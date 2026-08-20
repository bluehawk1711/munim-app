/**
 * ProductsScreen — product CRUD, stock adjustment, barcode scanning, labels.
 *
 * Redesigned with:
 * - FlashList for performance with large product lists
 * - AccordionCard with 3-dot menu for each product
 * - BottomSheet-based pickers for Color, Size, Category (from catalog)
 * - Responsive layout using ../lib/responsive
 * - Proper keyboard-aware form in bottom sheet
 */

import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  Image,
  Modal,
  Pressable,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, {FadeInUp} from 'react-native-reanimated';
import {FlashList} from '@shopify/flash-list';
import {Search, X, ScanLine, Barcode} from 'lucide-react-native';
import {SvgXml} from 'react-native-svg';
import * as ImagePicker from 'expo-image-picker';
import {CameraView, useCameraPermissions} from 'expo-camera';
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
import {successFeedback, errorFeedback} from '../lib/haptics';
import {uploadImageDirect} from '../lib/cloudinary';
import {rw, rh, rs, typography, spacing, radii, CARD_MARGIN, TOUCH_TARGET} from '../lib/responsive';
import {
  AccordionCard,
  Badge,
  Button,
  Empty,
  ErrorBox,
  Field,
  Header,
  Loading,
  ModalSheet,
  Screen,
  SelectField,
  ThreeDotMenu,
  ConfirmDialog,
  colors,
} from '../components/ui';
import {useThemeStyles} from '../theme';

/* ─── Helpers ────────────────────────────────────────────────────────── */

function toneFor(p: ProductDto): 'success' | 'warning' | 'danger' | 'muted' {
  if (p.stock <= 0) return 'danger';
  if (p.stock <= p.lowStockThreshold) return 'warning';
  return 'success';
}

function BarcodeChip({value}: {value: string}) {
  const xml = React.useMemo(() => barcodeSvg(value, {showText: false, height: 36}), [value]);
  if (!value) return null;
  return <SvgXml xml={xml} width={rw(140)} height={rs(36)} />;
}

/* ─── Product row (memoized for FlashList) ───────────────────────────── */

type ProductRowProps = {
  item: ProductDto;
  expanded: boolean;
  onToggle: () => void;
  onEdit: (p: ProductDto) => void;
  onAdjust: (p: ProductDto) => void;
  onDelete: (p: ProductDto) => void;
  onLabel: (p: ProductDto) => void;
};

const ProductRow = React.memo(function ProductRow({
  item,
  expanded,
  onToggle,
  onEdit,
  onAdjust,
  onDelete,
  onLabel,
}: ProductRowProps) {
  const menuActions = useMemo(
    () => [
      {label: 'Edit', onPress: () => onEdit(item)},
      {label: 'Adjust stock', onPress: () => onAdjust(item)},
      {label: 'Print label', onPress: () => onLabel(item)},
      {label: 'Delete', onPress: () => onDelete(item), destructive: true},
    ],
    [item, onEdit, onAdjust, onLabel, onDelete],
  );

  return (
    <AccordionCard
      expanded={expanded}
      onToggle={onToggle}
      trailing={<ThreeDotMenu actions={menuActions} />}
      header={
        <View style={productStyles.header}>
          {item.imageUrl ? (
            <Image source={{uri: item.imageUrl}} style={productStyles.thumb} />
          ) : null}
          <View style={{flex: 1}}>
            <Text style={productStyles.name} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={productStyles.meta} numberOfLines={1}>
              {item.sku}
              {item.color || item.size || item.category
                ? ` · ${[item.color, item.size, item.category].filter(Boolean).join(' / ')}`
                : ''}
            </Text>
            <View style={productStyles.priceRow}>
              <Text style={productStyles.price}>₹{Number(item.sellingPrice).toFixed(0)}</Text>
              <Badge
                text={item.stock <= 0 ? 'Out' : `${item.stock} in stock`}
                tone={toneFor(item)}
              />
            </View>
          </View>
        </View>
      }>
      {/* Expanded details */}
      <View style={productStyles.detailRow}>
        <Text style={productStyles.detailLabel}>Buy price</Text>
        <Text style={productStyles.detailValue}>{money(item.purchasePrice)}</Text>
      </View>
      <View style={productStyles.detailRow}>
        <Text style={productStyles.detailLabel}>Sell price</Text>
        <Text style={productStyles.detailValue}>{money(item.sellingPrice)}</Text>
      </View>
      <View style={productStyles.detailRow}>
        <Text style={productStyles.detailLabel}>Stock</Text>
        <Text style={productStyles.detailValue}>{item.stock} units</Text>
      </View>
      {item.color ? (
        <View style={productStyles.detailRow}>
          <Text style={productStyles.detailLabel}>Color</Text>
          <Text style={productStyles.detailValue}>{item.color}</Text>
        </View>
      ) : null}
      {item.size ? (
        <View style={productStyles.detailRow}>
          <Text style={productStyles.detailLabel}>Size</Text>
          <Text style={productStyles.detailValue}>{item.size}</Text>
        </View>
      ) : null}
      {item.category ? (
        <View style={productStyles.detailRow}>
          <Text style={productStyles.detailLabel}>Category</Text>
          <Text style={productStyles.detailValue}>{item.category}</Text>
        </View>
      ) : null}
      {item.weight != null ? (
        <View style={productStyles.detailRow}>
          <Text style={productStyles.detailLabel}>Weight</Text>
          <Text style={productStyles.detailValue}>{formatWeight(item.weight)}</Text>
        </View>
      ) : null}
      {item.barcode ? (
        <View style={{marginTop: spacing.sm}}>
          <BarcodeChip value={item.barcode} />
        </View>
      ) : null}
      {item.imageUrl ? (
        <Image source={{uri: item.imageUrl}} style={productStyles.detailImage} />
      ) : null}
    </AccordionCard>
  );
});

