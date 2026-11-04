/**
 * ProductsScreen — Inventory, redesigned to the swatch-row reference layout.
 *
 * - Custom HomeHeader ("Stock")
 * - Search + scan in one row with an Add-product icon button beside it;
 *   filter badges (stock · type · price) in ONE horizontally scrollable row
 *   with live counts — no floating CTA, no recalculate button, so the list
 *   gets the screen
 * - FlashList of image-forward product rows: thumbnail, name, variant chip
 *   (Color · Size · weight), price + "Out of stock"/"Cost" line, and a stock
 *   pill on the right ("98 units" / "8 units (Low)" / "0 units")
 * - Tapping a row opens ProductDetailSheet (@gorhom/bottom-sheet): SKU,
 *   barcode copy card, buy/sell/margin tiles, detail rows, Edit/Adjust CTA
 * - Full CRUD + stock adjustment + labels + barcode scanning preserved
 */

import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {FlashList} from '@shopify/flash-list';
import {Search, ScanLine, Package, Plus, X} from 'lucide-react-native';
import {SvgXml} from 'react-native-svg';
import * as Print from 'expo-print';
import {
  PRODUCT_IMAGES_ENABLED,
  barcodeSvg,
  buildProductLabel,
  classifyProduct,
  renderLabelSheetHtml,
  formatWeight,
  type ProductDto,
} from '@munim/core';
import {ApiClientError} from '@munim/api-client';
import {
  useBackfillBarcodes,
  useDeleteProduct,
  useProductByBarcode,
  useProducts,
  useQueryState,
  useSettings,
} from '@munim/query';
import {successFeedback, errorFeedback, selectionTick} from '../lib/haptics';
import {rw, rh, rs, typography, spacing, radii, CARD_MARGIN, TOUCH_TARGET} from '../lib/responsive';
import {
  Button,
  Empty,
  ErrorBox,
  Field,
  Loading,
  ModalSheet,
  Screen,
  ConfirmDialog,
  colors,
} from '../components/ui';
import {HomeHeader, headerScrollHandlers} from '../components/home-header';
import {ProductDetailSheet} from '../components/ProductDetailSheet';
import {BarcodeScannerModal} from '../components/BarcodeScannerModal';
import {EditProductModal} from '../components/EditProductModal';
import {AdjustStockModal} from '../components/AdjustStockModal';
import {useAppStore} from '../lib/store';
import {useThemeStyles} from '../theme';

/* ─── Helpers ────────────────────────────────────────────────────────── */

const PRODUCT_TYPE_COLORS: Record<string, string> = {
  Gold: '#D4AF37',
  Silver: '#C0C0C0',
  Diamond: '#B9F2FF',
  Platinum: '#E5E4E2',
  Other: '#9CA3AF',
};

type StockFilter = 'all' | 'in' | 'low' | 'out';
type TypeFilter = 'all' | 'Gold' | 'Silver';
type PriceFilter = 'all' | 'auto' | 'manual';

function inStock(p: ProductDto): boolean {
  return p.stock > p.lowStockThreshold;
}
function isLow(p: ProductDto): boolean {
  return p.stock > 0 && p.stock <= p.lowStockThreshold;
}
function isOut(p: ProductDto): boolean {
  return p.stock <= 0;
}

