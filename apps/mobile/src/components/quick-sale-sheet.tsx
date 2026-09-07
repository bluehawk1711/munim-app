/**
 * QuickSaleSheet — the instant "Record sale" dialog.
 *
 * Opens after a barcode scan (or any product pick) so the counter user can
 * sell in seconds: quantity, price override, optional walk-in customer, and
 * a payment-received switch. Uses the shared `useCreateSale` flow — the
 * exact same quick-sale mutation as web/desktop — so stock, dashboard, and
 * sales history all update.
 *
 * All colors are theme tokens.
 */

import React, {useEffect, useMemo, useState} from 'react';
import {Image, StyleSheet, Switch, Text, View} from 'react-native';
import {Package} from 'lucide-react-native';
import type {ProductDto} from '@munim/core';
import {useCreateSale} from '@munim/query';
import {Button, Field, ModalSheet, colors} from './ui';
import {useThemeStyles} from '../theme';
import {money} from '../lib/format';
import {successFeedback, errorFeedback, selectionTick} from '../lib/haptics';
import {rs, spacing, typography, radii} from '../lib/responsive';

/** Large ₹ price (same style as the inventory rows). */
const rupees = (v: number) =>
  `₹${v.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;

export function QuickSaleSheet({
  product,
  onClose,
}: {
  product: ProductDto | null;
  /** Controlled open state: sheet is visible iff `product` is non-null. */
  onClose: () => void;
}) {
  const styles = useThemeStyles(makeStyles);
  const createSale = useCreateSale();

  const [qty, setQty] = useState('1');
  const [price, setPrice] = useState('0');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [paid, setPaid] = useState(false);

  // Fresh product → reset the form to its defaults.
  useEffect(() => {
    if (product) {
      setQty('1');
      setPrice(String(product.sellingPrice));
      setCustomerName('');
      setCustomerPhone('');
      setPaid(false);
    }
  }, [product]);

  const quantity = Number(qty) || 0;
  const unitPrice = Number(price) || 0;
  const total = Math.max(0, quantity * unitPrice);
  const outOfStock = product ? product.stock <= 0 : false;
  const overStock = product ? quantity > product.stock : false;

  const busy = createSale.isPending;

  async function handleSell() {
    if (!product || busy) return;
    if (quantity <= 0) {
      errorFeedback('Quantity must be greater than 0');
      return;
    }
    try {
      await createSale.mutateAsync({
        productId: product.id,
        quantity,
        sellingPrice: unitPrice,
        customerName: customerName.trim() || undefined,
        customerPhone: customerPhone.trim() || undefined,
        paid,
      });
      successFeedback(`Sold ×${quantity} — ${money(total)}`);
      onClose();
    } catch {
      errorFeedback('Sale failed — try again');
    }
  }

  const summary = useMemo(() => {
    if (!product) return null;
    return (
      <View style={styles.summary}>
        {product.imageUrl ? (
          <Image source={{uri: product.imageUrl}} style={styles.thumb} />
        ) : (
          <View style={[styles.thumb, styles.thumbEmpty]}>
            <Package size={rs(20)} color={colors.muted} />
          </View>
        )}
        <View style={styles.summaryMain}>
          <Text style={styles.summaryName} numberOfLines={1}>
            {product.name}
          </Text>
          <Text style={styles.summaryMeta} numberOfLines={1}>
            {product.sku}
            {product.barcode ? ` · ${product.barcode}` : ''}
          </Text>
          <Text
            style={[
              styles.summaryStock,
              outOfStock && {color: colors.danger},
              !outOfStock && product.stock <= product.lowStockThreshold && {color: colors.warning},
            ]}>
            {outOfStock ? 'Out of stock' : `${product.stock} in stock`}
          </Text>
        </View>
      </View>
    );
  }, [product, outOfStock, styles]);

  return (
    <ModalSheet
      visible={!!product}
      title="Record sale"
      onClose={onClose}
      centered
      scrollable>
      {summary}

      <View style={styles.row}>
        <Field label="Quantity" value={qty} onChangeText={setQty} keyboardType="numeric" style={styles.rowField} />
        <Field label="Selling price" value={price} onChangeText={setPrice} keyboardType="numeric" style={styles.rowField} />
      </View>

      {overStock ? (
        <Text style={styles.stockWarn}>Only {product?.stock} in stock — sale will exceed available units</Text>
      ) : null}

      <Field
        label="Customer name (optional)"
        value={customerName}
        onChangeText={setCustomerName}
        placeholder="Walk-in customer"
      />
      <Field
        label="Phone (optional)"
        value={customerPhone}
        onChangeText={setCustomerPhone}
        keyboardType="phone-pad"
        placeholder="Phone number"
      />

      <View style={styles.paidRow}>
        <View style={styles.paidMain}>
          <Text style={styles.paidLabel}>Payment received now</Text>
          <Text style={styles.paidHint}>{paid ? 'Invoice will be PAID' : 'Invoice will be UNPAID'}</Text>
        </View>
        <Switch
          value={paid}
          onValueChange={value => {
            selectionTick();
            setPaid(value);
          }}
          trackColor={{true: colors.primary, false: colors.border}}
          thumbColor={colors.inverseOnSurface}
        />
      </View>

      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Total</Text>
        <Text style={styles.totalValue}>{rupees(total)}</Text>
      </View>

      <Button
        title={busy ? 'Selling…' : `Sell for ${rupees(total)}`}
        onPress={handleSell}
        disabled={busy || outOfStock || quantity <= 0}
        style={styles.sellBtn}
      />
      {outOfStock ? <Text style={[styles.stockWarn, {textAlign: 'center'}]}>This product is out of stock</Text> : null}
    </ModalSheet>
  );
}

const makeStyles = () =>
  StyleSheet.create({
    summary: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rs(12),
      padding: rs(12),
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.mutedSoft,
      marginBottom: spacing.md,
    },
    thumb: {
      width: rs(52),
      height: rs(52),
      borderRadius: radii.sm,
      backgroundColor: colors.mutedBg,
    },
    thumbEmpty: {alignItems: 'center', justifyContent: 'center'},
    summaryMain: {flex: 1, minWidth: 0, gap: rs(2)},
    summaryName: {fontSize: typography.body, fontWeight: '700', color: colors.text},
    summaryMeta: {fontSize: typography.caption, color: colors.muted},
    summaryStock: {fontSize: typography.caption, fontWeight: '700', color: colors.success},
    row: {flexDirection: 'row', gap: rs(10)},
    rowField: {flex: 1},
    stockWarn: {
      fontSize: typography.caption,
      fontWeight: '600',
      color: colors.warning,
      marginTop: rs(-4),
      marginBottom: spacing.sm,
    },
    paidRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rs(10),
      paddingVertical: spacing.sm,
      marginTop: spacing.xs,
    },
    paidMain: {flex: 1},
    paidLabel: {fontSize: typography.body, fontWeight: '600', color: colors.text},
    paidHint: {fontSize: typography.caption, color: colors.muted, marginTop: rs(2)},
    totalRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: spacing.sm,
      paddingTop: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    totalLabel: {fontSize: typography.body, fontWeight: '700', color: colors.muted},
    totalValue: {fontSize: rs(20), fontWeight: '800', color: colors.text},
    sellBtn: {marginTop: spacing.md},
  });
