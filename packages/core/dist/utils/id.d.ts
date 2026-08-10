/**
 * Cross-runtime id generation.
 *
 * `crypto.randomUUID()` is NOT reliably available in React Native (Hermes),
 * so we generate UUIDv4-compatible ids from Math.random instead. Good enough
 * for single-shop usage where collisions are astronomically unlikely.
 */
export declare function newId(prefix?: string): string;
//# sourceMappingURL=id.d.ts.map