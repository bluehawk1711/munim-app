/**
 * ProductDetailSheet — gorhom bottom sheet with the product's key details.
 *
 * Layout (matches the reference design, using ONLY fields the data model has):
 *   SKU · [×]
 *   Product Name
 *   Color · Size
 *   ┌ BARCODE/EAN-13  8901247009381  [Copy] ┐
 *   [Buy Price] [Sell Price] [Margin]
 *   Type / Category / Sub-category / Article
 *   Weight · Gross · Nag less · Chejat · NET WEIGHT (gold's price basis)
 *   Purity / Karat (or silver %) / Pricing / Labour / charges / Stock / Notes
 *   [Edit Product] [Adjust Stock]
 *
 * Rendered through the shared `MunimBottomSheet` (@gorhom/bottom-sheet) so
 * keyboard, backdrop, safe-area and theme behavior match every other sheet.
 */

import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {Image, Pressable, StyleSheet, Text, View} from 'react-native';
import {Barcode as BarcodeIcon, Package, ShoppingCart, X} from 'lucide-react-native';
import {PRODUCT_IMAGES_ENABLED, classifyProduct, formatLabelLabour, formatWeight, type ProductDto} from '@munim/core';
import {MunimBottomSheet, BottomSheetScrollView} from './BottomSheet';
import {ImageFullScreen} from './ImageFullScreen';
import type BottomSheet from '@gorhom/bottom-sheet';
import {colors, useThemeStyles} from '../theme';
import {copyText} from '../lib/clipboard';
import {money} from '../lib/format';
import {successFeedback, errorFeedback, actionPress} from '../lib/haptics';
import {rs, spacing, radii, typography} from '../lib/responsive';

type ProductDetailSheetProps = {
  /** Non-null opens the sheet for that product; null closes it. */
  product: ProductDto | null;
  onClose: () => void;
  onEdit: (p: ProductDto) => void;
  onAdjust: (p: ProductDto) => void;
  onSell: (p: ProductDto) => void;
};

