import React, {useMemo, useState} from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Print from 'expo-print';
import {ChevronDown, Search, Share2, Trash2} from 'lucide-react-native';
import {
  buildBillDocument,
  formatDate,
  mergeBillTemplateSettings,
  renderBillHtml,
  type InvoiceDto,
  type OrderDto,
  type OrderFilters,
  type OrderFormValues,
  type OrderItemValues,
  type PartyDto,
  type ProductDto,
} from '@munim/core';
import {
  useApiClient,
  useCreateOrder,
  useDeleteOrder,
  useGenerateOrderBill,
  useGoldRates,
  useOrders,
  useParties,
  useProducts,
  useQueryState,
  useSettings,
  useUpdateOrder,
} from '@munim/query';
import {money} from '../lib/format';
import {successFeedback, errorFeedback, selectionTick} from '../lib/haptics';
import {
  Badge,
  Button,
  Card,
  Empty,
  Field,
  Loading,
  ModalSheet,
  Screen,
  StatBox,
  colors,
} from '../components/ui';
import {HomeHeader, headerScrollHandlers} from '../components/home-header';
import {useThemeStyles} from '../theme';
import {savePdf} from '../lib/save-pdf';

type OrderStatusFilter = 'all' | 'OPEN' | 'COMPLETED' | 'CANCELLED';

const STATUS_CHIPS: {key: OrderStatusFilter; label: string}[] = [
  {key: 'all', label: 'All'},
  {key: 'OPEN', label: 'Open'},
  {key: 'COMPLETED', label: 'Billed'},
  {key: 'CANCELLED', label: 'Cancelled'},
];

const PAGE_SIZE = 15;

type FormLine = {
  key: string;
  productId: string;
  productName: string;
  sku: string;
  color: string;
  size: string;
  weight: string;
  weightUnit: 'gm' | 'mg';
  quantity: string;
  price: string;
};

type FormState = {
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  partyId: string;
  discount: string;
  delivery: string;
  notes: string;
  lines: FormLine[];
};

let keySeq = 0;
const nextKey = (): string => {
  keySeq += 1;
  return `l${keySeq}`;
};

const blankLine = (): FormLine => ({
  key: nextKey(),
  productId: '',
  productName: '',
  sku: '',
  color: '',
  size: '',
  weight: '',
  weightUnit: 'gm',
  quantity: '1',
  price: '0',
});

const blankForm = (): FormState => ({
  customerName: '',
  customerPhone: '',
  customerAddress: '',
  partyId: '',
  discount: '',
  delivery: '',
  notes: '',
  lines: [blankLine()],
});

const orderToForm = (o: OrderDto): FormState => ({
  customerName: o.customerName ?? '',
  customerPhone: o.customerPhone ?? '',
  customerAddress: o.customerAddress ?? '',
  partyId: o.partyId ?? '',
  discount: String(o.discount || 0),
  delivery: String(o.deliveryCharge || 0),
  notes: o.notes ?? '',
  lines: o.items.map(it => ({
    key: nextKey(),
    productId: it.productId ?? '',
    productName: it.productName,
    sku: it.sku ?? '',
    color: it.color ?? '',
    size: it.size ?? '',
    weight: it.weight != null ? String(it.weight) : '',
    weightUnit: it.weightUnit === 'mg' ? 'mg' : 'gm',
    quantity: String(it.quantity),
    price: String(it.price),
  })),
});

const toItems = (lines: FormLine[]): OrderItemValues[] =>
  lines
    .filter(l => l.productName.trim())
    .map(l => ({
      productId: l.productId || undefined,
      productName: l.productName.trim(),
      sku: l.sku || undefined,
      color: l.color || undefined,
      size: l.size || undefined,
      weight: l.weight ? Number(l.weight) : undefined,
      weightUnit: l.weightUnit,
      quantity: Number(l.quantity) || 1,
      price: Number(l.price) || 0,
    }));

const formTotals = (form: FormState) => {
  const subtotal = form.lines.reduce(
    (s, l) => s + (Number(l.quantity) || 0) * (Number(l.price) || 0),
    0,
  );
  const discount = Number(form.discount) || 0;
  const delivery = Number(form.delivery) || 0;
  return {subtotal, discount, delivery, total: Math.max(0, subtotal - discount + delivery)};
};

