use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

use serde::Serialize;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PrinterInfo {
    pub name: String,
    pub is_default: bool,
}

#[tauri::command]
pub fn list_printers() -> Result<Vec<PrinterInfo>, String> {
    imp::list()
}

#[tauri::command]
pub fn print_raw(printer_name: String, data: Vec<u8>) -> Result<(), String> {
    log_print_event("print_raw called", Some(&printer_name), Some(data.len()), None);
    log_tspl_stream("OUTGOING TSPL2 STREAM", &printer_name, &data);
    let result = imp::print_raw(&printer_name, &data);
    match &result {
        Ok(()) => log_print_event("print_raw succeeded", Some(&printer_name), None, None),
        Err(e) => log_print_event("print_raw FAILED", Some(&printer_name), None, Some(e.clone())),
    }
    result
}

/// Path to the print-debug log file inside the user's Downloads folder.
/// Created lazily; parent dir is ensured on every write.
fn log_file_path() -> PathBuf {
    let home = std::env::var("USERPROFILE")
        .or_else(|_| std::env::var("HOME"))
        .unwrap_or_else(|_| ".".to_string());
    PathBuf::from(home).join("Downloads").join("munim-print-debug.log")
}

fn timestamp() -> String {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    // Simple ISO-ish breakdown from epoch seconds (local time not needed for debug).
    let (year, month, day, hour, min, sec) = (
        1970 + now / 31_557_600,
        (now / 2_592_000) % 12 + 1,
        (now / 86_400) % 31 + 1,
        (now / 3600) % 24,
        (now / 60) % 60,
        now % 60,
    );
    format!("{year:04}-{month:02}-{day:02} {hour:02}:{min:02}:{sec:02}Z")
}

fn append_log(line: &str) {
    let path = log_file_path();
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    if let Ok(mut f) = OpenOptions::new().create(true).append(true).open(&path) {
        let _ = writeln!(f, "[{}] {}", timestamp(), line);
    }
}

fn log_print_event(event: &str, printer: Option<&str>, bytes: Option<usize>, error: Option<String>) {
    let mut parts = vec![format!("event={event}")];
    if let Some(p) = printer {
        parts.push(format!("printer=\"{p}\""));
    }
    if let Some(b) = bytes {
        parts.push(format!("bytes={b}"));
    }
    if let Some(e) = error {
        parts.push(format!("error=\"{e}\""));
    }
    append_log(&parts.join(" "));
}

/// Writes the full TSPL2 byte stream in a human-readable form
/// (escaped + line-by-line) to the debug log so the exact command stream
/// the printer received can be inspected after a misprint.
fn log_tspl_stream(label: &str, printer: &str, data: &[u8]) {
    append_log(&format!("--- {label} -> \"{printer}\" ({} bytes) ---", data.len()));
    let text = String::from_utf8_lossy(data);
    for raw_line in text.split('\n') {
        let line = raw_line.trim_end_matches('\r');
        if line.is_empty() {
            continue;
        }
        // Show control chars as escape codes so CR/LF/NUL are visible.
        let escaped: String = line
            .chars()
            .map(|c| match c {
                '\r' => "\\r".to_string(),
                '\n' => "\\n".to_string(),
                '\t' => "\\t".to_string(),
                '\0' => "\\0".to_string(),
                c if (c as u32) < 0x20 => format!("\\x{:02x}", c as u32),
                c => c.to_string(),
            })
            .collect();
        append_log(&format!("  | {escaped}"));
    }
    append_log("--- end stream ---");
}

#[cfg(windows)]
mod imp {
    use std::ffi::c_void;
    use std::ptr::null_mut;

    use super::{log_print_event, PrinterInfo};
    use windows::core::{PCWSTR, PWSTR};
    use windows::Win32::Foundation::GetLastError;
    use windows::Win32::Graphics::Printing::{
        ClosePrinter, EndDocPrinter, EndPagePrinter, EnumPrintersW, GetDefaultPrinterW,
        OpenPrinterW, StartDocPrinterW, StartPagePrinter, WritePrinter, DOC_INFO_1W,
        PRINTER_ACCESS_RIGHTS, PRINTER_DEFAULTSW, PRINTER_ENUM_CONNECTIONS, PRINTER_ENUM_LOCAL,
        PRINTER_HANDLE, PRINTER_INFO_4W,
    };

    /// Null-terminated UTF-16 for Win32 wide-string APIs.
    fn wide(s: &str) -> Vec<u16> {
        s.encode_utf16().chain(std::iter::once(0)).collect()
    }

    fn last_error(context: &str) -> String {
        format!("{context} (Win32 error {})", unsafe { GetLastError() }.0)
    }

    /// Name of the OS default printer, if one is set.
    fn default_printer() -> Option<String> {
        unsafe {
            let mut len = 0u32;
            if !GetDefaultPrinterW(None, &mut len).as_bool() || len == 0 {
                return None;
            }
            let mut buf = vec![0u16; len as usize];
            if !GetDefaultPrinterW(Some(PWSTR(buf.as_mut_ptr())), &mut len).as_bool() {
                return None;
            }
            PWSTR(buf.as_mut_ptr()).to_string().ok()
        }
    }

