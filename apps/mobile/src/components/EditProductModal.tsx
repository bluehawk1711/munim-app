/**
 * EditProductModal — reusable product create/edit form modal.
 * Manages its own state; just pass `product` (null = add) and callbacks.
 */

import React, {useEffect, useMemo, useState} from 'react';
import {Image, Pressable, StyleSheet, Text, View} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import {type ProductDto, karatPurityPercent, priceWithTable, resolveGoldRateTable, toGoldKarat, type LabourType, type PriceBreakdown} from '@munim/core';
import {
  useCatalog,
  useCreateProduct,
  useGoldRates,
  useQueryState,
  useSettings,
  useUpdateProduct,
  useUploadImage,
} from '@munim/query';
import {successFeedback, errorFeedback} from '../lib/haptics';
import {uploadImageDirect} from '../lib/cloudinary';
import {rs, spacing, radii, typography} from '../lib/responsive';
import {useThemeStyles} from '../theme';
import {Button, Field, LabourField, ModalSheet, SelectField, colors} from './ui';

const KARAT_OPTIONS = Array.from({length: 25}, (_, karat) => ({
  label: `${karat}K · ${karatPurityPercent(karat)}% pure`,
  value: String(karat),
}));

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

  // Theme-aware: never StyleSheet.create from the `colors` proxy at module
  // scope (theme.tsx) — the factory re-runs when the theme changes.
  const styles = useThemeStyles(c =>
    StyleSheet.create({
      imagePicker: {
        height: rs(120),
        borderRadius: radii.lg,
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: c.border,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing.md,
        overflow: 'hidden',
      },
      imagePickerThumb: {width: '100%', height: '100%'},
      imagePickerText: {fontSize: typography.secondary, color: c.muted, fontWeight: '600'},
      goldBox: {
        borderWidth: 1,
        borderColor: c.border,
        borderRadius: radii.lg,
        backgroundColor: c.mutedSoft,
        padding: spacing.md,
        gap: spacing.sm,
      },
      goldTitle: {fontSize: typography.secondary, fontWeight: '700', color: c.text},
      goldPreview: {fontSize: 12, color: c.muted, lineHeight: 17},
    }),
  );

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
  const [silverPercentage, setSilverPercentage] = useState('100');
  const [goldKarat, setGoldKarat] = useState('0');
  const [labourType, setLabourType] = useState<LabourType>('PERCENT');
  const [labourValue, setLabourValue] = useState('');
  const [priceMode, setPriceMode] = useState<'auto' | 'manual'>('auto');

  // Catalog pickers
  const [typePickerOpen, setTypePickerOpen] = useState(false);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [sizePickerOpen, setSizePickerOpen] = useState(false);
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
  const [karatPickerOpen, setKaratPickerOpen] = useState(false);
  const [goldModePickerOpen, setGoldModePickerOpen] = useState(false);

  // ── Dynamic metal pricing: rate table + shop-wide settings ──
  const goldRates = useQueryState(useGoldRates());
  const settings = useQueryState(useSettings());
  const shopDefaultLabourType = settings.data?.defaultLabourType ?? 'PERCENT';
  const shopDefaultLabourValue = settings.data?.defaultLabourValue ?? 0;
  const silverRatePerGram = settings.data?.silverRatePerGram ?? 0;
  const defaultLabour = useMemo(
    () => (shopDefaultLabourValue > 0 ? {type: shopDefaultLabourType, value: shopDefaultLabourValue} : null),
    [shopDefaultLabourType, shopDefaultLabourValue],
  );
  const karatTable = useMemo(
    () => resolveGoldRateTable(goldRates.data?.rates ?? []),
    [goldRates.data],
  );
  const selectedKarat = toGoldKarat(Number(goldKarat) || 0);
  /** Same math the API/DB computes on read — live preview of the auto price. */
  const metalPreview = useMemo<PriceBreakdown | null>(() => {
    if (type !== 'Gold' && type !== 'Silver') return null;
    return priceWithTable(
      {
        type,
        priceMode,
        weight: weight.trim() ? Number(weight) || 0 : null,
        weightUnit,
        goldKarat: selectedKarat,
        silverPercentage: Number(silverPercentage) || 100,
        labourType,
        labourValue: labourValue.trim() === '' ? null : Number(labourValue) || 0,
        sellingPrice: Number(sell) || 0,
      },
      karatTable,
      silverRatePerGram,
      defaultLabour,
    );
  }, [type, priceMode, weight, weightUnit, selectedKarat, silverPercentage, labourType, labourValue, sell, karatTable, silverRatePerGram, defaultLabour]);

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
      setSilverPercentage(String(product.silverPercentage ?? 100));
      setGoldKarat(String(product.goldKarat ?? 0));
      setLabourType(product.labourType);
      setLabourValue(product.labourValue != null ? String(product.labourValue) : '');
      setPriceMode(product.priceMode);
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
      setSilverPercentage('100');
      setGoldKarat('0');
      setLabourType('PERCENT');
      setLabourValue('');
      setPriceMode('auto');
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
        purchasePrice: Number(buy) || 0,
        sellingPrice: Number(sell) || 0,
        silverPercentage: Number(silverPercentage) || 100,
        goldKarat: goldKarat === '' ? null : Number(goldKarat) || 0,
        labourType,
        labourValue: labourValue.trim() === '' ? null : Math.max(0, Number(labourValue) || 0),
        priceMode,
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
        {type === 'Silver' && catalogCategories.length > 0 && (
          <View style={{marginBottom: spacing.sm}}>
            <Text style={{fontSize: 12, color: colors.muted, marginBottom: 5}}>Silver sub-category</Text>
            <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs}}>
              {catalogCategories.map(c => {
                const active = category === c.value;
                return (
                  <Pressable
                    key={c.value}
                    onPress={() => setCategory(active ? '' : c.value)}
                    style={{paddingVertical: 6, paddingHorizontal: spacing.sm, borderRadius: radii.full, borderWidth: 1, borderColor: active ? colors.primary : colors.border, backgroundColor: active ? colors.primary : colors.card}}>
                    <Text style={{fontSize: 12, fontWeight: active ? '700' : '500', color: active ? colors.inverseOnSurface : colors.text}}>{c.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}
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
        {(type === 'Gold' || type === 'Silver') && (
          <View style={styles.goldBox}>
            <Text style={styles.goldTitle}>{type} pricing</Text>
            {type === 'Gold' && (
              <SelectField
                label="Karat"
                value={goldKarat === '0' ? 'No karat — manual' : `${goldKarat}K`}
                placeholder="Select karat"
                onPress={() => setKaratPickerOpen(true)}
              />
            )}
            {type === 'Silver' && (
              <Field label="Silver %" value={silverPercentage} onChangeText={setSilverPercentage} keyboardType="numeric" placeholder="e.g. 90" />
            )}
            <SelectField
              label="Pricing"
              value={
                priceMode === 'auto'
                  ? type === 'Gold'
                    ? 'Auto — weight × karat rate'
                    : 'Auto — weight × silver rate'
                  : 'Manual price'
              }
              placeholder="Select pricing"
              onPress={() => setGoldModePickerOpen(true)}
            />
            <LabourField
              label="Labour"
              type={labourType}
              value={labourValue}
              onTypeChange={setLabourType}
              onValueChange={setLabourValue}
              placeholder={type === 'Gold' && shopDefaultLabourValue > 0 ? `shop default ${shopDefaultLabourValue}` : '0'}
              hint={
                type === 'Gold'
                  ? 'Leave empty to use the shop default labour.'
                  : 'Silver labour is per product — empty means none.'
              }
            />
            {metalPreview ? (
              <Text style={styles.goldPreview}>
                {metalPreview.source === 'auto'
                  ? `Auto price now: ₹${metalPreview.price.toFixed(2)} (${metalPreview.weightGm.toFixed(3)}g × ₹${metalPreview.ratePerGram.toFixed(2)}/g${metalPreview.labour.amount > 0 ? ` + labour ₹${metalPreview.labour.amount.toFixed(2)}` : ''})`
                  : `Stored price used (${metalPreview.fallback}) — set a ${type === 'Gold' ? 'karat' : 'shop silver rate'} and weight to auto-price.`}
              </Text>
            ) : (
              <Text style={styles.goldPreview}>
                {type === 'Gold' ? 'Pick a karat to enable auto pricing by weight.' : 'Enter weight to enable auto pricing.'}
              </Text>
            )}
            {type === 'Silver' && (
              <Text style={styles.goldPreview}>
                Shop silver rate: ₹{silverRatePerGram.toFixed(2)}/g{silverRatePerGram > 0 ? '' : ' (not set — set it in Settings)'}
              </Text>
            )}
          </View>
        )}
        <Field label="Stock" value={stock} onChangeText={setStock} keyboardType="numeric" />
        <Field label="Buy price" value={buy} onChangeText={setBuy} keyboardType="numeric" />
        <Field
          label={priceMode === 'auto' && (type === 'Gold' || type === 'Silver') ? 'Sell price — calculated' : 'Sell price'}
          value={
            priceMode === 'auto' && metalPreview?.source === 'auto' ? String(metalPreview.price) : sell
          }
          onChangeText={setSell}
          keyboardType="numeric"
          editable={!(priceMode === 'auto' && (type === 'Gold' || type === 'Silver'))}
        />
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

      <ModalSheet visible={karatPickerOpen} title="Select karat" onClose={() => setKaratPickerOpen(false)} centered scrollable>
        <Pressable
          onPress={() => { setGoldKarat('0'); setPriceMode('manual'); setKaratPickerOpen(false); }}
          style={({pressed}) => [{paddingVertical: spacing.md, paddingHorizontal: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border}, pressed && {backgroundColor: colors.mutedSoft}]}>
          <Text style={{fontSize: typography.body, color: goldKarat === '0' ? colors.primary : colors.text, fontWeight: goldKarat === '0' ? '700' : '400'}}>
            No karat — manual pricing
          </Text>
        </Pressable>
        {KARAT_OPTIONS.slice(1).map(k => (
          <Pressable
            key={k.value}
            onPress={() => { setGoldKarat(k.value); setKaratPickerOpen(false); }}
            style={({pressed}) => [{paddingVertical: spacing.md, paddingHorizontal: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border}, pressed && {backgroundColor: colors.mutedSoft}]}>
            <Text style={{fontSize: typography.body, color: k.value === goldKarat ? colors.primary : colors.text, fontWeight: k.value === goldKarat ? '700' : '400'}}>
              {k.label}
            </Text>
          </Pressable>
        ))}
      </ModalSheet>

      <ModalSheet visible={goldModePickerOpen} title="Select pricing" onClose={() => setGoldModePickerOpen(false)} centered>
        <Pressable
          onPress={() => { setPriceMode('manual'); setGoldModePickerOpen(false); }}
          style={({pressed}) => [{paddingVertical: spacing.md, paddingHorizontal: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border}, pressed && {backgroundColor: colors.mutedSoft}]}>
          <Text style={{fontSize: typography.body, color: priceMode === 'manual' ? colors.primary : colors.text, fontWeight: priceMode === 'manual' ? '700' : '400'}}>
            Manual price
          </Text>
          <Text style={{fontSize: 12, color: colors.muted, marginTop: 2}}>
            The stored sell price is used as-is.
          </Text>
        </Pressable>
        <Pressable
          disabled={type === 'Gold' && selectedKarat === null}
          onPress={() => { setPriceMode('auto'); setGoldModePickerOpen(false); }}
          style={({pressed}) => [{paddingVertical: spacing.md, paddingHorizontal: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border}, type === 'Gold' && selectedKarat === null && {opacity: 0.4}, pressed && {backgroundColor: colors.mutedSoft}]}>
          <Text style={{fontSize: typography.body, color: priceMode === 'auto' ? colors.primary : colors.text, fontWeight: priceMode === 'auto' ? '700' : '400'}}>
            {type === 'Silver' ? 'Auto — weight × silver rate' : 'Auto — weight × karat rate'}
          </Text>
          <Text style={{fontSize: 12, color: colors.muted, marginTop: 2}}>
            {type === 'Gold' && selectedKarat === null
              ? 'Pick a karat first to enable'
              : type === 'Silver'
                ? 'Prices = weight × purity × shop silver rate + labour'
                : `Prices = weight × ${goldKarat}K rate + labour`}
          </Text>
        </Pressable>
      </ModalSheet>
    </>
  );
}

