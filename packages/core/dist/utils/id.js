/**
 * Cross-runtime id generation.
 *
 * `crypto.randomUUID()` is NOT reliably available in React Native (Hermes),
 * so we generate UUIDv4-compatible ids from Math.random instead. Good enough
 * for single-shop usage where collisions are astronomically unlikely.
 */
/**
 * Ids that arrive from forms are often `""` rather than `undefined` (an
 * unselected picker). Empty strings must become NULL — they are not valid
 * foreign keys and would fail the FK constraint instead of meaning "none".
 */
export function idOrNull(value) {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
}
export function newId(prefix = "") {
    const hex = "0123456789abcdef";
    let out = "";
    for (let i = 0; i < 32; i++)
        out += hex[Math.floor(Math.random() * 16)];
    const uuid = `${out.slice(0, 8)}-${out.slice(8, 12)}-4${out.slice(13, 16)}-${"89ab"[Math.floor(Math.random() * 4)]}${out.slice(17, 20)}-${out.slice(20)}`;
    return prefix ? `${prefix}_${uuid}` : uuid;
}
//# sourceMappingURL=id.js.map