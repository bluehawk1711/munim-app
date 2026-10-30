import React, {useMemo, useState} from 'react';
import {Alert, FlatList, KeyboardAvoidingView, ListRenderItemInfo, Platform, Pressable, ScrollView, Share, StyleProp, Switch, Text, TextInput, View, ViewStyle} from 'react-native';
import * as Print from 'expo-print';
import {ChevronDown, Search} from 'lucide-react-native';
import {
  applyGoldBaseRate,
  buildBillDocument,
  calcNetWeight,
  CUSTOM_PAYMENT_METHOD,
  firstGoldKarat,
  GOLD_ESTIMATE_COLUMNS,
  PAYMENT_METHOD_PRESETS,
  invoicePricingFromBreakdown,
  isLabourType,
  priceBillLineRow,
  productMatchesCode,
  purityOptionsFor,
  renderBillText,
  renderBillHtml,
  resolveGoldRateTable,
  SILVER_ESTIMATE_COLUMNS,
  formatDate,
  swatchColor,
  weightTextToGrams,
  type BillDocument,
  type BillTemplate,
  type BillClassicColor,
  type BillMode,
  type BillTemplateSettings,
  type BillLinePricingOverrides,
  type EstimateColumnId,
  type GoldRateKaratMode,
  type LabourType,
  type PartyDto,
  type InvoiceDto,
  type PriceBreakdown,
  type PricingContext,
  type ProductDto,
} from '@munim/core';
import {
  useApiClient,
  useCreateInvoice,
  useGoldRates,
  useInvoice,
  useParties,
  useProducts,
  useAllProducts,
  useQueryState,
  useSettings,
  useSyncProductPrices,
  useUpdateInvoice,
} from '@munim/query';
import {money} from '../lib/format';
import {copyText} from '../lib/clipboard';
import {savePdf} from '../lib/save-pdf';
import {successFeedback, errorFeedback, selectionTick} from '../lib/haptics';
import {
  Badge,
  Button,
  Card,
  Empty,
  Field,
  ModalSheet,
  Screen,
  colors,
} from '../components/ui';
import {HomeHeader, headerScrollHandlers} from '../components/home-header';
import {BarcodeScannerModal} from '../components/BarcodeScannerModal';
import {DateField, toYmd} from '../components/date-field';
import {useThemeStyles} from '../theme';
import {useNavStore} from '../lib/nav-store';
import {rs, spacing, typography, radii} from '../lib/responsive';
import {StyleSheet as RNStyleSheet} from 'react-native';

type LineState = {
  productId: string;
  productName: string;
  sku: string;
  color: string;
  size: string;
  /** Optional line note printed under the item name. */
  description: string;
  weight: string;
  weightUnit: 'gm' | 'mg';
  /** True once the shop edits this line's Weight — the edited weight then
   *  drives auto-pricing (and survives later rate reprices). */
  weightEdited: boolean;
  /** Metal purity stamp ("22K") — the estimate's Remark column (dropdown). */
  purity: string;
  /** Gross-weight free text — bill G. Wt. column. */
  grossWeight: string;
  /** Bill line's nag-less weight in GRAMS — gold net-weight derivation input
   *  (net = gross − nag + chejat) + printed Nag Wt. column. */
  nagLessWeight: string;
  /** Bill line's chejat (stone) weight in GRAMS — the other derivation input
   *  + printed Chejat Wt. column. */
  chejatWeight: string;
  quantity: string;
  price: string;
  silverPercentage: string;
  /** Per-line pricing edits (the auto-pricing strip: Rate/Labour/Nag/Povayi/
   *  Other) — empty = keep the product's / bill's default. */
  ratePerGram: string;
  /** True once the shop edits this line's rate — it then sticks (stops
   *  tracking the bill's gold/silver rate). */
  rateEdited: boolean;
  labourType: string;
  labourValue: string;
  nag: string;
  povayi: string;
  otherCharges: string;
};

/** The editable pricing fields on a line (strip patch shape). */
type PricingStripFields = Pick<
  LineState,
  'ratePerGram' | 'labourType' | 'labourValue' | 'nag' | 'povayi' | 'otherCharges' | 'silverPercentage'
>;

const emptyLine = (): LineState => ({
  productId: '',
  productName: '',
  sku: '',
  color: '',
  size: '',
  description: '',
  weight: '',
  weightUnit: 'gm',
  weightEdited: false,
  purity: '',
  grossWeight: '',
  nagLessWeight: '',
  chejatWeight: '',
  quantity: '1',
  price: '0',
  silverPercentage: '100',
  ratePerGram: '',
  rateEdited: false,
  labourType: '',
  labourValue: '',
  nag: '',
  povayi: '',
  otherCharges: '',
});

/** EDIT MODE — a stored invoice row back into the editor's line state.
 *
 *  The exact inverse of `collectItems()`. Two details matter:
 *   • The frozen pricing snapshot becomes the strip's EXPLICIT values and the
 *     line is marked `rateEdited`, so a rate/labour frozen on the original
 *     bill STICKS instead of silently re-tracking the live bill rate.
 *   • `weightEdited` is set, so the saved weight keeps driving auto-pricing
 *     for silver lines rather than being replaced by the product's current one.
 *
 *  Gold lines store the DERIVED NET weight in `weight` (what priced them) plus
 *  their nag/chejat inputs — both come back here, so the net round-trips. */
const invoiceToLine = (it: InvoiceDto['items'][number]): LineState => {
  const p = it.pricing;
  const frozenRate = p?.ratePerGram != null;
  return {
    productId: it.productId ?? '',
    productName: it.productName,
    sku: it.sku ?? '',
    color: it.color ?? '',
    size: it.size ?? '',
    description: it.description ?? '',
    weight: it.weight != null ? String(it.weight) : '',
    weightUnit: it.weightUnit === 'mg' ? 'mg' : 'gm',
    weightEdited: true,
    purity: it.purity ?? '',
    grossWeight: it.grossWeight ?? '',
    nagLessWeight: it.nagLessWeight != null ? String(it.nagLessWeight) : '',
    chejatWeight: it.chejatWeight != null ? String(it.chejatWeight) : '',
    quantity: String(it.quantity),
    price: String(it.price),
    silverPercentage: p?.silverPercentage != null ? String(p.silverPercentage) : '100',
    ratePerGram: frozenRate ? String(p?.ratePerGram) : '',
    rateEdited: frozenRate,
    labourType: p?.labourType ?? '',
    labourValue: p?.labourValue != null ? String(p.labourValue) : '',
    nag: p?.nag != null ? String(p.nag) : '',
    povayi: p?.povayi != null ? String(p.povayi) : '',
    otherCharges: p?.other != null ? String(p.other) : '',
  };
};

/** Parses a raw ₹/rate input — "" → null (keep the product's default). */
const parseLineNum = (raw: string): number | null => {
  const t = raw.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

/** Grams → the line field's string form ("" when the product has no value). */
const gramsField = (grams: number | null): string => (grams == null ? '' : String(grams));

/** Gold price basis from the line's OWN derivation inputs — NET grams via the
 *  shared `calcNetWeight` (net = gross − nag + chejat; the line's nag/chejat
 *  fields are grams). Null when gross isn't usable (or nets ≤ 0) → the caller
 *  falls back to an edited Weight, else the product's own basis. */
const goldNetGrams = (line: LineState): number | null => {
  const net = calcNetWeight({
    grossWeight: line.grossWeight,
    nagLessWeight: line.nagLessWeight,
    chejatWeight: line.chejatWeight,
    weightUnit: line.weightUnit,
    nagUnit: 'gm',
  });
  return net && net.grams > 0 ? net.grams : null;
};

/** The line's strip edits layered onto the pricing engine (null/undefined
 *  fields keep the product's own inputs — the engine still does the math). */
const overridesFrom = (line: LineState): BillLinePricingOverrides => ({
  ratePerGram: parseLineNum(line.ratePerGram),
  labourType: isLabourType(line.labourType) ? line.labourType : null,
  labourValue: parseLineNum(line.labourValue),
  nag: parseLineNum(line.nag),
  povayi: parseLineNum(line.povayi),
  otherCharges: parseLineNum(line.otherCharges),
  silverPercentage: parseLineNum(line.silverPercentage),
});

/** Labour method segments for the strip (same three methods as core). */
const LABOUR_SEGMENTS: {type: LabourType; label: string}[] = [
  {type: 'PERCENT', label: '%'},
  {type: 'FIXED', label: '₹'},
  {type: 'PER_GRAM', label: '₹/g'},
];

const TYPE_LABELS: Record<string, string> = {
  CUSTOMER: 'Customer',
  SUPPLIER: 'Supplier',
  WORKER: 'Worker',
  OTHER: 'Other',
};

/** Catalog search sheet — shared by the per-line picker and the top-level
 *  "Add from stock" button so both browse the SAME server-side search. */
function ProductPickerSheet({
  visible,
  onClose,
  products,
  selectedId,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  products: ProductDto[] | null | undefined;
  selectedId?: string;
  onSelect: (id: string, product?: ProductDto) => void;
}) {
  const styles = useThemeStyles(makeStyles);
  const [query, setQuery] = useState('');
  // Server-side search reaches the WHOLE catalog — the browse list passed in
  // from the screen is capped at 500 rows. The local name/SKU filter is the
  // instant fallback while the search page loads.
  const search = query.trim();
  const {data: searchPage} = useProducts({search, pageSize: 50}, {enabled: visible && search.length > 0});
  const filtered = useMemo(() => {
    if (!search) return products ?? [];
    if (searchPage?.products) return searchPage.products;
    const q = search.toLowerCase();
    return (products ?? []).filter(
      p => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q),
    );
  }, [products, search, searchPage]);
  return (
    <ModalSheet visible={visible} title="Select product" onClose={onClose} centered scrollable>
      <View style={styles.searchWrap}>
        <Search size={rs(16)} color={colors.muted} />
        <TextInput
          style={[styles.searchInput, {flex: 1}]}
          value={query}
          onChangeText={setQuery}
          placeholder="Search products…"
          placeholderTextColor={colors.inputPlaceholder}
          autoCapitalize="none"
        />
      </View>
      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        style={{maxHeight: 340}}
        ListEmptyComponent={<Empty text="No products found" />}
        renderItem={({item}: ListRenderItemInfo<ProductDto>) => {
          const out = item.stock <= 0;
          return (
            <Pressable
              disabled={out}
              onPress={() => {
                selectionTick();
                onSelect(item.id, item);
                onClose();
                setQuery('');
              }}
              style={({pressed}) => [
                styles.pickRow,
                selectedId === item.id && {backgroundColor: colors.mutedBg},
                pressed && {backgroundColor: colors.mutedBg},
                out && {opacity: 0.5},
              ]}>
              <View style={{flex: 1}}>
                <Text style={{flex: 1, fontSize: 15, color: colors.text, fontWeight: '600'}} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={{fontSize: 12, color: out ? colors.danger : colors.muted}}>
                  {item.sku}{out ? ' · Out of stock' : ''}
                </Text>
              </View>
              <Text style={{fontSize: 14, color: colors.text, fontWeight: '700', marginLeft: spacing.sm}}>
                ₹{Number(item.effectivePrice).toFixed(0)}
              </Text>
            </Pressable>
          );
        }}
      />
    </ModalSheet>
  );
}

/** Product picker — select a product from the catalog to add to a bill line. */
function ProductPicker({
  products,
  productId,
  onSelect,
}: {
  products: ProductDto[] | null | undefined;
  productId: string;
  onSelect: (id: string, product?: ProductDto) => void;
}) {
  const styles = useThemeStyles(makeStyles);
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={({pressed}) => [styles.productPicker, pressed && {opacity: 0.7}]}>
        <View style={{flex: 1}}>
          <Text style={styles.pickerLabel}>Product</Text>
          <Text style={styles.pickerValue} numberOfLines={1}>
            {productId
              ? products?.find(p => p.id === productId)?.name ?? ''
              : 'Select product (optional)'}
          </Text>
        </View>
        <ChevronDown size={18} color={colors.muted} />
      </Pressable>
      <ProductPickerSheet
        visible={open}
        onClose={() => setOpen(false)}
        products={products}
        selectedId={productId}
        onSelect={onSelect}
      />
    </>
  );
}

/** Top-level "Add from stock" — the mobile twin of web/desktop's picker
 *  above the item table (fills the first empty line, else appends). */
function AddFromStockButton({
  products,
  onSelect,
}: {
  products: ProductDto[] | null | undefined;
  onSelect: (id: string, product?: ProductDto) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        title="+ Add from stock (auto-fills price)"
        variant="outline"
        onPress={() => setOpen(true)}
        style={{marginBottom: 8}}
      />
      <ProductPickerSheet
        visible={open}
        onClose={() => setOpen(false)}
        products={products}
        onSelect={onSelect}
      />
    </>
  );
}

