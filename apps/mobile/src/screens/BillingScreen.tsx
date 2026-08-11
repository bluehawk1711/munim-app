import React, {useMemo, useState} from 'react';
import {ScrollView, Share, StyleSheet, Text, View} from 'react-native';
import * as Print from 'expo-print';
import {
  createInvoice,
  getSettings,
  listInvoices,
  buildBillDocument,
  renderBillText,
  renderBillHtml,
  formatDate,
  type BillDocument,
} from '@munim/core';
import {getCore} from '../lib/core';
import {useAsync} from '../lib/use-async';
import {money} from '../lib/format';
import {successFeedback, errorFeedback} from '../lib/haptics';
import {
  Badge,
  Button,
  Card,
  Empty,
  Field,
  Header,
  Loading,
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

export function BillingScreen() {
  const styles = useThemeStyles(makeStyles);
  const {data: settings} = useAsync(async () => getSettings(await getCore()), []);
  const {data: list, loading, reload: reloadList} = useAsync(
    async () => listInvoices(await getCore(), {pageSize: 50}),
    [],
  );

  const [customer, setCustomer] = useState('');
  const [discount, setDiscount] = useState('0');
  const [paid, setPaid] = useState('0');
  const [lines, setLines] = useState<LineState[]>([emptyLine()]);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<BillDocument | null>(null);

  const subtotal = useMemo(
    () => lines.reduce((sum, l) => sum + (Number(l.quantity) || 0) * (Number(l.price) || 0), 0),
    [lines],
  );
  const total = Math.max(0, subtotal - (Number(discount) || 0));

  async function handleCreate() {
    const items = lines
      .map(l => ({
        productId: l.productId || undefined,
        productName: l.productName.trim(),
        quantity: Number(l.quantity) || 0,
        price: Number(l.price) || 0,
      }))
      .filter(it => it.productName && it.quantity > 0);
    if (items.length === 0) {
      return;
    }
    setSaving(true);
    try {
      const shop = settings
        ? {name: settings.shopName, address: settings.shopAddress ?? '', phones: settings.shopPhones, email: settings.shopEmail ?? ''}
        : undefined;
      const invoice = await createInvoice(await getCore(), {
        customerName: customer.trim() || undefined,
        items,
        discount: Number(discount) || 0,
        amountPaid: Number(paid) || 0,
        paymentMethod: 'cash',
        shopDetails: shop,
      });
      if (invoice) {
        const doc = buildBillDocument({
          billNo: invoice.invoiceNumber,
          date: invoice.date,
          customerName: invoice.customerName,
          customerPhone: invoice.customerPhone,
          customerAddress: invoice.customerAddress,
          shop: shop ?? {name: settings?.shopName ?? 'My Shop', address: null, phones: [], email: null},
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
        setPreview(doc);
        setCustomer('');
        setDiscount('0');
        setPaid('0');
        setLines([emptyLine()]);
        reloadList();
        successFeedback();
      }
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
      await Share.share({message: renderBillText(preview)});
    } catch {
      // user cancelled share
    }
  }

  async function handlePdf() {
    if (!preview) {
      return;
    }
    try {
      const {uri} = await Print.printToFileAsync({
        html: renderBillHtml(preview),
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
        <Card index={0}>
          <Field label="Customer" value={customer} onChangeText={setCustomer} />
          {lines.map((line, index) => (
            <View key={index} style={styles.lineBox}>
              <Field
                label={`Item ${index + 1} name`}
                value={line.productName}
                onChangeText={text => {
                  const updated = [...lines];
                  updated[index] = {...updated[index]!, productName: text};
                  setLines(updated);
                }}
              />
              <View style={styles.lineRow}>
                <Field
                  label="Qty"
                  value={line.quantity}
                  onChangeText={text => {
                    const updated = [...lines];
                    updated[index] = {...updated[index]!, quantity: text};
                    setLines(updated);
                  }}
                  keyboardType="numeric"
                  style={{flex: 1, marginRight: 8}}
                />
                <Field
                  label="Price"
                  value={line.price}
                  onChangeText={text => {
                    const updated = [...lines];
                    updated[index] = {...updated[index]!, price: text};
                    setLines(updated);
                  }}
                  keyboardType="numeric"
                  style={{flex: 2}}
                />
              </View>
              {index > 0 ? (
                <Button
                  title="Remove item"
                  variant="outline"
                  onPress={() => setLines(prev => prev.filter((_, i) => i !== index))}
                />
              ) : null}
            </View>
          ))}
          <Button
            title="+ Add item"
            variant="outline"
            onPress={() => setLines(prev => [...prev, emptyLine()])}
            style={{marginBottom: 12}}
          />
          <Field label="Discount" value={discount} onChangeText={setDiscount} keyboardType="numeric" />
          <Field label="Paid now" value={paid} onChangeText={setPaid} keyboardType="numeric" />
          <Text style={styles.total}>Total: {money(total)}</Text>
          <Button title={saving ? 'Saving…' : 'Create invoice'} onPress={handleCreate} loading={saving} />
        </Card>

        {preview ? (
          <Card index={1}>
            <Text style={styles.sectionTitle}>Bill preview — {preview.billNo}</Text>
            <Text style={styles.previewText}>{renderBillText(preview)}</Text>
            <View style={{flexDirection: 'row', gap: 8}}>
              <Button title="Share PDF" style={{flex: 1}} onPress={handlePdf} />
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
    lineRow: {flexDirection: 'row'},
    total: {fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 12},
    sectionTitle: {fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 8},
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