/* ─── Main screen ────────────────────────────────────────────────────── */

export function ProductsScreen() {
  const styles = useThemeStyles(makeStyles);

  // Data
  const {data: listData, error, loading, reload} = useQueryState(useProducts({pageSize: 500}));
  const data = listData?.products;
  const {data: catalogData} = useQueryState(useCatalog());
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
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ProductDto | null>(null);
  const [saving, setSaving] = useState(false);

  // Form fields
  const [name, setName] = useState('');
  const [color, setColor] = useState('');
  const [size, setSize] = useState('');
  const [category, setCategory] = useState('');
  const [weight, setWeight] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [stock, setStock] = useState('0');
  const [buy, setBuy] = useState('0');
  const [sell, setSell] = useState('0');

  // Catalog pickers
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [sizePickerOpen, setSizePickerOpen] = useState(false);
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
  const catalogColors = useMemo(() => (catalogData?.colors ?? []).map(c => ({label: c.name, value: c.name})), [catalogData]);
  const catalogSizes = useMemo(() => (catalogData?.sizes ?? []).map(s => ({label: s.name, value: s.name})), [catalogData]);
  const catalogCategories = useMemo(() => (catalogData?.categories ?? []).map(c => ({label: c.name, value: c.name})), [catalogData]);

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

  // Barcode scanner
  const [scanOpen, setScanOpen] = useState(false);
  const scanningRef = useRef(false);
  const [scanMsg, setScanMsg] = useState('');
  const [scanCode, setScanCode] = useState<string | null>(null);
  const scanQ = useProductByBarcode(scanCode);
  const [permission, requestPermission] = useCameraPermissions();

  // Backfill
  const [backfilling, setBackfilling] = useState(false);

  // Barcode scan result handler
  useEffect(() => {
    if (!scanCode) return;
    if (scanQ.data) {
      scanningRef.current = false;
      setScanOpen(false);
      successFeedback();
      openEdit(scanQ.data);
      setScanCode(null);
    } else if (scanQ.isError) {
      scanningRef.current = false;
      const notFound = scanQ.error instanceof ApiClientError && scanQ.error.status === 404;
      errorFeedback();
      setScanMsg(notFound ? `No product with barcode ${scanCode}` : 'Lookup failed');
      setScanCode(null);
    }
  }, [scanCode, scanQ.data, scanQ.isError, scanQ.error]);

  // Filtered list
  const query = search.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      query
        ? (data ?? []).filter(
            p =>
              p.name.toLowerCase().includes(query) ||
              p.sku.toLowerCase().includes(query) ||
              (p.barcode ?? '').toLowerCase().includes(query) ||
              (p.color ?? '').toLowerCase().includes(query) ||
              (p.size ?? '').toLowerCase().includes(query),
          )
        : data ?? [],
    [data, query],
  );

  const missingBarcodes = useMemo(() => (data ?? []).some(p => !p.barcode), [data]);

  // Form handlers
  function resetForm() {
    setName('');
    setColor('');
    setSize('');
    setCategory('');
    setWeight('');
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
    setImageUrl(p.imageUrl ?? '');
    setStock(String(p.stock));
    setBuy(String(p.purchasePrice));
    setSell(String(p.sellingPrice));
    setFormOpen(true);
  }

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
        imageUrl: imageUrl.trim() || undefined,
        stock: Math.max(0, Number(stock) || 0),
        purchasePrice: Math.max(0, Number(buy) || 0),
        sellingPrice: Math.max(0, Number(sell) || 0),
      };
      if (editing) {
        await updateProduct.mutateAsync({id: editing.id, values: input});
      } else {
        await createProduct.mutateAsync(input);
      }
      successFeedback();
      setFormOpen(false);
      setEditing(null);
      resetForm();
    } catch {
      errorFeedback();
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
      successFeedback();
      setAdjusting(null);
      setAdjustQty('');
      setAdjustReason('');
    } catch {
      errorFeedback();
    } finally {
      setAdjustBusy(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await deleteProduct.mutateAsync(deleteTarget.id);
      successFeedback();
    } catch {
      errorFeedback();
    }
    setDeleteTarget(null);
  }

  async function handlePickImage() {
    const mediaPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!mediaPermission.granted) {
      errorFeedback();
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (result.canceled || result.assets.length === 0) return;
    const asset = result.assets[0];
    setUploading(true);
    try {
      const file = {uri: asset.uri, name: asset.fileName ?? `product-${Date.now()}.jpg`, type: asset.mimeType ?? 'image/jpeg'};
      try {
        const {url} = await uploadImage.mutateAsync(file);
        setImageUrl(url);
      } catch {
        const url = await uploadImageDirect(file);
        setImageUrl(url);
      }
      successFeedback();
    } catch {
      errorFeedback();
    } finally {
      setUploading(false);
    }
  }

  async function handleLabelShare() {
    if (!labelTarget) return;
    setLabelBusy(true);
    try {
      const label = buildProductLabel(
        {id: labelTarget.id, name: labelTarget.name, sku: labelTarget.sku, barcode: labelTarget.barcode, weight: labelTarget.weight, sellingPrice: labelTarget.sellingPrice, colorName: labelTarget.color, sizeName: labelTarget.size, categoryName: labelTarget.category},
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
      successFeedback();
    } catch {
      errorFeedback();
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

  const toggleExpand = useCallback((id: string) => {
    setExpandedId(prev => (prev === id ? null : id));
  }, []);

  const renderItem = useCallback(
    ({item, index}: {item: ProductDto; index: number}) => (
      <ProductRow
        item={item}
        expanded={expandedId === item.id}
        onToggle={() => toggleExpand(item.id)}
        onEdit={openEdit}
        onAdjust={setAdjusting}
        onDelete={setDeleteTarget}
        onLabel={p => { setLabelTarget(p); setLabelCopies(1); setLabelOpen(true); }}
      />
    ),
    [expandedId, toggleExpand],
  );

  const keyExtractor = useCallback((item: ProductDto) => item.id, []);

  return (
    <Screen>
      <Header title="Products & Stock" subtitle={`${filtered.length} products`} />

      {/* Search bar */}
      <View style={styles.searchWrap}>
        <Search size={rs(16)} color={colors.muted} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search name, SKU, barcode…"
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
        <Pressable onPress={() => { setScanMsg(''); if (!permission?.granted) void requestPermission(); setScanOpen(true); }} style={styles.scanButton} accessibilityLabel="Scan barcode">
          <ScanLine size={rs(18)} color={colors.primary} />
        </Pressable>
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
          estimatedItemSize={rs(80)}
          contentContainerStyle={{padding: CARD_MARGIN, paddingBottom: spacing.xxxl}}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            query ? <Empty text="No products match your search" /> : <Empty text="No products yet" />
          }
        />
      )}

      {/* FAB */}
      <Animated.View entering={FadeInUp.duration(320)} style={styles.fab}>
        <Button title="+ Add product" onPress={openAdd} />
      </Animated.View>

      {/* Product form sheet */}
      <ModalSheet visible={formOpen} title={editing ? `Edit — ${editing.name}` : 'Add product'} onClose={() => setFormOpen(false)} dismissable={!saving && !uploading}>
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
        <Field label="Weight (mg)" value={weight} onChangeText={setWeight} keyboardType="numeric" placeholder="e.g. 24500" />
        <Field label="Stock" value={stock} onChangeText={setStock} keyboardType="numeric" />
        <Field label="Buy price" value={buy} onChangeText={setBuy} keyboardType="numeric" />
        <Field label="Sell price" value={sell} onChangeText={setSell} keyboardType="numeric" />
        <Button title={saving ? 'Saving…' : editing ? 'Save changes' : 'Save product'} onPress={handleSave} loading={saving} />
      </ModalSheet>

      {/* Stock adjustment sheet */}
      <ModalSheet visible={adjusting !== null} title={`Adjust stock — ${adjusting?.name ?? ''}`} onClose={() => setAdjusting(null)} dismissable={!adjustBusy}>
        <Field label="Quantity (+/−)" value={adjustQty} onChangeText={setAdjustQty} keyboardType="numeric" placeholder="e.g. 10 or -2" />
        <Field label="Reason (optional)" value={adjustReason} onChangeText={setAdjustReason} multiline placeholder="e.g. Restocked, damaged…" />
        <Button title="Adjust" onPress={handleAdjust} loading={adjustBusy} />
      </ModalSheet>

      {/* Label sheet */}
      <ModalSheet visible={labelOpen} title={`Print label — ${labelTarget?.name ?? ''}`} onClose={() => setLabelOpen(false)} dismissable={!labelBusy}>
        {labelTarget?.barcode ? <BarcodeChip value={labelTarget.barcode} /> : null}
        <Text style={{fontSize: typography.caption, color: colors.muted, marginTop: spacing.sm}}>
          {labelTarget?.sku}
          {[labelTarget?.color, labelTarget?.size, labelTarget?.category].filter(Boolean).length
            ? ` · ${[labelTarget?.color, labelTarget?.size, labelTarget?.category].filter(Boolean).join(' / ')}`
            : ''}
          {labelTarget?.weight != null ? ` · ${formatWeight(labelTarget.weight)}` : ''}
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

      {/* Catalog pickers */}
      <ModalSheet visible={colorPickerOpen} title="Select color" onClose={() => setColorPickerOpen(false)}>
        {catalogColors.map(c => (
          <Pressable key={c.value} onPress={() => { setColor(c.value); setColorPickerOpen(false); }} style={({pressed}) => [{paddingVertical: spacing.md, paddingHorizontal: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border}, pressed && {backgroundColor: colors.mutedSoft}]}>
            <Text style={{fontSize: typography.body, color: c.value === color ? colors.primary : colors.text, fontWeight: c.value === color ? '700' : '400'}}>{c.label}</Text>
          </Pressable>
        ))}
        <Pressable onPress={() => { setColor(''); setColorPickerOpen(false); }} style={{paddingVertical: spacing.md}}>
          <Text style={{fontSize: typography.body, color: colors.muted}}>Clear color</Text>
        </Pressable>
      </ModalSheet>

      <ModalSheet visible={sizePickerOpen} title="Select size" onClose={() => setSizePickerOpen(false)}>
        {catalogSizes.map(s => (
          <Pressable key={s.value} onPress={() => { setSize(s.value); setSizePickerOpen(false); }} style={({pressed}) => [{paddingVertical: spacing.md, paddingHorizontal: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border}, pressed && {backgroundColor: colors.mutedSoft}]}>
            <Text style={{fontSize: typography.body, color: s.value === size ? colors.primary : colors.text, fontWeight: s.value === size ? '700' : '400'}}>{s.label}</Text>
          </Pressable>
        ))}
        <Pressable onPress={() => { setSize(''); setSizePickerOpen(false); }} style={{paddingVertical: spacing.md}}>
          <Text style={{fontSize: typography.body, color: colors.muted}}>Clear size</Text>
        </Pressable>
      </ModalSheet>

      <ModalSheet visible={categoryPickerOpen} title="Select category" onClose={() => setCategoryPickerOpen(false)}>
        {catalogCategories.map(c => (
          <Pressable key={c.value} onPress={() => { setCategory(c.value); setCategoryPickerOpen(false); }} style={({pressed}) => [{paddingVertical: spacing.md, paddingHorizontal: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border}, pressed && {backgroundColor: colors.mutedSoft}]}>
            <Text style={{fontSize: typography.body, color: c.value === category ? colors.primary : colors.text, fontWeight: c.value === category ? '700' : '400'}}>{c.label}</Text>
          </Pressable>
        ))}
        <Pressable onPress={() => { setCategory(''); setCategoryPickerOpen(false); }} style={{paddingVertical: spacing.md}}>
          <Text style={{fontSize: typography.body, color: colors.muted}}>Clear category</Text>
        </Pressable>
      </ModalSheet>

      {/* Camera scanner */}
      <Modal visible={scanOpen} animationType="slide" onRequestClose={() => setScanOpen(false)}>
        <View style={styles.scanRoot}>
          {permission?.granted ? (
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              barcodeScannerSettings={{barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39', 'qr']}}
              onBarcodeScanned={({data: barcodeData}) => void handleScanDetected(barcodeData)}>
              <View style={styles.scanOverlay}>
                <View style={styles.scanFrame} />
                <Text style={styles.scanTitle}>Point at a product barcode</Text>
                {scanMsg ? <Text style={styles.scanMsg}>{scanMsg}</Text> : null}
                <Button title="Cancel" variant="outline" onPress={() => setScanOpen(false)} style={{marginTop: spacing.lg}} />
              </View>
            </CameraView>
          ) : (
            <View style={styles.scanPerm}>
              <Barcode size={rs(40)} color={colors.muted} />
              <Text style={styles.scanTitle}>Camera permission needed</Text>
              <Button title="Allow camera" onPress={() => void requestPermission()} style={{marginTop: spacing.md}} />
              <Button title="Cancel" variant="outline" onPress={() => setScanOpen(false)} style={{marginTop: spacing.sm}} />
            </View>
          )}
        </View>
      </Modal>
    </Screen>
  );
}

/* ─── Styles ─────────────────────────────────────────────────────────── */

const productStyles = StyleSheet.create({
  header: {flexDirection: 'row', alignItems: 'center', gap: spacing.sm},
  thumb: {width: rs(44), height: rs(44), borderRadius: radii.md, borderWidth: 1, borderColor: colors.border},
  name: {fontSize: typography.body, fontWeight: '600', color: colors.text},
  meta: {fontSize: typography.caption, color: colors.muted, marginTop: rs(2)},
  priceRow: {flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: rs(4)},
  price: {fontSize: typography.body, fontWeight: '700', color: colors.text},
  detailRow: {flexDirection: 'row', justifyContent: 'space-between', paddingVertical: rs(4)},
  detailLabel: {fontSize: typography.secondary, color: colors.muted},
  detailValue: {fontSize: typography.secondary, fontWeight: '600', color: colors.text},
  detailImage: {width: '100%', height: rs(120), borderRadius: radii.md, marginTop: spacing.sm, resizeMode: 'cover'},
});

const makeStyles = () =>
  StyleSheet.create({
    searchWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: CARD_MARGIN,
      marginBottom: spacing.sm,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.md,
      backgroundColor: colors.card,
      paddingHorizontal: spacing.md,
      height: TOUCH_TARGET,
    },
    searchIcon: {marginRight: spacing.sm},
    searchInput: {flex: 1, fontSize: typography.secondary, color: colors.text, paddingVertical: 0},
    searchClear: {padding: rs(4)},
    scanButton: {padding: rs(4), marginLeft: spacing.sm},
    fab: {position: 'absolute', bottom: spacing.xxl, left: CARD_MARGIN, right: CARD_MARGIN},
    imagePicker: {
      height: rs(96),
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
    scanRoot: {flex: 1, backgroundColor: '#000'},
    scanOverlay: {flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xxl},
    scanFrame: {width: rw(260), height: rs(160), borderWidth: 3, borderColor: colors.primary, borderRadius: radii.xl, marginBottom: spacing.xl},
    scanTitle: {fontSize: typography.body, fontWeight: '600', color: '#fff', textAlign: 'center'},
    scanMsg: {fontSize: typography.secondary, color: '#fca5a5', marginTop: spacing.md, textAlign: 'center'},
    scanPerm: {flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xxxl},
  });
