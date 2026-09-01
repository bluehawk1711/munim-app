/**
 * SalesScreen — quick sale entry, recent sales, record payment.
 *
 * Redesigned with:
 * - Clear visual hierarchy: product selection → quantity → sale action
 * - BottomSheet-based product picker with search
 * - Responsive layout
 * - FlashList for recent sales
 */

import React, {useEffect, useMemo, useState} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {FlashList} from '@shopify/flash-list';
import {formatDate, type InvoiceDto} from '@munim/core';
import {useCreateSale, useInvoices, useProducts, useQueryState, useRecordInvoicePayment} from '@munim/query';
import {successFeedback, errorFeedback} from '../lib/haptics';
import {money} from '../lib/format';
import {rw, rh, rs, typography, spacing, radii, CARD_MARGIN, TOUCH_TARGET} from '../lib/responsive';
import {
  Badge,
  Button,
  Card,
  Empty,
  ErrorBox,
  Field,
  Header,
  Loading,
  ModalSheet,
  Screen,
  colors,
} from '../components/ui';
import {useThemeStyles} from '../theme';

export function SalesScreen() {
  const styles = useThemeStyles(makeStyles);
  const {data: productsData, reload: reloadProducts} = useQueryState(useProducts({pageSize: 500}));
  const products = productsData?.products;
  const {data: recent, loading} = useQueryState(useInvoices({pageSize: 20}));

  // Product selection
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState('');
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [price, setPrice] = useState('');
  const [customer, setCustomer] = useState('');
  const [saving, setSaving] = useState(false);

  // Payment
  const [paying, setPaying] = useState<InvoiceDto | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('cash');
  const [payingNow, setPayingNow] = useState(false);
  const recordPayment = useRecordInvoicePayment(paying?.id ?? '');
  const createSale = useCreateSale();

  const selected = useMemo(() => products?.find(p => p.id === productId) ?? null, [products, productId]);
  const total = (Number(quantity) || 0) * (Number(price) || 0);

  // Filtered products for picker
  const filteredProducts = useMemo(() => {
    const list = products ?? [];
    if (!pickerQuery.trim()) return list;
    const q = pickerQuery.toLowerCase();
    return list.filter(
      p =>
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.barcode ?? '').toLowerCase().includes(q),
    );
  }, [products, pickerQuery]);

  // Auto-select first product
  useEffect(() => {
    if (products && products.length > 0 && !productId) {
      setProductId(products[0]!.id);
      setPrice(String(products[0]?.sellingPrice ?? 0));
    }
  }, [products, productId]);

  async function handleRecordPayment() {
    if (!paying) return;
    const amount = Number(payAmount);
    if (!amount || amount <= 0) return;
    setPayingNow(true);
    try {
      await recordPayment.mutateAsync({amount, method: payMethod});
      successFeedback();
      setPaying(null);
      setPayAmount('');
      setPayMethod('cash');
    } catch {
      errorFeedback();
    } finally {
      setPayingNow(false);
    }
  }

  async function handleSell() {
    if (!selected) return;
    setSaving(true);
    try {
      await createSale.mutateAsync({
        productId: selected.id,
        quantity: Number(quantity) || 0,
        sellingPrice: Number(price) || undefined,
        customerName: customer.trim() || undefined,
        paid: true,
        paymentMethod: 'cash',
      });
      successFeedback();
      setQuantity('1');
      setCustomer('');
      reloadProducts();
    } catch {
      errorFeedback();
    } finally {
      setSaving(false);
    }
  }

  function selectProduct(p: {id: string; sellingPrice: number; name: string}) {
    setProductId(p.id);
    setPrice(String(p.sellingPrice));
    setPickerOpen(false);
    setPickerQuery('');
  }

  const renderSaleItem = useMemo(
    () =>
      ({item, index}: {item: InvoiceDto; index: number}) => {
        const outstanding = Math.max(0, item.total - item.amountPaid);
        const canPay = item.status !== 'PAID' && outstanding > 0;
        return (
          <Card style={{marginHorizontal: CARD_MARGIN}} index={index}>
            <View style={styles.saleRow}>
              <View style={{flex: 1}}>
                <Text style={styles.saleNumber}>{item.invoiceNumber}</Text>
                <Text style={styles.saleMeta}>
                  {item.customerName ?? 'Walk-in'} · {formatDate(item.date)}
                </Text>
                {canPay ? (
                  <Text style={styles.saleMeta}>
                    Paid {money(item.amountPaid)} · Due {money(outstanding)}
                  </Text>
                ) : null}
              </View>
              <View style={{alignItems: 'flex-end', gap: rs(4)}}>
                <Text style={styles.saleTotal}>{money(item.total)}</Text>
                <Badge
                  text={item.status}
                  tone={item.status === 'PAID' ? 'success' : item.status === 'PARTIAL' ? 'warning' : 'muted'}
                />
                {canPay ? (
                  <Button
                    title="Record payment"
                    variant="outline"
                    size="small"
                    onPress={() => {
                      setPaying(item);
                      setPayAmount(String(outstanding));
                      setPayMethod('cash');
                    }}
                  />
                ) : null}
              </View>
            </View>
          </Card>
        );
      },
    [styles],
  );

  return (
    <Screen>
      <Header title="Sales" subtitle="Record a quick sale" />

      {!selected ? (
        <ErrorBox message="Add products in Stock tab first, or set your database in Settings." />
      ) : (
        <>
          {/* Sale form card */}
          <Card style={{marginHorizontal: CARD_MARGIN}} index={0}>
            {/* Product selector */}
            <Pressable onPress={() => setPickerOpen(true)} style={styles.productSelector}>
              <View style={{flex: 1}}>
                <Text style={styles.selectorLabel}>Product</Text>
                <Text style={styles.selectorValue} numberOfLines={1}>
                  {selected.name}
                </Text>
              </View>
              <Text style={styles.selectorChange}>Change</Text>
            </Pressable>

            <View style={styles.formRow}>
              <Field
                label="Qty"
                value={quantity}
                onChangeText={setQuantity}
                keyboardType="numeric"
                style={{flex: 1}}
              />
              <Field
                label="Price"
                value={price}
                onChangeText={setPrice}
                keyboardType="numeric"
                style={{flex: 1}}
              />
            </View>
            <Field label="Customer name (optional)" value={customer} onChangeText={setCustomer} />
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>{money(total)}</Text>
            </View>
            <Button title={saving ? 'Selling…' : 'Sell (cash)'} onPress={handleSell} loading={saving} />
          </Card>

          {/* Recent sales */}
          <Text style={styles.section}>Recent sales</Text>
          {loading || !recent ? (
            <Loading />
          ) : recent.invoices.length === 0 ? (
            <Empty text="No sales yet" />
          ) : (
            <FlashList
              data={recent.invoices}
              renderItem={renderSaleItem}
              keyExtractor={item => item.id}
              contentContainerStyle={{paddingBottom: spacing.xxxl}}
            />
          )}
        </>
      )}

      {/* Product picker sheet */}
      <ModalSheet visible={pickerOpen} title="Choose product" onClose={() => { setPickerOpen(false); setPickerQuery(''); }}>
        <View style={styles.pickerSearch}>
          <Text style={styles.pickerSearchIcon}>🔍</Text>
          <Pressable style={{flex: 1}}>
            <Text style={{fontSize: typography.body, color: colors.muted}}>Search products…</Text>
          </Pressable>
        </View>
        <View style={{maxHeight: rs(400)}}>
          {filteredProducts.map(p => (
            <Pressable
              key={p.id}
              onPress={() => selectProduct(p)}
              style={({pressed}) => [
                styles.pickerRow,
                p.id === productId && styles.pickerRowActive,
                pressed && {backgroundColor: colors.mutedSoft},
              ]}>
              <View style={{flex: 1}}>
                <Text
                  style={[
                    styles.pickerName,
                    p.id === productId && {color: colors.primary, fontWeight: '700'},
                  ]}
                  numberOfLines={1}>
                  {p.name}
                </Text>
                <Text style={styles.pickerMeta}>
                  {p.sku} · Stock: {p.stock}
                </Text>
              </View>
              <Text style={styles.pickerPrice}>{money(p.sellingPrice)}</Text>
            </Pressable>
          ))}
          {filteredProducts.length === 0 ? (
            <Text style={{textAlign: 'center', color: colors.muted, padding: spacing.xl}}>No products found</Text>
          ) : null}
        </View>
      </ModalSheet>

      {/* Payment sheet */}
      <ModalSheet
        visible={paying !== null}
        title={`Payment — ${paying?.invoiceNumber ?? ''}`}
        onClose={() => setPaying(null)}
        dismissable={!payingNow}>
        {paying ? (
          <>
            <Text style={{fontSize: typography.secondary, color: colors.muted, marginBottom: spacing.md}}>
              Invoice {money(paying.total)} · Paid {money(paying.amountPaid)} · Due{' '}
              {money(Math.max(0, paying.total - paying.amountPaid))}
            </Text>
            <Field label="Amount" value={payAmount} onChangeText={setPayAmount} keyboardType="numeric" />
            <Field label="Method" value={payMethod} onChangeText={setPayMethod} placeholder="cash / upi / card" />
            <Button title={payingNow ? 'Recording…' : 'Record payment'} onPress={handleRecordPayment} loading={payingNow} />
          </>
        ) : null}
      </ModalSheet>
    </Screen>
  );
}

