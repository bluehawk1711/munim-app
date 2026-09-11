/**
 * SalesScreen — scan-to-bill: barcode scanner → add products → complete sale.
 *
 * Flow:
 *   1. Tap "Scan barcode" → camera opens
 *   2. Barcode detected → product lookup → added to bill items
 *   3. Repeat for multiple products
 *   4. Enter customer name (optional)
 *   5. Tap "Complete sale" → invoice created → PDF generated → share/save
 */

import React, {useRef, useState} from 'react';
import {Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View, KeyboardAvoidingView} from 'react-native';
import * as Print from 'expo-print';
import {Camera, Minus, Plus, ShoppingCart, Trash2, X} from 'lucide-react-native';
import {
  buildBillDocument,
  renderBillHtml,
  swatchColor,
  type BillTemplate,
  type BillClassicColor,
  type BillMode,
  type BillTemplateSettings,
  type ProductDto,
  type InvoiceDto,
} from '@munim/core';
import {
  useCreateInvoice,
  useProductByBarcode,
  useSettings,
} from '@munim/query';
import {money} from '../lib/format';
import {successFeedback, errorFeedback, selectionTick} from '../lib/haptics';
import {rs, typography, spacing, radii, CARD_MARGIN} from '../lib/responsive';
import {
  Button,
  Card,
  Empty,
  Field,
  Loading,
  ModalSheet,
  Screen,
  colors,
} from '../components/ui';
import {HomeHeader, headerScrollHandlers} from '../components/home-header';
import {BarcodeScannerModal} from '../components/BarcodeScannerModal';
import {ProductDetailSheet} from '../components/ProductDetailSheet';
import {useThemeStyles} from '../theme';
import {savePdf} from '../lib/save-pdf';

type BillItem = {
  product: ProductDto;
  quantity: number;
  price: number;
};