/** Large in-row price, e.g. "₹100.00" (reference style, not "INR x"). */
const price = (v: number) => `₹${v.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;

function BarcodeChip({value}: {value: string}) {
  const xml = React.useMemo(() => barcodeSvg(value, {showText: true, height: 40}), [value]);
  if (!value) return null;
  return <SvgXml xml={xml} width={rw(200)} height={rs(40)} />;
}

/* ─── Product row (memoized for FlashList) ───────────────────────────── */

type ProductRowProps = {
  item: ProductDto;
  onPress: (p: ProductDto) => void;
  onBill: (p: ProductDto) => void;
  index: number;
};

const ProductRow = React.memo(function ProductRow({item, onPress, onBill}: ProductRowProps) {
  const styles = useThemeStyles(makeRowStyles);

  const variantBits = [item.article, item.color, item.size !== 'Standard' ? item.size : null, item.purity]
    .filter(Boolean)
    .join(' · ');

  const typeColor = PRODUCT_TYPE_COLORS[item.type ?? 'Other'] ?? PRODUCT_TYPE_COLORS.Other;
  const classification = classifyProduct({
    type: item.type,
    goldKarat: item.goldKarat,
    purity: item.purity,
    categoryName: item.category,
  }).text;
  // Weight-forward line — gold leads with the derived net weight (what
  // pricing uses), everything else with its own weight + unit.
  const weightText =
    item.type === 'Gold' && item.netWeight != null
      ? `${item.netWeight} net`
      : item.weight != null
        ? formatWeight(item.weight, item.weightUnit)
        : null;

  const stockPillStyle =
    item.stock <= 0 ? styles.pillOut : isLow(item) ? styles.pillLow : styles.pillOk;

  return (
    <Pressable
      onPress={() => onPress(item)}
      style={({pressed}) => [styles.row, pressed && styles.rowPressed]}>
      {/* Thumbnail — photos are parked (PRODUCT_IMAGES_ENABLED in
          @munim/core), so the placeholder renders; image code kept. */}
      <View style={styles.thumb}>
        {PRODUCT_IMAGES_ENABLED && item.imageUrl ? (
          <Image source={{uri: item.imageUrl}} style={styles.thumbImg} />
        ) : (
          <Package size={rs(24)} color={colors.muted} />
        )}
      </View>

      {/* Name / classification + variant / weight / price */}
      <View style={styles.main}>
        <Text style={styles.name} numberOfLines={1}>
          {item.name}
        </Text>
        <View style={styles.chipRow}>
          <View style={[styles.typeBadge, {backgroundColor: `${typeColor}22`, borderColor: `${typeColor}44`}]}>
            <Text style={[styles.typeBadgeText, {color: typeColor}]}>{classification}</Text>
          </View>
          {variantBits ? (
            <Text style={styles.variantText} numberOfLines={1}>
              {variantBits}
            </Text>
          ) : null}
        </View>
        {weightText ? <Text style={styles.weightText}>{weightText}</Text> : null}
        <View style={styles.priceRow}>
          <Text style={styles.price}>{price(item.effectivePrice)}</Text>
          {item.stock <= 0 ? (
            <Text style={styles.outText}>Out of stock</Text>
          ) : (
            <Text style={styles.costText}>Cost: {price(item.purchasePrice)}</Text>
          )}
        </View>
      </View>

      {/* Stock pill + quick bill action */}
      <View style={styles.rightCol}>
        <View style={[styles.pill, stockPillStyle]}>
          <Text style={styles.pillText} numberOfLines={1}>
            {item.stock <= 0
              ? '0 units'
              : isLow(item)
                ? `${item.stock} units (Low)`
                : `${item.stock} units`}
          </Text>
        </View>
        <Pressable
          onPress={() => onBill(item)}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={`Bill ${item.name}`}
          style={({pressed}) => [styles.billBtn, pressed && {opacity: 0.7}]}>
          <Text style={styles.billBtnText}>Bill</Text>
        </Pressable>
      </View>
    </Pressable>
  );
});

/* ─── Main screen ────────────────────────────────────────────────────── */

const PAGE_SIZE = 40;

export function ProductsScreen() {
  const styles = useThemeStyles(makeStyles);

  // Pagination
  const [page, setPage] = useState(1);
  const [allProducts, setAllProducts] = useState<ProductDto[]>([]);

  // UI state (declared early so useProducts can reference them)
  const [search, setSearch] = useState('');
  const [stockFilter, setStockFilter] = useState<StockFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [priceFilter, setPriceFilter] = useState<PriceFilter>('all');

  // Data
  const {data: listData, error, loading, reload} = useQueryState(useProducts({page, pageSize: PAGE_SIZE, type: typeFilter, priceMode: priceFilter}));
  const data = listData?.products ?? [];
  const totalCount = listData?.pagination.totalCount ?? 0;
  const totalPages = listData?.pagination.totalPages ?? 1;
  // Shimmer only on a genuine cold load: once rows have been shown, a
  // background refetch (come back to the tab, change a filter) keeps the list
  // on screen instead of flashing the skeleton.
  const showSkeleton = loading && allProducts.length === 0;

  // Append products when page changes
  useEffect(() => {
    if (page === 1) {
      setAllProducts(data);
    } else {
      setAllProducts(prev => {
        const existingIds = new Set(prev.map(p => p.id));
        const newProducts = data.filter(p => !existingIds.has(p.id));
        return [...prev, ...newProducts];
      });
    }
  }, [data, page]);
  const {data: settings} = useQueryState(useSettings());

  // Mutations
  const deleteProduct = useDeleteProduct();
  const backfillBarcodes = useBackfillBarcodes();

  // UI state
  const [detailTarget, setDetailTarget] = useState<ProductDto | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ProductDto | null>(null);

  // Stock adjustment
  const [adjusting, setAdjusting] = useState<ProductDto | null>(null);

  // Label
  const [labelTarget, setLabelTarget] = useState<ProductDto | null>(null);
  const [labelOpen, setLabelOpen] = useState(false);
  const [labelCopies, setLabelCopies] = useState(1);
  const [labelBusy, setLabelBusy] = useState(false);

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<ProductDto | null>(null);

  // Barcode scanner (scan → instant sale dialog)
  const [scanOpen, setScanOpen] = useState(false);
  const scanningRef = useRef(false);
  const [scanMsg, setScanMsg] = useState('');
  const [scanCode, setScanCode] = useState<string | null>(null);
  const scanQ = useProductByBarcode(scanCode);

  // Backfill
  const [backfilling, setBackfilling] = useState(false);

  /** Quick sale → stage the product on a new bill, then open the Sales tab. */
  const sendToBill = useCallback((product: ProductDto) => {
    if (product.stock <= 0) {
      errorFeedback(`${product.name} is out of stock`);
      return;
    }
    useAppStore.getState().stageBillProduct(product.id);
    useAppStore.getState().setActiveView('sales');
    successFeedback(`${product.name} added to a new bill`);
  }, []);

  // Barcode scan result handler — a found product is staged on the new bill.
  useEffect(() => {
    if (!scanCode) return;
    if (scanQ.data) {
      scanningRef.current = false;
      setScanOpen(false);
      setScanCode(null);
      sendToBill(scanQ.data);
    } else if (scanQ.isError) {
      scanningRef.current = false;
      const notFound = scanQ.error instanceof ApiClientError && scanQ.error.status === 404;
      setScanMsg(notFound ? `No product with barcode ${scanCode}` : 'Lookup failed');
      setScanCode(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanCode, scanQ.data, scanQ.isError, scanQ.error]);

  // Filtered list
  const query = search.trim().toLowerCase();
  const filtered = useMemo(() => {
    let list = allProducts;
    if (query) {
      list = list.filter(
        p =>
          p.name.toLowerCase().includes(query) ||
          p.sku.toLowerCase().includes(query) ||
          (p.barcode ?? '').toLowerCase().includes(query) ||
          (p.color ?? '').toLowerCase().includes(query) ||
          (p.size ?? '').toLowerCase().includes(query),
      );
    }
    if (stockFilter === 'in') list = list.filter(inStock);
    else if (stockFilter === 'low') list = list.filter(isLow);
    else if (stockFilter === 'out') list = list.filter(isOut);
    return list;
  }, [allProducts, query, stockFilter]);

  const counts = useMemo(
    () => ({
      all: allProducts.length,
      in: allProducts.filter(inStock).length,
      low: allProducts.filter(isLow).length,
      out: allProducts.filter(isOut).length,
    }),
    [allProducts],
  );

  const hasMore = page < totalPages;
  const loadingMore = useRef(false);

  const loadMore = useCallback(() => {
    if (!hasMore || loadingMore.current) return;
    loadingMore.current = true;
    setPage(p => p + 1);
  }, [hasMore]);

  // Reset loading flag when data arrives
  useEffect(() => {
    loadingMore.current = false;
  }, [data]);

  const missingBarcodes = useMemo(() => allProducts.some(p => !p.barcode), [allProducts]);

  // Form handlers
  function openAdd() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(p: ProductDto) {
    setEditing(p);
    setFormOpen(true);
  }

  /** Detail sheet → Edit Product */
  const handleDetailEdit = useCallback((p: ProductDto) => {
    setDetailTarget(null);
    openEdit(p);
  }, []);

  /** Detail sheet → Adjust Stock */
  const handleDetailAdjust = useCallback((p: ProductDto) => {
    setDetailTarget(null);
    setAdjusting(p);
  }, []);

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await deleteProduct.mutateAsync(deleteTarget.id);
      successFeedback(`${deleteTarget.name} deleted`);
    } catch {
      errorFeedback('Failed to delete product');
    }
    setDeleteTarget(null);
  }

  async function handleLabelShare() {
    if (!labelTarget) return;
    setLabelBusy(true);
    try {
      const label = buildProductLabel(
        {id: labelTarget.id, name: labelTarget.name, sku: labelTarget.sku, barcode: labelTarget.barcode, type: labelTarget.type, weight: labelTarget.weight, weightUnit: labelTarget.weightUnit, grossWeight: labelTarget.grossWeight ?? null, nagLessWeight: labelTarget.nagLessWeight ?? null, nagRate: labelTarget.nagRate ?? null, chejatWeight: labelTarget.chejatWeight ?? null, netWeight: labelTarget.netWeight ?? null, purity: labelTarget.purity, sellingPrice: labelTarget.effectivePrice, labourType: labelTarget.labourType, labourValue: labelTarget.labourValue, colorName: labelTarget.color, sizeName: labelTarget.size, categoryName: labelTarget.category, subCategoryName: labelTarget.subCategory},
        {name: settings?.shopName ?? ''},
      );
      const html = renderLabelSheetHtml([label], {copies: labelCopies});
      const {uri} = await Print.printToFileAsync({html, base64: false});
      await Share.share({url: uri, message: `Label — ${labelTarget.name} (${labelTarget.sku})`});
      setLabelOpen(false);
    } catch {
      errorFeedback();
    } finally {
      setLabelBusy(false);
    }
  }

  async function handleBackfill() {
    setBackfilling(true);
    try {
      await backfillBarcodes.mutateAsync();
      successFeedback('Barcodes generated');
    } catch {
      errorFeedback('Barcode generation failed');
    } finally {
      setBackfilling(false);
    }
  }

  function handleScanDetected(code: string) {
    if (scanningRef.current) return;
    scanningRef.current = true;
    setScanMsg('');
    setScanCode(code);
  }

  const onPressRow = useCallback((p: ProductDto) => {
    selectionTick();
    setDetailTarget(p);
  }, []);

  const renderItem = useCallback(
    ({item, index}: {item: ProductDto; index: number}) => (
      <ProductRow item={item} onPress={onPressRow} onBill={sendToBill} index={index} />
    ),
    [onPressRow, sendToBill],
  );

  const keyExtractor = useCallback((item: ProductDto) => item.id, []);

  const FILTERS: {key: StockFilter; label: string; count: number}[] = [
    {key: 'all', label: 'All', count: counts.all},
    {key: 'in', label: 'In Stock', count: counts.in},
    {key: 'low', label: 'Low Stock', count: counts.low},
    {key: 'out', label: 'Out of Stock', count: counts.out},
  ];

  const TYPE_FILTERS: {key: TypeFilter; label: string}[] = [
    {key: 'all', label: 'All types'},
    {key: 'Gold', label: 'Gold'},
    {key: 'Silver', label: 'Silver'},
  ];

  const PRICE_FILTERS: {key: PriceFilter; label: string}[] = [
    {key: 'all', label: 'All pricing'},
    {key: 'auto', label: 'Auto'},
    {key: 'manual', label: 'Manual'},
  ];

  return (
    <Screen>
      <HomeHeader title="Stock" />

      {/* Search + scan row, with add-product icon button beside it */}
      <View style={styles.searchBarRow}>
        <View style={styles.searchWrap}>
          <Search size={rs(16)} color={colors.muted} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={v => { setSearch(v); setPage(1); setAllProducts([]); }}
            placeholder="Search product name, SKU, barcode…"
            placeholderTextColor={colors.inputPlaceholder}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
          {search ? (
            <Pressable onPress={() => { setSearch(''); setPage(1); setAllProducts([]); }} style={styles.searchClear} accessibilityLabel="Clear search">
              <X size={rs(16)} color={colors.muted} />
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => { setScanMsg(''); setScanOpen(true); }}
            style={({pressed}) => [styles.scanButton, pressed && {opacity: 0.7}]}
            accessibilityLabel="Scan barcode">
            <ScanLine size={rs(18)} color={colors.onPrimary} />
          </Pressable>
        </View>
        <Pressable
          onPress={openAdd}
          style={({pressed}) => [styles.addButton, pressed && {opacity: 0.7}]}
          accessibilityLabel="Add product">
          <Plus size={rs(20)} color={colors.onPrimary} />
        </Pressable>
      </View>

      {/* Filter badges — one horizontally scrollable row (stock · type · price),
          every badge sharing the same size and pill language. */}
      <View style={styles.chipScrollWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipScrollContent}>
          {FILTERS.map(f => {
            const active = stockFilter === f.key;
            return (
              <Pressable
                key={f.key}
                onPress={() => {
                  selectionTick();
                  setStockFilter(f.key);
                  setPage(1);
                }}
                style={({pressed}) => [styles.chip, active && styles.chipActive, pressed && {opacity: 0.8}]}>
                {f.key === 'low' && f.count > 0 ? <View style={styles.dotWarning} /> : null}
                {f.key === 'out' && f.count > 0 ? <View style={styles.dotDanger} /> : null}
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{f.label}</Text>
                {f.count > 0 ? (
                  <Text style={[styles.chipCount, active && styles.chipTextActive]}>{f.count}</Text>
                ) : null}
              </Pressable>
            );
          })}
          <View style={styles.chipDivider} />
          {TYPE_FILTERS.map(f => {
            const active = typeFilter === f.key;
            return (
              <Pressable
                key={f.key}
                onPress={() => {
                  selectionTick();
                  setTypeFilter(f.key);
                  setPage(1);
                }}
                style={({pressed}) => [styles.chip, active && styles.chipActive, pressed && {opacity: 0.8}]}>
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{f.label}</Text>
              </Pressable>
            );
          })}
          <View style={styles.chipDivider} />
          {PRICE_FILTERS.map(f => {
            const active = priceFilter === f.key;
            return (
              <Pressable
                key={f.key}
                onPress={() => {
                  selectionTick();
                  setPriceFilter(f.key);
                  setPage(1);
                }}
                style={({pressed}) => [styles.chip, active && styles.chipActive, pressed && {opacity: 0.8}]}>
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{f.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {missingBarcodes ? (
        <View style={{marginHorizontal: CARD_MARGIN, marginBottom: spacing.sm}}>
          <Button title={backfilling ? 'Generating…' : 'Generate missing barcodes'} variant="outline" onPress={handleBackfill} disabled={backfilling} />
        </View>
      ) : null}

      {error ? (
        <ErrorBox message={error} onRetry={reload} />
      ) : showSkeleton ? (
        <Loading />
      ) : (
        <FlashList
          data={filtered}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={{paddingHorizontal: CARD_MARGIN, paddingBottom: spacing.xxxl, gap: spacing.sm}}
          keyboardShouldPersistTaps="handled"
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            hasMore ? (
              <View style={{paddingVertical: spacing.md, alignItems: 'center'}}>
                <Text style={{color: colors.muted, fontSize: rs(13)}}>Loading more…</Text>
              </View>
            ) : filtered.length > 0 ? (
              <View style={{paddingVertical: spacing.md, alignItems: 'center'}}>
                <Text style={{color: colors.muted, fontSize: rs(12)}}>Showing {filtered.length} of {totalCount} products</Text>
              </View>
            ) : null
          }
          {...headerScrollHandlers}
          ListEmptyComponent={
            query || stockFilter !== 'all' ? (
              <Empty text="No products match the current filters" />
            ) : (
              <Empty text="No products yet" />
            )
          }
        />
      )}

      {/* Product detail bottom sheet (@gorhom) */}
      <ProductDetailSheet
        product={detailTarget}
        onClose={() => setDetailTarget(null)}
        onEdit={handleDetailEdit}
        onAdjust={handleDetailAdjust}
        onSell={p => { setDetailTarget(null); sendToBill(p); }}
      />

      {/* Product form — draggable bottom sheet */}
      <EditProductModal
        visible={formOpen}
        product={editing}
        onClose={() => { setFormOpen(false); setEditing(null); }}
        onSaved={() => { setFormOpen(false); setEditing(null); }}
      />

      {/* Stock adjustment sheet — centered modal */}
      <AdjustStockModal
        visible={adjusting !== null}
        product={adjusting}
        onClose={() => setAdjusting(null)}
        onSaved={() => setAdjusting(null)}
      />

      {/* Label sheet — centered modal */}
      <ModalSheet visible={labelOpen} title={`Print label — ${labelTarget?.name ?? ''}`} onClose={() => setLabelOpen(false)} dismissable={!labelBusy} centered scrollable>
        {labelTarget?.barcode ? <BarcodeChip value={labelTarget.barcode} /> : null}
        <Text style={{fontSize: typography.caption, color: colors.muted, marginTop: spacing.sm}}>
          {labelTarget?.sku}
          {[labelTarget?.color, labelTarget?.size, labelTarget?.category].filter(Boolean).length
            ? ` · ${[labelTarget?.color, labelTarget?.size, labelTarget?.category].filter(Boolean).join(' / ')}`
            : ''}
          {labelTarget?.weight != null ? ` · ${formatWeight(labelTarget.weight, labelTarget.weightUnit)}` : ''}
        </Text>
        <Field label="Copies" value={String(labelCopies)} onChangeText={t => setLabelCopies(Math.max(1, Math.min(100, Number(t) || 1)))} keyboardType="number-pad" />
        <Button title={labelBusy ? 'Preparing…' : 'Share label PDF'} onPress={handleLabelShare} loading={labelBusy} disabled={!labelTarget} />
      </ModalSheet>

      {/* Delete confirmation */}
      <ConfirmDialog
        visible={deleteTarget !== null}
        title="Delete product"
        message={`Delete "${deleteTarget?.name ?? ''}"? This cannot be undone.`}
        confirmLabel="Delete"
        destructive
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* Camera scanner (shared) — found products land on the new bill */}
      <BarcodeScannerModal visible={scanOpen} onClose={() => setScanOpen(false)} onDetected={handleScanDetected} message={scanMsg} />
    </Screen>
  );
}

/* ─── Row styles ─────────────────────────────────────────────────────── */

const makeRowStyles = () =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.lg,
      padding: rs(12),
      gap: rs(10),
    },
    rowPressed: {
      backgroundColor: colors.mutedSoft,
    },
    thumb: {
      width: rs(72),
      height: rs(72),
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.mutedSoft,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      flexShrink: 0,
    },
    thumbImg: {width: '100%', height: '100%'},
    main: {flex: 1, minWidth: 0},
    name: {fontSize: rs(15), fontWeight: '700', color: colors.text},
    chipRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rs(6),
      marginTop: rs(4),
      maxWidth: '100%',
    },
    typeBadge: {
      borderRadius: radii.full,
      paddingHorizontal: rs(5),
      paddingVertical: rs(1),
      borderWidth: 1,
      flexShrink: 0,
    },
    typeBadgeText: {fontSize: rs(9), fontWeight: '700'},
    variantText: {fontSize: rs(10.5), fontWeight: '600', color: colors.muted, flexShrink: 1},
    weightText: {fontSize: rs(12), fontWeight: '700', color: colors.text, marginTop: rs(3)},
    priceRow: {flexDirection: 'row', alignItems: 'baseline', gap: rs(8), marginTop: rs(4)},
    price: {fontSize: rs(17), fontWeight: '800', color: colors.primary},
    costText: {fontSize: rs(11.5), color: colors.muted},
    outText: {fontSize: rs(11.5), fontWeight: '600', color: colors.danger},
    rightCol: {alignItems: 'flex-end', gap: rs(6), flexShrink: 0},
    pill: {
      borderRadius: radii.full,
      paddingHorizontal: rs(9),
      paddingVertical: rs(4),
      alignSelf: 'center',
      flexShrink: 0,
      maxWidth: rs(120),
    },
    pillOk: {backgroundColor: colors.mutedSoft},
    pillLow: {backgroundColor: colors.warningSoft},
    pillOut: {backgroundColor: colors.dangerSoft},
    pillText: {
      fontSize: rs(10),
      fontWeight: '700',
      color: colors.text,
      textAlign: 'right',
    },
    billBtn: {
      borderRadius: radii.full,
      backgroundColor: colors.primary,
      paddingHorizontal: rs(12),
      paddingVertical: rs(5),
    },
    billBtnText: {fontSize: rs(11), fontWeight: '700', color: colors.onPrimary},
  });

/* ─── Screen styles ──────────────────────────────────────────────────── */

const makeStyles = () =>
  StyleSheet.create({
    chipScrollWrap: {
      marginHorizontal: CARD_MARGIN,
      marginBottom: spacing.sm,
    },
    chipScrollContent: {
      gap: rs(6),
      alignItems: 'center',
      paddingRight: rs(6),
    },
    chipDivider: {
      width: 1,
      height: rs(18),
      backgroundColor: colors.border,
      marginHorizontal: rs(3),
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rs(5),
      borderRadius: radii.full,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      paddingHorizontal: rs(11),
      paddingVertical: rs(6),
      minHeight: rs(30),
      flexShrink: 0,
    },
    chipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    chipText: {fontSize: rs(11.5), fontWeight: '600', color: colors.muted},
    chipTextActive: {color: colors.onPrimary},
    chipCount: {
      fontSize: rs(10.5),
      fontWeight: '800',
      color: colors.muted,
    },
    dotWarning: {
      width: rs(6),
      height: rs(6),
      borderRadius: radii.full,
      backgroundColor: colors.warning,
    },
    dotDanger: {
      width: rs(6),
      height: rs(6),
      borderRadius: radii.full,
      backgroundColor: colors.danger,
    },
    searchBarRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginHorizontal: CARD_MARGIN,
      marginBottom: spacing.sm,
    },
    searchWrap: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.full,
      backgroundColor: colors.card,
      paddingLeft: spacing.md,
      paddingRight: rs(4),
      height: TOUCH_TARGET,
    },
    searchIcon: {marginRight: spacing.sm},
    searchInput: {flex: 1, fontSize: typography.secondary, color: colors.text, paddingVertical: 0},
    searchClear: {padding: rs(4)},
    scanButton: {
      width: rh(38),
      height: rh(38),
      borderRadius: radii.full,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: spacing.sm,
    },
    addButton: {
      width: rh(42),
      height: rh(42),
      borderRadius: radii.full,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
  });
