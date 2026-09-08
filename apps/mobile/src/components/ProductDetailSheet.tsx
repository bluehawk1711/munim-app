/**
 * ProductDetailSheet — gorhom bottom sheet with the product's key details.
 *
 * Layout (matches the reference design, using ONLY fields the data model has):
 *   SKU · [×]
 *   Product Name
 *   Color · Size
 *   ┌ BARCODE/EAN-13  8901247009381  [Copy] ┐
 *   [Buy Price] [Sell Price] [Margin]
 *   Category / Gross Weight / Stock rows
 *   [Edit Product] [Adjust Stock]
 *
 * Rendered through the shared `MunimBottomSheet` (@gorhom/bottom-sheet) so
 * keyboard, backdrop, safe-area and theme behavior match every other sheet.
 */

import React, {useCallback, useEffect, useMemo} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {Barcode as BarcodeIcon, X} from 'lucide-react-native';
import {formatWeight, type ProductDto} from '@munim/core';
import {MunimBottomSheet, BottomSheetScrollView} from './BottomSheet';
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
};

export function ProductDetailSheet({product, onClose, onEdit, onAdjust}: ProductDetailSheetProps) {
  const styles = useThemeStyles(makeStyles);
  const sheetRef = React.useRef<BottomSheet>(null);
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
    product.sellingPrice > 0
      ? Math.round(((product.sellingPrice - product.purchasePrice) / product.sellingPrice) * 100)
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
              {money(product.sellingPrice)}
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
        {product.category ? (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Category</Text>
            <Text style={styles.detailValue}>{product.category}</Text>
          </View>
        ) : null}
        {product.weight != null ? (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Gross Weight</Text>
            <Text style={styles.detailValue}>{formatWeight(product.weight, product.weightUnit)}</Text>
          </View>
        ) : null}
        {product.purity ? (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Purity</Text>
            <Text style={styles.detailValue}>{product.purity}</Text>
          </View>
        ) : null}
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Stock</Text>
          <Text style={styles.detailValue}>
            {product.stock} {product.stock === 1 ? 'unit' : 'units'}
            {product.stock > 0 && product.stock <= product.lowStockThreshold
              ? '  ·  Low'
              : ''}
          </Text>
        </View>
        <View style={styles.detailRowLast}>
          <Text style={styles.detailLabel}>Low Stock Alert</Text>
          <Text style={styles.detailValue}>{product.lowStockThreshold}</Text>
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              actionPress();
              onEdit(product);
            }}
            style={({pressed}) => [styles.editBtn, pressed && {opacity: 0.7}]}>
            <Text style={styles.editText}>Edit Product</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              actionPress();
              onAdjust(product);
            }}
            style={({pressed}) => [styles.adjustBtn, pressed && {opacity: 0.85}]}>
            <Text style={styles.adjustText}>Adjust Stock</Text>
          </Pressable>
        </View>
      </BottomSheetScrollView>
    </MunimBottomSheet>
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
