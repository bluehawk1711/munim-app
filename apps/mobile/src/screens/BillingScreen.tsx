import React, {useMemo, useState} from 'react';
import {Alert, FlatList, KeyboardAvoidingView, ListRenderItemInfo, Platform, Pressable, ScrollView, Share, StyleSheet, Switch, Text, TextInput, View} from 'react-native';
import * as Print from 'expo-print';
import {ChevronDown, Search} from 'lucide-react-native';
import {
  buildBillDocument,
  renderBillText,
  renderBillHtml,
  formatDate,
  swatchColor,
  type BillDocument,
  type BillTemplate,
  type BillClassicColor,
  type BillMode,
  type BillTemplateSettings,
  type PartyDto,
  type InvoiceDto,
  type ProductDto,
} from '@munim/core';
import {
  useCreateInvoice,
  useParties,
  useProducts,
  useQueryState,
  useSettings,
} from '@munim/query';
import {money} from '../lib/format';
import {successFeedback, errorFeedback, selectionTick} from '../lib/haptics';
import {
  Badge,
  Button,
  Card,
  Empty,
  Field,
  Loading,
  ModalSheet,
  Screen,
  Section,
  colors,
} from '../components/ui';
import {HomeHeader, headerScrollHandlers} from '../components/home-header';
import {DateField, toYmd} from '../components/date-field';
import {useThemeStyles} from '../theme';
import {rw, rs, spacing, typography, radii} from '../lib/responsive';
import {StyleSheet as RNStyleSheet} from 'react-native';

type LineState = {
  productId: string;
  productName: string;
  sku: string;
  color: string;
  size: string;
  quantity: string;
  price: string;
};

const emptyLine = (): LineState => ({
  productId: '',
  productName: '',
  sku: '',
  color: '',
  size: '',
  quantity: '1',
  price: '0',
});

const TYPE_LABELS: Record<string, string> = {
  CUSTOMER: 'Customer',
  SUPPLIER: 'Supplier',
  WORKER: 'Worker',
  OTHER: 'Other',
};

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
  const [query, setQuery] = useState('');
  const filtered = useMemo(
    () =>
      query
        ? (products ?? []).filter(
            p =>
              p.name.toLowerCase().includes(query.toLowerCase()) ||
              p.sku.toLowerCase().includes(query.toLowerCase()),
          )
        : products ?? [],
    [products, query],
  );
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
      <ModalSheet visible={open} title="Select product" onClose={() => setOpen(false)} centered scrollable>
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
          renderItem={({item}: ListRenderItemInfo<ProductDto>) => (
            <Pressable
              onPress={() => {
                selectionTick();
                onSelect(item.id, item);
                setOpen(false);
                setQuery('');
              }}
              style={({pressed}) => [
                styles.pickRow,
                productId === item.id && {backgroundColor: colors.mutedBg},
                pressed && {backgroundColor: colors.mutedBg},
              ]}>
              <View style={{flex: 1}}>
                <Text style={{flex: 1, fontSize: 15, color: colors.text, fontWeight: '600'}} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={{fontSize: 12, color: colors.muted}}>{item.sku}</Text>
              </View>
              <Text style={{fontSize: 14, color: colors.text, fontWeight: '700', marginLeft: spacing.sm}}>
                ₹{Number(item.sellingPrice).toFixed(0)}
              </Text>
            </Pressable>
          )}
        />
      </ModalSheet>
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

