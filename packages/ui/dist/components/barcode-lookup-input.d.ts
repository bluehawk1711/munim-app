/**
 * BarcodeLookupInput — shared web + desktop quick-lookup field for the shop
 * counter. Most USB barcode scanners act like a keyboard: they type the code
 * into the focused input and send Enter. This input focuses that workflow:
 *   - type/scan a code, press Enter → onLookup(code)
 *   - resolves → success flash + clear; rejects → error flash
 *
 * Callers own the actual lookup (they know their db client) and the success
 * action (e.g. open the product). Purely presentational beyond that.
 */
import * as React from "react";
export declare function BarcodeLookupInput({ onLookup, placeholder, className, autoFocus, clearOnSuccess, }: {
    /** Must resolve on a hit and throw on a miss (message shown as feedback). */
    onLookup: (code: string) => Promise<unknown>;
    placeholder?: string;
    className?: string;
    autoFocus?: boolean;
    clearOnSuccess?: boolean;
}): React.JSX.Element;
//# sourceMappingURL=barcode-lookup-input.d.ts.map