/** Fast entry — USB-scanner/typed SKU or the camera. `onAdd` resolves to an
 *  error message (null = added), so ONE control serves Bill 1 and Bill 2. */
function FastEntry({
  title = 'Fast entry — scan barcode or type SKU',
  onAdd,
}: {
  title?: string;
  onAdd: (raw: string) => Promise<string | null>;
}) {
  const styles = useThemeStyles(makeStyles);
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');
  const [scanOpen, setScanOpen] = useState(false);
  async function submit(raw: string): Promise<string | null> {
    const err = await onAdd(raw);
    setMessage(err ?? '');
    if (!err) setCode('');
    return err;
  }
  return (
    <>
      <View>
        <Text style={styles.optLabel}>{title}</Text>
        <View style={styles.searchWrap}>
          <TextInput
            style={[styles.searchInput, {flex: 1}]}
            value={code}
            onChangeText={setCode}
            placeholder="Scan barcode or type SKU…"
            placeholderTextColor={colors.inputPlaceholder}
            autoCapitalize="characters"
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={() => void submit(code)}
          />
          <Button title="Add" variant="outline" onPress={() => void submit(code)} />
        </View>
        <Button
          title="Scan barcode to add"
          variant="outline"
          onPress={() => {
            setMessage('');
            setScanOpen(true);
          }}
        />
        {message ? <Text style={styles.scanMessage}>{message}</Text> : null}
      </View>
      <BarcodeScannerModal
        visible={scanOpen}
        onClose={() => setScanOpen(false)}
        onDetected={detected => {
          void submit(detected).then(err => {
            if (!err) setScanOpen(false);
          });
        }}
        message={message}
        title="Scan a product for this bill"
      />
    </>
  );
}

/** "Link to khata party" picker — same behaviour as web: selecting a party
 * pre-fills the customer name/phone/address; "None (walk-in)" clears it. */
function PartyPicker({
  parties,
  partyId,
  selected,
  onChange,
}: {
  parties: PartyDto[] | null | undefined;
  partyId: string;
  selected: string;
  onChange: (id: string, party?: PartyDto) => void;
}) {
  const styles = useThemeStyles(makeStyles);
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={({pressed}) => [styles.partyPicker, pressed && {opacity: 0.7}]}>
        <View style={{flex: 1}}>
          <Text style={styles.pickerLabel}>Link to khata party</Text>
          <Text style={styles.pickerValue}>{selected || 'None (walk-in)'}</Text>
        </View>
        <ChevronDown size={18} color={colors.muted} />
      </Pressable>
      <ModalSheet visible={open} title="Select party" onClose={() => setOpen(false)} centered scrollable>
        <FlatList
          data={parties ?? []}
          keyExtractor={item => item.id}
          style={{maxHeight: 340}}
          ListHeaderComponent={
            <Pressable
              onPress={() => {
                selectionTick();
                onChange('');
                setOpen(false);
              }}
              style={({pressed}) => [
                styles.pickRow,
                partyId === '' && {backgroundColor: colors.mutedBg},
                pressed && {backgroundColor: colors.mutedBg},
              ]}>
              <Text style={{flex: 1, fontSize: 15, color: colors.text, fontWeight: '600'}}>
                None (walk-in)
              </Text>
            </Pressable>
          }
          ListEmptyComponent={<Empty text="No parties yet — add one from the Khata tab first" />}
          renderItem={({item}: ListRenderItemInfo<PartyDto>) => (
            <Pressable
              onPress={() => {
                selectionTick();
                onChange(item.id, item);
                setOpen(false);
              }}
              style={({pressed}) => [
                styles.pickRow,
                partyId === item.id && {backgroundColor: colors.mutedBg},
                pressed && {backgroundColor: colors.mutedBg},
              ]}>
              <Text style={{flex: 1, fontSize: 15, color: colors.text, fontWeight: '600'}}>
                {item.name}
              </Text>
              <Text style={{fontSize: 12, color: colors.muted}}>
                {TYPE_LABELS[item.type] ?? item.type.toLowerCase()}
              </Text>
            </Pressable>
          )}
        />
      </ModalSheet>
    </>
  );
}

/** Remark dropdown for a bill line — the estimate's printed Remark column.
 *  (Renamed from "Purity" per the client; the value is still the metal
 *  purity stamp, options come from core's shared presets — `purityOptionsFor`
 *  keeps the line's current off-list stamp in the list too). */