    pub fn list() -> Result<Vec<PrinterInfo>, String> {
        unsafe {
            let flags = PRINTER_ENUM_LOCAL | PRINTER_ENUM_CONNECTIONS;
            let mut needed = 0u32;
            let mut returned = 0u32;
            let _ = EnumPrintersW(flags, PCWSTR::null(), 4, None, &mut needed, &mut returned);
            if needed == 0 {
                return Ok(Vec::new());
            }

            let mut buf = vec![0u8; needed as usize];
            EnumPrintersW(
                flags,
                PCWSTR::null(),
                4,
                Some(&mut buf),
                &mut needed,
                &mut returned,
            )
            .map_err(|_| last_error("EnumPrinters failed"))?;

            let default_name = default_printer();

            let base = buf.as_ptr() as *const PRINTER_INFO_4W;
            let mut printers = Vec::with_capacity(returned as usize);
            for i in 0..returned as usize {
                let info = base.add(i).read_unaligned();
                let name = PWSTR(info.pPrinterName.0).to_string().unwrap_or_default();
                if name.is_empty() {
                    continue;
                }
                printers.push(PrinterInfo {
                    is_default: default_name.as_deref() == Some(name.as_str()),
                    name,
                });
            }
            printers.sort_by(|a, b| {
                b.is_default
                    .cmp(&a.is_default)
                    .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
            });
            log_print_event("list_printers called", None, None, None);
            log_print_event(
                "list_printers result",
                None,
                Some(printers.len()),
                None,
            );
            Ok(printers)
        }
    }

    pub fn print_raw(printer_name: &str, data: &[u8]) -> Result<(), String> {
        unsafe {
            let name = wide(printer_name);
            let datatype = wide("RAW");
            let mut handle = PRINTER_HANDLE::default();
            let defaults = PRINTER_DEFAULTSW {
                pDatatype: PWSTR(datatype.as_ptr() as *mut u16),
                pDevMode: null_mut(),
                DesiredAccess: PRINTER_ACCESS_RIGHTS(0),
            };
            match OpenPrinterW(PCWSTR(name.as_ptr()), &mut handle, Some(&defaults)) {
                Ok(()) => log_print_event("OpenPrinterW ok", Some(printer_name), None, None),
                Err(e) => {
                    let msg = format!("Printer \"{printer_name}\" not found or inaccessible: {e}");
                    log_print_event("OpenPrinterW FAILED", Some(printer_name), None, Some(msg.clone()));
                    return Err(msg);
                }
            }

            let result = write_job(handle, data);
            let _ = ClosePrinter(handle);
            result
        }
    }

    unsafe fn write_job(handle: PRINTER_HANDLE, data: &[u8]) -> Result<(), String> {
        let doc_name = wide("Munim label");
        let datatype = wide("RAW");
        let doc = DOC_INFO_1W {
            pDocName: PWSTR(doc_name.as_ptr() as *mut u16),
            pOutputFile: PWSTR::null(),
            pDatatype: PWSTR(datatype.as_ptr() as *mut u16),
        };
        if StartDocPrinterW(handle, 1, &doc) == 0 {
            let e = last_error("Could not start print job");
            log_print_event("StartDocPrinterW FAILED", None, None, Some(e.clone()));
            return Err(e);
        }
        log_print_event("StartDocPrinterW ok", None, None, None);

        let mut total = 0usize;
        let outcome = (|| -> Result<(), String> {
            StartPagePrinter(handle)
                .ok()
                .map_err(|_| last_error("Could not start page"))?;
            log_print_event("StartPagePrinter ok", None, None, None);
            while total < data.len() {
                let mut written = 0u32;
                WritePrinter(
                    handle,
                    data.as_ptr().add(total) as *const c_void,
                    (data.len() - total) as u32,
                    &mut written,
                )
                .ok()
                .map_err(|_| last_error("Could not write to printer"))?;
                if written == 0 {
                    return Err("Print job stalled".to_string());
                }
                total += written as usize;
            }
            log_print_event(
                "WritePrinter ok (full stream spooled)",
                None,
                Some(total),
                None,
            );
            EndPagePrinter(handle)
                .ok()
                .map_err(|_| last_error("Could not end page"))
        })();

        if let Err(err) = outcome {
            let _ = EndDocPrinter(handle);
            log_print_event("EndDocPrinter (after error)", None, None, Some(err.clone()));
            return Err(err);
        }
        if !EndDocPrinter(handle).as_bool() {
            let e = last_error("Could not finish print job");
            log_print_event("EndDocPrinter FAILED", None, None, Some(e.clone()));
            return Err(e);
        }
        log_print_event("EndDocPrinter ok", None, None, None);
        Ok(())
    }
}

#[cfg(not(windows))]
mod imp {
    use super::{log_print_event, PrinterInfo};

    pub fn list() -> Result<Vec<PrinterInfo>, String> {
        log_print_event("list_printers called (non-Windows stub)", None, None, None);
        Err("Label printers are currently supported on Windows only".to_string())
    }

    pub fn print_raw(_printer_name: &str, _data: &[u8]) -> Result<(), String> {
        let msg = "Label printers are currently supported on Windows only".to_string();
        log_print_event("print_raw (non-Windows stub)", Some(_printer_name), Some(_data.len()), Some(msg.clone()));
        Err(msg)
    }
}
