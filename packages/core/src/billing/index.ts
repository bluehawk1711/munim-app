export {
  buildBillDocument,
  renderBillText,
  renderBillHtml,
  DEFAULT_BILL_TEMPLATE_SETTINGS,
  mergeBillTemplateSettings,
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
  buildSilverPriceLine,
  formatLabelLabour,
  renderLabelMarkup,
  renderLabelSheetHtml,
  renderLabelText,
  LABEL_WIDTH_MM,
  LABEL_HEIGHT_MM,
  type ProductLabel,
  type LabelShop,
  type LabelSheetOptions,
  type SilverPriceLineOptions,
} from "./labelDocument.js";

export {
  buildLabelTspl2,
  type LabelPrinterInfo,
  type LabelSizeSettings,
  type LabelPrintSettings,
  type TsplLabelOptions,
  DEFAULT_LABEL_PRINT_SETTINGS,
  LABEL_WIDTH_MM as THERMAL_LABEL_WIDTH_MM,
  LABEL_HEIGHT_MM as THERMAL_LABEL_HEIGHT_MM,
} from "./labelTspl.js";