export function ProductDetailSheet({product, onClose, onEdit, onAdjust, onSell}: ProductDetailSheetProps) {
  const styles = useThemeStyles(makeStyles);
  const sheetRef = React.useRef<BottomSheet>(null);
  const [fullImage, setFullImage] = useState<string | null>(null);
  // Start CLOSED (-1): the sheet mounts with the screen, and without this it
  // would auto-open as an empty sheet on entering Inventory.
  const snapPoints = useMemo(() => ['92%'], []);

  useEffect(() => {
    if (product) {
      sheetRef.current?.snapToIndex(0);
    } else {
      sheetRef.current?.close();
    }
  }, [product]);

  const handleCopy = useCallback(async () => {
    if (!product?.barcode) return;
    (await copyText(product.barcode))
      ? successFeedback('Barcode copied')
      : errorFeedback('Copy failed');
  }, [product]);

  if (!product) {
    // Gorhom sheets must stay mounted; content switches on `product`.
    return (
      <MunimBottomSheet
        ref={sheetRef}
        snapPoints={snapPoints}
        initialIndex={-1}
        onClose={onClose}>
        <BottomSheetScrollView>{null}</BottomSheetScrollView>
      </MunimBottomSheet>
    );
  }

  const margin =
    product.effectivePrice > 0
      ? Math.round(((product.effectivePrice - product.purchasePrice) / product.effectivePrice) * 100)
      : 0;
  const subtitle = [product.color, product.size].filter(Boolean).join(' · ');

  return (
    <MunimBottomSheet
      ref={sheetRef}
      snapPoints={snapPoints}
      initialIndex={0}
      onClose={onClose}>
      <BottomSheetScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled">
        {/* SKU + close */}
        <View style={styles.topRow}>
          <Text style={styles.sku}>{product.sku}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close product details"
            onPress={() => {
              actionPress();
              onClose();
            }}
            style={({pressed}) => [styles.closeBtn, pressed && {opacity: 0.6}]}>
            <X size={rs(18)} color={colors.text} />
          </Pressable>
        </View>

        {/* Name + variant subtitle */}
        <Text style={styles.name}>{product.name}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}

        {/* Product image — parked for now (PRODUCT_IMAGES_ENABLED in
            @munim/core); returns with the flag, code kept intact. */}
        {PRODUCT_IMAGES_ENABLED && product.imageUrl ? (
          <Pressable
            onPress={() => { actionPress(); setFullImage(product.imageUrl); }}
            style={({pressed}) => [styles.imageWrap, pressed && {opacity: 0.8}]}>
            <Image source={{uri: product.imageUrl}} style={styles.heroImage} />
          </Pressable>
        ) : (
          <View style={[styles.imageWrap, styles.imageEmpty]}>
            <Package size={rs(28)} color={colors.muted} />
          </View>
        )}

        {/* Barcode card */}
        {product.barcode ? (
          <View style={styles.barcodeCard}>
            <View style={styles.barcodeIconWrap}>
              <BarcodeIcon size={rs(18)} color={colors.primary} strokeWidth={2.2} />
            </View>
            <View style={styles.barcodeMain}>
              <Text style={styles.barcodeLabel}>BARCODE / EAN-13</Text>
              <Text style={styles.barcodeValue}>{product.barcode}</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Copy barcode"
              onPress={() => void handleCopy()}
              style={({pressed}) => [styles.copyBtn, pressed && {opacity: 0.6}]}>
              <Text style={styles.copyText}>Copy</Text>
            </Pressable>
          </View>
        ) : null}

        {/* Price tiles */}
        <View style={styles.tileRow}>
          <View style={styles.tile}>
            <Text style={styles.tileLabel}>Buy Price</Text>
            <Text style={styles.tileValue}>{money(product.purchasePrice)}</Text>
            <Text style={styles.tileCaption}>Direct Stock{'\n'}Purchase</Text>
          </View>
          <View style={styles.tile}>
            <Text style={styles.tileLabel}>Sell Price</Text>
            <Text style={[styles.tileValue, styles.tileValuePrimary]}>
              {money(product.effectivePrice)}
            </Text>
            <Text style={styles.tileCaption}>Retail Tag</Text>
          </View>
          <View style={styles.tile}>
            <Text style={styles.tileLabel}>Margin</Text>
            <Text style={[styles.tileValue, styles.tileValueWarning]}>{margin}%</Text>
            <Text style={styles.tileCaption}>Estimated</Text>
          </View>
        </View>

        {/* Detail rows */}
        <DetailRow
          label="Type"
          value={
            classifyProduct({
              type: product.type,
              goldKarat: product.goldKarat,
              purity: product.purity,
              categoryName: product.category,
            }).text
          }
        />
        <DetailRow label="Category" value={product.category || null} />
        <DetailRow label="Sub-category" value={product.subCategory || null} />
        <DetailRow label="Article" value={product.article || null} />
        {product.type === 'Gold' && product.goldKarat != null ? (
          <DetailRow label="Karat" value={`${product.goldKarat}K`} />
        ) : null}
        {product.type === 'Silver' ? (
          <DetailRow label="Silver %" value={`${product.silverPercentage}%`} />
        ) : null}

        {/* Weight matrix — the same figures the bill prints (G. Wt. / N/C /
            N. Wt.), so the sheet explains the price the product carries. */}
        {/* Gold weighs its NET weight (the raw `weight` column is empty for
            gold) — same rule as the web/desktop tables and the reports. */}
        <DetailRow
          label="Weight"
          value={
            product.type === 'Gold' && product.netWeight?.trim()
              ? `${product.netWeight.trim()} (net)`
              : product.weight != null
                ? formatWeight(product.weight, product.weightUnit)
                : null
          }
        />
        <DetailRow label="Gross Weight" value={product.grossWeight?.trim() || null} />
        <DetailRow label="Nag Less" value={withUnit(product.nagLessWeight, product.nagUnit)} />
        <DetailRow label="Chejat" value={withUnit(product.chejatWeight, product.nagUnit)} />
        <DetailRow label="Net Weight" value={withUnit(product.netWeight, product.weightUnit)} />

        <DetailRow label="Purity" value={product.purity || null} />
        <DetailRow
          label="Pricing"
          value={product.priceMode === 'auto' ? 'Auto (metal rate)' : 'Manual price'}
        />
        <DetailRow
          label="Labour"
          value={
            formatLabelLabour({labourType: product.labourType, labourValue: product.labourValue}) || null
          }
        />
        <DetailRow label="Charges" value={chargesText(product)} />
        <DetailRow
          label="Stock"
          value={`${product.stock} ${product.stock === 1 ? 'unit' : 'units'}${
            product.stock > 0 && product.stock <= product.lowStockThreshold ? '  ·  Low' : ''
          }`}
        />
        <DetailRow label="Low Stock Alert" value={String(product.lowStockThreshold)} />
        {product.notes?.trim() ? <DetailRow label="Notes" value={product.notes.trim()} last /> : null}

        {/* Actions */}
        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              actionPress();
              onSell(product);
            }}
            style={({pressed}) => [styles.sellBtn, pressed && {opacity: 0.85}]}>
            <ShoppingCart size={rs(16)} color={colors.onPrimary} strokeWidth={2.2} />
            <Text style={styles.sellText}>Sell</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              actionPress();
              onEdit(product);
            }}
            style={({pressed}) => [styles.editBtn, pressed && {opacity: 0.7}]}>
            <Text style={styles.editText}>Edit</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              actionPress();
              onAdjust(product);
            }}
            style={({pressed}) => [styles.adjustBtn, pressed && {opacity: 0.85}]}>
            <Text style={styles.adjustText}>Stock</Text>
          </Pressable>
        </View>
      </BottomSheetScrollView>
      <ImageFullScreen visible={!!fullImage} imageUrl={fullImage} onClose={() => setFullImage(null)} />
    </MunimBottomSheet>
  );
}

