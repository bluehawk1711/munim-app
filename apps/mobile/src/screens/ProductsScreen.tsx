import React, {useState} from 'react';
import {FlatList, StyleSheet, Text, View} from 'react-native';
import {listAllProducts, createProduct, adjustStock, deleteProduct, type ProductWithMeta} from '@munim/core';
import {getCore} from '../lib/core';
import {useAsync} from '../lib/use-async';
import {money} from '../lib/format';
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
  const {data, error, loading, reload} = useAsync(async () => listAllProducts(await getCore()), []);

  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState('');
  const [size, setSize] = useState('');
  const [stock, setStock] = useState('0');
  const [buy, setBuy] = useState('0');
  const [sell, setSell] = useState('0');
  const [saving, setSaving] = useState(false);

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
        stock: Math.max(0, Number(stock) || 0),
        purchasePrice: Math.max(0, Number(buy) || 0),
        sellingPrice: Math.max(0, Number(sell) || 0),
      });
      setAddOpen(false);
      setName('');
      setColor('');
      setSize('');
      setStock('0');
      setBuy('0');
      setSell('0');
      reload();
    } catch (err) {
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
      setAdjusting(null);
      setAdjustQty('');
      reload();
    } catch (err) {
      // keep modal open on failure
    }
  }

  async function handleDelete(p: ProductWithMeta) {
    try {
      await deleteProduct(await getCore(), p.id);
      reload();
    } catch (err) {
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
          renderItem={({item}) => (
            <Card>
              <View style={styles.row}>
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

      <View style={styles.fab}>
        <Button title="+ Add product" onPress={() => setAddOpen(true)} />
      </View>

      <ModalSheet visible={addOpen} title="Add product" onClose={() => setAddOpen(false)}>
        <Field label="Name" value={name} onChangeText={setName} placeholder="e.g. Gold Necklace Set" />
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

const styles = StyleSheet.create({
  row: {flexDirection: 'row', justifyContent: 'space-between'},
  name: {fontSize: 15, fontWeight: '600', color: colors.text},
  meta: {fontSize: 12, color: colors.muted, marginTop: 2},
  stock: {fontSize: 14, fontWeight: '700', color: colors.text},
  fab: {position: 'absolute', bottom: 24, left: 16, right: 16},
});
