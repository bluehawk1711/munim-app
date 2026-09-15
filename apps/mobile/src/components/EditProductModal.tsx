/**
 * EditProductModal — reusable product create/edit form modal.
 * Manages its own state; just pass `product` (null = add) and callbacks.
 */

import React, {useEffect, useMemo, useState} from 'react';
import {Image, Pressable, StyleSheet, Text, View} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import {type ProductDto} from '@munim/core';
import {
  useCatalog,
  useCreateProduct,
  useQueryState,
  useUpdateProduct,
  useUploadImage,
} from '@munim/query';
import {successFeedback, errorFeedback} from '../lib/haptics';
import {uploadImageDirect} from '../lib/cloudinary';
import {rs, spacing, radii, typography} from '../lib/responsive';
import {Button, Field, ModalSheet, SelectField, colors} from './ui';

type EditProductModalProps = {
  visible: boolean;
  onClose: () => void;
  onSaved?: () => void;
  /** null = add new product; non-null = edit existing */
  product: ProductDto | null;
};

export function EditProductModal({visible, onClose, onSaved, product}: EditProductModalProps) {
  const isEdit = !!product;
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const uploadImage = useUploadImage();

  const {data: colorsCatalog} = useQueryState(useCatalog('color'));
  const {data: sizesCatalog} = useQueryState(useCatalog('size'));
  const {data: categoriesCatalog} = useQueryState(useCatalog('category'));

  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Form fields
  const [name, setName] = useState('');
  const [type, setType] = useState('Gold');
  const [color, setColor] = useState('');
  const [size, setSize] = useState('');
  const [category, setCategory] = useState('');
  const [weight, setWeight] = useState('');
  const [weightUnit, setWeightUnit] = useState<'mg' | 'gm'>('gm');
  const [grossWeight, setGrossWeight] = useState('');
  const [nagLessWeight, setNagLessWeight] = useState('');
  const [nagRate, setNagRate] = useState('');
  const [chejatWeight, setChejatWeight] = useState('');
  const [netWeight, setNetWeight] = useState('');
  const [purity, setPurity] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [stock, setStock] = useState('0');
  const [buy, setBuy] = useState('0');
  const [sell, setSell] = useState('0');

  // Catalog pickers
  const [typePickerOpen, setTypePickerOpen] = useState(false);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [sizePickerOpen, setSizePickerOpen] = useState(false);
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);

  const catalogColors = useMemo(() => (colorsCatalog ?? []).map((c: {name: string}) => ({label: c.name, value: c.name})), [colorsCatalog]);
  const catalogSizes = useMemo(() => (sizesCatalog ?? []).map((s: {name: string}) => ({label: s.name, value: s.name})), [sizesCatalog]);
  const catalogCategories = useMemo(() => (categoriesCatalog ?? []).map((c: {name: string}) => ({label: c.name, value: c.name})), [categoriesCatalog]);

  // Populate form when product changes
  useEffect(() => {
    if (!visible) return;
    if (product) {
      setName(product.name);
      setType(product.type ?? 'Gold');
      setColor(product.color);
      setSize(product.size);
      setCategory(product.category ?? '');
      setWeight(product.weight != null ? String(product.weight) : '');
      setWeightUnit(product.weightUnit === 'mg' ? 'mg' : 'gm');
      setGrossWeight(product.grossWeight ?? '');
      setNagLessWeight(product.nagLessWeight ?? '');
      setNagRate(product.nagRate ?? '');
      setChejatWeight(product.chejatWeight ?? '');
      setNetWeight(product.netWeight ?? '');
      setPurity(product.purity ?? '');
      setImageUrl(product.imageUrl ?? '');
      setStock(String(product.stock));
      setBuy(String(product.purchasePrice));
      setSell(String(product.sellingPrice));
    } else {
      setName('');
      setType('Gold');
      setColor('');
      setSize('');
      setCategory('');
      setWeight('');
      setWeightUnit('gm');
      setGrossWeight('');
      setNagLessWeight('');
      setNagRate('');
      setChejatWeight('');
      setNetWeight('');
      setPurity('');
      setImageUrl('');
      setStock('0');
      setBuy('0');
      setSell('0');
    }
  }, [visible, product]);

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

  async function handleSave() {
    if (!name.trim()) return;
    const buyVal = Number(buy) || 0;
    const sellVal = Number(sell) || 0;
    if (buyVal <= 0) { errorFeedback('Buy price must be greater than 0'); return; }
    if (sellVal <= 0) { errorFeedback('Sell price must be greater than 0'); return; }
    setSaving(true);
    try {
      const input = {
        name: name.trim(),
        type: type as 'Gold' | 'Silver' | 'Diamond' | 'Platinum' | 'Other',
        color: color.trim() || undefined,
        size: size.trim() || 'Standard',
        category: category.trim() || undefined,
        weight: weight.trim() ? Math.max(0, Number(weight) || 0) : undefined,
        weightUnit,
        grossWeight: grossWeight.trim() || undefined,
        nagLessWeight: nagLessWeight.trim() || undefined,
        nagRate: nagRate.trim() || undefined,
        chejatWeight: chejatWeight.trim() || undefined,
        netWeight: netWeight.trim() || undefined,
        purity: purity.trim() || undefined,
        imageUrl: imageUrl.trim() || undefined,
        stock: Math.max(0, Number(stock) || 0),
        purchasePrice: buyVal,
        sellingPrice: sellVal,
      };
      if (isEdit) {
        await updateProduct.mutateAsync({id: product.id, values: input});
        successFeedback(`${name} updated`);
      } else {
        await createProduct.mutateAsync(input);
        successFeedback(`${name} created`);
      }
      onClose();
      onSaved?.();
    } catch {
      errorFeedback('Failed to save product');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <ModalSheet visible={visible} size="xl" title={isEdit ? `Edit — ${product.name}` : 'Add product'} onClose={onClose} dismissable={!saving && !uploading} centered scrollable>
        <Field label="Name" value={name} onChangeText={setName} placeholder="e.g. Gold Necklace Set" />
        <SelectField label="Type" value={type} placeholder="Select type" onPress={() => setTypePickerOpen(true)} />
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
        {type !== 'Silver' && (
          <>
            <Field label="Gross weight" value={grossWeight} onChangeText={setGrossWeight} placeholder="e.g. 10+5 or 24.5" />
            <Field label="Nag less weight" value={nagLessWeight} onChangeText={setNagLessWeight} placeholder="e.g. 2.5" />
            <Field label="Nag rate" value={nagRate} onChangeText={setNagRate} placeholder="e.g. 5" />
            <Field label="Chejat weight" value={chejatWeight} onChangeText={setChejatWeight} placeholder="e.g. 3" />
            <Field label="Net weight" value={netWeight} onChangeText={setNetWeight} placeholder="e.g. 19" />
          </>
        )}
        <Field label="Purity" value={purity} onChangeText={setPurity} placeholder="e.g. 24K / 22K / 916 / 925" maxLength={20} />
        <Field label="Stock" value={stock} onChangeText={setStock} keyboardType="numeric" />
        <Field label="Buy price" value={buy} onChangeText={setBuy} keyboardType="numeric" />
        <Field label="Sell price" value={sell} onChangeText={setSell} keyboardType="numeric" />
        <Button title={saving ? 'Saving…' : isEdit ? 'Save changes' : 'Save product'} onPress={handleSave} loading={saving} />
      </ModalSheet>

      {/* Catalog pickers */}
      <ModalSheet visible={typePickerOpen} title="Select type" onClose={() => setTypePickerOpen(false)} centered scrollable>
        {['Gold', 'Silver', 'Diamond', 'Platinum', 'Other'].map(t => (
          <Pressable key={t} onPress={() => { setType(t); setTypePickerOpen(false); }} style={({pressed}) => [{paddingVertical: spacing.md, paddingHorizontal: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border}, pressed && {backgroundColor: colors.mutedSoft}]}>
            <Text style={{fontSize: typography.body, color: t === type ? colors.primary : colors.text, fontWeight: t === type ? '700' : '400'}}>{t}</Text>
          </Pressable>
        ))}
      </ModalSheet>

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
    </>
  );
}

const styles = StyleSheet.create({
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
