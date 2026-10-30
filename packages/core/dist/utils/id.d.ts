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
export declare function idOrNull(value?: string | null): string | null;
export declare function newId(prefix?: string): string;
//# sourceMappingURL=id.d.ts.map