/** Line-item editor shared by bill 1 and the 2-in-1 Separate bill 2. */
function LineItemsEditor({
  lines,
  onChange,
  onRemove,
  onAdd,
  products,
  productIds,
  onSelectProduct,
}: {
  lines: LineState[];
  onChange: (index: number, patch: Partial<LineState>) => void;
  onRemove: (index: number) => void;
  onAdd: () => void;
  products: ProductDto[] | null | undefined;
  productIds: string[];
  onSelectProduct: (lineIndex: number, productId: string, product?: ProductDto) => void;
}) {
  const styles = useThemeStyles(makeStyles);
  return (
    <>
      {lines.map((line, index) => (
        <View key={index} style={styles.lineBox}>
          <ProductPicker
            products={products}
            productId={line.productId}
            onSelect={(id, product) => onSelectProduct(index, id, product)}
          />
          <Field
            label="Item name"
            value={line.productName}
            onChangeText={text => onChange(index, {productName: text})}
            placeholder="Or type manually"
          />
          <View style={styles.lineRow}>
            <Field
              label="Qty"
              value={line.quantity}
              onChangeText={text => onChange(index, {quantity: text})}
              keyboardType="numeric"
              style={{flex: 1, marginRight: 8}}
            />
            <Field
              label="Price"
              value={line.price}
              onChangeText={text => onChange(index, {price: text})}
              keyboardType="numeric"
              style={{flex: 2}}
            />
          </View>
          {index > 0 ? (
            <Button title="Remove item" variant="outline" onPress={() => onRemove(index)} />
          ) : null}
        </View>
      ))}
      <Button title="+ Add item" variant="outline" onPress={onAdd} style={{marginBottom: 12}} />
    </>
  );
}

/** Live math strip: subtotal − discount + delivery = total (matches core's bill engine). */
function TotalsBlock({
  styles,
  label,
  subtotal,
  discount,
  delivery,
  total,
}: {
  styles: ReturnType<typeof makeStyles>;
  label: string;
  subtotal: number;
  discount: number;
  delivery: number;
  total: number;
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
    </View>
  );
}

