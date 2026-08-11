// Bill/invoice types are NOT defined here anymore — the web app builds and
// renders the shared `BillDocument` from @munim/core (see generatePDF.ts).
// Job letters are also shared now: the typed form model lives in @munim/core
// (`JobLetterData` + `defaultJobLetterData`), so desktop/mobile render the
// same letter. This file only re-exports for back-compat with old imports.

import { defaultJobLetterData, type JobLetterData } from "@munim/core";

export { defaultJobLetterData, type JobLetterData } from "@munim/core";

/** Back-compat alias used by older imports. */
export const defaultFormData: JobLetterData = defaultJobLetterData;
