import React, {useState} from 'react';
import {FlatList, Image, Pressable, StyleSheet, Text, View} from 'react-native';
import Animated, {FadeInUp} from 'react-native-reanimated';
import * as ImagePicker from 'expo-image-picker';
import {
  listAllProducts,
  createProduct,
  adjustStock,
  deleteProduct,
  uploadImageToCloudinary,
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

export function ProductsScreen() {
  const styles = useThemeStyles(makeStyles);
  const {data, error, loading, reload} = useAsync(async () => listAllProducts(await getCore()), []);

  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState('');
  const [size, setSize] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [stock, setStock] = useState('0');
  const [buy, setBuy] = useState('0');
  const [sell, setSell] = useState('0');
  const [saving, setSaving] = useState(false);

  async function handlePickImage() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
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

  async function handleAdd() {
    if (!name.trim()) {
      return;
    }
    setSaving(true);
    try {
      await createProduct(await getCore(), {
        name: name.trim(),
        color: color.trim() || 'Standard',
        size: size.trim() || 'Standard',
        imageUrl: imageUrl.trim() || undefined,
        stock: Math.max(0, Number(stock) || 0),
        purchasePrice: Math.max(0, Number(buy) || 0),
        sellingPrice: Math.max(0, Number(sell) || 0),
      });
      successFeedback();
      setAddOpen(false);
      setName('');
      setColor('');
      setSize('');
      setImageUrl('');
      setStock('0');
      setBuy('0');
      setSell('0');
      reload();
    } catch {
      errorFeedback();
      // surfaced by the caller UI in a future iteration; keep the modal open
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
      await adjustStock(await getCore(), adjusting.id, {adjustment: qty});
      successFeedback();
      setAdjusting(null);
      setAdjustQty('');
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

  return (
    <Screen>
      <Header title="Products & Stock" subtitle="Tap + to add, tap a product to adjust stock" />
      {error ? (
        <ErrorBox message={error} onRetry={reload} />
      ) : loading || !data ? (
        <Loading />
      ) : (
        <FlatList
          data={data}
          keyExtractor={item => item.id}
          ListEmptyComponent={<Empty text="No products yet" />}
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
                    {item.colorName || item.sizeName
                      ? ` · ${[item.colorName, item.sizeName].filter(Boolean).join(' / ')}`
                      : ''}
                  </Text>
                  <Text style={styles.meta}>
                    Buy {money(item.purchasePrice)} · Sell {money(item.sellingPrice)}
                  </Text>
                </View>
                <View style={{alignItems: 'flex-end', gap: 6}}>
                  <Badge
                    text={item.stock <= 0 ? 'Out of stock' : item.stock <= item.lowStockThreshold ? 'Low stock' : 'In stock'}
                    tone={toneFor(item)}
                  />
                  <Text style={styles.stock}>{item.stock} in stock</Text>
                  <View style={{flexDirection: 'row', gap: 8}}>
                    <Button
                      title="Adjust"
                      variant="outline"
                      onPress={() => {
                        setAdjusting(item);
                        setAdjustQty('');
                      }}
                    />
                    <Button title="Delete" variant="danger" onPress={() => handleDelete(item)} />
                  </View>
                </View>
              </View>
            </Card>
          )}
        />
      )}

      <Animated.View entering={FadeInUp.duration(320)} style={styles.fab}>
        <Button title="+ Add product" onPress={() => setAddOpen(true)} />
      </Animated.View>

      <ModalSheet visible={addOpen} title="Add product" onClose={() => setAddOpen(false)}>
        <Field label="Name" value={name} onChangeText={setName} placeholder="e.g. Gold Necklace Set" />
        <Pressable style={styles.imagePicker} onPress={handlePickImage} disabled={uploading}>
          {imageUrl ? (
            <Image source={{uri: imageUrl}} style={styles.imagePickerThumb} />
          ) : (
            <Text style={styles.imagePickerText}>{uploading ? 'Uploading…' : '+ Add product image'}</Text>
          )}
        </Pressable>
        <Field label="Color" value={color} onChangeText={setColor} placeholder="Gold" />
        <Field label="Size" value={size} onChangeText={setSize} placeholder="Standard" />
        <Field label="Stock" value={stock} onChangeText={setStock} keyboardType="numeric" />
        <Field label="Buy price" value={buy} onChangeText={setBuy} keyboardType="numeric" />
        <Field label="Sell price" value={sell} onChangeText={setSell} keyboardType="numeric" />
        <Button title={saving ? 'Saving…' : 'Save product'} onPress={handleAdd} loading={saving} />
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
        <Button title="Adjust" onPress={handleAdjust} />
      </ModalSheet>
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
  });