/** Product picker — pick from the catalog to quote a line. Out-of-stock
 *  products stay selectable: orders are quotes, stock is checked at billing. */
function ProductPicker({
  products,
  selectedId,
  onSelect,
}: {
  products: ProductDto[] | null | undefined;
  selectedId: string;
  onSelect: (product: ProductDto) => void;
}) {
  const styles = useThemeStyles(makeStyles);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const search = query.trim();
  const {data: searchPage} = useProducts({search, pageSize: 50}, {enabled: open && search.length > 0});
  const filtered = useMemo(() => {
    if (!search) return products ?? [];
    if (searchPage?.products) return searchPage.products;
    const q = search.toLowerCase();
    return (products ?? []).filter(
      p => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q),
    );
  }, [products, search, searchPage]);
  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={({pressed}) => [styles.picker, pressed && {opacity: 0.7}]}>
        <View style={{flex: 1}}>
          <Text style={styles.pickerLabel}>Product</Text>
          <Text style={styles.pickerValue} numberOfLines={1}>
            {selectedId
              ? products?.find(p => p.id === selectedId)?.name ?? ''
              : 'Select product (optional)'}
          </Text>
        </View>
        <ChevronDown size={18} color={colors.muted} />
      </Pressable>
      <ModalSheet visible={open} title="Select product" onClose={() => setOpen(false)} centered scrollable>
        <View style={styles.searchBox}>
          <Search size={16} color={colors.muted} />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Search products…"
            placeholderTextColor={colors.inputPlaceholder}
            autoCapitalize="none"
          />
        </View>
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          style={{maxHeight: 340}}
          ListEmptyComponent={<Empty text="No products found" />}
          renderItem={({item}) => {
            const out = item.stock <= 0;
            return (
              <Pressable
                onPress={() => {
                  selectionTick();
                  onSelect(item);
                  setOpen(false);
                  setQuery('');
                }}
                style={({pressed}) => [styles.pickRow, pressed && {backgroundColor: colors.mutedBg}]}>
                <View style={{flex: 1}}>
                  <Text style={styles.pickName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={{fontSize: 12, color: out ? colors.warning : colors.muted}}>
                    {item.sku}
                    {out ? ' · out of stock' : ''}
                  </Text>
                </View>
                <Text style={styles.pickPrice}>₹{Number(item.effectivePrice).toFixed(0)}</Text>
              </Pressable>
            );
          }}
        />
      </ModalSheet>
    </>
  );
}

/** "Link to khata party" picker — selecting a party pre-fills the customer
 *  fields; "None (walk-in)" clears it. Same behaviour as billing. */
function PartyPicker({
  parties,
  partyId,
  onChange,
}: {
  parties: PartyDto[] | null | undefined;
  partyId: string;
  onChange: (id: string, party?: PartyDto) => void;
}) {
  const styles = useThemeStyles(makeStyles);
  const [open, setOpen] = useState(false);
  const selected = parties?.find(p => p.id === partyId)?.name;
  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={({pressed}) => [styles.picker, pressed && {opacity: 0.7}]}>
        <View style={{flex: 1}}>
          <Text style={styles.pickerLabel}>Link to khata party</Text>
          <Text style={styles.pickerValue}>{selected || 'None (walk-in)'}</Text>
        </View>
        <ChevronDown size={18} color={colors.muted} />
      </Pressable>
      <ModalSheet visible={open} title="Select party" onClose={() => setOpen(false)} centered scrollable>
        <FlatList
          data={parties ?? []}
          keyExtractor={item => item.id}
          style={{maxHeight: 340}}
          ListHeaderComponent={
            <Pressable
              onPress={() => {
                selectionTick();
                onChange('');
                setOpen(false);
              }}
              style={({pressed}) => [styles.pickRow, pressed && {backgroundColor: colors.mutedBg}]}>
              <Text style={styles.pickName}>None (walk-in)</Text>
            </Pressable>
          }
          ListEmptyComponent={<Empty text="No parties yet — add one from the Khata tab first" />}
          renderItem={({item}) => (
            <Pressable
              onPress={() => {
                selectionTick();
                onChange(item.id, item);
                setOpen(false);
              }}
              style={({pressed}) => [styles.pickRow, pressed && {backgroundColor: colors.mutedBg}]}>
              <Text style={styles.pickName}>{item.name}</Text>
              {item.phone ? <Text style={{fontSize: 12, color: colors.muted}}>{item.phone}</Text> : null}
            </Pressable>
          )}
        />
      </ModalSheet>
    </>
  );
}

