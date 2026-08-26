//! Label-printer access — enumerate installed printers and send raw bytes
//! (TSPL2 command streams from @munim/core's `buildLabelTspl2`) straight to
//! the Windows print spooler. RAW datatype = the printer's own interpreter
//! renders the job, so TSC thermal printers (TE244 etc.) draw crisp native
//! barcodes with no driver rasterization and no print dialog.

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
    imp::print_raw(&printer_name, &data)
}

#[cfg(windows)]
mod imp {
    use std::ffi::c_void;
    use std::ptr::null_mut;

    use super::PrinterInfo;
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
            // Size query first, then the real enumeration (level 4 = name,
            // server, attributes — cheap and always available).
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
            Ok(printers)
        }
    }

    pub fn print_raw(printer_name: &str, data: &[u8]) -> Result<(), String> {
        unsafe {
            let name = wide(printer_name);
            let datatype = wide("RAW");
            let mut handle = PRINTER_HANDLE::default();
            // RAW datatype + DesiredAccess(0) = spooler passes our bytes
            // straight through to the device (no driver rendering).
            let defaults = PRINTER_DEFAULTSW {
                pDatatype: PWSTR(datatype.as_ptr() as *mut u16),
                pDevMode: null_mut(),
                DesiredAccess: PRINTER_ACCESS_RIGHTS(0),
            };
            OpenPrinterW(PCWSTR(name.as_ptr()), &mut handle, Some(&defaults))
                .map_err(|_| format!("Printer \"{printer_name}\" not found or inaccessible"))?;

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
            return Err(last_error("Could not start print job"));
        }

        let mut total = 0usize;
        let outcome = (|| -> Result<(), String> {
            StartPagePrinter(handle)
                .ok()
                .map_err(|_| last_error("Could not start page"))?;
            // WritePrinter may accept fewer bytes than requested — keep
            // pushing the remainder until the whole stream is spooled.
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
            EndPagePrinter(handle)
                .ok()
                .map_err(|_| last_error("Could not end page"))
        })();

        if let Err(err) = outcome {
            let _ = EndDocPrinter(handle);
            return Err(err);
        }
        if !EndDocPrinter(handle).as_bool() {
            return Err(last_error("Could not finish print job"));
        }
        Ok(())
    }
}

#[cfg(not(windows))]
mod imp {
    use super::PrinterInfo;

    pub fn list() -> Result<Vec<PrinterInfo>, String> {
        Err("Label printers are currently supported on Windows only".to_string())
    }

    pub fn print_raw(_printer_name: &str, _data: &[u8]) -> Result<(), String> {
        Err("Label printers are currently supported on Windows only".to_string())
    }
}
