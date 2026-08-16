import React, {useRef, useState} from 'react';
import {
  FlatList,
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
import {Search, X, ScanLine, Barcode} from 'lucide-react-native';
import {SvgXml} from 'react-native-svg';
import * as ImagePicker from 'expo-image-picker';
import {CameraView, useCameraPermissions} from 'expo-camera';
import * as Print from 'expo-print';
import {
  listAllProducts,
  createProduct,
  updateProduct,
  adjustStock,
  deleteProduct,
  backfillBarcodes,
  findProductByBarcode,
  getSettings,
  uploadImageToCloudinary,
  barcodeSvg,
  buildProductLabel,
  renderLabelSheetHtml,
  formatWeight,
  type ProductWithMeta,
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
  ErrorBox,
  Field,
  Header,
  Loading,
  ModalSheet,
  Screen,
  colors,
} from '../components/ui';
import {useThemeStyles} from '../theme';

const CLOUD_NAME: string = String(process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME ?? '');
const UPLOAD_PRESET: string = String(process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET ?? '');

function toneFor(p: ProductWithMeta): 'success' | 'warning' | 'danger' | 'muted' {
  if (p.stock <= 0) {
    return 'danger';
  }
  if (p.stock <= p.lowStockThreshold) {
    return 'warning';
  }
  return 'success';
}

/** Small barcode renderer — the SAME SVG string core generates for web/desktop. */
function BarcodeChip({value}: {value: string}) {
  const xml = React.useMemo(() => barcodeSvg(value, {showText: false, height: 36}), [value]);
  if (!value) return null;
  return <SvgXml xml={xml} width={150} height={40} />;
}

export function ProductsScreen() {
  const styles = useThemeStyles(makeStyles);
  const {data, error, loading, reload} = useAsync(async () => listAllProducts(await getCore()), []);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ProductWithMeta | null>(null);
  const [search, setSearch] = useState('');
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
  const [saving, setSaving] = useState(false);

  // Camera scanning
  const [scanOpen, setScanOpen] = useState(false);
  // Re-entry guard for handleScanDetected — never read in JSX, so a ref
  // avoids a pointless re-render while scanning.
  const scanningRef = useRef(false);
  const [scanMsg, setScanMsg] = useState('');
  const [permission, requestPermission] = useCameraPermissions();

  // Label printing
  const [labelTarget, setLabelTarget] = useState<ProductWithMeta | null>(null);
  const [labelOpen, setLabelOpen] = useState(false);
  const [labelCopies, setLabelCopies] = useState(1);
  const [labelBusy, setLabelBusy] = useState(false);

  const [backfilling, setBackfilling] = useState(false);

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
    if (result.canceled || result.assets.length === 0) {
      return;
    }
    const asset = result.assets[0];
    setUploading(true);
    try {
      const url = await uploadImageToCloudinary(
        {uri: asset.uri, name: asset.fileName ?? `product-${Date.now()}.jpg`, type: asset.mimeType ?? 'image/jpeg'},
        CLOUD_NAME,
        UPLOAD_PRESET,
      );
      setImageUrl(url);
      successFeedback();
    } catch {
      errorFeedback();
    } finally {
      setUploading(false);
    }
  }

  const [adjusting, setAdjusting] = useState<ProductWithMeta | null>(null);
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustReason, setAdjustReason] = useState('');

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

  function openEdit(p: ProductWithMeta) {
    setEditing(p);
    setName(p.name);
    setColor(p.colorName ?? '');
    setSize(p.sizeName ?? '');
    setCategory(p.categoryName ?? '');
    setWeight(p.weight != null ? String(p.weight) : '');
    setImageUrl(p.imageUrl ?? '');
    setStock(String(p.stock));
    setBuy(String(p.purchasePrice));
    setSell(String(p.sellingPrice));
    setFormOpen(true);
  }

  async function handleSave() {
    if (!name.trim()) {
      return;
    }
    setSaving(true);
    try {
      const input = {
        name: name.trim(),
        // Empty color = no color (optional field).
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
        await updateProduct(await getCore(), editing.id, input);
      } else {
        await createProduct(await getCore(), input);
      }
      successFeedback();
      setFormOpen(false);
      setEditing(null);
      resetForm();
      reload();
    } catch {
      errorFeedback();
      // keep the modal open on failure
    } finally {
      setSaving(false);
    }
  }

  async function handleAdjust() {
    if (!adjusting) {
      return;
    }
    const qty = Math.round(Number(adjustQty));
    if (!qty) {
      return;
    }
    try {
      await adjustStock(await getCore(), adjusting.id, {
        adjustment: qty,
        reason: adjustReason.trim() || undefined,
      });
      successFeedback();
      setAdjusting(null);
      setAdjustQty('');
      setAdjustReason('');
      reload();
    } catch {
      errorFeedback();
      // keep modal open on failure
    }
  }

  async function handleDelete(p: ProductWithMeta) {
    try {
      await deleteProduct(await getCore(), p.id);
      reload();
    } catch {
      errorFeedback();
      // ignore
    }
  }

  async function handleBackfill() {
    setBackfilling(true);
    try {
      await backfillBarcodes(await getCore());
      successFeedback();
      reload();
    } catch {
      errorFeedback();
    } finally {
      setBackfilling(false);
    }
  }

  async function handleScanDetected(code: string) {
    if (scanningRef.current) return;
    scanningRef.current = true;
    setScanMsg('');
    try {
      const product = await findProductByBarcode(await getCore(), code);
      if (product) {
        setScanOpen(false);
        successFeedback();
        openEdit(product);
      } else {
        errorFeedback();
        setScanMsg(`No product with barcode ${code}`);
      }
    } catch {
      errorFeedback();
      setScanMsg('Lookup failed — check your database connection');
    } finally {
      scanningRef.current = false;
    }
  }

  function openScan() {
    setScanMsg('');
    if (!permission?.granted) {
      void requestPermission();
    }
    setScanOpen(true);
  }

  async function handleLabelShare() {
    if (!labelTarget) return;
    setLabelBusy(true);
    try {
      const settings = await getSettings(await getCore());
      const label = buildProductLabel(
        {
          id: labelTarget.id,
          name: labelTarget.name,
          sku: labelTarget.sku,
          barcode: labelTarget.barcode,
          weight: labelTarget.weight,
          sellingPrice: labelTarget.sellingPrice,
          colorName: labelTarget.colorName,
          sizeName: labelTarget.sizeName,
          categoryName: labelTarget.categoryName,
        },
        {name: settings?.shopName ?? ''},
      );
      const html = renderLabelSheetHtml([label], {copies: labelCopies});
      const {uri} = await Print.printToFileAsync({html, base64: false});
      await Share.share({
        url: uri,
        message: `Label — ${labelTarget.name} (${labelTarget.sku})`,
      });
      setLabelOpen(false);
    } catch {
      errorFeedback();
    } finally {
      setLabelBusy(false);
    }
  }

  const query = search.trim().toLowerCase();
  const filtered = query
    ? (data ?? []).filter(
        p =>
          p.name.toLowerCase().includes(query) ||
          p.sku.toLowerCase().includes(query) ||
          (p.barcode ?? '').toLowerCase().includes(query) ||
          (p.colorName ?? '').toLowerCase().includes(query) ||
          (p.sizeName ?? '').toLowerCase().includes(query),
      )
    : data;

  const missingBarcodes = (data ?? []).some(p => !p.barcode);

  return (
    <Screen>
      <Header title="Products & Stock" subtitle="Search, add, edit & adjust stock" />
      <View style={styles.searchWrap}>
        <Search size={16} color={colors.muted} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search by name, SKU, barcode, color…"
          placeholderTextColor={colors.inputPlaceholder}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
        {search ? (
          <Pressable
            onPress={() => setSearch('')}
            style={styles.searchClear}
            accessibilityRole="button"
            accessibilityLabel="Clear search">
            <X size={16} color={colors.muted} />
          </Pressable>
        ) : null}
        <Pressable
          onPress={openScan}
          style={styles.scanButton}
          accessibilityRole="button"
          accessibilityLabel="Scan barcode">
          <ScanLine size={18} color={colors.primary} />
        </Pressable>
      </View>
      {missingBarcodes ? (
        <View style={{marginHorizontal: 16, marginBottom: 10}}>
          <Button
            title={backfilling ? 'Generating…' : 'Generate missing barcodes'}
            variant="outline"
            onPress={handleBackfill}
            disabled={backfilling}
          />
        </View>
      ) : null}
      {error ? (
        <ErrorBox message={error} onRetry={reload} />
      ) : loading || !data ? (
        <Loading />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          style={{flex: 1}}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            query ? (
              <Empty text="No products match your search" />
            ) : (
              <Empty text="No products yet" />
            )
          }
          contentContainerStyle={{paddingBottom: 90}}
          renderItem={({item, index}) => (
            <Card index={index}>
              <View style={styles.row}>
                {item.imageUrl ? (
                  <Image source={{uri: item.imageUrl}} style={styles.thumb} />
                ) : null}
                <View style={{flex: 1}}>
                  <Text style={styles.name}>{item.name}</Text>
                  <Text style={styles.meta}>
                    {item.sku}
                    {item.colorName || item.sizeName || item.categoryName
                      ? ` · ${[item.colorName, item.sizeName, item.categoryName].filter(Boolean).join(' / ')}`
                      : ''}
                    {item.weight != null ? ` · ${formatWeight(item.weight)}` : ''}
                  </Text>
                  <Text style={styles.meta}>
                    Buy {money(item.purchasePrice)} · Sell {money(item.sellingPrice)}
                  </Text>
                  {item.barcode ? <BarcodeChip value={item.barcode} /> : null}
                </View>
                <View style={{alignItems: 'flex-end', gap: 6}}>
                  <Badge
                    text={item.stock <= 0 ? 'Out of stock' : item.stock <= item.lowStockThreshold ? 'Low stock' : 'In stock'}
                    tone={toneFor(item)}
                  />
                  <Text style={styles.stock}>{item.stock} in stock</Text>
                  <View style={styles.cardActions}>
                    <Button title="Label" variant="outline" onPress={() => { setLabelTarget(item); setLabelCopies(1); setLabelOpen(true); }} />
                    <Button title="Edit" variant="outline" onPress={() => openEdit(item)} />
                    <Button title="Adjust" variant="outline" onPress={() => { setAdjusting(item); setAdjustQty(''); setAdjustReason(''); }} />
                    <Button title="Delete" variant="danger" onPress={() => handleDelete(item)} />
                  </View>
                </View>
              </View>
            </Card>
          )}
        />
      )}

      <Animated.View entering={FadeInUp.duration(320)} style={styles.fab}>
        <Button title="+ Add product" onPress={openAdd} />
      </Animated.View>

      <ModalSheet
        visible={formOpen}
        title={editing ? `Edit product — ${editing.name}` : 'Add product'}
        onClose={() => setFormOpen(false)}>
        <Field label="Name" value={name} onChangeText={setName} placeholder="e.g. Gold Necklace Set" />
        <Pressable style={styles.imagePicker} onPress={handlePickImage} disabled={uploading}>
          {imageUrl ? (
            <Image source={{uri: imageUrl}} style={styles.imagePickerThumb} />
          ) : (
            <Text style={styles.imagePickerText}>{uploading ? 'Uploading…' : '+ Add product image'}</Text>
          )}
        </Pressable>
        <Field label="Color" value={color} onChangeText={setColor} placeholder="Gold (optional)" />
        <Field label="Size" value={size} onChangeText={setSize} placeholder="Standard" />
        <Field label="Category" value={category} onChangeText={setCategory} placeholder="e.g. Jewellery (optional)" />
        <Field label="Weight (mg)" value={weight} onChangeText={setWeight} keyboardType="numeric" placeholder="e.g. 24500 (24.5 g)" />
        <Field label="Stock" value={stock} onChangeText={setStock} keyboardType="numeric" />
        <Field label="Buy price" value={buy} onChangeText={setBuy} keyboardType="numeric" />
        <Field label="Sell price" value={sell} onChangeText={setSell} keyboardType="numeric" />
        <Button
          title={saving ? 'Saving…' : editing ? 'Save changes' : 'Save product'}
          onPress={handleSave}
          loading={saving}
        />
      </ModalSheet>

      <ModalSheet
        visible={adjusting !== null}
        title={`Adjust stock — ${adjusting?.name ?? ''}`}
        onClose={() => setAdjusting(null)}>
        <Field
          label="Quantity (+/−)"
          value={adjustQty}
          onChangeText={setAdjustQty}
          keyboardType="numeric"
          placeholder="e.g. 10 or -2"
        />
        <Field
          label="Reason (optional)"
          value={adjustReason}
          onChangeText={setAdjustReason}
          multiline
          placeholder="e.g. Restocked, damaged, returned…"
        />
        <Button title="Adjust" onPress={handleAdjust} />
      </ModalSheet>

      <ModalSheet
        visible={labelOpen}
        title={`Print label — ${labelTarget?.name ?? ''}`}
        onClose={() => setLabelOpen(false)}>
        {labelTarget?.barcode ? <BarcodeChip value={labelTarget.barcode} /> : null}
        <Text style={styles.meta}>
          {labelTarget?.sku}
          {[labelTarget?.colorName, labelTarget?.sizeName, labelTarget?.categoryName].filter(Boolean).length
            ? ` · ${[labelTarget?.colorName, labelTarget?.sizeName, labelTarget?.categoryName].filter(Boolean).join(' / ')}`
            : ''}
          {labelTarget?.weight != null ? ` · ${formatWeight(labelTarget.weight)}` : ''}
          {labelTarget ? ` · ₹${Number(labelTarget.sellingPrice).toFixed(2)}` : ''}
        </Text>
        <Field
          label="Number of copies"
          value={String(labelCopies)}
          onChangeText={text => {
            const n = Math.max(1, Math.min(100, Number(text) || 1));
            setLabelCopies(n);
          }}
          keyboardType="numeric"
        />
        <Button
          title={labelBusy ? 'Preparing PDF…' : 'Share label PDF'}
          onPress={handleLabelShare}
          loading={labelBusy}
          disabled={!labelTarget}
        />
      </ModalSheet>

      {/* Camera scanner — Scan → Detect → Find → Open */}
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
                <Button title="Cancel" variant="outline" onPress={() => setScanOpen(false)} style={{marginTop: 24}} />
              </View>
            </CameraView>
          ) : (
            <View style={styles.scanPerm}>
              <Barcode size={40} color={colors.muted} />
              <Text style={styles.scanTitle}>Camera permission needed to scan barcodes</Text>
              <Button title="Allow camera" onPress={() => void requestPermission()} style={{marginTop: 12}} />
              <Button title="Cancel" variant="outline" onPress={() => setScanOpen(false)} style={{marginTop: 8}} />
            </View>
          )}
        </View>
      </Modal>
    </Screen>
  );
}

