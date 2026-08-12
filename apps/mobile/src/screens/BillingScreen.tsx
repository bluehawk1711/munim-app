import React, {useMemo, useState} from 'react';
import {Alert, FlatList, Pressable, ScrollView, Share, StyleSheet, Switch, Text, View} from 'react-native';
import * as Print from 'expo-print';
import {ChevronDown} from 'lucide-react-native';
import {
  createInvoice,
  getSettings,
  listInvoices,
  listParties,
  buildBillDocument,
  renderBillText,
  renderBillHtml,
  formatDate,
  type BillDocument,
  type BillTemplate,
  type BillClassicColor,
  type BillMode,
  type BillTemplateSettings,
  type Party,
} from '@munim/core';
import {getCore} from '../lib/core';
import {useAsync} from '../lib/use-async';
import {money} from '../lib/format';
import {successFeedback, errorFeedback, selectionTick} from '../lib/haptics';
import {
  Badge,
  Button,
  Card,
  Empty,
  Field,
  Header,
  Loading,
  ModalSheet,
  Screen,
  Section,
  colors,
} from '../components/ui';
import {useThemeStyles} from '../theme';

type LineState = {
  productId: string;
  productName: string;
  quantity: string;
  price: string;
};

const emptyLine = (): LineState => ({productId: '', productName: '', quantity: '1', price: '0'});

const TYPE_LABELS: Record<string, string> = {
  CUSTOMER: 'Customer',
  SUPPLIER: 'Supplier',
  WORKER: 'Worker',
  OTHER: 'Other',
};

/** "Link to khata party" picker — same behaviour as web: selecting a party
 * pre-fills the customer name/phone/address; "None (walk-in)" clears it. */