export function BillingScreen() {
  const styles = useThemeStyles(makeStyles);
  const {data: settings} = useQueryState(useSettings());
  const {data: parties} = useQueryState(useParties());
  const {data: productsData, loading: productsLoading} = useQueryState(useProducts({pageSize: 500}));
  const products = productsData?.products;
  const createInvoice = useCreateInvoice();

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
  const [lines, setLines] = useState<LineState[]>([emptyLine()]);

  // ── Template options (same model as web + desktop) ──────────────────────
  const [template, setTemplate] = useState<BillTemplate>('jewellery');
  const [classicColor, setClassicColor] = useState<BillClassicColor>('red');
  const [twoInOne, setTwoInOne] = useState(false);
  const [mode, setMode] = useState<BillMode>('duplicate');

  // ── Bill 2 — only used in 2-in-1 "Separate" mode ───────────────────────
  const [secondCustomer, setSecondCustomer] = useState('');
  const [secondCustomerPhone, setSecondCustomerPhone] = useState('');
  const [secondCustomerAddress, setSecondCustomerAddress] = useState('');
  const [secondPartyId, setSecondPartyId] = useState('');
  const [secondDiscount, setSecondDiscount] = useState('0');
  const [secondDelivery, setSecondDelivery] = useState('0');
  const [secondPaid, setSecondPaid] = useState('0');
  const [secondLines, setSecondLines] = useState<LineState[]>([emptyLine()]);
  const [secondPreview, setSecondPreview] = useState<BillDocument | null>(null);

  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<BillDocument | null>(null);

  const distinct = twoInOne && mode === 'distinct';

  const subtotal = useMemo(
    () => lines.reduce((sum, l) => sum + (Number(l.quantity) || 0) * (Number(l.price) || 0), 0),
    [lines],
  );
  // Same totals math as web/desktop: subtotal − discount + delivery.
  const total = Math.max(0, subtotal - (Number(discount) || 0) + (Number(delivery) || 0));
  const secondSubtotal = useMemo(
    () => secondLines.reduce((sum, l) => sum + (Number(l.quantity) || 0) * (Number(l.price) || 0), 0),
    [secondLines],
  );
  const secondTotal = Math.max(0, secondSubtotal - (Number(secondDiscount) || 0) + (Number(secondDelivery) || 0));

  const productIds = useMemo(() => lines.map(l => l.productId), [lines]);

  function updateLine(index: number, patch: Partial<LineState>) {
    setLines(prev => prev.map((l, i) => (i === index ? {...l, ...patch} : l)));
  }

  function updateSecondLine(index: number, patch: Partial<LineState>) {
    setSecondLines(prev => prev.map((l, i) => (i === index ? {...l, ...patch} : l)));
  }

  function onSelectProduct(lineIndex: number, productId: string, product?: ProductDto) {
    updateLine(lineIndex, {
      productId,
      productName: product?.name ?? '',
      sku: product?.sku ?? '',
      color: product?.color ?? '',
      size: product?.size ?? '',
      price: product ? String(product.sellingPrice) : '',
    });
  }

  function onSecondSelectProduct(lineIndex: number, productId: string, product?: ProductDto) {
    updateSecondLine(lineIndex, {
      productId,
      productName: product?.name ?? '',
      sku: product?.sku ?? '',
      color: product?.color ?? '',
      size: product?.size ?? '',
      price: product ? String(product.sellingPrice) : '',
    });
  }

  function collectItems(list: LineState[]) {
    return list
      .map(l => ({
        productId: l.productId || undefined,
        productName: l.productName.trim(),
        sku: l.sku.trim() || undefined,
        color: l.color.trim() || undefined,
        size: l.size.trim() || undefined,
        quantity: Number(l.quantity) || 0,
        price: Number(l.price) || 0,
      }))
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
        quantity: it.quantity,
        price: it.price,
      })),
      discount: invoice.discount,
      deliveryCharge: invoice.deliveryCharge,
      amountPaid: invoice.amountPaid,
      status: invoice.status,
      currency: settings?.currency ?? 'INR',
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
    setSecondCustomer('');
    setSecondCustomerPhone('');
    setSecondCustomerAddress('');
    setSecondPartyId('');
    setSecondDiscount('0');
    setSecondDelivery('0');
    setSecondPaid('0');
    setSecondLines([emptyLine()]);
  }

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
    const zeroPriceIdx = items.findIndex(it => !(it.price > 0));
    if (zeroPriceIdx >= 0) {
      errorFeedback();
      Alert.alert(
        'Price needed',
        `Set a price above 0 for item ${zeroPriceIdx + 1} — picking a product auto-fills its selling price.`,
      );
      return;
    }
    if (total <= 0) {
      errorFeedback();
      Alert.alert(
        'Total is zero',
        'The bill total must be above 0 — check item prices, discount and delivery charge.',
      );
      return;
    }
    const secondItems = distinct ? collectItems(secondLines) : [];
    if (distinct && secondItems.length === 0) {
      errorFeedback();
      Alert.alert('Second bill needed', 'Separate mode needs at least one item in Bill 2.');
      return;
    }
    const secondZeroIdx = distinct ? secondItems.findIndex(it => !(it.price > 0)) : -1;
    if (secondZeroIdx >= 0) {
      errorFeedback();
      Alert.alert('Bill 2 price needed', `Set a price above 0 for item ${secondZeroIdx + 1} in Bill 2.`);
      return;
    }
    if (distinct && secondTotal <= 0) {
      errorFeedback();
      Alert.alert('Bill 2 total is zero', 'Bill 2 total must be above 0 — check its item prices, discount and delivery charge.');
      return;
    }
    setSaving(true);
    try {
      const shop = settings
        ? {name: settings.shopName, address: settings.shopAddress ?? '', phones: settings.shopPhones, email: settings.shopEmail ?? ''}
        : undefined;
      // Same template snapshot web saves — the options follow each invoice.
      const templateSettings: BillTemplateSettings = {template, classicColor, twoInOne, mode};
      const shared = {
        date: date || undefined,
        notes: notes.trim() || undefined,
      };
      const invoice = await createInvoice.mutateAsync({
        customerName: customer.trim() || undefined,
        customerPhone: customerPhone.trim() || undefined,
        customerAddress: customerAddress.trim() || undefined,
        partyId: partyId || undefined,
        ...shared,
        items,
        discount: Number(discount) || 0,
        deliveryCharge: Number(delivery) || 0,
        amountPaid: Number(paid) || 0,
        paymentMethod: 'cash',
        shopDetails: shop,
        templateSettings,
      });
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
            amountPaid: Number(secondPaid) || 0,
            paymentMethod: 'cash',
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
      void generateAndSharePdf(doc, secondDoc);
    } catch {
      errorFeedback('Failed to create bill');
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
      let message = renderBillText(preview);
      if (twoInOne && secondPreview) {
        message = `${message}\n\n──────────\n\n${renderBillText(secondPreview)}`;
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
      let html = renderBillHtml(preview);
      if (twoInOne) {
        const second = secondPreview ? renderBillHtml(secondPreview) : html;
        html = `${html}<div style="page-break-after: always"></div>${second}`;
      }
      const {uri} = await Print.printToFileAsync({
        html,
        base64: false,
      });
      await Share.share({url: uri, message: `Bill ${preview.billNo} — ${preview.shop.name}`});
    } catch {
      // user cancelled share or print failed
    }
  }

  /** Auto-generate PDF after invoice creation — same flow as web's handleSaveAndPrint. */
  async function generateAndSharePdf(doc: BillDocument, secondDoc?: BillDocument | null) {
    try {
      let html = renderBillHtml(doc);
      if (secondDoc) {
        html = `${html}<div style="page-break-after: always"></div>${renderBillHtml(secondDoc)}`;
      }
      const {uri} = await Print.printToFileAsync({html, base64: false});
      await Share.share({url: uri, message: `Bill ${doc.billNo} — ${doc.shop.name}`});
    } catch {
      // user cancelled — bill is already saved, no error needed
    }
  }

  return (
    <Screen>
      <HomeHeader title="Billing" />
      <KeyboardAvoidingView style={{flex: 1}} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{paddingBottom: 90}} {...headerScrollHandlers}>
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

          {twoInOne ? (
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
          <LineItemsEditor
            lines={lines}
            onChange={updateLine}
            onRemove={index => setLines(prev => prev.filter((_, i) => i !== index))}
            onAdd={() => setLines(prev => [...prev, emptyLine()])}
            products={products}
            productIds={productIds}
            onSelectProduct={onSelectProduct}
          />
          <Field label="Discount" value={discount} onChangeText={setDiscount} keyboardType="numeric" />
          <Field label="Delivery charge" value={delivery} onChangeText={setDelivery} keyboardType="numeric" />
          <Field label="Paid now" value={paid} onChangeText={setPaid} keyboardType="numeric" />
          <Field label="Notes / terms" value={notes} onChangeText={setNotes} placeholder="Thank you for your business!" multiline />
          <TotalsBlock
            styles={styles}
            label="Total"
            subtotal={subtotal}
            discount={Number(discount) || 0}
            delivery={Number(delivery) || 0}
            total={total}
          />
          <Button title={saving ? 'Saving…' : 'Create invoice'} onPress={handleCreate} loading={saving} />
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
            <LineItemsEditor
              lines={secondLines}
              onChange={updateSecondLine}
              onRemove={index => setSecondLines(prev => prev.filter((_, i) => i !== index))}
              onAdd={() => setSecondLines(prev => [...prev, emptyLine()])}
              products={products}
              productIds={productIds}
              onSelectProduct={onSecondSelectProduct}
            />
            <Field label="Discount" value={secondDiscount} onChangeText={setSecondDiscount} keyboardType="numeric" />
            <Field label="Delivery charge" value={secondDelivery} onChangeText={setSecondDelivery} keyboardType="numeric" />
            <Field label="Paid now" value={secondPaid} onChangeText={setSecondPaid} keyboardType="numeric" />
            <TotalsBlock
              styles={styles}
              label="Bill 2 total"
              subtotal={secondSubtotal}
              discount={Number(secondDiscount) || 0}
              delivery={Number(secondDelivery) || 0}
              total={secondTotal}
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
    total: {fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 12},
    totalBreakdown: {marginTop: 4, marginBottom: 10, gap: 3},
    totalRow: {flexDirection: 'row', justifyContent: 'space-between'},
    totalRowLabel: {fontSize: 13, color: colors.muted},
    totalRowValue: {fontSize: 13, color: colors.text, fontVariant: ['tabular-nums']},
    sectionTitle: {fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 8},
    secondBillHeader: {flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4},
    optLabel: {fontSize: 12, fontWeight: '600', color: colors.muted, marginBottom: 6},
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
    name: {fontSize: 15, fontWeight: '600', color: colors.text},
    meta: {fontSize: 12, color: colors.muted, marginTop: 2},
  });