/** Free-text weight + its unit ("0.620 gm") — "" for an empty value. */
function withUnit(value: string | null | undefined, unit: string | null | undefined): string | null {
  const text = value?.trim();
  if (!text) return null;
  // Stored free text may already carry the unit — never double it.
  if (/[a-z]/i.test(text)) return text;
  return `${text} ${unit === 'mg' ? 'mg' : 'gm'}`;
}

/** Flat ₹ charges added to the auto price — null when the product has none. */
function chargesText(product: ProductDto): string | null {
  const parts = [
    ['Nag', product.nagRate],
    ['Povayi', product.povayiRate],
    ['Other', product.otherCharges],
  ]
    .map(([label, raw]) => {
      const n = raw == null || raw === '' ? NaN : Number(raw);
      if (!Number.isFinite(n) || n <= 0) return null;
      const amount = Number.isInteger(n)
        ? n.toLocaleString('en-IN')
        : n.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2});
      return `${label} ₹${amount}`;
    })
    .filter((part): part is string => part !== null);
  return parts.length > 0 ? parts.join('  ·  ') : null;
}

/** One label/value row — omitted entirely when there is no value to show. */
function DetailRow({label, value, last}: {label: string; value: string | null; last?: boolean}) {
  const styles = useThemeStyles(makeStyles);
  if (!value) return null;
  return (
    <View style={last ? styles.detailRowLast : styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const makeStyles = () =>
  StyleSheet.create({
    scroll: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.xxxl,
    },
    topRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: spacing.sm,
    },
    sku: {
      fontSize: rs(12),
      fontWeight: '800',
      letterSpacing: 0.8,
      color: colors.primary,
    },
    closeBtn: {
      width: rs(38),
      height: rs(38),
      borderRadius: radii.full,
      backgroundColor: colors.mutedSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    name: {
      fontSize: typography.h1,
      fontWeight: '800',
      color: colors.text,
      marginTop: rs(4),
    },
    subtitle: {
      fontSize: typography.secondary,
      color: colors.muted,
      marginTop: rs(2),
    },
    imageWrap: {
      marginTop: spacing.md,
      borderRadius: radii.lg,
      overflow: 'hidden',
      alignSelf: 'flex-start',
    },
    heroImage: {
      width: rs(120),
      height: rs(120),
      borderRadius: radii.lg,
    },
    imageEmpty: {
      width: rs(120),
      height: rs(120),
      borderRadius: radii.lg,
      backgroundColor: colors.mutedSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    barcodeCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.mutedSoft,
      borderRadius: radii.lg,
      padding: rs(12),
      marginTop: spacing.md,
      gap: rs(10),
    },
    barcodeIconWrap: {
      width: rs(44),
      height: rs(44),
      borderRadius: radii.md,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    barcodeMain: {flex: 1, minWidth: 0},
    barcodeLabel: {
      fontSize: rs(10),
      fontWeight: '800',
      letterSpacing: 0.8,
      color: colors.muted,
    },
    barcodeValue: {
      fontSize: rs(15),
      fontWeight: '800',
      color: colors.text,
      marginTop: rs(2),
    },
    copyBtn: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.full,
      paddingHorizontal: rs(14),
      paddingVertical: rs(8),
    },
    copyText: {fontSize: rs(12.5), fontWeight: '700', color: colors.text},
    tileRow: {
      flexDirection: 'row',
      gap: rs(8),
      marginTop: spacing.md,
    },
    tile: {
      flex: 1,
      backgroundColor: colors.mutedSoft,
      borderRadius: radii.lg,
      padding: rs(12),
    },
    tileLabel: {fontSize: rs(11.5), fontWeight: '600', color: colors.muted},
    tileValue: {
      fontSize: rs(17),
      fontWeight: '800',
      color: colors.text,
      marginTop: rs(4),
    },
    tileValuePrimary: {color: colors.primary},
    tileValueWarning: {color: colors.warning},
    tileCaption: {
      fontSize: rs(10.5),
      color: colors.muted,
      marginTop: rs(4),
      lineHeight: rs(13),
    },
    detailRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: rs(12),
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    detailRowLast: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: rs(12),
    },
    detailLabel: {fontSize: typography.secondary, color: colors.muted},
    detailValue: {
      fontSize: typography.secondary,
      fontWeight: '700',
      color: colors.text,
      textAlign: 'right',
      flexShrink: 1,
      marginLeft: spacing.md,
    },
    actions: {
      flexDirection: 'row',
      gap: rs(10),
      marginTop: spacing.lg,
    },
    sellBtn: {
      flex: 1,
      minHeight: 52,
      borderRadius: radii.full,
      backgroundColor: colors.primary,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: rs(6),
    },
    sellText: {fontSize: typography.body, fontWeight: '700', color: colors.onPrimary},
    editBtn: {
      flex: 1,
      minHeight: 52,
      borderRadius: radii.full,
      backgroundColor: colors.mutedSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    editText: {fontSize: typography.body, fontWeight: '700', color: colors.text},
    adjustBtn: {
      flex: 1,
      minHeight: 52,
      borderRadius: radii.full,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    adjustText: {fontSize: typography.body, fontWeight: '700', color: colors.onPrimary},
  });