const makeStyles = () =>
  StyleSheet.create({
    productSelector: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.md,
      padding: spacing.md,
      marginBottom: spacing.md,
    },
    selectorLabel: {fontSize: typography.label, color: colors.muted, fontWeight: '600'},
    selectorValue: {fontSize: typography.body, color: colors.text, fontWeight: '600', marginTop: rs(2)},
    selectorChange: {fontSize: typography.secondary, color: colors.primary, fontWeight: '600'},
    formRow: {flexDirection: 'row', gap: spacing.sm},
    totalRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: spacing.md,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      marginBottom: spacing.sm,
    },
    totalLabel: {fontSize: typography.body, fontWeight: '600', color: colors.muted},
    totalValue: {fontSize: typography.h2, fontWeight: '700', color: colors.text},
    section: {
      fontSize: typography.h3,
      fontWeight: '700',
      color: colors.text,
      marginHorizontal: CARD_MARGIN,
      marginTop: spacing.xl,
      marginBottom: spacing.sm,
    },
    saleRow: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
    saleNumber: {fontSize: typography.body, fontWeight: '600', color: colors.text},
    saleMeta: {fontSize: typography.caption, color: colors.muted, marginTop: rs(2)},
    saleTotal: {fontSize: typography.body, fontWeight: '700', color: colors.text},
    pickerSearch: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.md,
      padding: spacing.md,
      marginBottom: spacing.sm,
    },
    pickerSearchIcon: {marginRight: spacing.sm},
    pickerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    pickerRowActive: {backgroundColor: colors.mutedSoft},
    pickerName: {fontSize: typography.body, fontWeight: '500', color: colors.text},
    pickerMeta: {fontSize: typography.caption, color: colors.muted, marginTop: rs(2)},
    pickerPrice: {fontSize: typography.body, fontWeight: '600', color: colors.text},
  });
