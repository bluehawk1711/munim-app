/**
 * ProductsScreen — Inventory, redesigned to the swatch-row reference layout.
 *
 * - Custom HomeHeader ("Stock")
 * - Search + scan in one row; filter chips (All / In Stock / Low / Out) with
 *   live counts
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
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, {FadeInUp} from 'react-native-reanimated';
import {FlashList} from '@shopify/flash-list';
import {Search, ScanLine, Package, X} from 'lucide-react-native';
import {SvgXml} from 'react-native-svg';
import * as ImagePicker from 'expo-image-picker';
import * as Print from 'expo-print';
import {
  barcodeSvg,
  buildProductLabel,
  renderLabelSheetHtml,
  formatWeight,
  type ProductDto,
} from '@munim/core';
import {ApiClientError} from '@munim/api-client';
import {
  useAdjustStock,
  useBackfillBarcodes,
  useCatalog,
  useCreateProduct,
  useDeleteProduct,
  useProductByBarcode,
  useProducts,
  useQueryState,
  useSettings,
  useUpdateProduct,
  useUploadImage,
} from '@munim/query';
import {money} from '../lib/format';
import {successFeedback, errorFeedback, selectionTick} from '../lib/haptics';
import {uploadImageDirect} from '../lib/cloudinary';
import {rw, rh, rs, typography, spacing, radii, CARD_MARGIN, TOUCH_TARGET} from '../lib/responsive';
import {
  Button,
  Empty,
  ErrorBox,
  Field,
  Loading,
  ModalSheet,
  Screen,
  SelectField,
  ConfirmDialog,
  colors,
} from '../components/ui';
import {HomeHeader, headerScrollHandlers} from '../components/home-header';
import {ProductDetailSheet} from '../components/ProductDetailSheet';
import {BarcodeScannerModal} from '../components/BarcodeScannerModal';
import {QuickSaleSheet} from '../components/quick-sale-sheet';
import {useThemeStyles} from '../theme';

/* ─── Helpers ────────────────────────────────────────────────────────── */

type StockFilter = 'all' | 'in' | 'low' | 'out';

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
  index: number;
};

const ProductRow = React.memo(function ProductRow({item, onPress, index}: ProductRowProps) {
  const styles = useThemeStyles(makeRowStyles);

  const variantBits = [item.color, item.size !== 'Standard' ? item.size : null, item.purity]
    .filter(Boolean)
    .join(' · ');

  const stockPillStyle =
    item.stock <= 0 ? styles.pillOut : isLow(item) ? styles.pillLow : styles.pillOk;

  return (
    <Pressable
      onPress={() => onPress(item)}
      style={({pressed}) => [styles.row, pressed && styles.rowPressed]}>
      {/* Thumbnail */}
      <View style={styles.thumb}>
        {item.imageUrl ? (
          <Image source={{uri: item.imageUrl}} style={styles.thumbImg} />
        ) : (
          <Package size={rs(20)} color={colors.muted} />
        )}
      </View>

      {/* Name / variant chip / price + cost line */}
      <View style={styles.main}>
        <Text style={styles.name} numberOfLines={1}>
          {item.name}
        </Text>
        {variantBits || item.weight != null ? (
          <View style={styles.variantChip}>
            <Text style={styles.variantText} numberOfLines={1}>
              {[
                variantBits || null,
                item.weight != null ? `${formatWeight(item.weight, item.weightUnit)}` : null,
              ]
                .filter(Boolean)
                .join('  ·  ')}
            </Text>
          </View>
        ) : null}
        <View style={styles.priceRow}>
          <Text style={styles.price}>{price(item.sellingPrice)}</Text>
          {item.stock <= 0 ? (
            <Text style={styles.outText}>Out of stock</Text>
          ) : (
            <Text style={styles.costText}>Cost: {price(item.purchasePrice)}</Text>
          )}
        </View>
      </View>

      {/* Right stock pill */}
      <View style={[styles.pill, stockPillStyle]}>
        <Text style={styles.pillText} numberOfLines={1}>
          {item.stock <= 0
            ? '0 units'
            : isLow(item)
              ? `${item.stock} units (Low)`
              : `${item.stock} units`}
        </Text>
      </View>
    </Pressable>
  );
});

/* ─── Main screen ────────────────────────────────────────────────────── */