/** Line-item editor for quoted order lines. */
function OrderLinesEditor({
  lines,
  products,
  onChange,
  onPickProduct,
  onRemove,
  onAdd,
}: {
  lines: FormLine[];
  products: ProductDto[] | null | undefined;
  onChange: (index: number, patch: Partial<FormLine>) => void;
  onPickProduct: (index: number, product: ProductDto) => void;
  onRemove: (index: number) => void;
  onAdd: () => void;
}) {
  const styles = useThemeStyles(makeStyles);
  return (
    <>
      {lines.map((line, index) => (
        <View key={line.key} style={styles.lineBox}>
          <ProductPicker
            products={products}
            selectedId={line.productId}
            onSelect={product => onPickProduct(index, product)}
          />
          <Field
            label="Item name"
            value={line.productName}
            onChangeText={text => onChange(index, {productName: text})}
            placeholder="Or type manually"
          />
          <View style={styles.lineRow}>
            <Field
              label="Qty"
              value={line.quantity}
              onChangeText={text => onChange(index, {quantity: text})}
              keyboardType="numeric"
              style={{flex: 1, marginRight: 8}}
            />
            <Field
              label="Quoted ₹"
              value={line.price}
              onChangeText={text => onChange(index, {price: text})}
              keyboardType="numeric"
              style={{flex: 2}}
            />
          </View>
          {line.weight ? (
            <Text style={styles.lineWeight}>
              {line.weight}
              {line.weightUnit}
            </Text>
          ) : null}
          {index > 0 ? (
            <Button title="Remove item" variant="outline" onPress={() => onRemove(index)} />
          ) : null}
        </View>
      ))}
      <Button title="+ Add item" variant="outline" onPress={onAdd} style={{marginBottom: 12}} />
    </>
  );
}