export function SalesScreen() {
  const styles = useThemeStyles(makeStyles);
  const {data: settings} = useSettings();
  const createInvoice = useCreateInvoice();

  // Bill state
  const [items, setItems] = useState<BillItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [includeDelivery, setIncludeDelivery] = useState(true);
  const [deliveryCharge, setDeliveryCharge] = useState('');
  const [busy, setBusy] = useState(false);

  // Template settings (same model as web + desktop)
  const [template, setTemplate] = useState<BillTemplate>('jewellery');
  const [classicColor, setClassicColor] = useState<BillClassicColor>('red');
  const [twoInOne, setTwoInOne] = useState(false);
  const [mode, setMode] = useState<BillMode>('duplicate');

  // Barcode scanner
  const [scanOpen, setScanOpen] = useState(false);
  const [scanCode, setScanCode] = useState<string | null>(null);
  const [scanMsg, setScanMsg] = useState('');
  const scanningRef = useRef(false);

  // Duplicate product warning
  const [dupProduct, setDupProduct] = useState<ProductDto | null>(null);
  const [dupQty, setDupQty] = useState(1);

  // Product detail sheet
  const [detailTarget, setDetailTarget] = useState<ProductDto | null>(null);

  const scanQ = useProductByBarcode(scanCode);

  // Handle barcode detected
  function handleScanDetected(code: string) {
    if (scanningRef.current) return;
    scanningRef.current = true;
    setScanMsg('');
    setScanCode(code);
  }

  // Handle scan result
  React.useEffect(() => {
    if (!scanCode) return;
    if (scanQ.data) {
      scanningRef.current = false;
      setScanOpen(false);
      const product = scanQ.data;
      // Check if already in bill
      const existing = items.find(i => i.product.id === product.id);
      if (existing) {
        setDupProduct(product);
        setDupQty(existing.quantity + 1);
      } else {
        setItems(prev => [...prev, {product, quantity: 1, price: product.sellingPrice}]);
        successFeedback(`${product.name} added`);
      }
      setScanCode(null);
    } else if (scanQ.isError) {
      scanningRef.current = false;
      const msg = scanQ.error?.message?.includes('404')
        ? `No product with barcode ${scanCode}`
        : 'Barcode lookup failed';
      errorFeedback(msg);
      setScanCode(null);
    }
  }, [scanCode, scanQ.data, scanQ.isError, scanQ.error]);

  // Add duplicate product with new qty
  function confirmDup() {
    if (!dupProduct) return;
    setItems(prev =>
      prev.map(i =>
        i.product.id === dupProduct.id ? {...i, quantity: dupQty} : i,
      ),
    );
    setDupProduct(null);
    setDupQty(1);
  }

  // Update item quantity
  function updateQty(productId: string, delta: number) {
    setItems(prev =>
      prev
        .map(i =>
          i.product.id === productId
            ? {...i, quantity: Math.max(1, i.quantity + delta)}
            : i,
        ),
    );
  }

  // Update item price
  function updatePrice(productId: string, price: number) {
    setItems(prev =>
      prev.map(i =>
        i.product.id === productId ? {...i, price: Math.max(0, price)} : i,
      ),
    );
  }

  // Remove item
  function removeItem(productId: string) {
    setItems(prev => prev.filter(i => i.product.id !== productId));
  }

  // Totals
  const subtotal = items.reduce((s, i) => s + i.quantity * i.price, 0);
  const total = subtotal + (includeDelivery ? (Number(deliveryCharge) || 0) : 0);

  // Complete sale
  async function handleComplete() {
    if (items.length === 0) {
      errorFeedback('Add at least one product');
      return;
    }
    if (items.some(i => i.price <= 0)) {
      errorFeedback('All items must have a price greater than 0');
      return;
    }
    setBusy(true);
    try {
      const templateSettings: BillTemplateSettings = {template, classicColor, twoInOne, mode};
      const invoice = await createInvoice.mutateAsync({
        customerName: customerName.trim() || undefined,
        customerPhone: customerPhone.trim() || undefined,
        date: new Date().toISOString(),
        items: items.map(i => ({
          productId: i.product.id,
          productName: i.product.name,
          sku: i.product.sku,
          color: i.product.color || undefined,
          size: i.product.size || undefined,
          quantity: i.quantity,
          price: i.price,
        })),
        amountPaid: subtotal + (includeDelivery ? (Number(deliveryCharge) || 0) : 0),
        paymentMethod: 'cash',
        deliveryCharge: includeDelivery ? (Number(deliveryCharge) || 0) : 0,
        templateSettings,
        shopDetails: settings
          ? {name: settings.shopName, address: settings.shopAddress ?? '', phones: settings.shopPhones ?? [], email: settings.shopEmail ?? ''}
          : undefined,
      });

      // Generate and share PDF
      const shop = settings ? {name: settings.shopName, address: settings.shopAddress ?? '', phones: settings.shopPhones ?? [], email: settings.shopEmail ?? ''} : {name: 'My Shop', address: '', phones: [], email: ''};
      const doc = buildBillDocument({
        billNo: invoice.invoiceNumber,
        date: invoice.date,
        customerName: invoice.customerName,
        customerPhone: invoice.customerPhone,
        customerAddress: invoice.customerAddress,
        shop,
        lines: invoice.items.map(it => ({
          productName: it.productName,
          sku: it.sku,
          color: it.color,
          size: it.size,
          quantity: it.quantity,
          price: it.price,
        })),
        discount: invoice.discount,
        deliveryCharge: invoice.deliveryCharge,
        amountPaid: invoice.amountPaid,
        status: invoice.status,
      });
      const html = renderBillHtml(doc);
      const {uri} = await Print.printToFileAsync({html, base64: false});

      // Save to Downloads (Android) or share (iOS)
      await savePdf(uri, doc.billNo);

      // Reset
      setItems([]);
      setCustomerName('');
      setCustomerPhone('');
      successFeedback('Sale completed');
    } catch {
      errorFeedback('Failed to create sale');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <HomeHeader title="Sales" />

      <KeyboardAvoidingView style={{flex: 1}} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{paddingBottom: spacing.xxxl}}
        {...headerScrollHandlers}>
        {/* Scan button */}
        <Card style={{marginHorizontal: CARD_MARGIN}} index={0}>
          <Pressable
            onPress={() => { selectionTick(); setScanOpen(true); }}
            style={styles.scanButton}>
            <View style={styles.scanIcon}>
              <Camera size={rs(20)} color={colors.onPrimary} strokeWidth={2.2} />
            </View>
            <View style={{flex: 1}}>
              <Text style={styles.scanTitle}>Scan barcode</Text>
              <Text style={styles.scanSubtitle}>Tap to scan a product barcode</Text>
            </View>
            <Text style={{color: colors.muted, fontSize: typography.h2}}>›</Text>
          </Pressable>
        </Card>

        {/* Template options — same model as web + desktop */}
        <Card style={{marginHorizontal: CARD_MARGIN, marginTop: GRID_GAP}} index={1}>
          <Text style={styles.cardTitle}>Bill template</Text>
          <View style={styles.segmentRow}>
            {(['jewellery', 'ecommerce'] as const).map(t => (
              <Pressable
                key={t}
                accessibilityRole="button"
                onPress={() => { selectionTick(); setTemplate(t); }}
                style={({pressed}) => [
                  styles.segment,
                  template === t && styles.segmentActive,
                  pressed && {opacity: 0.75},
                ]}>
                <Text style={[styles.segmentText, template === t && styles.segmentTextActive]}>
                  {t === 'jewellery' ? 'Classic Jewellery' : 'Modern E-commerce'}
                </Text>
              </Pressable>
            ))}
          </View>

          {template === 'jewellery' ? (
            <>
              <Text style={[styles.cardTitle, {marginTop: spacing.sm}]}>Classic color</Text>
              <View style={styles.colorRow}>
                {(['red', 'yellow'] as const).map(c => (
                  <Pressable
                    key={c}
                    accessibilityRole="button"
                    onPress={() => { selectionTick(); setClassicColor(c); }}
                    style={({pressed}) => [
                      styles.colorDotWrap,
                      classicColor === c && styles.colorDotActive,
                      pressed && {opacity: 0.75},
                    ]}>
                    <View style={[styles.colorDot, {backgroundColor: swatchColor(c)}]} />
                  </Pressable>
                ))}
                <Text style={styles.colorHint}>
                  {classicColor === 'red' ? 'Red theme' : 'Yellow theme'}
                </Text>
              </View>
            </>
          ) : null}

          <View style={styles.toggleRow}>
            <View style={{flex: 1, paddingRight: 12}}>
              <Text style={styles.toggleLabel}>2-in-1 bill</Text>
              <Text style={{fontSize: typography.caption, color: colors.muted}}>Two bills on one page</Text>
            </View>
            <Switch
              value={twoInOne}
              onValueChange={value => { selectionTick(); setTwoInOne(value); }}
              trackColor={{true: colors.primary, false: colors.border}}
              thumbColor={colors.card}
            />
          </View>

          {twoInOne ? (
            <>
              <Text style={[styles.cardTitle, {marginTop: spacing.sm}]}>Mode</Text>
              <View style={styles.segmentRow}>
                {(['duplicate', 'distinct'] as const).map(m => (
                  <Pressable
                    key={m}
                    accessibilityRole="button"
                    onPress={() => { selectionTick(); setMode(m); }}
                    style={({pressed}) => [
                      styles.segment,
                      mode === m && styles.segmentActive,
                      pressed && {opacity: 0.75},
                    ]}>
                    <Text style={[styles.segmentText, mode === m && styles.segmentTextActive]}>
                      {m === 'duplicate' ? 'Duplicate' : 'Separate'}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </>
          ) : null}
        </Card>

        {/* Customer info */}
        <Card style={{marginHorizontal: CARD_MARGIN, marginTop: GRID_GAP}} index={2}>
          <Text style={styles.cardTitle}>Customer (optional)</Text>
          <Field label="Name" value={customerName} onChangeText={setCustomerName} placeholder="Walk-in customer" />
          <Field label="Phone" value={customerPhone} onChangeText={setCustomerPhone} keyboardType="phone-pad" placeholder="Optional" />
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Include delivery charge</Text>
            <Switch
              value={includeDelivery}
              onValueChange={setIncludeDelivery}
              trackColor={{false: colors.border, true: colors.primary}}
              thumbColor={colors.card}
            />
          </View>
          {includeDelivery && (
            <Field label="Delivery charge" value={deliveryCharge} onChangeText={setDeliveryCharge} keyboardType="numeric" placeholder="0" />
          )}
        </Card>

        {/* Bill items */}
        <Card style={{marginHorizontal: CARD_MARGIN, marginTop: GRID_GAP}} index={3}>
          <View style={styles.billHeader}>
            <ShoppingCart size={rs(16)} color={colors.primary} strokeWidth={2.2} />
            <Text style={styles.cardTitle}>Bill items</Text>
            <Text style={styles.itemCount}>{items.length}</Text>
          </View>

          {items.length === 0 ? (
            <Empty text="Scan a barcode to add products." />
          ) : (
            <>
              {items.map(item => (
                <Pressable
                  key={item.product.id}
                  onPress={() => setDetailTarget(item.product)}
                  style={({pressed}) => [styles.billItem, pressed && {opacity: 0.7}]}>
                  <View style={styles.billItemTop}>
                    <View style={{flex: 1, minWidth: 0}}>
                      <Text style={styles.itemName} numberOfLines={1}>{item.product.name}</Text>
                      <Text style={styles.itemMeta}>
                        {[item.product.sku, item.product.color, item.product.size].filter(Boolean).join(' · ')}
                      </Text>
                    </View>
                    <Pressable onPress={() => removeItem(item.product.id)} hitSlop={8}>
                      <Trash2 size={rs(16)} color={colors.danger} strokeWidth={2} />
                    </Pressable>
                  </View>
                  <View style={styles.billItemBottom}>
                    <View style={styles.qtyRow}>
                      <Pressable onPress={() => updateQty(item.product.id, -1)} style={styles.qtyBtn}>
                        <Minus size={rs(14)} color={colors.text} strokeWidth={2.5} />
                      </Pressable>
                      <Text style={styles.qtyText}>{item.quantity}</Text>
                      <Pressable onPress={() => updateQty(item.product.id, 1)} style={styles.qtyBtn}>
                        <Plus size={rs(14)} color={colors.text} strokeWidth={2.5} />
                      </Pressable>
                    </View>
                    <Text style={styles.itemTotal}>{money(item.quantity * item.price)}</Text>
                  </View>
                </Pressable>
              ))}

              {/* Total */}
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Subtotal</Text>
                <Text style={styles.totalValue}>{money(subtotal)}</Text>
              </View>
              {includeDelivery && (Number(deliveryCharge) || 0) > 0 ? (
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Delivery</Text>
                  <Text style={styles.totalValue}>+{money(Number(deliveryCharge) || 0)}</Text>
                </View>
              ) : null}
              <View style={[styles.totalRow, {borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm}]}>
                <Text style={[styles.totalLabel, {fontWeight: '800'}]}>Total</Text>
                <Text style={[styles.totalValue, {color: colors.primary}]}>{money(total)}</Text>
              </View>

              <Button
                title={busy ? 'Completing…' : `Complete sale — ${money(total)}`}
                onPress={handleComplete}
                loading={busy}
                disabled={items.length === 0 || busy}
              />
            </>
          )}
        </Card>
      </ScrollView>
      </KeyboardAvoidingView>

      {/* Barcode scanner */}
      <BarcodeScannerModal
        visible={scanOpen}
        onClose={() => { setScanOpen(false); setScanCode(null); scanningRef.current = false; }}
        onDetected={handleScanDetected}
        message={scanMsg}
      />

      {/* Duplicate product dialog */}
      <ModalSheet visible={!!dupProduct} title="Product already in bill" onClose={() => setDupProduct(null)} centered>
        {dupProduct ? (
          <>
            <Text style={{fontSize: typography.body, color: colors.text, marginBottom: spacing.md}}>
              {dupProduct.name} is already in the bill. Update quantity?
            </Text>
            <View style={styles.dupQtyRow}>
              <Pressable onPress={() => setDupQty(q => Math.max(1, q - 1))} style={styles.qtyBtn}>
                <Minus size={rs(14)} color={colors.text} strokeWidth={2.5} />
              </Pressable>
              <Text style={styles.qtyText}>{dupQty}</Text>
              <Pressable onPress={() => setDupQty(q => q + 1)} style={styles.qtyBtn}>
                <Plus size={rs(14)} color={colors.text} strokeWidth={2.5} />
              </Pressable>
            </View>
            <Button title="Update quantity" onPress={confirmDup} />
          </>
        ) : null}
      </ModalSheet>

      {/* Product detail sheet */}
      <ProductDetailSheet
        product={detailTarget}
        onClose={() => setDetailTarget(null)}
        onEdit={() => setDetailTarget(null)}
        onAdjust={() => setDetailTarget(null)}
        onSell={() => setDetailTarget(null)}
      />
    </Screen>
  );
}

const GRID_GAP = spacing.sm;

const makeStyles = () =>
  StyleSheet.create({
    scanButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.md,
    },
    scanIcon: {
      width: rs(40),
      height: rs(40),
      borderRadius: radii.md,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    scanTitle: {fontSize: typography.body, fontWeight: '700', color: colors.text},
    scanSubtitle: {fontSize: typography.caption, color: colors.muted, marginTop: rs(2)},
    cardTitle: {fontSize: typography.h3, fontWeight: '700', color: colors.text, marginBottom: spacing.md},
    billHeader: {flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md},
    itemCount: {
      fontSize: typography.caption,
      fontWeight: '700',
      color: colors.onPrimary,
      backgroundColor: colors.primary,
      borderRadius: radii.sm,
      paddingHorizontal: rs(8),
      paddingVertical: rs(2),
      overflow: 'hidden',
    },
    billItem: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      paddingTop: spacing.md,
      paddingBottom: spacing.md,
    },
    billItemTop: {flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginBottom: spacing.sm},
    itemName: {fontSize: typography.secondary, fontWeight: '600', color: colors.text},
    itemMeta: {fontSize: typography.caption, color: colors.muted, marginTop: rs(2)},
    billItemBottom: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
    qtyRow: {flexDirection: 'row', alignItems: 'center', gap: spacing.sm},
    qtyBtn: {
      width: rs(28),
      height: rs(28),
      borderRadius: radii.sm,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.card,
    },
    qtyText: {fontSize: typography.body, fontWeight: '700', color: colors.text, minWidth: rs(24), textAlign: 'center'},
    itemTotal: {fontSize: typography.body, fontWeight: '700', color: colors.primary},
    totalRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      paddingTop: spacing.md,
      marginTop: spacing.sm,
      marginBottom: spacing.md,
    },
    totalLabel: {fontSize: typography.h3, fontWeight: '700', color: colors.text},
    totalValue: {fontSize: typography.h2, fontWeight: '800', color: colors.primary},
    toggleRow: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border},
    toggleLabel: {fontSize: typography.secondary, fontWeight: '600', color: colors.text},
    segmentRow: {flexDirection: 'row', gap: spacing.sm},
    segment: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.md,
      paddingVertical: spacing.sm,
      alignItems: 'center',
      backgroundColor: colors.card,
    },
    segmentActive: {backgroundColor: colors.primary, borderColor: colors.primary},
    segmentText: {fontSize: typography.caption, fontWeight: '600', color: colors.muted},
    segmentTextActive: {color: colors.onPrimary},
    colorRow: {flexDirection: 'row', alignItems: 'center', gap: spacing.sm},
    colorDotWrap: {
      width: rs(36),
      height: rs(36),
      borderRadius: rs(18),
      borderWidth: 2,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    colorDotActive: {borderColor: colors.primary, borderWidth: 2.5},
    colorDot: {width: rs(22), height: rs(22), borderRadius: rs(11)},
    colorHint: {fontSize: typography.caption, color: colors.muted, marginLeft: spacing.xs},
    dupQtyRow: {flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.lg, marginVertical: spacing.md},
  });
