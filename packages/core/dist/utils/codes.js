// Generates unique SKUs and invoice numbers without hard-coding a DB driver.
// The caller passes an `exists` predicate so the same logic runs in every app.
function randomCode(length) {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let out = "";
    for (let i = 0; i < length; i++) {
        out += chars[Math.floor(Math.random() * chars.length)];
    }
    return out;
}
/** Format: PRD-XXXXXX */
export async function generateSku(exists) {
    for (let attempt = 0; attempt < 10; attempt++) {
        const code = `PRD-${randomCode(6)}`;
        if (!(await exists(code)))
            return code;
    }
    return `PRD-${randomCode(4)}${Date.now().toString(36).slice(-4).toUpperCase()}`;
}
/** Format: INV-YYYYMMDD-XXXX */
export async function generateInvoiceNumber(exists) {
    const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    for (let attempt = 0; attempt < 10; attempt++) {
        const seq = Math.floor(1000 + Math.random() * 9000).toString();
        const invoice = `INV-${datePart}-${seq}`;
        if (!(await exists(invoice)))
            return invoice;
    }
    return `INV-${datePart}-${Date.now().toString().slice(-6)}`;
}
//# sourceMappingURL=codes.js.map