export function OrdersScreen() {
  const styles = useThemeStyles(makeStyles);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<OrderStatusFilter>('all');
  const [page, setPage] = useState(1);

  const filters: OrderFilters = {search, status, page, pageSize: PAGE_SIZE};
  const {data, loading, error} = useQueryState(useOrders(filters));
  const orders: OrderDto[] = useMemo(() => data?.orders ?? [], [data]);
  const totalCount = data?.pagination.totalCount ?? 0;
  const totalPages = data?.pagination.totalPages ?? 0;

  function setSearchFilter(value: string) {
    setSearch(value);
    setPage(1);
  }
  function setStatusFilter(value: OrderStatusFilter) {
    setStatus(value);
    setPage(1);
  }

  const createOrder = useCreateOrder();
  const updateOrder = useUpdateOrder();
  const deleteOrder = useDeleteOrder();
  const generateBill = useGenerateOrderBill();
  const {data: productsData} = useQueryState(useProducts({pageSize: 1000}));
  const products = productsData?.products;
  const {data: parties} = useQueryState(useParties());
  const {data: settings} = useQueryState(useSettings());
  const {data: goldRates} = useGoldRates();
  const getClient = useApiClient();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<OrderDto | null>(null);
  const [form, setForm] = useState<FormState>(blankForm);
  const [formBusy, setFormBusy] = useState(false);

  const [billing, setBilling] = useState<OrderDto | null>(null);
  const [billBusy, setBillBusy] = useState(false);
  const [cancelling, setCancelling] = useState<OrderDto | null>(null);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [deleting, setDeleting] = useState<OrderDto | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [exporting, setExporting] = useState<OrderDto | null>(null);

  const totals = useMemo(() => formTotals(form), [form]);
  const summary = useMemo(() => {
    const open = orders.filter(o => o.status === 'OPEN');
    return {
      openValue: open.reduce((s, o) => s + o.total, 0),
      openCount: open.length,
      totalCount,
    };
  }, [orders, totalCount]);

  function openCreate() {
    setEditing(null);
    setForm(blankForm());
    setFormOpen(true);
  }

  function openEdit(o: OrderDto) {
    setEditing(o);
    setForm(orderToForm(o));
    setFormOpen(true);
  }

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(prev => ({...prev, [key]: value}));
  }

  function updateLine(index: number, patch: Partial<FormLine>) {
    setForm(prev => ({
      ...prev,
      lines: prev.lines.map((l, x) => (x === index ? {...l, ...patch} : l)),
    }));
  }

  function pickProduct(index: number, product: ProductDto) {
    setForm(prev => ({
      ...prev,
      lines: prev.lines.map((l, x) =>
        x === index
          ? {
              ...l,
              productId: product.id,
              productName: product.name,
              sku: product.sku ?? '',
              color: product.color ?? '',
              size: product.size ?? '',
              weight: product.weight != null ? String(product.weight) : '',
              weightUnit: product.weightUnit === 'mg' ? 'mg' : 'gm',
              price: String(product.effectivePrice ?? product.sellingPrice),
            }
          : l,
      ),
    }));
  }

  function pickParty(id: string, party?: PartyDto) {
    setForm(prev => ({
      ...prev,
      partyId: id,
      customerName: party?.name || prev.customerName,
      customerPhone: party?.phone || prev.customerPhone,
      customerAddress: party?.address || prev.customerAddress,
    }));
  }

  async function saveForm() {
    const items = toItems(form.lines);
    if (items.length === 0) {
      errorFeedback('Add at least one line item');
      return;
    }
    const values: OrderFormValues = {
      customerName: form.customerName.trim() || undefined,
      customerPhone: form.customerPhone.trim() || undefined,
      customerAddress: form.customerAddress.trim() || undefined,
      partyId: form.partyId || undefined,
      items,
      discount: Number(form.discount) || 0,
      deliveryCharge: Number(form.delivery) || 0,
      notes: form.notes.trim() || undefined,
    };
    setFormBusy(true);
    try {
      if (editing) {
        await updateOrder.mutateAsync({id: editing.id, values});
        successFeedback(`${editing.orderNumber} updated`);
      } else {
        const created = await createOrder.mutateAsync(values);
        successFeedback(`${created.orderNumber} created`);
      }
      setFormOpen(false);
    } catch {
      errorFeedback(editing ? 'Failed to update order' : 'Failed to create order');
    } finally {
      setFormBusy(false);
    }
  }

  async function confirmBill() {
    if (!billing) return;
    setBillBusy(true);
    try {
      const result = await generateBill.mutateAsync(billing.id);
      successFeedback(`${result.invoice.invoiceNumber} created — order billed`);
      setBilling(null);
    } catch {
      errorFeedback('Could not bill order — an item may be out of stock');
    } finally {
      setBillBusy(false);
    }
  }

  async function confirmCancel() {
    if (!cancelling) return;
    setCancelBusy(true);
    try {
      await updateOrder.mutateAsync({id: cancelling.id, values: {status: 'CANCELLED'}});
      successFeedback(`${cancelling.orderNumber} cancelled`);
      setCancelling(null);
    } catch {
      errorFeedback('Failed to cancel order');
    } finally {
      setCancelBusy(false);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await deleteOrder.mutateAsync(deleting.id);
      successFeedback(`${deleting.orderNumber} deleted`);
      setDeleting(null);
    } catch {
      errorFeedback('Failed to delete order');
    } finally {
      setDeleteBusy(false);
    }
  }

  /** COMPLETED order → load its invoice and print/save the bill PDF. */
  async function shareInvoice(o: OrderDto) {
    if (!o.invoiceId || !settings) return;
    setExporting(o);
    try {
      const api = await getClient();
      const inv: InvoiceDto = await api.invoices.get(o.invoiceId);
      const shop = {
        name: settings.shopName,
        address: settings.shopAddress ?? '',
        phones: Array.isArray(settings.shopPhones) ? settings.shopPhones : [],
        email: settings.shopEmail ?? '',
      };
      const doc = buildBillDocument({
        billNo: inv.invoiceNumber,
        date: inv.date,
        customerName: inv.customerName ?? '',
        customerPhone: inv.customerPhone ?? '',
        customerAddress: inv.customerAddress ?? '',
        shop,
        lines: inv.items.map(it => ({
          productName: it.productName,
          sku: it.sku ?? '',
          color: it.color ?? '',
          size: it.size ?? '',
          weight: it.weight,
          weightUnit: it.weightUnit,
          quantity: it.quantity,
          price: it.price,
        })),
        discount: inv.discount,
        deliveryCharge: inv.deliveryCharge,
        amountPaid: inv.amountPaid,
        status: inv.status,
        currency: settings.currency ?? 'INR',
        goldRate: inv.goldRate ?? goldRates?.baseRatePerGram ?? null,
        silverRate: inv.silverRate ?? settings.silverRatePerGram ?? null,
      });
      const html = renderBillHtml(doc, mergeBillTemplateSettings(inv.templateSettings));
      const {uri} = await Print.printToFileAsync({html, base64: false});
      await savePdf(uri, inv.invoiceNumber);
    } catch {
      // user cancelled or print failed
    } finally {
      setExporting(null);
    }
  }

  const badgeTone = (s: OrderDto['status']): 'success' | 'warning' | 'muted' =>
    s === 'COMPLETED' ? 'success' : s === 'OPEN' ? 'warning' : 'muted';
  const badgeLabel = (s: OrderDto['status']): string =>
    s === 'COMPLETED' ? 'Billed' : s === 'OPEN' ? 'Open' : 'Cancelled';

  return (
    <Screen>
      <HomeHeader title="Orders" />

      <KeyboardAvoidingView
        style={{flex: 1}}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}>
        <FlatList
          data={orders}
          keyExtractor={item => item.id}
          keyboardShouldPersistTaps="handled"
          {...headerScrollHandlers}
          style={loading && orders.length > 0 ? {opacity: 0.55} : null}
          ListHeaderComponent={
            <View>
              <View style={styles.searchWrap}>
                <View style={styles.searchBox}>
                  <Search size={15} color={colors.muted} />
                  <TextInput
                    value={search}
                    onChangeText={setSearchFilter}
                    placeholder="Search order #, customer…"
                    placeholderTextColor={colors.inputPlaceholder}
                    style={styles.searchInput}
                    autoCapitalize="none"
                  />
                </View>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipsRow}>
                {STATUS_CHIPS.map(chip => {
                  const active = status === chip.key;
                  return (
                    <Pressable
                      key={chip.key}
                      onPress={() => {
                        selectionTick();
                        setStatusFilter(chip.key);
                      }}
                      style={[
                        styles.chip,
                        active && {backgroundColor: colors.primary, borderColor: colors.primary},
                      ]}>
                      <Text style={[styles.chipText, active && {color: colors.onPrimary}]}>
                        {chip.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
              <View style={styles.statsRow}>
                <StatBox label="Open value" value={money(summary.openValue)} index={0} />
                <StatBox
                  label="Open"
                  value={String(summary.openCount)}
                  valueColor={colors.warning}
                  index={1}
                />
                <StatBox label="Total" value={String(summary.totalCount)} index={2} />
              </View>
              <View style={styles.ctaWrap}>
                <Button title="+ New order" onPress={openCreate} />
              </View>
            </View>
          }
          ListEmptyComponent={
            loading ? (
              <Loading rows={5} />
            ) : error ? (
              <Empty text={error} />
            ) : (
              <Empty text="No orders yet — quote an order, bill it when the customer confirms" />
            )
          }
          contentContainerStyle={{paddingBottom: 40}}
          renderItem={({item, index}) => {
            const exportingThis = exporting?.id === item.id;
            return (
              <Card index={index}>
                <View style={styles.row}>
                  <View style={{flex: 1}}>
                    <View style={styles.rowHeadline}>
                      <Text style={styles.number}>{item.orderNumber}</Text>
                      <Badge text={badgeLabel(item.status)} tone={badgeTone(item.status)} />
                    </View>
                    <Text style={styles.name}>{item.customerName ?? 'Walk-in customer'}</Text>
                    <Text style={styles.meta}>
                      {formatDate(item.date)} · {item.items.length} item
                      {item.items.length !== 1 ? 's' : ''}
                      {item.items[0]?.productName ? ` · ${item.items[0].productName}` : ''}
                    </Text>
                  </View>
                  <View style={styles.rowRight}>
                    <Text style={styles.total}>{money(item.total)}</Text>
                    <View style={styles.rowActions}>
                      {item.status === 'COMPLETED' && item.invoiceId ? (
                        <Pressable
                          onPress={() => void shareInvoice(item)}
                          hitSlop={8}
                          disabled={exportingThis}
                          style={({pressed}) => [
                            styles.iconBtn,
                            pressed && {opacity: 0.5},
                            exportingThis && {opacity: 0.4},
                          ]}
                          accessibilityLabel={`Share invoice for ${item.orderNumber}`}>
                          <Share2 size={16} color={colors.primary} />
                        </Pressable>
                      ) : null}
                      {item.status === 'OPEN' ? (
                        <>
                          <Button
                            title="Edit"
                            variant="outline"
                            onPress={() => openEdit(item)}
                            style={styles.smallBtn}
                          />
                          <Button
                            title="Bill"
                            variant="outline"
                            onPress={() => setBilling(item)}
                            style={styles.smallBtn}
                          />
                          <Pressable
                            onPress={() => {
                              setCancelling(item);
                            }}
                            hitSlop={8}
                            style={({pressed}) => [styles.iconBtn, pressed && {opacity: 0.5}]}
                            accessibilityLabel={`Cancel ${item.orderNumber}`}>
                            <Trash2 size={16} color={colors.danger} />
                          </Pressable>
                        </>
                      ) : null}
                      {item.status === 'CANCELLED' ? (
                        <Pressable
                          onPress={() => setDeleting(item)}
                          hitSlop={8}
                          style={({pressed}) => [styles.iconBtn, pressed && {opacity: 0.5}]}
                          accessibilityLabel={`Delete ${item.orderNumber}`}>
                          <Trash2 size={16} color={colors.danger} />
                        </Pressable>
                      ) : null}
                    </View>
                  </View>
                </View>
              </Card>
            );
          }}
          ListFooterComponent={
            totalPages > 1 ? (
              <View style={styles.pager}>
                <Button
                  title="‹ Prev"
                  variant="outline"
                  disabled={page <= 1}
                  onPress={() => setPage(p => Math.max(1, p - 1))}
                  style={{flex: 1}}
                />
                <Text style={styles.pagerText}>
                  Page {page} of {totalPages} · {totalCount}
                </Text>
                <Button
                  title="Next ›"
                  variant="outline"
                  disabled={page >= totalPages}
                  onPress={() => setPage(p => p + 1)}
                  style={{flex: 1}}
                />
              </View>
            ) : null
          }
        />
      </KeyboardAvoidingView>

      {/* Create / edit — full-height sheet */}
      <ModalSheet
        visible={formOpen}
        title={editing ? `Edit ${editing.orderNumber}` : 'New order'}
        onClose={() => setFormOpen(false)}
        dismissable={!formBusy}
        size="xl"
        scrollable>
        <Text style={styles.sheetNote}>
          Quote items at locked prices — stock is checked only when you bill it.
        </Text>
        <Field
          label="Customer"
          value={form.customerName}
          onChangeText={text => setField('customerName', text)}
        />
        <Field
          label="Phone"
          value={form.customerPhone}
          onChangeText={text => setField('customerPhone', text)}
          keyboardType="phone-pad"
        />
        <Field
          label="Address"
          value={form.customerAddress}
          onChangeText={text => setField('customerAddress', text)}
        />
        <PartyPicker
          parties={parties}
          partyId={form.partyId}
          onChange={(id, party) => pickParty(id, party)}
        />
        <Text style={styles.groupLabel}>Items</Text>
        <OrderLinesEditor
          lines={form.lines}
          products={products}
          onChange={updateLine}
          onPickProduct={pickProduct}
          onRemove={index =>
            setForm(prev => ({...prev, lines: prev.lines.filter((_, x) => x !== index)}))
          }
          onAdd={() => setForm(prev => ({...prev, lines: [...prev.lines, blankLine()]}))}
        />
        <View style={styles.lineRow}>
          <Field
            label="Discount (₹)"
            value={form.discount}
            onChangeText={text => setField('discount', text)}
            keyboardType="numeric"
            style={{flex: 1, marginRight: 8}}
          />
          <Field
            label="Delivery (₹)"
            value={form.delivery}
            onChangeText={text => setField('delivery', text)}
            keyboardType="numeric"
            style={{flex: 1}}
          />
        </View>
        <Field
          label="Notes"
          value={form.notes}
          onChangeText={text => setField('notes', text)}
          placeholder="e.g. ready after Friday"
        />
        <View style={styles.totalsBox}>
          <View style={styles.totalLine}>
            <Text style={styles.totalLabel}>Subtotal</Text>
            <Text style={styles.totalValue}>{money(totals.subtotal)}</Text>
          </View>
          {totals.discount > 0 ? (
            <View style={styles.totalLine}>
              <Text style={styles.totalLabel}>Discount</Text>
              <Text style={styles.totalValue}>-{money(totals.discount)}</Text>
            </View>
          ) : null}
          {totals.delivery > 0 ? (
            <View style={styles.totalLine}>
              <Text style={styles.totalLabel}>Delivery</Text>
              <Text style={styles.totalValue}>+{money(totals.delivery)}</Text>
            </View>
          ) : null}
          <View style={[styles.totalLine, styles.totalGrand]}>
            <Text style={[styles.totalLabel, {fontWeight: '700', color: colors.text}]}>
              Quoted total
            </Text>
            <Text style={styles.totalGrandValue}>{money(totals.total)}</Text>
          </View>
        </View>
        <Button
          title={formBusy ? 'Saving…' : editing ? 'Save changes' : 'Create order'}
          onPress={() => void saveForm()}
          loading={formBusy}
        />
        {editing && editing.status === 'OPEN' ? (
          <Button
            title="Cancel order"
            variant="outline"
            onPress={() => {
              setFormOpen(false);
              setCancelling(editing);
            }}
            style={{marginTop: 10}}
          />
        ) : null}
        <View style={{height: 24}} />
      </ModalSheet>

      {/* Bill confirmation — prefilled summary */}
      <ModalSheet
        visible={!!billing}
        title={billing ? `Bill ${billing.orderNumber}?` : ''}
        onClose={() => setBilling(null)}
        dismissable={!billBusy}
        centered>
        {billing ? (
          <>
            <View style={styles.confirmBox}>
              <View style={styles.totalLine}>
                <Text style={styles.totalLabel}>Customer</Text>
                <Text style={styles.totalValue}>{billing.customerName || 'Walk-in customer'}</Text>
              </View>
              <View style={styles.totalLine}>
                <Text style={styles.totalLabel}>Items</Text>
                <Text style={styles.totalValue}>
                  {billing.items.length} line{billing.items.length !== 1 ? 's' : ''}
                </Text>
              </View>
              <View style={styles.totalLine}>
                <Text style={styles.totalLabel}>Quoted total</Text>
                <Text style={styles.totalValue}>{money(billing.total)}</Text>
              </View>
            </View>
            <Text style={styles.sheetNote}>
              Quoted prices carry into the bill as-is. Stock is checked right now — if an item is
              out of stock, billing fails and the order stays open.
            </Text>
            <Button
              title={billBusy ? 'Billing…' : 'Generate bill'}
              onPress={() => void confirmBill()}
              loading={billBusy}
            />
          </>
        ) : null}
      </ModalSheet>

      {/* Cancel confirm */}
      <ModalSheet
        visible={!!cancelling}
        title={cancelling ? `Cancel ${cancelling.orderNumber}?` : ''}
        onClose={() => setCancelling(null)}
        dismissable={!cancelBusy}
        centered>
        <Text style={styles.confirmNote}>
          This order will be marked cancelled. You can still delete it afterwards.
        </Text>
        <Button
          title={cancelBusy ? 'Cancelling…' : 'Cancel order'}
          variant="danger"
          onPress={() => void confirmCancel()}
          loading={cancelBusy}
        />
      </ModalSheet>

      {/* Delete confirm */}
      <ModalSheet
        visible={!!deleting}
        title={deleting ? `Delete ${deleting.orderNumber}?` : ''}
        onClose={() => setDeleting(null)}
        dismissable={!deleteBusy}
        centered>
        <Text style={styles.confirmNote}>
          This order will be removed permanently. Billed orders cannot be deleted.
        </Text>
        <Button
          title={deleteBusy ? 'Deleting…' : 'Delete order'}
          variant="danger"
          onPress={() => void confirmDelete()}
          loading={deleteBusy}
        />
      </ModalSheet>
    </Screen>
  );
}

const makeStyles = () =>
  StyleSheet.create({
    searchWrap: {marginHorizontal: 16, marginBottom: 10},
    searchBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: 12,
    },
    searchInput: {flex: 1, paddingVertical: 10, fontSize: 14, color: colors.text},
    chipsRow: {paddingHorizontal: 16, gap: 8, paddingBottom: 12},
    chip: {
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    chipText: {fontSize: 12, fontWeight: '600', color: colors.muted},
    statsRow: {flexDirection: 'row', gap: 10, marginHorizontal: 16, marginBottom: 10},
    ctaWrap: {marginHorizontal: 16, marginBottom: 12},
    row: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
    rowHeadline: {flexDirection: 'row', alignItems: 'center', gap: 8},
    number: {fontSize: 12, color: colors.muted, fontFamily: 'monospace', fontWeight: '600'},
    name: {fontSize: 15, fontWeight: '600', color: colors.text, marginTop: 3},
    meta: {fontSize: 11, color: colors.muted, marginTop: 2},
    rowRight: {alignItems: 'flex-end', gap: 6, marginTop: 2},
    total: {fontSize: 15, fontWeight: '700', color: colors.text},
    rowActions: {flexDirection: 'row', alignItems: 'center', gap: 6},
    smallBtn: {paddingVertical: 6, paddingHorizontal: 10},
    iconBtn: {
      width: 32,
      height: 32,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.mutedSoft,
    },
    pager: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginHorizontal: 16,
      marginTop: 4,
    },
    pagerText: {fontSize: 11, color: colors.muted, fontWeight: '600'},
    picker: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      marginBottom: 10,
    },
    pickerLabel: {fontSize: 11, color: colors.muted, fontWeight: '600'},
    pickerValue: {fontSize: 15, color: colors.text, marginTop: 2},
    searchBoxModal: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.mutedSoft,
      borderRadius: 10,
      paddingHorizontal: 12,
      marginBottom: 8,
    },
    searchInputModal: {flex: 1, paddingVertical: 9, fontSize: 14, color: colors.text},
    pickRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 11,
      paddingHorizontal: 6,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      gap: 8,
    },
    pickName: {flex: 1, fontSize: 15, color: colors.text, fontWeight: '600'},
    pickPrice: {fontSize: 14, color: colors.text, fontWeight: '700'},
    lineBox: {
      backgroundColor: colors.mutedSoft,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 12,
      marginBottom: 10,
      gap: 4,
    },
    lineRow: {flexDirection: 'row', alignItems: 'flex-end'},
    lineWeight: {fontSize: 11, color: colors.muted, fontWeight: '600', marginBottom: 6},
    groupLabel: {
      fontSize: 11,
      color: colors.muted,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      marginBottom: 8,
      marginTop: 6,
    },
    sheetNote: {fontSize: 12, color: colors.muted, lineHeight: 18, marginBottom: 14},
    totalsBox: {
      backgroundColor: colors.mutedSoft,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 12,
      marginBottom: 14,
      gap: 6,
    },
    totalLine: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
    totalLabel: {fontSize: 12, color: colors.muted, fontWeight: '600'},
    totalValue: {fontSize: 13, color: colors.text, fontWeight: '600'},
    totalGrand: {borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8, marginTop: 2},
    totalGrandValue: {fontSize: 16, color: colors.text, fontWeight: '800'},
    confirmBox: {
      backgroundColor: colors.mutedSoft,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 12,
      marginBottom: 12,
      gap: 6,
    },
    confirmNote: {fontSize: 13, color: colors.muted, lineHeight: 19, marginBottom: 14},
  });
