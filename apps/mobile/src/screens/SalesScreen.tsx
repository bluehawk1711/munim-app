import React, {useEffect, useMemo, useState} from 'react';
import {FlatList, StyleSheet, Text, View} from 'react-native';
import {createSale, listInvoices, listAllProducts, formatDate} from '@munim/core';
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
  Row,
  Screen,
  Section,
  colors,
} from '../components/ui';

export function SalesScreen() {
  const {data: products, reload: reloadProducts} = useAsync(async () => listAllProducts(await getCore()), []);
  const {data: recent, loading, reload: reloadRecent} = useAsync(
    async () => listInvoices(await getCore(), {pageSize: 20}),
    [],
  );

  const [pickerOpen, setPickerOpen] = useState(false);
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [price, setPrice] = useState('');
  const [customer, setCustomer] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (products && products.length > 0 && !productId) {
      setProductId(products[0]?.id ?? '');
      setPrice(String(products[0]?.sellingPrice ?? 0));
    }
  }, [products, productId]);

  const selected = useMemo(() => products?.find(p => p.id === productId) ?? null, [products, productId]);
  const total = (Number(quantity) || 0) * (Number(price) || 0);

  async function handleSell() {
    if (!selected) {
      return;
    }
    setSaving(true);
    try {
      const invoice = await createSale(await getCore(), {
        productId: selected.id,
        quantity: Number(quantity) || 0,
        sellingPrice: Number(price) || undefined,
        customerName: customer.trim() || undefined,
        paid: true,
        paymentMethod: 'cash',
      });
      if (invoice) {
        setQuantity('1');
        setCustomer('');
        reloadProducts();
        reloadRecent();
      }
    } catch {
      // keep form for retry
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen>
      <Header title="Sales" subtitle="Record a quick sale" />
      {!selected ? (
        <ErrorBox message="Add products in Products first, or set your database in Settings." />
      ) : (
        <Card index={0}>
          <Row label="Product" value={selected.name} onPress={() => setPickerOpen(true)} />
          <Field label="Quantity" value={quantity} onChangeText={setQuantity} keyboardType="numeric" />
          <Field label="Selling price" value={price} onChangeText={setPrice} keyboardType="numeric" />
          <Field label="Customer name" value={customer} onChangeText={setCustomer} />
          <Text style={styles.total}>Total: {money(total)}</Text>
          <Button title={saving ? 'Selling…' : 'Sell (cash)'} onPress={handleSell} loading={saving} />
        </Card>
      )}

      <Section title="Recent sales" />
      {loading || !recent ? (
        <Loading />
      ) : recent.invoices.length === 0 ? (
        <Empty text="No sales yet" />
      ) : (
        <FlatList
          data={recent.invoices}
          keyExtractor={item => item.id}
          contentContainerStyle={{paddingBottom: 90}}
          renderItem={({item, index}) => (
            <Card index={index}>
              <View style={styles.row}>
                <View style={{flex: 1}}>
                  <Text style={styles.name}>{item.invoiceNumber}</Text>
                  <Text style={styles.meta}>
                    {item.customerName ?? 'Walk-in'} · {formatDate(item.date)}
                  </Text>
                </View>
                <View style={{alignItems: 'flex-end', gap: 4}}>
                  <Text style={styles.name}>{money(item.total)}</Text>
                  <Badge
                    text={item.status}
                    tone={item.status === 'PAID' ? 'success' : item.status === 'PARTIAL' ? 'warning' : 'muted'}
                  />
                </View>
              </View>
            </Card>
          )}
        />
      )}

      <ModalSheet visible={pickerOpen} title="Choose product" onClose={() => setPickerOpen(false)}>
        {products?.map(p => (
          <Row
            key={p.id}
            label={`${p.name} (${p.stock} left)`}
            value={money(p.sellingPrice)}
            onPress={() => {
              setProductId(p.id);
              setPrice(String(p.sellingPrice));
              setPickerOpen(false);
            }}
          />
        ))}
      </ModalSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  name: {fontSize: 15, fontWeight: '600', color: colors.text},
  meta: {fontSize: 12, color: colors.muted, marginTop: 2},
  total: {fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 12},
});