const makeStyles = () =>
  StyleSheet.create({
    row: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10},
    thumb: {width: 44, height: 44, borderRadius: 10, borderWidth: 1, borderColor: colors.border},
    name: {fontSize: 15, fontWeight: '600', color: colors.text},
    meta: {fontSize: 12, color: colors.muted, marginTop: 2},
    stock: {fontSize: 14, fontWeight: '700', color: colors.text},
    fab: {position: 'absolute', bottom: 24, left: 16, right: 16},
    searchWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: 16,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      backgroundColor: colors.card,
      paddingHorizontal: 12,
      height: 40,
    },
    searchIcon: {marginRight: 8},
    searchInput: {flex: 1, fontSize: 14, color: colors.text, paddingVertical: 0},
    searchClear: {padding: 4},
    scanButton: {padding: 4, marginLeft: 6},
    cardActions: {flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-end'},
    imagePicker: {
      height: 96,
      borderRadius: 12,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
      overflow: 'hidden',
    },
    imagePickerThumb: {width: '100%', height: '100%'},
    imagePickerText: {fontSize: 13, color: colors.muted, fontWeight: '600'},
    scanRoot: {flex: 1, backgroundColor: '#000'},
    scanOverlay: {flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24},
    scanFrame: {
      width: 260,
      height: 160,
      borderWidth: 3,
      borderColor: colors.primary,
      borderRadius: 16,
      marginBottom: 20,
    },
    scanTitle: {fontSize: 15, fontWeight: '600', color: '#fff', textAlign: 'center'},
    scanMsg: {fontSize: 13, color: '#fca5a5', marginTop: 10, textAlign: 'center'},
    scanPerm: {flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32},
  });