function PartyPicker({
  parties,
  partyId,
  selected,
  onChange,
}: {
  parties: Party[] | null | undefined;
  partyId: string;
  selected: string;
  onChange: (id: string, party?: Party) => void;
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
      <ModalSheet visible={open} title="Select party" onClose={() => setOpen(false)}>
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
          renderItem={({item}) => (
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
}: {
  lines: LineState[];
  onChange: (index: number, patch: Partial<LineState>) => void;
  onRemove: (index: number) => void;
  onAdd: () => void;
}) {
  const styles = useThemeStyles(makeStyles);
  return (
    <>
      {lines.map((line, index) => (
        <View key={index} style={styles.lineBox}>
          <Field
            label={`Item ${index + 1} name`}
            value={line.productName}
            onChangeText={text => onChange(index, {productName: text})}
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

export function BillingScreen() {
  const styles = useThemeStyles(makeStyles);
  const {data: settings} = useAsync(async () => getSettings(await getCore()), []);
  const {data: parties} = useAsync(async () => listParties(await getCore()), []);
  const {data: list, loading, reload: reloadList} = useAsync(
    async () => listInvoices(await getCore(), {pageSize: 50}),
    [],
  );

  // ── Bill 1 ──────────────────────────────────────────────────────────────
  const [customer, setCustomer] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [partyId, setPartyId] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
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

  function updateLine(index: number, patch: Partial<LineState>) {
    setLines(prev => prev.map((l, i) => (i === index ? {...l, ...patch} : l)));
  }

  function updateSecondLine(index: number, patch: Partial<LineState>) {
    setSecondLines(prev => prev.map((l, i) => (i === index ? {...l, ...patch} : l)));
  }

  function collectItems(list: LineState[]) {
    return list
      .map(l => ({
        productId: l.productId || undefined,
        productName: l.productName.trim(),
        quantity: Number(l.quantity) || 0,
        price: Number(l.price) || 0,
      }))
      .filter(it => it.productName && it.quantity > 0);
  }

  /** Shared bill model (core) — identical numbers to web + desktop. */
  function toBillDocument(
    invoice: NonNullable<Awaited<ReturnType<typeof createInvoice>>>,
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
    setDate(new Date().toISOString().slice(0, 10));
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
      return;
    }
    if (distinct && collectItems(secondLines).length === 0) {
      errorFeedback();
      Alert.alert('Second bill needed', 'Separate mode needs at least one item in Bill 2.');
      return;
    }
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      errorFeedback();
      Alert.alert('Invalid date', 'Use YYYY-MM-DD (e.g. 2026-08-12).');
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
      const invoice = await createInvoice(await getCore(), {
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
      if (!invoice) {
        throw new Error('Failed to create invoice');
      }
      const doc = toBillDocument(invoice, shop);
      let secondDoc: BillDocument | null = null;

      if (distinct) {
        try {
          const secondInvoice = await createInvoice(await getCore(), {
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
          if (secondInvoice) {
            secondDoc = toBillDocument(secondInvoice, shop);
          }
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
          reloadList();
          return;
        }
      }

      setPreview(doc);
      if (secondDoc) {
        setSecondPreview(secondDoc);
      }
      resetForm();
      reloadList();
      successFeedback();
    } catch {
      errorFeedback();
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
        // 2-in-1 sheet: Duplicate repeats bill 1, Separate stacks bill 2.
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

  return (
    <Screen>
      <Header title="Billing" subtitle="Create an invoice — same shared bill as web & desktop" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{paddingBottom: 90}}>
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
                    <View style={[styles.colorDot, {backgroundColor: c === 'red' ? '#dc2626' : '#eab308'}]} />
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
              thumbColor="#ffffff"
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
          <Field
            label="Date (YYYY-MM-DD)"
            value={date}
            onChangeText={setDate}
            placeholder="2026-08-12"
            keyboardType="numbers-and-punctuation"
          />
          <LineItemsEditor
            lines={lines}
            onChange={updateLine}
            onRemove={index => setLines(prev => prev.filter((_, i) => i !== index))}
            onAdd={() => setLines(prev => [...prev, emptyLine()])}
          />
          <Field label="Discount" value={discount} onChangeText={setDiscount} keyboardType="numeric" />
          <Field label="Delivery charge" value={delivery} onChangeText={setDelivery} keyboardType="numeric" />
          <Field label="Paid now" value={paid} onChangeText={setPaid} keyboardType="numeric" />
          <Field label="Notes / terms" value={notes} onChangeText={setNotes} placeholder="Thank you for your business!" multiline />
          <Text style={styles.total}>Total: {money(total)}</Text>
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
            />
            <Field label="Discount" value={secondDiscount} onChangeText={setSecondDiscount} keyboardType="numeric" />
            <Field label="Delivery charge" value={secondDelivery} onChangeText={setSecondDelivery} keyboardType="numeric" />
            <Field label="Paid now" value={secondPaid} onChangeText={setSecondPaid} keyboardType="numeric" />
            <Text style={styles.total}>Bill 2 total: {money(secondTotal)}</Text>
          </Card>
        ) : null}

        {preview ? (
          <Card index={3}>
            <Text style={styles.sectionTitle}>
              Bill preview — {preview.billNo}
              {twoInOne ? ' (2-in-1)' : ''}
            </Text>
            <Text style={styles.previewText}>{renderBillText(preview)}</Text>
            {secondPreview ? (
              <>
                <Text style={styles.sectionTitle}>Bill 2 — {secondPreview.billNo}</Text>
                <Text style={styles.previewText}>{renderBillText(secondPreview)}</Text>
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

        <Section title="Invoices" index={preview ? 2 : 1} />
        {loading || !list ? (
          <Loading />
        ) : list.invoices.length === 0 ? (
          <Empty text="No invoices yet" />
        ) : (
          list.invoices.map((inv, i) => (
            <Card key={inv.id} index={3 + i}>
              <View style={styles.row}>
                <View style={{flex: 1}}>
                  <Text style={styles.name}>{inv.invoiceNumber}</Text>
                  <Text style={styles.meta}>
                    {inv.customerName ?? 'Walk-in'} · {formatDate(inv.date)}
                  </Text>
                </View>
                <View style={{alignItems: 'flex-end', gap: 4}}>
                  <Text style={styles.name}>{money(inv.total)}</Text>
                  <Badge
                    text={inv.status}
                    tone={inv.status === 'PAID' ? 'success' : inv.status === 'PARTIAL' ? 'warning' : 'muted'}
                  />
                </View>
              </View>
            </Card>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

const makeStyles = () =>
  StyleSheet.create({
    lineBox: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 10,
      marginBottom: 10,
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
    pickRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 4,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    lineRow: {flexDirection: 'row'},
    total: {fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 12},
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
    row: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
    name: {fontSize: 15, fontWeight: '600', color: colors.text},
    meta: {fontSize: 12, color: colors.muted, marginTop: 2},
  });
