export {
  buildBillDocument,
  renderBillText,
  renderBillHtml,
  type BillDocument,
  type BillLine,
  type BillLineInput,
  type BillShopDetails,
  type BillStatus,
  type BuildBillInput,
  type BillTemplate,
  type BillClassicColor,
  type BillMode,
  type BillTemplateSettings,
} from "./billDocument.js";

export {
  generateBillPDF,
} from "./generateBillPdf.js";

export {
  defaultJobLetterData,
  formatJoiningDate,
  jobLetterFromStored,
  renderJobLetterHtml,
  type JobLetterCompanyFallback,
  type JobLetterData,
  type JobLetterRowLike,
} from "./jobLetterDocument.js";

export {
  buildProductLabel,
  renderLabelMarkup,
  renderLabelSheetHtml,
  renderLabelText,
  LABEL_WIDTH_MM,
  LABEL_HEIGHT_MM,
  type ProductLabel,
  type LabelShop,
  type LabelSheetOptions,
} from "./labelDocument.js";

export {
  buildLabelTspl2,
  type LabelPrinterInfo,
  type LabelSizeSettings,
  type LabelPrintSettings,
  type TsplLabelOptions,
  DEFAULT_LABEL_PRINT_SETTINGS,
} from "./labelTspl.js";