function PurityPicker({
  value,
  onChange,
  style,
}: {
  value: string;
  onChange: (v: string) => void;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useThemeStyles(makeStyles);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  return (
    <>
      <Pressable
        onPress={() => {
          setDraft(value);
          setOpen(true);
        }}
        style={({pressed}) => [styles.partyPicker, style, pressed && {opacity: 0.7}]}
        accessibilityRole="button"
        accessibilityLabel={`Remark ${value || 'not set'}`}>
        <View style={{flex: 1}}>
          <Text style={styles.pickerLabel}>Remark</Text>
          <Text style={styles.pickerValue}>{value || '—'}</Text>
        </View>
        <ChevronDown size={18} color={colors.muted} />
      </Pressable>
      <ModalSheet visible={open} title="Remark" onClose={() => setOpen(false)} centered scrollable>
        {/* Free text stays allowed (products carry arbitrary stamps) — the
            presets below are suggestions, same as web/desktop. */}
        <View style={styles.searchWrap}>
          <TextInput
            style={[styles.searchInput, {flex: 1}]}
            value={draft}
            onChangeText={setDraft}
            placeholder="Type a stamp, e.g. 22K"
            placeholderTextColor={colors.inputPlaceholder}
            autoCapitalize="characters"
            maxLength={24}
            accessibilityLabel="Custom remark"
          />
        </View>
        <View style={{flexDirection: 'row', gap: 8, marginBottom: 8}}>
          <Button
            title="Use"
            style={{flex: 1}}
            onPress={() => {
              selectionTick();
              onChange(draft.trim());
              setOpen(false);
            }}
          />
          <Button
            title="No remark"
            variant="outline"
            style={{flex: 1}}
            onPress={() => {
              selectionTick();
              onChange('');
              setOpen(false);
            }}
          />
        </View>
        <FlatList
          data={purityOptionsFor(value)}
          keyExtractor={item => item}
          style={{maxHeight: 300}}
          renderItem={({item}) => (
            <Pressable
              onPress={() => {
                selectionTick();
                onChange(item);
                setOpen(false);
              }}
              style={({pressed}) => [
                styles.pickRow,
                item === value && {backgroundColor: colors.mutedBg},
                pressed && {backgroundColor: colors.mutedBg},
              ]}>
              <Text style={{flex: 1, fontSize: 15, color: colors.text, fontWeight: '600'}}>{item}</Text>
            </Pressable>
          )}
        />
      </ModalSheet>
    </>
  );
}

/** Line-item editor shared by bill 1 and the 2-in-1 Separate bill 2. */
function LineItemsEditor({
  lines,
  onChange,
  onWeightChange,
  onBasisChange,
  onPricingChange,
  pricing,
  onRemove,
  onAdd,
  products,
  onSelectProduct,
}: {
  lines: LineState[];
  onChange: (index: number, patch: Partial<LineState>) => void;
  /** Weight edits re-price the line (core engine) — passed down from the screen. */
  onWeightChange?: (index: number, weight: string) => void;
  /** Weight-basis edits (gold G. Wt. / Nag / Chejat) — re-price the line. */
  onBasisChange?: (index: number, patch: Partial<LineState>) => void;
  /** Pricing-strip edits (Rate/Labour/Nag/Povayi/Other/Silver %) — re-price the line. */
  onPricingChange?: (index: number, patch: Partial<PricingStripFields>) => void;
  /** Live pricing view per line (metal + breakdown) — null → no strip. */
  pricing?: (index: number) => {metal: 'Gold' | 'Silver'; breakdown: PriceBreakdown} | null;
  onRemove: (index: number) => void;
  onAdd: () => void;
  products: ProductDto[] | null | undefined;
  onSelectProduct: (lineIndex: number, productId: string, product?: ProductDto) => void;
}) {
  const styles = useThemeStyles(makeStyles);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(0);
  return (
    <>
      {lines.map((line, index) => {
        const pricingView = pricing?.(index) ?? null;
        const labourType: LabourType = isLabourType(line.labourType)
          ? line.labourType
          : (pricingView?.breakdown.labour.type ?? 'PERCENT');
        const otherChargesTotal = pricingView
          ? pricingView.breakdown.charges.nag +
            pricingView.breakdown.charges.povayi +
            pricingView.breakdown.charges.other
          : 0;
        const isGold = line.productId
          ? products?.find(p => p.id === line.productId)?.type === 'Gold'
          : false;
        // Gold's price basis (net wt) shown read-only — the derived grams, or
        // the weight the engine actually priced when a breakdown exists.
        const goldNet = isGold ? pricingView?.breakdown.weightGm ?? goldNetGrams(line) : null;
        /** Basis edits (G. Wt. / Nag / Chejat) re-price via the screen. */
        const basis = (patch: Partial<LineState>) =>
          onBasisChange ? onBasisChange(index, patch) : onChange(index, patch);
        const isOpen = expandedIndex === index;
        const lineTotal = (Number(line.quantity) || 0) * (Number(line.price) || 0);
        const summaryName = `${line.productName || 'New item'}${line.purity.trim() ? ` p:${line.purity.trim()}` : ''}`;
        return (
          <View key={index} style={styles.lineBox}>
            {/* Collapsed summary — tap to expand the inputs (Weight/Price/Remark…). */}
            <Pressable onPress={() => setExpandedIndex(isOpen ? null : index)}>
              <View style={styles.lineSummary}>
                <Text style={styles.lineSummaryName} numberOfLines={1}>
                  {summaryName}
                </Text>
                <Text style={styles.lineSummaryMeta}>{`${line.quantity || '0'} × ${money(Number(line.price) || 0)}`}</Text>
                <Text style={styles.lineSummaryTotal}>{money(lineTotal)}</Text>
                <ChevronDown
                  size={16}
                  color={colors.muted}
                  style={{transform: [{rotate: isOpen ? '180deg' : '0deg'}]}}
                />
              </View>
            </Pressable>
            {isOpen ? (
              <>
                <ProductPicker
                  products={products}
                  productId={line.productId}
                  onSelect={(id, product) => onSelectProduct(index, id, product)}
                />
                {line.sku ? (
                  <View style={styles.skuRow}>
                    <Text style={styles.skuChip}>{line.sku}</Text>
                    <Pressable
                      accessibilityLabel="Copy SKU"
                      hitSlop={8}
                      onPress={() => {
                        void copyText(line.sku).then(ok => ok && successFeedback());
                      }}
                    >
                      <Text style={styles.skuCopy}>Copy</Text>
                    </Pressable>
                  </View>
                ) : null}
                <Field
                  label="Item name"
                  value={line.productName}
                  onChangeText={text => onChange(index, {productName: text})}
                  placeholder="Or type manually"
                />
                <Field
                  label="Description (optional)"
                  value={line.description}
                  onChangeText={text => onChange(index, {description: text})}
                  maxLength={200}
                />
                <View style={styles.lineRow}>
                  <Field
                    label="Qty"
                    value={line.quantity}
                    onChangeText={text => onChange(index, {quantity: text})}
                    keyboardType="decimal-pad"
                    style={{flex: 1, marginRight: 8}}
                  />
                  <Field
                    label="Price"
                    value={line.price}
                    onChangeText={text => onChange(index, {price: text})}
                    keyboardType="decimal-pad"
                    style={{flex: 2}}
                  />
                </View>
                {!isGold ? (
                  <View style={styles.lineRow}>
                    <Field
                      label="Weight"
                      value={line.weight}
                      onChangeText={text =>
                        onWeightChange ? onWeightChange(index, text) : onChange(index, {weight: text})
                      }
                      keyboardType="decimal-pad"
                      style={{flex: 1, marginRight: 8}}
                      placeholder="0.000"
                    />
                    <PurityPicker value={line.purity} onChange={v => onChange(index, {purity: v})} style={{flex: 1}} />
                  </View>
                ) : (
                  <View style={styles.lineRow}>
                    <Field
                      label="G. Wt."
                      value={line.grossWeight}
                      onChangeText={text => basis({grossWeight: text})}
                      keyboardType="decimal-pad"
                      style={{flex: 1, marginRight: 8}}
                      placeholder="19.12"
                    />
                    <PurityPicker value={line.purity} onChange={v => onChange(index, {purity: v})} style={{flex: 1}} />
                  </View>
                )}
                <View style={styles.lineRow}>
                  {isGold ? (
                    <>
                      <Field
                        label="Nag Wt."
                        value={line.nagLessWeight}
                        onChangeText={text => basis({nagLessWeight: text})}
                        keyboardType="decimal-pad"
                        style={{flex: 1, marginRight: 8}}
                        placeholder="0.000"
                      />
                      <Field
                        label="Chejat Wt."
                        value={line.chejatWeight}
                        onChangeText={text => basis({chejatWeight: text})}
                        keyboardType="decimal-pad"
                        style={{flex: 1}}
                        placeholder="0.000"
                      />
                    </>
                  ) : (
                    <>
                      <Field
                        label="G. Wt."
                        value={line.grossWeight}
                        onChangeText={text => basis({grossWeight: text})}
                        keyboardType="decimal-pad"
                        style={{flex: 1, marginRight: 8}}
                        placeholder="19.12"
                      />
                      <View style={{flex: 1}} />
                    </>
                  )}
                </View>
                {isGold ? (
                  <Field
                    label="Net wt (derived)"
                    value={goldNet != null ? goldNet.toFixed(3) : ''}
                    editable={false}
                    style={{width: '48%'}}
                    placeholder="0.000"
                  />
                ) : null}
                {pricingView ? (
                  <View style={styles.pricingStrip}>
                    <View style={styles.lineRow}>
                      <Field
                        label="Rate ₹/g"
                        value={line.ratePerGram}
                        onChangeText={text => onPricingChange?.(index, {ratePerGram: text})}
                        keyboardType="decimal-pad"
                        style={{flex: 1, marginRight: 8}}
                        placeholder={
                          pricingView.breakdown.source === 'auto' ? String(pricingView.breakdown.ratePerGram) : '0'
                        }
                      />
                      {pricingView.metal === 'Silver' ? (
                        <Field
                          label="Silver %"
                          value={line.silverPercentage}
                          onChangeText={text => onPricingChange?.(index, {silverPercentage: text})}
                          keyboardType="decimal-pad"
                          style={{flex: 1}}
                        />
                      ) : (
                        <View style={{flex: 1}} />
                      )}
                    </View>
                    <View style={styles.lineRow}>
                      <View style={{flex: 1, marginRight: 8}}>
                        <Text style={styles.pricingLabel}>Labour</Text>
                        <View style={styles.labourSegRow}>
                          {LABOUR_SEGMENTS.map(seg => (
                            <Pressable
                              key={seg.type}
                              onPress={() => onPricingChange?.(index, {labourType: seg.type})}
                              style={[styles.labourSegBtn, labourType === seg.type && styles.labourSegBtnActive]}>
                              <Text
                                style={[
                                  styles.labourSegText,
                                  labourType === seg.type && styles.labourSegTextActive,
                                ]}>
                                {seg.label}
                              </Text>
                            </Pressable>
                          ))}
                        </View>
                      </View>
                      <Field
                        label="Value"
                        value={line.labourValue}
                        onChangeText={text => onPricingChange?.(index, {labourValue: text})}
                        keyboardType="decimal-pad"
                        style={{flex: 1}}
                        placeholder={
                          line.labourValue === '' &&
                          pricingView.breakdown.source === 'auto' &&
                          pricingView.breakdown.labour.value > 0
                            ? String(pricingView.breakdown.labour.value)
                            : '0'
                        }
                      />
                    </View>
                    <View style={styles.lineRow}>
                      {pricingView.metal === 'Gold' ? (
                        <Field
                          label="Nag ₹"
                          value={line.nag}
                          onChangeText={text => onPricingChange?.(index, {nag: text})}
                          keyboardType="decimal-pad"
                          style={{flex: 1, marginRight: 8}}
                        />
                      ) : null}
                      <Field
                        label="Povayi ₹"
                        value={line.povayi}
                        onChangeText={text => onPricingChange?.(index, {povayi: text})}
                        keyboardType="decimal-pad"
                        style={{flex: pricingView.metal === 'Gold' ? 1 : 2, marginRight: 8}}
                      />
                      <Field
                        label="Other ₹"
                        value={line.otherCharges}
                        onChangeText={text => onPricingChange?.(index, {otherCharges: text})}
                        keyboardType="decimal-pad"
                        style={{flex: 1}}
                      />
                    </View>
                    <Text style={styles.pricingReadout}>
                      {`Metal ${money(pricingView.breakdown.metalValue)} · Labour ${money(pricingView.breakdown.labour.amount)}${
                        otherChargesTotal > 0 ? ` · Other ${money(otherChargesTotal)}` : ''
                      }`}
                    </Text>
                  </View>
                ) : null}
                <Button title="Done" variant="outline" onPress={() => setExpandedIndex(null)} />
                <Button title="Remove item" variant="outline" onPress={() => onRemove(index)} />
              </>
            ) : null}
          </View>
        );
      })}
      <Button title="+ Add item" variant="outline" onPress={onAdd} style={{marginBottom: 12}} />
    </>
  );
}

/** Live math strip: subtotal − discount − materialReturned + delivery = total (matches core's bill engine). */
function TotalsBlock({
  styles,
  label,
  subtotal,
  discount,
  delivery,
  materialReturned,
  materialTitle,
  total,
  paid,
}: {
  styles: ReturnType<typeof makeStyles>;
  label: string;
  subtotal: number;
  discount: number;
  delivery: number;
  materialReturned: number;
  materialTitle?: string;
  total: number;
  /** Live paid/due strip — what's being handed over vs still owed. */
  paid?: number;
}) {
  return (
    <View>
      <View style={styles.totalBreakdown}>
        <View style={styles.totalRow}>
          <Text style={styles.totalRowLabel}>Subtotal</Text>
          <Text style={styles.totalRowValue}>{money(subtotal)}</Text>
        </View>
        {discount > 0 ? (
          <View style={styles.totalRow}>
            <Text style={styles.totalRowLabel}>Discount</Text>
            <Text style={styles.totalRowValue}>−{money(discount)}</Text>
          </View>
        ) : null}
        {materialReturned > 0 ? (
          <View style={styles.totalRow}>
            <Text style={styles.totalRowLabel}>{materialTitle?.trim() || 'Material Returned'}</Text>
            <Text style={styles.totalRowValue}>−{money(materialReturned)}</Text>
          </View>
        ) : null}
        {delivery > 0 ? (
          <View style={styles.totalRow}>
            <Text style={styles.totalRowLabel}>Delivery</Text>
            <Text style={styles.totalRowValue}>+{money(delivery)}</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.total}>
        {label}: {money(total)}
      </Text>
      {typeof paid === 'number' ? (
        <View style={styles.paidDueStrip}>
          <Text style={styles.paidDueLabel}>
            Paid <Text style={styles.paidDueValue}>{money(paid)}</Text>
          </Text>
          <Text style={styles.paidDueLabel}>
            Due{' '}
            <Text style={[styles.paidDueValue, total - paid > 0 && {color: colors.warning}]}>
              {money(Math.max(0, total - paid))}
            </Text>
          </Text>
        </View>
      ) : null}
    </View>
  );
}

export function BillingScreen() {
  const styles = useThemeStyles(makeStyles);
  const {data: settings} = useQueryState(useSettings());
  const {data: parties} = useQueryState(useParties());
  const {data: productsData} = useQueryState(useAllProducts());
  const products = productsData;
  const createInvoice = useCreateInvoice();
  const updateInvoice = useUpdateInvoice();

  // ── EDIT MODE — More → Billing opened from the Invoices list carries an id.
  // The whole screen is reused; there's no second bill form to keep in sync.
  const editingInvoiceId = useNavStore(s => s.editingInvoiceId);
  const editing = editingInvoiceId !== null && editingInvoiceId !== '';
  const {data: editInvoice, isError: editLoadFailed} = useInvoice(editingInvoiceId);
  /** Set once per invoice so a background refetch can't wipe in-progress edits. */
  const seededEditId = React.useRef<string | null>(null);

  // ── Bill 1 ──────────────────────────────────────────────────────────────
  const [customer, setCustomer] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [partyId, setPartyId] = useState('');
  const [date, setDate] = useState(() => toYmd(new Date()));
  const [notes, setNotes] = useState('');
  const [discount, setDiscount] = useState('0');
  const [delivery, setDelivery] = useState('0');
  const [paid, setPaid] = useState('0');
  /** Save the bill as fully paid (paid := total) — web/desktop parity. */
  const [markPaid, setMarkPaid] = useState(false);
  /** Auto-generate/share the PDF right after saving — web/desktop parity. */
  const [autoSavePdf, setAutoSavePdf] = useState(true);
  const [lines, setLines] = useState<LineState[]>([emptyLine()]);
  const [materialReturnedWeight, setMaterialReturnedWeight] = useState('');
  const [materialReturnedValue, setMaterialReturnedValue] = useState('');
  const [materialReturnedTitle, setMaterialReturnedTitle] = useState('');

  // ── Template options (same model as web + desktop) ──────────────────────
  const [template, setTemplate] = useState<BillTemplate>('ecommerce');
  const [classicColor, setClassicColor] = useState<BillClassicColor>('red');
  const [twoInOne, setTwoInOne] = useState(false);
  const [mode, setMode] = useState<BillMode>('duplicate');
  const [weightAfterName, setWeightAfterName] = useState(true);
  const [goldRateLine, setGoldRateLine] = useState(true);
  const [silverRateLine, setSilverRateLine] = useState(true);
  // Chejat/Nag direction marks — ON prints "Chejat: 0.100 +" / "Nag: 0.200 −".
  const [signSuffix, setSignSuffix] = useState(true);
  // Purity line under the gold rate row — shop base / this bill's product
  // karat / custom text / nothing (see GoldRateKaratMode).
  const [goldRateKaratMode, setGoldRateKaratMode] = useState<GoldRateKaratMode>('base');
  const [goldRateKaratText, setGoldRateKaratText] = useState('');
  // Karat PICKED in the "Karat" source — prints under the gold rate even
  // when neither the product nor the shop has a karat set.
  const [goldRateKaratValue, setGoldRateKaratValue] = useState(22);
  // How the advance is coming in — Cash / Online + optional reference note.
  const [paymentMethod, setPaymentMethod] = useState<string>('cash');
  const [paymentNote, setPaymentNote] = useState('');

  // ── Estimate column toggles — per METAL (gold grid ≠ silver field list) ─
  const [hiddenGold, setHiddenGold] = useState<EstimateColumnId[]>([]);
  const [hiddenSilver, setHiddenSilver] = useState<EstimateColumnId[]>([]);
  const toggleColumn = (metal: 'gold' | 'silver', id: EstimateColumnId) => {
    const setter = metal === 'gold' ? setHiddenGold : setHiddenSilver;
    setter(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  };

  const {data: goldRates} = useGoldRates();
  const goldBaseRate = goldRates?.baseRatePerGram ?? null;

  // Per-bill gold base ₹/g — prefilled with the shop's rate; editing it
  // re-prices every auto-priced gold line as you type (Phase 4b).
  const [goldRateInput, setGoldRateInput] = useState('');
  const goldRateTouched = React.useRef(false);
  React.useEffect(() => {
    if (goldBaseRate != null && !goldRateTouched.current) setGoldRateInput(String(goldBaseRate));
  }, [goldBaseRate]);
  const parsedGoldRate = Number(goldRateInput);
  const billGoldRate =
    goldRateInput.trim() && Number.isFinite(parsedGoldRate) && parsedGoldRate > 0
      ? parsedGoldRate
      : goldBaseRate;

  // Per-bill silver ₹/10g — prefilled from the shop's ₹/g rate (×10); editing
  // it re-prices every auto-priced silver line on THIS bill only (stored per-gram).
  const [silverRateInput, setSilverRateInput] = useState('');
  const silverRateTouched = React.useRef(false);
  const shopSilverPerGram = settings?.silverRatePerGram ?? 0;
  const shopSilverPer10g = Math.round(shopSilverPerGram * 1000) / 100;
  React.useEffect(() => {
    if (shopSilverPerGram > 0 && !silverRateTouched.current) setSilverRateInput(String(shopSilverPer10g));
  }, [shopSilverPerGram, shopSilverPer10g]);
  const parsedSilver10g = Number(silverRateInput);
  // null until the user edits it — untouched bills keep each product's own rate.
  const billSilverRate: number | null = !silverRateTouched.current
    ? null
    : silverRateInput.trim() && Number.isFinite(parsedSilver10g) && parsedSilver10g > 0
      ? parsedSilver10g / 10
      : shopSilverPerGram;

  /** Same snapshot web + desktop save — options follow each invoice + render. */
  const billTemplateSettings: BillTemplateSettings = {
    template,
    classicColor,
    twoInOne,
    mode,
    weightAfterName,
    goldRateLine,
    silverRateLine,
    signSuffix,
    goldRateKaratMode,
    goldRateKaratText,
    goldRateKaratValue,
    hiddenColumns: {gold: hiddenGold, silver: hiddenSilver},
  };

  /** Badge text for the gold-rate purity line — the form-side twin of core's
   *  `goldRateKaratLine`: off → nothing; custom → the operator's text;
   *  product → the first gold line's karat (the selected product's);
   *  base → the shop base karat. */
  function rateKaratBadge(): string | null {
    if (goldRateKaratMode === 'off') return null;
    if (goldRateKaratMode === 'custom') return goldRateKaratText.trim() || null;
    if (goldRateKaratMode === 'karat') return `${goldRateKaratValue}K`;
    if (goldRateKaratMode === 'product') {
      const karat = firstGoldKarat(
        lines
          .filter(l => l.productName.trim())
          .map(l => {
            const bd = lineBreakdown(l);
            return {pricing: bd ? invoicePricingFromBreakdown(bd) : null, purity: l.purity || null};
          }),
      );
      return karat != null && karat > 0 ? `${karat}K` : null;
    }
    return goldRates?.baseKarat && goldRates.baseKarat > 0 ? `Base ${goldRates.baseKarat}K` : null;
  }
  const rateKaratBadgeText = rateKaratBadge();

  // ── Bill 2 — only used in 2-in-1 "Separate" mode ───────────────────────
  const [secondCustomer, setSecondCustomer] = useState('');
  const [secondCustomerPhone, setSecondCustomerPhone] = useState('');
  const [secondCustomerAddress, setSecondCustomerAddress] = useState('');
  const [secondPartyId, setSecondPartyId] = useState('');
  const [secondDiscount, setSecondDiscount] = useState('0');
  const [secondDelivery, setSecondDelivery] = useState('0');
  const [secondMaterialReturnedWeight, setSecondMaterialReturnedWeight] = useState('');
  const [secondMaterialReturnedValue, setSecondMaterialReturnedValue] = useState('');
  const [secondMaterialReturnedTitle, setSecondMaterialReturnedTitle] = useState('');
  const [secondPaid, setSecondPaid] = useState('0');
  const [secondLines, setSecondLines] = useState<LineState[]>([emptyLine()]);
  const [secondPreview, setSecondPreview] = useState<BillDocument | null>(null);

  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<BillDocument | null>(null);

  // "Separate" mode creates a SECOND invoice — that only makes sense when
  // creating. Editing works on one saved bill, so the 2-in-1 pairing UI is off.
  const distinct = !editing && twoInOne && mode === 'distinct';

  // ── Recalculate prices: cart lines are refreshed inside handleSyncPrices
  //    with a per-product fetch (auto prices are computed on read). ─────────
  const getClient = useApiClient();
  const syncPrices = useSyncProductPrices();

  /** Pricing inputs for the bill — the gold table re-based on `billGoldRate`. */
  const billPricingContext = useMemo(() => {
    const table = resolveGoldRateTable(goldRates?.rates ?? []);
    const overridden =
      billGoldRate != null ? applyGoldBaseRate(table, billGoldRate, goldRates?.baseKarat ?? null) : table;
    const defaultLabour =
      (settings?.defaultLabourValue ?? 0) > 0
        ? {type: settings?.defaultLabourType ?? 'PERCENT', value: settings?.defaultLabourValue ?? 0}
        : null;
    return {
      goldRateTable: overridden,
      silverRatePerGram: settings?.silverRatePerGram ?? 0,
      silverRateOverride: billSilverRate,
      defaultLabour,
    };
  }, [goldRates, billGoldRate, billSilverRate, settings]);

  /** Live breakdown for one line — the strip edits layer on top. Null when
   *  the line isn't an auto-priced Gold/Silver product. */
  function lineBreakdown(line: LineState, ctx: PricingContext = billPricingContext): PriceBreakdown | null {
    if (!line.productId) return null;
    const p = productsData?.find(x => x.id === line.productId);
    if (!p || p.priceMode !== 'auto' || (p.type !== 'Gold' && p.type !== 'Silver')) return null;
    const parsed = Number(line.weight);
    const editedWeight = line.weight.trim() !== '' && Number.isFinite(parsed) ? parsed : null;
    // Gold prices on the DERIVED NET weight (gross − nag + chejat, grams);
    // silver keeps the plain Weight basis. No net → weight → null (product's).
    const net = p.type === 'Gold' ? goldNetGrams(line) : null;
    const weight = net ?? editedWeight;
    const weightUnit = net != null ? 'gm' : line.weightUnit;
    return priceBillLineRow(p, ctx, {weight, weightUnit}, overridesFrom(line));
  }

  /** Writes a breakdown back onto the line — price always; rate when the shop
   *  hasn't typed one (untouched rates keep tracking the bill's rate). */
  function applyBreakdown(line: LineState, bd: PriceBreakdown | null): LineState {
    if (!bd) return line;
    const next = {...line, price: String(bd.price)};
    if (!line.rateEdited && bd.source === 'auto') next.ratePerGram = String(bd.ratePerGram);
    return next;
  }

  /** Re-prices ONE auto-priced gold/silver line — the edited line weight (when
   *  any) overrides the product's pricing weight so rate edits keep it. */
  function repriceLine(line: LineState, ctx?: PricingContext): LineState {
    return applyBreakdown(line, lineBreakdown(line, ctx));
  }

  /** Editing a line's Weight re-prices that line (clearing it reverts to the
   *  product's own price). */
  function makeWeightHandler(setter: (updater: (prev: LineState[]) => LineState[]) => void) {
    return (index: number, raw: string) => {
      setter(prev =>
        prev.map((l, i) => (i === index ? repriceLine({...l, weight: raw, weightEdited: raw.trim() !== ''}) : l)),
      );
    };
  }

  /** Editing a line's weight-BASIS inputs (gold: G. Wt. / Nag / Chejat — they
   *  drive the derived net the price is computed on) re-prices that line. */
  function makeBasisHandler(setter: (updater: (prev: LineState[]) => LineState[]) => void) {
    return (index: number, patch: Partial<LineState>) => {
      setter(prev => prev.map((l, i) => (i === index ? repriceLine({...l, ...patch}) : l)));
    };
  }

  /** Pricing-strip edits re-price the line; a typed rate sticks (stops
   *  tracking the bill's gold/silver rate). */
  function makePricingHandler(setter: (updater: (prev: LineState[]) => LineState[]) => void) {
    return (index: number, patch: Partial<PricingStripFields>) => {
      setter(prev =>
        prev.map((l, i) => {
          if (i !== index) return l;
          const merged = {...l, ...patch};
          if (patch.ratePerGram !== undefined) merged.rateEdited = patch.ratePerGram.trim() !== '';
          return repriceLine(merged);
        }),
      );
    };
  }

  /** Bill context with the gold base replaced by the field's live value — the
   *  rate inputs reprice inside their own setState updater (a memo would still
   *  hold the previous keystroke's rate at that point). */
  function goldContextFor(raw: string): PricingContext {
    const parsed = Number(raw);
    const rate = raw.trim() !== '' && Number.isFinite(parsed) && parsed > 0 ? parsed : goldBaseRate;
    const table = resolveGoldRateTable(goldRates?.rates ?? []);
    return {
      ...billPricingContext,
      goldRateTable: rate != null ? applyGoldBaseRate(table, rate, goldRates?.baseKarat ?? null) : table,
    };
  }

  /** Same for the silver ₹/10g field (stored per-gram). */
  function silverContextFor(raw: string): PricingContext {
    const parsed10g = Number(raw);
    const perGram =
      raw.trim() !== '' && Number.isFinite(parsed10g) && parsed10g > 0 ? parsed10g / 10 : shopSilverPerGram;
    return {...billPricingContext, silverRateOverride: perGram};
  }

  /** Re-prices one metal's lines under an explicitly built context. */
  function repriceMetalWith(prev: LineState[], metal: 'Gold' | 'Silver', ctx: PricingContext): LineState[] {
    return prev.map(line => {
      if (!line.productId) return line;
      const p = productsData?.find(x => x.id === line.productId);
      if (!p || p.type !== metal || p.priceMode !== 'auto') return line;
      return applyBreakdown(line, lineBreakdown(line, ctx));
    });
  }

  function handleGoldRateChange(value: string) {
    goldRateTouched.current = true;
    setGoldRateInput(value);
    const ctx = goldContextFor(value);
    setLines(prev => repriceMetalWith(prev, 'Gold', ctx));
    setSecondLines(prev => repriceMetalWith(prev, 'Gold', ctx));
  }

  function handleSilverRateChange(value: string) {
    silverRateTouched.current = true;
    setSilverRateInput(value);
    const ctx = silverContextFor(value);
    setLines(prev => repriceMetalWith(prev, 'Silver', ctx));
    setSecondLines(prev => repriceMetalWith(prev, 'Silver', ctx));
  }

  /** The pricing strip's data for one line — metal + live breakdown
   *  (null → no strip: no product / manual price / non-metal). */
  function pricingViewFor(line: LineState): {metal: 'Gold' | 'Silver'; breakdown: PriceBreakdown} | null {
    if (!line.productId) return null;
    const p = productsData?.find(x => x.id === line.productId);
    if (!p || p.priceMode !== 'auto' || (p.type !== 'Gold' && p.type !== 'Silver')) return null;
    const bd = lineBreakdown(line);
    if (!bd) return null;
    return {metal: p.type, breakdown: bd};
  }

  async function handleSyncPrices() {
    try {
      const r = await syncPrices.mutateAsync();
      if (r.scanned === 0) {
        successFeedback();
        Alert.alert('Nothing to recalculate', 'No auto-priced products yet.');
      } else if (r.updated === 0) {
        successFeedback();
        Alert.alert('Prices already match', 'Every auto-priced product already has today\u2019s rate.');
      } else {
        successFeedback();
        Alert.alert('Prices updated', `Re-priced ${r.updated} of ${r.scanned} auto-priced product(s).`);
      }
      // Refresh just the products actually on the bills — no full-catalog
      // scan. Detail caches were invalidated by the sync-prices call above.
      try {
        const api = await getClient();
        const ids = [...new Set([...lines, ...secondLines].map(l => l.productId).filter(id => id !== ''))];
        const rows = await Promise.all(ids.map(id => api.products.get(id)));
        const priceOf = (id: string): string | null => {
          const row = rows.find(fresh => fresh.id === id);
          return row ? String(row.effectivePrice) : null;
        };
        const refresh = (prev: LineState[]): LineState[] =>
          prev.map(line => {
            if (!line.productId) return line;
            const fresh = priceOf(line.productId);
            return fresh === null ? line : {...line, price: fresh};
          });
        // Server rates land first, then the bill's own gold/silver rates (if
        // any) re-apply on top so edited rates are never clobbered.
        setLines(prev => repriceMetalWith(repriceMetalWith(refresh(prev), 'Gold', billPricingContext), 'Silver', billPricingContext));
        setSecondLines(prev => repriceMetalWith(repriceMetalWith(refresh(prev), 'Gold', billPricingContext), 'Silver', billPricingContext));
      } catch {
        // Best-effort: keep the current line prices if the refresh fails.
      }
    } catch (err) {
      errorFeedback('Recalculation failed');
      Alert.alert('Recalculation failed', err instanceof Error ? err.message : 'Try again.');
    }
  }

  const subtotal = useMemo(
    () => lines.reduce((sum, l) => sum + (Number(l.quantity) || 0) * (Number(l.price) || 0), 0),
    [lines],
  );
  // Same totals math as web/desktop: subtotal − discount − materialReturned + delivery.
  const total = Math.max(0, subtotal - (Number(discount) || 0) - (Number(materialReturnedValue) || 0) + (Number(delivery) || 0));
  const secondSubtotal = useMemo(
    () => secondLines.reduce((sum, l) => sum + (Number(l.quantity) || 0) * (Number(l.price) || 0), 0),
    [secondLines],
  );
  const secondTotal = Math.max(0, secondSubtotal - (Number(secondDiscount) || 0) - (Number(secondMaterialReturnedValue) || 0) + (Number(secondDelivery) || 0));

  function updateLine(index: number, patch: Partial<LineState>) {
    setLines(prev => prev.map((l, i) => (i === index ? {...l, ...patch} : l)));
  }

  function updateSecondLine(index: number, patch: Partial<LineState>) {
    setSecondLines(prev => prev.map((l, i) => (i === index ? {...l, ...patch} : l)));
  }

  /** Picking a product resets the line's pricing edits and materializes its
   *  inputs (rate from the live breakdown; labour/charges from the product
   *  row), then re-prices through the engine so price + rate land together. */
  function pickLine(base: LineState, productId: string, product?: ProductDto): LineState {
    const picked: LineState = {
      ...base,
      productId,
      productName: product?.name ?? '',
      sku: product?.sku ?? '',
      color: product?.color ?? '',
      size: product?.size ?? '',
      description: '',
      weight: product?.weight != null ? String(product.weight) : '',
      weightUnit: product?.weightUnit === 'mg' ? 'mg' : 'gm',
      weightEdited: false,
      purity: product?.purity ?? '',
      grossWeight: product?.grossWeight ?? '',
      nagLessWeight: gramsField(weightTextToGrams(product?.nagLessWeight ?? null, product?.nagUnit ?? null)),
      chejatWeight: gramsField(weightTextToGrams(product?.chejatWeight ?? null, product?.nagUnit ?? null)),
      price: product ? String(product.effectivePrice) : '',
      silverPercentage: product ? String(product.silverPercentage ?? 100) : '100',
      ratePerGram: '',
      rateEdited: false,
      labourType: product?.labourType ?? '',
      labourValue: product?.labourValue != null ? String(product.labourValue) : '',
      nag: product?.nagRate ?? '',
      povayi: product?.povayiRate != null ? String(product.povayiRate) : '',
      otherCharges: product?.otherCharges != null ? String(product.otherCharges) : '',
    };
    return applyBreakdown(picked, lineBreakdown(picked));
  }

  function onSelectProduct(lineIndex: number, productId: string, product?: ProductDto) {
    setLines(prev => prev.map((l, i) => (i === lineIndex ? pickLine(l, productId, product) : l)));
  }

  function onSecondSelectProduct(lineIndex: number, productId: string, product?: ProductDto) {
    setSecondLines(prev => prev.map((l, i) => (i === lineIndex ? pickLine(l, productId, product) : l)));
  }

  /**
   * Fast entry — barcode or SKU: resolve against the loaded catalog first
   * (same rule as core `findProductByCode`), then the API for codes outside
   * the loaded pages. Out-of-stock is refused. The line lands in the first
   * empty row (else appends), matching web + desktop.
   */
  /** Resolves to an error message, or null when the row landed. */
  async function addByCode(raw: string, target: 'first' | 'second' = 'first'): Promise<string | null> {
    const code = raw.trim();
    if (!code) return null;
    try {
      let product: ProductDto | null = productsData?.find(p => productMatchesCode(p, code)) ?? null;
      if (!product) {
        const api = await getClient();
        product = await api.products.byBarcode(code);
      }
      if (product.stock <= 0) {
        errorFeedback();
        return `${product.name} is out of stock`;
      }
      const row = pickLine(emptyLine(), product.id, product);
      const setter = target === 'second' ? setSecondLines : setLines;
      setter(prev => {
        const idx = prev.findIndex(l => !l.productId && !l.productName.trim());
        return idx >= 0 ? prev.map((l, i) => (i === idx ? row : l)) : [...prev, row];
      });
      successFeedback(`Added ${product.name}`);
      return null;
    } catch (err) {
      errorFeedback();
      return err instanceof Error ? err.message : 'Product not found';
    }
  }

  /** Picked from the top-level "Add from stock" — first empty line, else append. */
  function addPickedToLines(
    setter: React.Dispatch<React.SetStateAction<LineState[]>>,
    product?: ProductDto,
  ) {
    if (!product) return;
    const row = pickLine(emptyLine(), product.id, product);
    setter(prev => {
      const idx = prev.findIndex(l => !l.productId && !l.productName.trim());
      return idx >= 0 ? prev.map((l, i) => (i === idx ? row : l)) : [...prev, row];
    });
    successFeedback(`Added ${product.name}`);
  }

  function collectItems(list: LineState[]) {
    return list
      .map(l => {
        const bd = lineBreakdown(l);
        const pricing = bd ? invoicePricingFromBreakdown(bd) : null;
        // Gold stores the DERIVED NET weight (grams) — what it priced — plus
        // its nag/chejat derivation inputs for their own bill columns; silver
        // keeps the plain Weight field.
        const isGold = l.productId
          ? productsData?.find(x => x.id === l.productId)?.type === 'Gold'
          : false;
        const net = isGold ? goldNetGrams(l) : null;
        return {
          productId: l.productId || undefined,
          productName: l.productName.trim(),
          sku: l.sku.trim() || undefined,
          color: l.color.trim() || undefined,
          size: l.size.trim() || undefined,
          description: l.description.trim() || undefined,
          weight: net ?? (l.weight.trim() ? Number(l.weight) : undefined),
          weightUnit: net != null ? 'gm' : l.weight.trim() ? l.weightUnit : undefined,
          purity: l.purity.trim() || undefined,
          grossWeight: l.grossWeight.trim() || undefined,
          nagLessWeight: isGold ? parseLineNum(l.nagLessWeight) ?? undefined : undefined,
          chejatWeight: isGold ? parseLineNum(l.chejatWeight) ?? undefined : undefined,
          quantity: Number(l.quantity) || 0,
          price: Number(l.price) || 0,
          pricing: pricing ?? undefined,
        };
      })
      .filter(it => it.productName && it.quantity > 0);
  }

  /** Shared bill model (core) — identical numbers to web + desktop. */
  function toBillDocument(
    invoice: InvoiceDto,
    shop: {name: string; address: string; phones: string[]; email: string} | undefined,
  ): BillDocument {
    return buildBillDocument({
      billNo: invoice.invoiceNumber,
      date: invoice.date,
      customerName: invoice.customerName,
      customerPhone: invoice.customerPhone,
      customerAddress: invoice.customerAddress,
      shop:
        shop ?? {name: settings?.shopName ?? 'My Shop', address: null, phones: [], email: null},
      lines: invoice.items.map(it => ({
        productName: it.productName,
        sku: it.sku,
        color: it.color,
        size: it.size,
        weight: it.weight,
        weightUnit: it.weightUnit,
        purity: it.purity,
        grossWeight: it.grossWeight,
        nagLessWeight: it.nagLessWeight,
        chejatWeight: it.chejatWeight,
        pricing: it.pricing,
        quantity: it.quantity,
        price: it.price,
      })),
      discount: invoice.discount,
      deliveryCharge: invoice.deliveryCharge,
      materialReturnedWeight: invoice.materialReturnedWeight,
      materialReturnedValue: invoice.materialReturnedValue,
      materialReturnedTitle: invoice.materialReturnedTitle,
      amountPaid: invoice.amountPaid,
      status: invoice.status,
      currency: settings?.currency ?? 'INR',
      goldRate: invoice.goldRate ?? goldBaseRate,
      // Purity of the quoted rate — the "24K" suffix on the gold rate row.
      goldRateKarat: goldRates?.baseKarat ?? null,
      silverRate: invoice.silverRate ?? settings?.silverRatePerGram ?? null,
    });
  }

  /** Clears the form fields only — the bill preview stays so the user can
   * immediately share / export the bill they just created. */
  function resetForm() {
    setCustomer('');
    setCustomerPhone('');
    setCustomerAddress('');
    setPartyId('');
    setDate(toYmd(new Date()));
    setNotes('');
    setDiscount('0');
    setDelivery('0');
    setPaid('0');
    setLines([emptyLine()]);
    setMaterialReturnedWeight('');
    setMaterialReturnedValue('');
    setMaterialReturnedTitle('');
    setSecondCustomer('');
    setSecondCustomerPhone('');
    setSecondCustomerAddress('');
    setSecondPartyId('');
    setSecondDiscount('0');
    setSecondDelivery('0');
    setSecondMaterialReturnedWeight('');
    setSecondMaterialReturnedValue('');
    setSecondMaterialReturnedTitle('');
    setSecondPaid('0');
    setSecondLines([emptyLine()]);
    goldRateTouched.current = false;
    setGoldRateInput(goldBaseRate != null ? String(goldBaseRate) : '');
    silverRateTouched.current = false;
    setSilverRateInput(shopSilverPer10g > 0 ? String(shopSilverPer10g) : '');
  }

  /** EDIT MODE — a stored invoice back into every field on this form (the
   *  inverse of what `handleCreate` submits). Bill 2 is always cleared: an
   *  edit updates exactly ONE invoice. */
  function seedFromInvoice(inv: InvoiceDto) {
    setCustomer(inv.customerName ?? '');
    setCustomerPhone(inv.customerPhone ?? '');
    setCustomerAddress(inv.customerAddress ?? '');
    setPartyId(inv.partyId ?? '');
    setDate(inv.date.slice(0, 10));
    setNotes(inv.notes ?? '');
    setDiscount(String(inv.discount));
    setDelivery(String(inv.deliveryCharge));
    setPaid(String(inv.amountPaid));
    setLines(inv.items.length ? inv.items.map(invoiceToLine) : [emptyLine()]);
    setMaterialReturnedWeight(inv.materialReturnedWeight ?? '');
    setMaterialReturnedValue(String(inv.materialReturnedValue));
    setMaterialReturnedTitle(inv.materialReturnedTitle ?? '');

    // Never carry a previous run's 2-in-1 partner into an edit.
    setSecondCustomer('');
    setSecondCustomerPhone('');
    setSecondCustomerAddress('');
    setSecondPartyId('');
    setSecondDiscount('0');
    setSecondDelivery('0');
    setSecondMaterialReturnedWeight('');
    setSecondMaterialReturnedValue('');
    setSecondMaterialReturnedTitle('');
    setSecondPaid('0');
    setSecondLines([emptyLine()]);
    setSecondPreview(null);

    const st = inv.templateSettings;
    setTemplate(st?.template ?? 'ecommerce');
    setClassicColor(st?.classicColor ?? 'red');
    setTwoInOne(st?.twoInOne ?? false);
    setMode(st?.mode ?? 'duplicate');
    setWeightAfterName(st?.weightAfterName ?? true);
    setGoldRateLine(st?.goldRateLine ?? true);
    setSilverRateLine(st?.silverRateLine ?? true);
    setSignSuffix(st?.signSuffix ?? true);
    setGoldRateKaratMode(st?.goldRateKaratMode ?? 'base');
    setGoldRateKaratText(st?.goldRateKaratText ?? '');
    setGoldRateKaratValue(st?.goldRateKaratValue ?? 22);
    setHiddenGold(st?.hiddenColumns?.gold ?? []);
    setHiddenSilver(st?.hiddenColumns?.silver ?? []);

    // The bill's OWN rates beat the shop default — and are marked touched so
    // the two prefill effects above can't overwrite them later.
    if (inv.goldRate != null && inv.goldRate > 0) {
      setGoldRateInput(String(inv.goldRate));
      goldRateTouched.current = true;
    }
    if (inv.silverRate != null && inv.silverRate > 0) {
      // Stored per-gram; the field shows ₹/10g (same conversion as the shop prefill).
      setSilverRateInput(String(Math.round(inv.silverRate * 1000) / 100));
      silverRateTouched.current = true;
    }
  }

  // Load + seed once per invoice (never on a refetch — that would wipe the
  // operator's in-progress edits). The preview shows the SAVED bill.
  React.useEffect(() => {
    if (!editing || !editInvoice || seededEditId.current === editInvoice.id) return;
    seededEditId.current = editInvoice.id;
    seedFromInvoice(editInvoice);
    const shop = settings
      ? {name: settings.shopName, address: settings.shopAddress ?? '', phones: Array.isArray(settings.shopPhones) ? settings.shopPhones : [], email: settings.shopEmail ?? ''}
      : undefined;
    setPreview(toBillDocument(editInvoice, shop));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- guarded by ref.
  }, [editing, editInvoice, settings]);

  /** Leave edit mode without leaving the Billing tab: clean form, back to the list. */
  function cancelEdit() {
    seededEditId.current = null;
    resetForm();
    setPreview(null);
    setSecondPreview(null);
    useNavStore.getState().openMore('invoices');
  }

  // Back/Close leaving the Billing tab also has to drop the seeded bill.
  React.useEffect(() => {
    if (editing || seededEditId.current === null) return;
    seededEditId.current = null;
    resetForm();
    setPreview(null);
    setSecondPreview(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset-only effect.
  }, [editing]);

  // A bill that no longer exists (deleted elsewhere) must not leave a dead form.
  React.useEffect(() => {
    if (!editing || !editLoadFailed) return;
    errorFeedback('That bill could no longer be found');
    seededEditId.current = null;
    resetForm();
    setPreview(null);
    setSecondPreview(null);
    useNavStore.getState().openMore('invoices');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot guard.
  }, [editing, editLoadFailed]);

  async function handleCreate() {
    const items = collectItems(lines);
    if (items.length === 0) {
      errorFeedback();
      Alert.alert(
        'Nothing to bill',
        'Add at least one item — pick a product (its price fills in automatically) or type an item name with a quantity and price.',
      );
      return;
    }
    const secondItems = distinct ? collectItems(secondLines) : [];
    if (distinct && secondItems.length === 0) {
      errorFeedback();
      Alert.alert('Second bill needed', 'Separate mode needs at least one item in Bill 2.');
      return;
    }
    setSaving(true);
    try {
      const shop = settings
        ? {name: settings.shopName, address: settings.shopAddress ?? '', phones: Array.isArray(settings.shopPhones) ? settings.shopPhones : [], email: settings.shopEmail ?? ''}
        : undefined;
      // Same template snapshot web saves — the options follow each invoice.
      const templateSettings = billTemplateSettings;
      const shared = {
        date: date || undefined,
        notes: notes.trim() || undefined,
        goldRate: billGoldRate ?? undefined,
        silverRate: billSilverRate ?? undefined,
      };
      // The SAME payload feeds both create and edit — the edit screen is this
      // screen with a bill loaded, so the whole bill is re-submitted.
      const values = {
        customerName: customer.trim() || undefined,
        customerPhone: customerPhone.trim() || undefined,
        customerAddress: customerAddress.trim() || undefined,
        partyId: partyId || undefined,
        ...shared,
        items,
        discount: Number(discount) || 0,
        deliveryCharge: Number(delivery) || 0,
        materialReturnedWeight: materialReturnedWeight.trim() || undefined,
        materialReturnedValue: Number(materialReturnedValue) || 0,
        materialReturnedTitle: materialReturnedTitle.trim() || undefined,
        amountPaid: markPaid ? total : Math.min(Number(paid) || 0, total),
        // How the advance came in — Cash / Online + the optional reference.
        paymentMethod,
        paymentNote: paymentNote.trim() || undefined,
        shopDetails: shop,
        templateSettings,
      };

      // ── EDIT: PUT the whole bill back. Core reconciles the per-product
      //    stock delta and the payment rows; the number stays untouched. ──
      if (editing && editInvoice) {
        const updated = await updateInvoice.mutateAsync({id: editInvoice.id, values});
        const doc = toBillDocument(updated, shop);
        setPreview(doc);
        successFeedback(`Bill ${updated.invoiceNumber} updated`);
        if (autoSavePdf) void generateAndSharePdf(doc);
        return;
      }

      const invoice = await createInvoice.mutateAsync(values);
      const doc = toBillDocument(invoice, shop);
      let secondDoc: BillDocument | null = null;

      if (distinct) {
        try {
          const secondInvoice = await createInvoice.mutateAsync({
            customerName: secondCustomer.trim() || undefined,
            customerPhone: secondCustomerPhone.trim() || undefined,
            customerAddress: secondCustomerAddress.trim() || undefined,
            partyId: secondPartyId || undefined,
            ...shared,
            items: collectItems(secondLines),
            discount: Number(secondDiscount) || 0,
            deliveryCharge: Number(secondDelivery) || 0,
            materialReturnedWeight: secondMaterialReturnedWeight.trim() || undefined,
            materialReturnedValue: Number(secondMaterialReturnedValue) || 0,
            materialReturnedTitle: secondMaterialReturnedTitle.trim() || undefined,
            amountPaid: markPaid ? secondTotal : Math.min(Number(secondPaid) || 0, secondTotal),
            // Same Cash/Online choice as Bill 1 (one advance, two prints).
            paymentMethod,
            paymentNote: paymentNote.trim() || undefined,
            shopDetails: shop,
            templateSettings,
          });
          secondDoc = toBillDocument(secondInvoice, shop);
        } catch (err) {
          // Bill 1 is already saved — surface the partial result clearly.
          errorFeedback();
          setPreview(doc);
          Alert.alert(
            'Bill 1 saved',
            `Bill 1 (${invoice.invoiceNumber}) was saved, but Bill 2 failed${
              err instanceof Error ? `: ${err.message}` : '.'
            }`,
          );
          resetForm();
          return;
        }
      }

      setPreview(doc);
      if (secondDoc) {
        setSecondPreview(secondDoc);
      }
      resetForm();
      successFeedback(`Bill ${invoice.invoiceNumber} created`);

      // Auto-generate PDF like web does — save to device then share.
      if (autoSavePdf) void generateAndSharePdf(doc, secondDoc);
    } catch {
      errorFeedback(editing ? 'Failed to update bill' : 'Failed to create bill');
      // keep form for retry
    } finally {
      setSaving(false);
    }
  }

  async function handleShareBill() {
    if (!preview) {
      return;
    }
    try {
      let message = renderBillText(preview, billTemplateSettings);
      if (twoInOne && secondPreview) {
        message = `${message}\n\n──────────\n\n${renderBillText(secondPreview, billTemplateSettings)}`;
      }
      await Share.share({message});
    } catch {
      // user cancelled share
    }
  }

  async function handlePdf() {
    if (!preview) {
      return;
    }
    try {
      let html = renderBillHtml(preview, billTemplateSettings);
      if (twoInOne) {
        const second = secondPreview ? renderBillHtml(secondPreview, billTemplateSettings) : html;
        html = `${html}<div style="page-break-after: always"></div>${second}`;
      }
      const {uri} = await Print.printToFileAsync({
        html,
        base64: false,
      });
      await savePdf(uri, preview.billNo);
    } catch {
      // user cancelled share or print failed
    }
  }

  /** Auto-generate PDF after invoice creation — same flow as web's handleSaveAndPrint. */
  async function generateAndSharePdf(doc: BillDocument, secondDoc?: BillDocument | null) {
    try {
      let html = renderBillHtml(doc, billTemplateSettings);
      if (secondDoc) {
        html = `${html}<div style="page-break-after: always"></div>${renderBillHtml(secondDoc, billTemplateSettings)}`;
      }
      const {uri} = await Print.printToFileAsync({html, base64: false});
      await savePdf(uri, doc.billNo);
    } catch {
      // user cancelled — bill is already saved, no error needed
    }
  }

  return (
    <Screen>
      <HomeHeader title={editing && editInvoice ? `Edit ${editInvoice.invoiceNumber}` : 'Billing'} />
      <KeyboardAvoidingView style={{flex: 1}} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{paddingBottom: 90}} {...headerScrollHandlers}>
        {/* EDIT MODE — makes it impossible to mistake this for a new bill */}
        {editing && (
          <Card index={0}>
            <Text style={styles.switchLabel}>Editing {editInvoice?.invoiceNumber ?? 'bill'}</Text>
            <Text style={styles.switchSub}>
              Saving replaces the saved bill. Stock moves by the difference only, the paid amount is reconciled with
              the payments already recorded, and the bill number is never changed.
            </Text>
            <Button
              title="Cancel edit"
              variant="outline"
              onPress={cancelEdit}
              style={{marginTop: 10, alignSelf: 'flex-start'}}
            />
          </Card>
        )}

        {/* Template options — same model as web + desktop */}
        <Card index={0}>
          <Text style={styles.optLabel}>Bill template</Text>
          <View style={styles.segmentRow}>
            {(['jewellery', 'ecommerce'] as const).map(t => (
              <Pressable
                key={t}
                accessibilityRole="button"
                accessibilityLabel={t === 'jewellery' ? 'Classic Jewellery template' : 'Modern E-commerce template'}
                onPress={() => {
                  selectionTick();
                  setTemplate(t);
                }}
                style={({pressed}) => [
                  styles.segment,
                  template === t && styles.segmentActive,
                  pressed && {opacity: 0.75},
                ]}>
                <Text style={[styles.segmentText, template === t && styles.segmentTextActive]}>
                  {t === 'jewellery' ? 'Classic Jewellery' : 'Modern E-commerce'}
                </Text>
              </Pressable>
            ))}
          </View>

          {template === 'jewellery' ? (
            <>
              <Text style={styles.optLabel}>Classic color</Text>
              <View style={styles.colorRow}>
                {(['red', 'yellow'] as const).map(c => (
                  <Pressable
                    key={c}
                    accessibilityRole="button"
                    accessibilityLabel={c === 'red' ? 'Red theme' : 'Yellow theme'}
                    onPress={() => {
                      selectionTick();
                      setClassicColor(c);
                    }}
                    style={({pressed}) => [
                      styles.colorDotWrap,
                      classicColor === c && styles.colorDotActive,
                      pressed && {opacity: 0.75},
                    ]}>
                    <View
                      style={[
                        styles.colorDot,
                        // Semantic print colors — from the shared core map
                        // (same source as web/desktop, not theme tokens).
                        {backgroundColor: swatchColor(c)},
                      ]}
                    />
                  </Pressable>
                ))}
                <Text style={styles.colorHint}>
                  {classicColor === 'red' ? 'Red theme' : 'Yellow theme'}
                </Text>
              </View>
            </>
          ) : null}

          {/* 2-in-1 pairs bills when CREATING — an edit always updates one bill,
              so the pairing controls are out of the way in edit mode. */}
          {editing ? null : (
            <View style={styles.switchRow}>
              <View style={{flex: 1, paddingRight: 12}}>
                <Text style={styles.switchLabel}>2-in-1 bill</Text>
                <Text style={styles.switchSub}>Two bills on one page</Text>
              </View>
              <Switch
                value={twoInOne}
                onValueChange={value => {
                  selectionTick();
                  setTwoInOne(value);
                }}
                trackColor={{true: colors.primary, false: colors.border}}
                thumbColor={colors.inverseOnSurface}
              />
            </View>
          )}

          <View style={styles.switchRow}>
            <View style={{flex: 1, paddingRight: 12}}>
              <Text style={styles.switchLabel}>Weight column</Text>
              <Text style={styles.switchSub}>Show item weight after the name</Text>
            </View>
            <Switch
              value={weightAfterName}
              onValueChange={value => {
                selectionTick();
                setWeightAfterName(value);
              }}
              trackColor={{true: colors.primary, false: colors.border}}
              thumbColor={colors.inverseOnSurface}
            />
          </View>

          <View style={styles.switchRow}>
            <View style={{flex: 1, paddingRight: 12}}>
              <Text style={styles.switchLabel}>Gold rate line</Text>
              <Text style={styles.switchSub}>Today's gold rate row on the bill</Text>
            </View>
            <Switch
              value={goldRateLine}
              onValueChange={value => {
                selectionTick();
                setGoldRateLine(value);
              }}
              trackColor={{true: colors.primary, false: colors.border}}
              thumbColor={colors.inverseOnSurface}
            />
          </View>

          <View style={styles.switchRow}>
            <View style={{flex: 1, paddingRight: 12}}>
              <Text style={styles.switchLabel}>Silver rate line</Text>
              <Text style={styles.switchSub}>Today's silver rate row on the bill</Text>
            </View>
            <Switch
              value={silverRateLine}
              onValueChange={value => {
                selectionTick();
                setSilverRateLine(value);
              }}
              trackColor={{true: colors.primary, false: colors.border}}
              thumbColor={colors.inverseOnSurface}
            />
          </View>

          <View style={styles.switchRow}>
            <View style={{flex: 1, paddingRight: 12}}>
              <Text style={styles.switchLabel}>Chejat/Nag signs</Text>
              <Text style={styles.switchSub}>Print "Chejat: 0.100 +" / "Nag: 0.200 −"</Text>
            </View>
            <Switch
              value={signSuffix}
              onValueChange={value => {
                selectionTick();
                setSignSuffix(value);
              }}
              trackColor={{true: colors.primary, false: colors.border}}
              thumbColor={colors.inverseOnSurface}
            />
          </View>

          {/* Purity under the gold rate row — shown only while the row itself
              is on. "Product's" prints the bill's first gold line's karat. */}
          {goldRateLine ? (
            <>
              <Text style={styles.optLabel}>Karat line under gold rate</Text>
              <View style={styles.segmentRow}>
                {([
                  {id: 'off', label: 'Off'},
                  {id: 'base', label: 'Base'},
                  {id: 'product', label: "Product's"},
                  {id: 'karat', label: 'Karat'},
                  {id: 'custom', label: 'Custom'},
                ] as const).map(opt => (
                  <Pressable
                    key={opt.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Karat line: ${opt.label}`}
                    onPress={() => {
                      selectionTick();
                      setGoldRateKaratMode(opt.id);
                    }}
                    style={({pressed}) => [
                      styles.segment,
                      goldRateKaratMode === opt.id && styles.segmentActive,
                      pressed && {opacity: 0.75},
                    ]}>
                    <Text style={[styles.segmentText, goldRateKaratMode === opt.id && styles.segmentTextActive]}>
                      {opt.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
              {goldRateKaratMode === 'karat' ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom: 8}}>
                  <View style={{flexDirection: 'row', gap: 6}}>
                    {Array.from({length: 16}, (_, i) => 24 - i).map(k => (
                      <Pressable
                        key={k}
                        accessibilityRole="button"
                        accessibilityLabel={`Karat line: ${k}K`}
                        onPress={() => {
                          selectionTick();
                          setGoldRateKaratValue(k);
                        }}
                        style={({pressed}) => [
                          styles.segment,
                          goldRateKaratValue === k && styles.segmentActive,
                          {paddingHorizontal: 12},
                          pressed && {opacity: 0.75},
                        ]}>
                        <Text style={[styles.segmentText, goldRateKaratValue === k && styles.segmentTextActive]}>
                          {k}K
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </ScrollView>
              ) : null}
              {goldRateKaratMode === 'custom' ? (
                <Field
                  label="Custom karat text"
                  value={goldRateKaratText}
                  onChangeText={setGoldRateKaratText}
                  placeholder="e.g. 22K hallmark"
                />
              ) : null}
            </>
          ) : null}

          {!editing && twoInOne ? (
            <>
              <Text style={styles.optLabel}>Mode</Text>
              <View style={styles.segmentRow}>
                {(['duplicate', 'distinct'] as const).map(m => (
                  <Pressable
                    key={m}
                    accessibilityRole="button"
                    accessibilityLabel={m === 'duplicate' ? 'Duplicate mode' : 'Separate mode'}
                    onPress={() => {
                      selectionTick();
                      setMode(m);
                    }}
                    style={({pressed}) => [
                      styles.segment,
                      mode === m && styles.segmentActive,
                      pressed && {opacity: 0.75},
                    ]}>
                    <Text style={[styles.segmentText, mode === m && styles.segmentTextActive]}>
                      {m === 'duplicate' ? 'Duplicate' : 'Separate'}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </>
          ) : null}

          {/* Bill columns — per-metal toggles for the estimate grid */}
          <View style={{marginTop: 8}}>
            <Text style={styles.switchLabel}>Bill columns</Text>
            <Text style={styles.switchSub}>
              {template === 'jewellery'
                ? 'Column toggles apply to the Modern E-commerce estimate grid — the Classic Jewellery template has its own fixed layout.'
                : 'Turn a column off to hide it from the printed bill — gold and silver have different fields.'}
            </Text>
          </View>
          {template === 'jewellery' ? null : (
            <>
              <Text style={styles.optLabel}>Gold bill</Text>
              {GOLD_ESTIMATE_COLUMNS.map(c => (
                <View key={`g-${c.id}`} style={styles.switchRow}>
                  <View style={{flex: 1, paddingRight: 12}}>
                    <Text style={styles.switchLabel}>{c.label}</Text>
                  </View>
                  <Switch
                    value={!hiddenGold.includes(c.id)}
                    onValueChange={() => {
                      selectionTick();
                      toggleColumn('gold', c.id);
                    }}
                    trackColor={{true: colors.primary, false: colors.border}}
                    thumbColor={colors.inverseOnSurface}
                  />
                </View>
              ))}
              <Text style={styles.optLabel}>Silver bill</Text>
              {SILVER_ESTIMATE_COLUMNS.map(c => (
                <View key={`s-${c.id}`} style={styles.switchRow}>
                  <View style={{flex: 1, paddingRight: 12}}>
                    <Text style={styles.switchLabel}>{c.label}</Text>
                  </View>
                  <Switch
                    value={!hiddenSilver.includes(c.id)}
                    onValueChange={() => {
                      selectionTick();
                      toggleColumn('silver', c.id);
                    }}
                    trackColor={{true: colors.primary, false: colors.border}}
                    thumbColor={colors.inverseOnSurface}
                  />
                </View>
              ))}
            </>
          )}
        </Card>

        <Card index={1}>
          <Field label="Customer" value={customer} onChangeText={setCustomer} />
          <Field label="Phone" value={customerPhone} onChangeText={setCustomerPhone} keyboardType="phone-pad" />
          <Field label="Address" value={customerAddress} onChangeText={setCustomerAddress} />
          <PartyPicker
            parties={parties}
            partyId={partyId}
            selected={parties?.find(p => p.id === partyId)?.name ?? ''}
            onChange={(id, party) => {
              setPartyId(id);
              if (party) {
                setCustomer(party.name);
                setCustomerPhone(party.phone ?? '');
                setCustomerAddress(party.address ?? '');
              }
            }}
          />
          <DateField label="Date" value={date} onChange={setDate} />
          <Field
            label="Gold karat rate (₹/g) — editing re-prices gold lines"
            value={goldRateInput}
            onChangeText={handleGoldRateChange}
            keyboardType="decimal-pad"
            placeholder={goldBaseRate != null ? String(goldBaseRate) : '—'}
            rightElement={
              rateKaratBadgeText ? (
                <View style={styles.goldCaretBadge}>
                  <Text style={styles.goldCaretBadgeText}>{rateKaratBadgeText}</Text>
                </View>
              ) : null
            }
          />
          <Field
            label={
              billSilverRate != null
                ? `Silver rate (₹/10g) ≈ ₹${billSilverRate.toFixed(2)}/g — editing re-prices silver lines`
                : 'Silver rate (₹/10g) — editing re-prices silver lines'
            }
            value={silverRateInput}
            onChangeText={handleSilverRateChange}
            keyboardType="decimal-pad"
            placeholder={shopSilverPer10g > 0 ? String(shopSilverPer10g) : '—'}
          />
          <Button
            variant="outline"
            title={syncPrices.isPending ? 'Recalculating…' : 'Recalculate prices'}
            onPress={handleSyncPrices}
            disabled={syncPrices.isPending}
          />
          {/* Same two entry points as web/desktop: browse the stock catalog,
              or scan/type a code (first empty line, else append). */}
          <AddFromStockButton products={products} onSelect={(_id, product) => addPickedToLines(setLines, product)} />
          <FastEntry onAdd={raw => addByCode(raw, 'first')} />
          <LineItemsEditor
            lines={lines}
            onChange={updateLine}
            onWeightChange={makeWeightHandler(setLines)}
            onBasisChange={makeBasisHandler(setLines)}
            onPricingChange={makePricingHandler(setLines)}
            pricing={index => (lines[index] ? pricingViewFor(lines[index]) : null)}
            onRemove={index => setLines(prev => prev.filter((_, i) => i !== index))}
            onAdd={() => setLines(prev => [...prev, emptyLine()])}
            products={products}
            onSelectProduct={onSelectProduct}
          />
          <Field label="Discount" value={discount} onChangeText={setDiscount} keyboardType="decimal-pad" />
          <Field label="Delivery charge" value={delivery} onChangeText={setDelivery} keyboardType="decimal-pad" />
            <Field label="Material returned title" value={materialReturnedTitle} onChangeText={setMaterialReturnedTitle} placeholder="Material Returned" />
            <Field label="Material returned weight" value={materialReturnedWeight} onChangeText={setMaterialReturnedWeight} placeholder="e.g. 5gm" />
            <Field label="Material returned value (₹)" value={materialReturnedValue} onChangeText={setMaterialReturnedValue} keyboardType="decimal-pad" />
          <Field label="Amount paid now (₹)" value={paid} onChangeText={setPaid} keyboardType="decimal-pad" />
          <View style={styles.switchRow}>
            <View style={{flex: 1, paddingRight: 12}}>
              <Text style={styles.switchLabel}>Auto-save the PDF</Text>
              <Text style={styles.switchSub}>
                {editing ? 'Save after saving the bill' : 'Save after creating the bill'}
              </Text>
            </View>
            <Switch
              value={autoSavePdf}
              onValueChange={value => {
                selectionTick();
                setAutoSavePdf(value);
              }}
              trackColor={{true: colors.primary, false: colors.border}}
              thumbColor={colors.inverseOnSurface}
            />
          </View>
          <View style={styles.switchRow}>
            <View style={{flex: 1, paddingRight: 12}}>
              <Text style={styles.switchLabel}>Mark as fully paid</Text>
              <Text style={styles.switchSub}>
                {`Paid becomes the full ${money(total)}${distinct ? ` · bill 2 ${money(secondTotal)}` : ''}`}
              </Text>
            </View>
            <Switch
              value={markPaid}
              onValueChange={value => {
                selectionTick();
                setMarkPaid(value);
              }}
              trackColor={{true: colors.primary, false: colors.border}}
              thumbColor={colors.inverseOnSurface}
            />
          </View>
          {/* How the advance is coming in — Cash / Online + optional note
              (recorded on the payment, shown in the invoice's Payments trail). */}
          <View>
            <Text style={styles.optLabel}>Paid via</Text>
            <View style={styles.segmentRow}>
              {[...PAYMENT_METHOD_PRESETS.map(p => ({id: p.id, label: p.label})), {id: CUSTOM_PAYMENT_METHOD, label: 'Custom…'}].map(m => (
                <Pressable
                  key={m.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Pay by ${m.label}`}
                  onPress={() => {
                    selectionTick();
                    // Custom… starts empty so the operator types the real
                    // method; a preset stores its id.
                    setPaymentMethod(m.id === CUSTOM_PAYMENT_METHOD ? '' : m.id);
                  }}
                  style={({pressed}) => [
                    styles.segment,
                    (paymentMethod === m.id || (m.id === CUSTOM_PAYMENT_METHOD && !PAYMENT_METHOD_PRESETS.some(p => p.id === paymentMethod))) && styles.segmentActive,
                    pressed && {opacity: 0.75},
                  ]}>
                  <Text style={[styles.segmentText, (paymentMethod === m.id || (m.id === CUSTOM_PAYMENT_METHOD && !PAYMENT_METHOD_PRESETS.some(p => p.id === paymentMethod))) && styles.segmentTextActive]}>
                    {m.label}
                  </Text>
                </Pressable>
              ))}
            </View>
            {!PAYMENT_METHOD_PRESETS.some(p => p.id === paymentMethod) ? (
              <Field
                label="Custom method"
                value={paymentMethod}
                onChangeText={setPaymentMethod}
                placeholder="e.g. Paytm, cheque no…"
                maxLength={40}
              />
            ) : null}
          </View>
          <Field
            label="Payment note (optional)"
            value={paymentNote}
            onChangeText={setPaymentNote}
            placeholder={paymentMethod === 'online' || (paymentMethod !== '' && paymentMethod !== 'cash') ? 'UPI id / transaction no.' : 'e.g. cash in hand'}
            maxLength={120}
          />
          <Field label="Notes / terms" value={notes} onChangeText={setNotes} placeholder="Thank you for your business!" multiline />
          <TotalsBlock
            styles={styles}
            label="Total"
            subtotal={subtotal}
            discount={Number(discount) || 0}
            delivery={Number(delivery) || 0}
            materialReturned={Number(materialReturnedValue) || 0}
            materialTitle={materialReturnedTitle}
            total={total}
            paid={markPaid ? total : Math.min(Number(paid) || 0, total)}
          />
          <Button
            title={
              saving
                ? 'Saving…'
                : editing && !editInvoice
                  ? 'Loading bill…'
                  : editing
                    ? `Save changes — ${money(total)}`
                    : 'Create invoice'
            }
            onPress={handleCreate}
            loading={saving}
            disabled={editing && !editInvoice}
          />
        </Card>

        {distinct ? (
          <Card index={2} style={{borderColor: colors.primary, borderWidth: 1}}>
            <View style={styles.secondBillHeader}>
              <Text style={styles.sectionTitle}>Second bill — separate</Text>
              <Badge text="Bill 2" tone="muted" />
            </View>
            <Field label="Customer" value={secondCustomer} onChangeText={setSecondCustomer} />
            <Field label="Phone" value={secondCustomerPhone} onChangeText={setSecondCustomerPhone} keyboardType="phone-pad" />
            <Field label="Address" value={secondCustomerAddress} onChangeText={setSecondCustomerAddress} />
            <PartyPicker
              parties={parties}
              partyId={secondPartyId}
              selected={parties?.find(p => p.id === secondPartyId)?.name ?? ''}
              onChange={(id, party) => {
                setSecondPartyId(id);
                if (party) {
                  setSecondCustomer(party.name);
                  setSecondCustomerPhone(party.phone ?? '');
                  setSecondCustomerAddress(party.address ?? '');
                }
              }}
            />
            <AddFromStockButton products={products} onSelect={(_id, product) => addPickedToLines(setSecondLines, product)} />
            <FastEntry onAdd={raw => addByCode(raw, 'second')} />
              <LineItemsEditor
                lines={secondLines}
                onChange={updateSecondLine}
                onWeightChange={makeWeightHandler(setSecondLines)}
                onBasisChange={makeBasisHandler(setSecondLines)}
                onPricingChange={makePricingHandler(setSecondLines)}
                pricing={index => (secondLines[index] ? pricingViewFor(secondLines[index]) : null)}
              onRemove={index => setSecondLines(prev => prev.filter((_, i) => i !== index))}
              onAdd={() => setSecondLines(prev => [...prev, emptyLine()])}
              products={products}
              onSelectProduct={onSecondSelectProduct}
            />
            <Field label="Discount" value={secondDiscount} onChangeText={setSecondDiscount} keyboardType="decimal-pad" />
            <Field label="Delivery charge" value={secondDelivery} onChangeText={setSecondDelivery} keyboardType="decimal-pad" />
            <Field label="Material returned title" value={secondMaterialReturnedTitle} onChangeText={setSecondMaterialReturnedTitle} placeholder="Material Returned" />
            <Field label="Material returned weight" value={secondMaterialReturnedWeight} onChangeText={setSecondMaterialReturnedWeight} placeholder="e.g. 5gm" />
            <Field label="Material returned value (₹)" value={secondMaterialReturnedValue} onChangeText={setSecondMaterialReturnedValue} keyboardType="decimal-pad" />
            <Field label="Amount paid now (₹)" value={secondPaid} onChangeText={setSecondPaid} keyboardType="decimal-pad" />
            <TotalsBlock
              styles={styles}
              label="Bill 2 total"
              subtotal={secondSubtotal}
              discount={Number(secondDiscount) || 0}
              delivery={Number(secondDelivery) || 0}
              materialReturned={Number(secondMaterialReturnedValue) || 0}
              materialTitle={secondMaterialReturnedTitle}
              total={secondTotal}
              paid={markPaid ? secondTotal : Math.min(Number(secondPaid) || 0, secondTotal)}
            />
          </Card>
        ) : null}

        {preview ? (
          <Card index={3}>
            <Text style={styles.sectionTitle}>
              Bill — {preview.billNo}
              {twoInOne ? ' (2-in-1)' : ''}
            </Text>
            {/* Structured preview — matches desktop's sidebar card */}
            <View style={styles.previewCard}>
              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>Customer</Text>
                <Text style={styles.previewValue}>{preview.customerName || 'Walk-in'}</Text>
              </View>
              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>Date</Text>
                <Text style={styles.previewValue}>{formatDate(preview.date)}</Text>
              </View>
              {preview.customerPhone ? (
                <View style={styles.previewRow}>
                  <Text style={styles.previewLabel}>Phone</Text>
                  <Text style={styles.previewValue}>{preview.customerPhone}</Text>
                </View>
              ) : null}
              <View style={styles.previewDivider} />
              {preview.lines.map((line, i) => (
                <View key={i} style={styles.previewLineItem}>
                  <Text style={styles.previewLineName} numberOfLines={1}>
                    {line.productName}
                    {line.sku ? ` (${line.sku})` : ''}
                  </Text>
                  <Text style={styles.previewLineQty}>×{line.quantity}</Text>
                  <Text style={styles.previewLinePrice}>{money(line.price * line.quantity)}</Text>
                </View>
              ))}
              <View style={styles.previewDivider} />
              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>Subtotal</Text>
                <Text style={styles.previewValue}>{money(preview.subtotal)}</Text>
              </View>
              {preview.discount > 0 ? (
                <View style={styles.previewRow}>
                  <Text style={styles.previewLabel}>Discount</Text>
                  <Text style={[styles.previewValue, {color: colors.danger}]}>-{money(preview.discount)}</Text>
                </View>
              ) : null}
              {preview.deliveryCharge > 0 ? (
                <View style={styles.previewRow}>
                  <Text style={styles.previewLabel}>Delivery</Text>
                  <Text style={styles.previewValue}>+{money(preview.deliveryCharge)}</Text>
                </View>
              ) : null}
              {preview.materialReturnedValue > 0 ? (
                <View style={styles.previewRow}>
                  <Text style={styles.previewLabel}>{preview.materialReturnedTitle?.trim() || 'Material Returned'}{preview.materialReturnedWeight ? ` (${preview.materialReturnedWeight})` : ''}</Text>
                  <Text style={[styles.previewValue, {color: colors.danger}]}>−{money(preview.materialReturnedValue)}</Text>
                </View>
              ) : null}
              <View style={[styles.previewRow, styles.previewTotalRow]}>
                <Text style={styles.previewTotalLabel}>Total</Text>
                <Text style={styles.previewTotalValue}>{money(preview.total)}</Text>
              </View>
              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>Paid</Text>
                <Text style={[styles.previewValue, {color: colors.success}]}>{money(preview.amountPaid)}</Text>
              </View>
              {preview.dueAmount > 0 ? (
                <View style={styles.previewRow}>
                  <Text style={styles.previewLabel}>Due</Text>
                  <Text style={[styles.previewValue, {color: colors.danger, fontWeight: '700'}]}>{money(preview.dueAmount)}</Text>
                </View>
              ) : null}
              <Text style={styles.previewAmountWords}>{preview.amountInWords}</Text>
            </View>
            {secondPreview ? (
              <>
                <Text style={styles.sectionTitle}>Bill 2 — {secondPreview.billNo}</Text>
                <View style={styles.previewCard}>
                  {secondPreview.lines.map((line, i) => (
                    <View key={i} style={styles.previewLineItem}>
                      <Text style={styles.previewLineName} numberOfLines={1}>
                        {line.productName}
                      </Text>
                      <Text style={styles.previewLineQty}>×{line.quantity}</Text>
                      <Text style={styles.previewLinePrice}>{money(line.price * line.quantity)}</Text>
                    </View>
                  ))}
                  <View style={[styles.previewRow, styles.previewTotalRow]}>
                    <Text style={styles.previewTotalLabel}>Total</Text>
                    <Text style={styles.previewTotalValue}>{money(secondPreview.total)}</Text>
                  </View>
                </View>
              </>
            ) : null}
            <View style={{flexDirection: 'row', gap: 8}}>
              <Button
                title={twoInOne ? 'Share 2-in-1 PDF' : 'Share PDF'}
                style={{flex: 1}}
                onPress={handlePdf}
              />
              <Button title="Share text" variant="outline" style={{flex: 1}} onPress={handleShareBill} />
            </View>
          </Card>
        ) : null}
      </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const makeStyles = () =>
  RNStyleSheet.create({
    lineBox: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 10,
      marginBottom: 10,
    },
    productPicker: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      marginBottom: 8,
      backgroundColor: colors.card,
    },
    partyPicker: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      marginBottom: 12,
      backgroundColor: colors.card,
    },
    pickerLabel: {fontSize: 11, color: colors.muted, fontWeight: '600'},
    pickerValue: {fontSize: 15, color: colors.text, marginTop: 2},
    searchWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.md,
      paddingHorizontal: spacing.md,
      marginBottom: spacing.md,
      backgroundColor: colors.card,
    },
    searchInput: {paddingVertical: spacing.md, fontSize: typography.body},
    pickRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 4,
      borderBottomWidth: RNStyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    lineRow: {flexDirection: 'row'},
    lineSummary: {flexDirection: 'row', alignItems: 'center', paddingVertical: 4, gap: 6},
    lineSummaryName: {flex: 1, fontSize: 14, fontWeight: '700', color: colors.text},
    lineSummaryMeta: {fontSize: 12, color: colors.muted},
    lineSummaryTotal: {fontSize: 14, fontWeight: '700', color: colors.primary},
    skuRow: {flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6},
    skuChip: {
      fontSize: 11,
      fontFamily: 'monospace',
      color: colors.muted,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.sm,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    skuCopy: {fontSize: 11, fontWeight: '600', color: colors.primary},
    pricingStrip: {
      borderTopWidth: RNStyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      paddingTop: 8,
      marginTop: 2,
      marginBottom: 4,
      gap: 6,
    },
    pricingLabel: {fontSize: 11, color: colors.muted, fontWeight: '600', marginBottom: 4},
    labourSegRow: {flexDirection: 'row', gap: 4},
    labourSegBtn: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.sm,
      paddingVertical: 8,
      alignItems: 'center',
      backgroundColor: colors.card,
    },
    labourSegBtnActive: {backgroundColor: colors.primary, borderColor: colors.primary},
    labourSegText: {fontSize: 12, fontWeight: '600', color: colors.muted},
    labourSegTextActive: {color: colors.onPrimary},
    pricingReadout: {fontSize: 11, color: colors.muted, fontVariant: ['tabular-nums'], marginBottom: 4},
    total: {fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 12},
    totalBreakdown: {marginTop: 4, marginBottom: 10, gap: 3},
    totalRow: {flexDirection: 'row', justifyContent: 'space-between'},
    totalRowLabel: {fontSize: 13, color: colors.muted},
    totalRowValue: {fontSize: 13, color: colors.text, fontVariant: ['tabular-nums']},
    sectionTitle: {fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 8},
    secondBillHeader: {flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4},
    optLabel: {fontSize: 12, fontWeight: '600', color: colors.muted, marginBottom: 6},
    scanMessage: {fontSize: 12, color: colors.danger, marginTop: 4, marginBottom: 8},
    segmentRow: {flexDirection: 'row', gap: 8, marginBottom: 14},
    segment: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingVertical: 8,
      paddingHorizontal: 10,
      alignItems: 'center',
    },
    segmentActive: {borderColor: colors.primary, backgroundColor: colors.accent},
    segmentText: {fontSize: 12, fontWeight: '600', color: colors.muted, textAlign: 'center'},
    segmentTextActive: {color: colors.primary},
    colorRow: {flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14},
    colorDotWrap: {borderWidth: 2, borderColor: 'transparent', borderRadius: 16, padding: 2},
    colorDotActive: {borderColor: colors.primary},
    colorDot: {width: 28, height: 28, borderRadius: 14},
    colorHint: {fontSize: 12, color: colors.muted, fontWeight: '600'},
    switchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 4,
    },
    switchLabel: {fontSize: 14, fontWeight: '700', color: colors.text},
    switchSub: {fontSize: 12, color: colors.muted, marginTop: 2},
    previewText: {
      fontSize: 12,
      color: colors.text,
      fontFamily: 'monospace',
      marginBottom: 12,
      lineHeight: 18,
    },
    previewCard: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 12,
      marginBottom: 12,
      backgroundColor: colors.bg,
    },
    previewRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 4,
    },
    previewLabel: {fontSize: 12, color: colors.muted},
    previewValue: {fontSize: 13, fontWeight: '600', color: colors.text},
    previewDivider: {height: 1, backgroundColor: colors.border, marginVertical: 8},
    previewLineItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 3,
      gap: 8,
    },
    previewLineName: {flex: 1, fontSize: 13, color: colors.text},
    previewLineQty: {fontSize: 12, color: colors.muted, width: 30, textAlign: 'right'},
    previewLinePrice: {fontSize: 13, fontWeight: '600', color: colors.text, width: 80, textAlign: 'right'},
    previewTotalRow: {
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: 8,
      marginTop: 4,
    },
    previewTotalLabel: {fontSize: 14, fontWeight: '700', color: colors.text},
    previewTotalValue: {fontSize: 16, fontWeight: '700', color: colors.primary},
    previewAmountWords: {
      fontSize: 11,
      color: colors.muted,
      fontStyle: 'italic',
      marginTop: 8,
      textAlign: 'center',
    },
    row: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
    paidDueStrip: {
      flexDirection: 'row' as const,
      justifyContent: 'space-between' as const,
      alignItems: 'center' as const,
      backgroundColor: colors.mutedSoft,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      marginTop: spacing.sm,
    },
    paidDueLabel: {fontSize: typography.caption, color: colors.muted},
    paidDueValue: {fontWeight: '700' as const, color: colors.text},
    /** Small pill showing which karat the gold-rate field is priced at. */
    goldCaretBadge: {
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 4,
      backgroundColor: colors.primary + '22',
    },
    goldCaretBadgeText: {
      fontSize: 11,
      fontWeight: '700' as const,
      color: colors.primary,
    },
    name: {fontSize: 15, fontWeight: '600', color: colors.text},
    meta: {fontSize: 12, color: colors.muted, marginTop: 2},
  });