export function ProductsScreen() {
  const styles = useThemeStyles(makeStyles);

  // Data
  const {data: listData, error, loading, reload} = useQueryState(useProducts({pageSize: 500}));
  const data = listData?.products;
  const {data: colorsCatalog} = useQueryState(useCatalog('color'));
  const {data: sizesCatalog} = useQueryState(useCatalog('size'));
  const {data: categoriesCatalog} = useQueryState(useCatalog('category'));
  const {data: settings} = useQueryState(useSettings());

  // Mutations
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const adjustStock = useAdjustStock();
  const deleteProduct = useDeleteProduct();
  const backfillBarcodes = useBackfillBarcodes();
  const uploadImage = useUploadImage();

  // UI state
  const [search, setSearch] = useState('');
  const [stockFilter, setStockFilter] = useState<StockFilter>('all');
  const [detailTarget, setDetailTarget] = useState<ProductDto | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ProductDto | null>(null);
  const [saving, setSaving] = useState(false);

  // Form fields
  const [name, setName] = useState('');
  const [color, setColor] = useState('');
  const [size, setSize] = useState('');
  const [category, setCategory] = useState('');
  const [weight, setWeight] = useState('');
  const [weightUnit, setWeightUnit] = useState<'mg' | 'gm'>('gm');
  const [purity, setPurity] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [stock, setStock] = useState('0');
  const [buy, setBuy] = useState('0');
  const [sell, setSell] = useState('0');

  // Catalog pickers
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [sizePickerOpen, setSizePickerOpen] = useState(false);
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
  const catalogColors = useMemo(() => (colorsCatalog ?? []).map((c: {name: string}) => ({label: c.name, value: c.name})), [colorsCatalog]);
  const catalogSizes = useMemo(() => (sizesCatalog ?? []).map((s: {name: string}) => ({label: s.name, value: s.name})), [sizesCatalog]);
  const catalogCategories = useMemo(() => (categoriesCatalog ?? []).map((c: {name: string}) => ({label: c.name, value: c.name})), [categoriesCatalog]);

  // Stock adjustment
  const [adjusting, setAdjusting] = useState<ProductDto | null>(null);
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [adjustBusy, setAdjustBusy] = useState(false);

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
  const [saleProduct, setSaleProduct] = useState<ProductDto | null>(null);

  // Backfill
  const [backfilling, setBackfilling] = useState(false);

  // Barcode scan result handler — a found product opens the QuickSaleSheet
  // (instant counter sale) instead of the edit form.
  useEffect(() => {
    if (!scanCode) return;
    if (scanQ.data) {
      scanningRef.current = false;
      setScanOpen(false);
      setSaleProduct(scanQ.data);
      setScanCode(null);
    } else if (scanQ.isError) {
      scanningRef.current = false;
      const notFound = scanQ.error instanceof ApiClientError && scanQ.error.status === 404;
      setScanMsg(notFound ? `No product with barcode ${scanCode}` : 'Lookup failed');
      setScanCode(null);
    }
  }, [scanCode, scanQ.data, scanQ.isError, scanQ.error]);

  // Filtered list
  const query = search.trim().toLowerCase();
  const filtered = useMemo(() => {
    let list = data ?? [];
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
  }, [data, query, stockFilter]);

  const counts = useMemo(
    () => ({
      all: (data ?? []).length,
      in: (data ?? []).filter(inStock).length,
      low: (data ?? []).filter(isLow).length,
      out: (data ?? []).filter(isOut).length,
    }),
    [data],
  );

  const missingBarcodes = useMemo(() => (data ?? []).some(p => !p.barcode), [data]);

  // Form handlers
  function resetForm() {
    setName('');
    setColor('');
    setSize('');
    setCategory('');
    setWeight('');
    setWeightUnit('gm');
    setPurity('');
    setImageUrl('');
    setStock('0');
    setBuy('0');
    setSell('0');
  }

  function openAdd() {
    setEditing(null);
    resetForm();
    setFormOpen(true);
  }

  function openEdit(p: ProductDto) {
    setEditing(p);
    setName(p.name);
    setColor(p.color);
    setSize(p.size);
    setCategory(p.category ?? '');
    setWeight(p.weight != null ? String(p.weight) : '');
    setWeightUnit(p.weightUnit === 'mg' ? 'mg' : 'gm');
    setPurity(p.purity ?? '');
    setImageUrl(p.imageUrl ?? '');
    setStock(String(p.stock));
    setBuy(String(p.purchasePrice));
    setSell(String(p.sellingPrice));
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
    setAdjustQty('');
    setAdjustReason('');
  }, []);

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const input = {
        name: name.trim(),
        color: color.trim() || undefined,
        size: size.trim() || 'Standard',
        category: category.trim() || undefined,
        weight: weight.trim() ? Math.max(0, Number(weight) || 0) : undefined,
        weightUnit,
        purity: purity.trim() || undefined,
        imageUrl: imageUrl.trim() || undefined,
        stock: Math.max(0, Number(stock) || 0),
        purchasePrice: Math.max(0, Number(buy) || 0),
        sellingPrice: Math.max(0, Number(sell) || 0),
      };
      if (editing) {
        await updateProduct.mutateAsync({id: editing.id, values: input});
        successFeedback(`${name} updated`);
      } else {
        await createProduct.mutateAsync(input);
        successFeedback(`${name} created`);
      }
      setFormOpen(false);
      setEditing(null);
      resetForm();
    } catch {
      errorFeedback('Failed to save product');
    } finally {
      setSaving(false);
    }
  }

  async function handleAdjust() {
    if (!adjusting) return;
    const qty = Math.round(Number(adjustQty));
    if (!qty) return;
    setAdjustBusy(true);
    try {
      await adjustStock.mutateAsync({id: adjusting.id, values: {adjustment: qty, reason: adjustReason.trim() || undefined}});
      successFeedback(`Stock adjusted for ${adjusting.name}`);
      setAdjusting(null);
      setAdjustQty('');
      setAdjustReason('');
    } catch {
      errorFeedback('Stock adjustment failed');
    } finally {
      setAdjustBusy(false);
    }
  }

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

  async function handlePickImage() {
    try {
      const mediaPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!mediaPermission.granted) {
        errorFeedback();
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        allowsEditing: false,
      });
      if (result.canceled || result.assets.length === 0) return;
      const asset = result.assets[0];
      setUploading(true);
      const file = {uri: asset.uri, name: asset.fileName ?? `product-${Date.now()}.jpg`, type: asset.mimeType ?? 'image/jpeg'};
      try {
        const {url} = await uploadImage.mutateAsync(file);
        setImageUrl(url);
        successFeedback();
      } catch (uploadErr) {
        // Fallback to direct Cloudinary upload if API endpoint unavailable
        try {
          const url = await uploadImageDirect(file);
          setImageUrl(url);
          successFeedback();
        } catch (directErr) {
          errorFeedback();
          console.error('Image upload failed:', uploadErr, directErr);
        }
      }
    } catch (err) {
      errorFeedback();
      console.error('Image picker failed:', err);
    } finally {
      setUploading(false);
    }
  }

  async function handleLabelShare() {
    if (!labelTarget) return;
    setLabelBusy(true);
    try {
      const label = buildProductLabel(
        {id: labelTarget.id, name: labelTarget.name, sku: labelTarget.sku, barcode: labelTarget.barcode, weight: labelTarget.weight, weightUnit: labelTarget.weightUnit, sellingPrice: labelTarget.sellingPrice, colorName: labelTarget.color, sizeName: labelTarget.size, categoryName: labelTarget.category},
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
      <ProductRow item={item} onPress={onPressRow} index={index} />
    ),
    [onPressRow],
  );

  const keyExtractor = useCallback((item: ProductDto) => item.id, []);

  const FILTERS: {key: StockFilter; label: string; count: number}[] = [
    {key: 'all', label: 'All', count: counts.all},
    {key: 'in', label: 'In Stock', count: counts.in},
    {key: 'low', label: 'Low Stock', count: counts.low},
    {key: 'out', label: 'Out of Stock', count: counts.out},
  ];

  return (
    <Screen>
      <HomeHeader title="Stock" />

      {/* Search + scan row */}
      <View style={styles.searchWrap}>
        <Search size={rs(16)} color={colors.muted} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search product name, SKU, barcode…"
          placeholderTextColor={colors.inputPlaceholder}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
        {search ? (
          <Pressable onPress={() => setSearch('')} style={styles.searchClear} accessibilityLabel="Clear search">
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

      {/* Filter chips */}
      <View style={styles.chipRow}>
        {FILTERS.map(f => {
          const active = stockFilter === f.key;
          return (
            <Pressable
              key={f.key}
              onPress={() => {
                selectionTick();
                setStockFilter(f.key);
              }}
              style={({pressed}) => [styles.chip, active && styles.chipActive, pressed && {opacity: 0.8}]}>
              {f.key === 'low' && f.count > 0 ? <View style={styles.dotWarning} /> : null}
              {f.key === 'out' && f.count > 0 ? <View style={styles.dotDanger} /> : null}
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {f.label}
              </Text>
              {f.count > 0 ? <Text style={[styles.chipCount, active && styles.chipTextActive]}>{f.count}</Text> : null}
            </Pressable>
          );
        })}
      </View>

      {missingBarcodes ? (
        <View style={{marginHorizontal: CARD_MARGIN, marginBottom: spacing.sm}}>
          <Button title={backfilling ? 'Generating…' : 'Generate missing barcodes'} variant="outline" onPress={handleBackfill} disabled={backfilling} />
        </View>
      ) : null}

      {error ? (
        <ErrorBox message={error} onRetry={reload} />
      ) : loading || !data ? (
        <Loading />
      ) : (
        <FlashList
          data={filtered}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={{paddingHorizontal: CARD_MARGIN, paddingBottom: 110, gap: spacing.sm}}
          keyboardShouldPersistTaps="handled"
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

      {/* CTA — Add Product */}
      <Animated.View entering={FadeInUp.duration(320)} style={styles.fab}>
        <Button title="+ Add Product" onPress={openAdd} />
      </Animated.View>

      {/* Product detail bottom sheet (@gorhom) */}
      <ProductDetailSheet
        product={detailTarget}
        onClose={() => setDetailTarget(null)}
        onEdit={handleDetailEdit}
        onAdjust={handleDetailAdjust}
      />

      {/* Product form sheet — centered modal */}
      <ModalSheet visible={formOpen} title={editing ? `Edit — ${editing.name}` : 'Add product'} onClose={() => setFormOpen(false)} dismissable={!saving && !uploading} centered scrollable>
        <Field label="Name" value={name} onChangeText={setName} placeholder="e.g. Gold Necklace Set" />
        <Pressable style={styles.imagePicker} onPress={handlePickImage} disabled={uploading}>
          {imageUrl ? (
            <Image source={{uri: imageUrl}} style={styles.imagePickerThumb} />
          ) : (
            <Text style={styles.imagePickerText}>{uploading ? 'Uploading…' : '+ Add image'}</Text>
          )}
        </Pressable>
        <SelectField label="Color" value={color} placeholder="Select color (optional)" onPress={() => setColorPickerOpen(true)} />
        <SelectField label="Size" value={size} placeholder="Select size" onPress={() => setSizePickerOpen(true)} />
        <SelectField label="Category" value={category} placeholder="Select category (optional)" onPress={() => setCategoryPickerOpen(true)} />
        <View style={{flexDirection: 'row', gap: spacing.sm}}>
          <View style={{flex: 1}}>
            <Field label="Weight" value={weight} onChangeText={setWeight} keyboardType="numeric" placeholder={weightUnit === 'gm' ? 'e.g. 24.5' : 'e.g. 24500'} />
          </View>
          <View style={{width: 70}}>
            <Text style={{fontSize: 12, color: colors.muted, marginBottom: 5}}>Unit</Text>
            <Pressable
              onPress={() => setWeightUnit(u => u === 'gm' ? 'mg' : 'gm')}
              style={{height: 44, borderRadius: 8, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center'}}>
              <Text style={{fontSize: 14, fontWeight: '700', color: colors.primary}}>{weightUnit}</Text>
            </Pressable>
          </View>
        </View>
        <Field label="Purity" value={purity} onChangeText={setPurity} placeholder="e.g. 24K / 22K / 916 / 925" maxLength={20} />
        <Field label="Stock" value={stock} onChangeText={setStock} keyboardType="numeric" />
        <Field label="Buy price" value={buy} onChangeText={setBuy} keyboardType="numeric" />
        <Field label="Sell price" value={sell} onChangeText={setSell} keyboardType="numeric" />
        <Button title={saving ? 'Saving…' : editing ? 'Save changes' : 'Save product'} onPress={handleSave} loading={saving} />
      </ModalSheet>

      {/* Stock adjustment sheet — centered modal */}
      <ModalSheet visible={adjusting !== null} title={`Adjust stock — ${adjusting?.name ?? ''}`} onClose={() => setAdjusting(null)} dismissable={!adjustBusy} centered scrollable>
        <Field label="Quantity (+/−)" value={adjustQty} onChangeText={setAdjustQty} keyboardType="numeric" placeholder="e.g. 10 or -2" />
        <Field label="Reason (optional)" value={adjustReason} onChangeText={setAdjustReason} multiline placeholder="e.g. Restocked, damaged…" />
        <Button title="Adjust" onPress={handleAdjust} loading={adjustBusy} />
      </ModalSheet>

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
        <Field label="Copies" value={String(labelCopies)} onChangeText={t => setLabelCopies(Math.max(1, Math.min(100, Number(t) || 1)))} keyboardType="numeric" />
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

      {/* Catalog pickers — centered modals with scroll */}
      <ModalSheet visible={colorPickerOpen} title="Select color" onClose={() => setColorPickerOpen(false)} centered scrollable>
        {catalogColors.map(c => (
          <Pressable key={c.value} onPress={() => { setColor(c.value); setColorPickerOpen(false); }} style={({pressed}) => [{paddingVertical: spacing.md, paddingHorizontal: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border}, pressed && {backgroundColor: colors.mutedSoft}]}>
            <Text style={{fontSize: typography.body, color: c.value === color ? colors.primary : colors.text, fontWeight: c.value === color ? '700' : '400'}}>{c.label}</Text>
          </Pressable>
        ))}
        <Pressable onPress={() => { setColor(''); setColorPickerOpen(false); }} style={{paddingVertical: spacing.md}}>
          <Text style={{fontSize: typography.body, color: colors.muted}}>Clear color</Text>
        </Pressable>
      </ModalSheet>

      <ModalSheet visible={sizePickerOpen} title="Select size" onClose={() => setSizePickerOpen(false)} centered scrollable>
        {catalogSizes.map(s => (
          <Pressable key={s.value} onPress={() => { setSize(s.value); setSizePickerOpen(false); }} style={({pressed}) => [{paddingVertical: spacing.md, paddingHorizontal: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border}, pressed && {backgroundColor: colors.mutedSoft}]}>
            <Text style={{fontSize: typography.body, color: s.value === size ? colors.primary : colors.text, fontWeight: s.value === size ? '700' : '400'}}>{s.label}</Text>
          </Pressable>
        ))}
        <Pressable onPress={() => { setSize(''); setSizePickerOpen(false); }} style={{paddingVertical: spacing.md}}>
          <Text style={{fontSize: typography.body, color: colors.muted}}>Clear size</Text>
        </Pressable>
      </ModalSheet>

      <ModalSheet visible={categoryPickerOpen} title="Select category" onClose={() => setCategoryPickerOpen(false)} centered scrollable>
        {catalogCategories.map(c => (
          <Pressable key={c.value} onPress={() => { setCategory(c.value); setCategoryPickerOpen(false); }} style={({pressed}) => [{paddingVertical: spacing.md, paddingHorizontal: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border}, pressed && {backgroundColor: colors.mutedSoft}]}>
            <Text style={{fontSize: typography.body, color: c.value === category ? colors.primary : colors.text, fontWeight: c.value === category ? '700' : '400'}}>{c.label}</Text>
          </Pressable>
        ))}
        <Pressable onPress={() => { setCategory(''); setCategoryPickerOpen(false); }} style={{paddingVertical: spacing.md}}>
          <Text style={{fontSize: typography.body, color: colors.muted}}>Clear category</Text>
        </Pressable>
      </ModalSheet>

      {/* Camera scanner (shared) — found products open the QuickSaleSheet */}
      <BarcodeScannerModal visible={scanOpen} onClose={() => setScanOpen(false)} onDetected={handleScanDetected} message={scanMsg} />
      <QuickSaleSheet product={saleProduct} onClose={() => setSaleProduct(null)} />
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
      width: rs(64),
      height: rs(64),
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
    variantChip: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.mutedSoft,
      borderRadius: radii.sm,
      paddingHorizontal: rs(7),
      paddingVertical: rs(2.5),
      marginTop: rs(4),
      maxWidth: '100%',
    },
    variantText: {fontSize: rs(10.5), fontWeight: '600', color: colors.muted},
    priceRow: {flexDirection: 'row', alignItems: 'baseline', gap: rs(8), marginTop: rs(5)},
    price: {fontSize: rs(17), fontWeight: '800', color: colors.primary},
    costText: {fontSize: rs(11.5), color: colors.muted},
    outText: {fontSize: rs(11.5), fontWeight: '600', color: colors.danger},
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
  });

/* ─── Screen styles ──────────────────────────────────────────────────── */

const makeStyles = () =>
  StyleSheet.create({
    searchWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: CARD_MARGIN,
      marginBottom: spacing.sm,
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
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: rs(6),
      marginHorizontal: CARD_MARGIN,
      marginBottom: spacing.sm,
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
    fab: {position: 'absolute', bottom: rs(32), left: CARD_MARGIN, right: CARD_MARGIN, elevation: 4},
    imagePicker: {
      height: rs(120),
      borderRadius: radii.lg,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.md,
      overflow: 'hidden',
    },
    imagePickerThumb: {width: '100%', height: '100%'},
    imagePickerText: {fontSize: typography.secondary, color: colors.muted, fontWeight: '600'},
  });
