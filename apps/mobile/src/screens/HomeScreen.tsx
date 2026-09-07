/**
 * HomeScreen — Munim mobile dashboard (counter-style home).
 *
 * Layout mirrors the reference design:
 *   HomeHeader (custom) → status chips → TOTAL NET REVENUE hero card with
 *   6-month performance line chart → quick actions (Record Sale / Add Stock
 *   / New Khata / Reports) → Khata Net Position (you pay vs you receive) →
 *   Recent Counter Activity → "Create New Bill / Order" CTA.
 *
 * All colors are theme tokens; charts reuse the shared SVG kit (LineChart).
 * Deep-links preserved: status chips / activity rows / CTA jump to the right
 * tab (optionally with an invoice status filter via nav-store).
 */

import React, {useEffect, useRef, useState} from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {
  ShoppingCart,
  PackagePlus,
  Users,
  BarChart3,
  Plus,
  Wallet,
  ChevronRight,
} from 'lucide-react-native';
import {formatDate, type ProductDto} from '@munim/core';
import {ApiClientError} from '@munim/api-client';
import {useDashboard, useProductByBarcode, useQueryState} from '@munim/query';
import {money} from '../lib/format';
import {rs, typography, spacing, radii, CARD_MARGIN} from '../lib/responsive';
import {Badge, Card, Empty, ErrorBox, Loading, Screen} from '../components/ui';
import {LineChart, BarChart, DonutChart} from '../components/charts';
import {BarcodeScannerModal} from '../components/BarcodeScannerModal';
import {QuickSaleSheet} from '../components/quick-sale-sheet';
import {HomeHeader, headerScrollHandlers} from '../components/home-header';
import {useTheme, useThemeStyles} from '../theme';
import {useAppStore} from '../lib/store';
import {useNavStore, type InvoiceStatusFilter} from '../lib/nav-store';
import {selectionTick, actionPress, errorFeedback} from '../lib/haptics';
import type {MobileColors} from '@munim/theme';

/** Server status label → invoice status filter (for deep-linking). */
const STATUS_TO_FILTER: Record<string, InvoiceStatusFilter> = {
  Paid: 'PAID',
  Partial: 'PARTIAL',
  Unpaid: 'UNPAID',
  Draft: 'DRAFT',
};

/** +x.x% growth of this month's revenue over the previous month. */
function revenueDelta(monthlySales: {month: string; revenue: number; orders: number}[]): number | null {
  if (monthlySales.length < 2) return null;
  const cur = monthlySales[monthlySales.length - 1]?.revenue ?? 0;
  const prev = monthlySales[monthlySales.length - 2]?.revenue ?? 0;
  if (prev <= 0) return cur > 0 ? 100 : null;
  return ((cur - prev) / prev) * 100;
}

export function HomeScreen() {
  const styles = useThemeStyles(makeStyles);
  const {colors: palette} = useTheme();
  const {data, error, loading, reload} = useQueryState(useDashboard());

  // ── Scan-to-sell (header scan button) ───────────────────────────────────
  const [scanOpen, setScanOpen] = useState(false);
  const [scanCode, setScanCode] = useState<string | null>(null);
  const [saleProduct, setSaleProduct] = useState<ProductDto | null>(null);
  const scanningRef = useRef(false);
  const scanQ = useProductByBarcode(scanCode);

  // Scan result → open the instant-sale dialog with the found product.
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
      errorFeedback(notFound ? `No product with barcode ${scanCode}` : 'Barcode lookup failed');
      setScanCode(null);
    }
  }, [scanCode, scanQ.data, scanQ.isError, scanQ.error]);

  /** Camera frame → remember the code; lookup resolves in the effect. */
  function handleScanDetected(code: string) {
    if (scanningRef.current) return;
    scanningRef.current = true;
    setScanCode(code);
  }

  const performance = (data?.monthlySales ?? []).map((m) => ({
    label: m.month.slice(0, 3),
    value: m.revenue,
  }));

  const delta = data ? revenueDelta(data.monthlySales) : null;

  /** Deep-link: switch to the given tab (from Home). */
  function goTo(tab: 'products' | 'more' | 'sales' | 'billing' | 'parties') {
    useAppStore.getState().setActiveView(tab);
  }

  /** Deep-link into More → Invoices with a status filter. */
  function openInvoices(status: InvoiceStatusFilter) {
    useNavStore.getState().openMore('invoices', status);
    goTo('more');
  }

  function onStatusPress(name: string) {
    const filter = STATUS_TO_FILTER[name];
    if (filter) openInvoices(filter);
  }

  const lowCount = (data?.lowStockCount ?? 0) + (data?.outOfStockCount ?? 0);
  const saleCount = data?.invoicesCount ?? 0;
  const netOwed = data?.unpaidAmount ?? 0;
  // Khata split mirrors web's ledger model: what we must PAY (advances taken
  // + vendor-side dues) vs what we will RECEIVE (advances given + receivable
  // invoices). The dashboard exposes the real split via receivables/payables.
  const youPay = data?.payables ?? 0;
  const youReceive = data?.receivables ?? 0;
  const payPct = youPay + youReceive > 0 ? (youPay / (youPay + youReceive)) * 100 : 50;

  return (
    <Screen>
      <HomeHeader onScanPress={() => {
        scanningRef.current = false;
        setScanOpen(true);
      }} />
      {error ? (
        <ErrorBox message={error} onRetry={reload} />
      ) : loading || !data ? (
        <Loading />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          {...headerScrollHandlers}>
          {/* Status chips row */}
          <View style={styles.chipRow}>
            <Pressable
              onPress={() => {
                selectionTick();
                goTo('sales');
              }}
              style={({pressed}) => [styles.chip, styles.chipInfo, pressed && styles.pressed]}>
              <View style={[styles.chipDot, {backgroundColor: palette.primary}]} />
              <Text style={styles.chipText} numberOfLines={1}>
                Store Counter Active
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                selectionTick();
                goTo('products');
              }}
              style={({pressed}) => [styles.chip, styles.chipInfo, pressed && styles.pressed]}>
              <Text style={styles.chipText} numberOfLines={1}>
                Cash in Drawer · Bank UPI
              </Text>
            </Pressable>
          </View>
          <View style={styles.chipRow}>
            <Pressable
              onPress={() => openInvoices('all')}
              style={({pressed}) => [styles.chip, styles.chipWarning, pressed && styles.pressed]}>
              <Text style={styles.chipText} numberOfLines={1}>
                Unpaid net revenue · {saleCount} bills
              </Text>
            </Pressable>
            <Pressable
              onPress={() => goTo('products')}
              style={({pressed}) => [styles.chip, styles.chipDanger, pressed && styles.pressed]}>
              <Text style={styles.chipText} numberOfLines={1}>
                Low stock: {lowCount} items
              </Text>
            </Pressable>
          </View>

          {/* Total net revenue hero */}
          <Card style={styles.card} index={0}>
            <View style={styles.revenueHeader}>
              <Text style={styles.revenueLabel}>TOTAL NET REVENUE</Text>
              {delta !== null ? (
                <View style={[styles.deltaBox, {backgroundColor: delta >= 0 ? palette.successSoft : palette.dangerSoft}]}>
                  <Text style={[styles.deltaText, {color: delta >= 0 ? palette.success : palette.danger}]}>
                    ↑ {Math.abs(delta).toFixed(1)}%
                  </Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.revenueValue} numberOfLines={1} adjustsFontSizeToFit>
              {money(data.totalRevenue)}
            </Text>
            <Text style={styles.revenueSub}>
              This mo: <Text style={styles.revenueSubValue}>{money(data.monthlyRevenue)}</Text>
            </Text>

            <View style={styles.chartHeader}>
              <Text style={styles.chartTitle}>6-MONTH PERFORMANCE</Text>
              <Text style={styles.chartRange}>
                {performance.length > 0
                  ? `${performance[0]!.label} - ${performance[performance.length - 1]!.label} ${new Date().getFullYear()}`
                  : ''}
              </Text>
            </View>
            <LineChart data={performance} />
          </Card>

          {/* Stock & sales pulse — live composition charts from the dashboard */}
          <Text style={styles.section}>Stock & Sales Pulse</Text>
          <Card style={styles.card} index={1}>
            <Text style={styles.chartTitle}>STOCK DISTRIBUTION</Text>
            <DonutChart
              segments={(data.stockDistribution ?? []).map((s) => ({name: s.name, value: s.value, color: s.color}))}
              centerSub="SKUs"
              formatValue={(v) => String(Math.round(v))}
              onSegmentPress={() => goTo('products')}
            />
          </Card>
          <Card style={styles.card} index={2}>
            <View style={styles.chartHeader}>
              <Text style={styles.chartTitle}>UNITS SOLD</Text>
              <Text style={styles.chartRange}>
                {(data.soldPerMonth ?? []).reduce((a, b) => a + b.quantity, 0)} pcs / 6 mo
              </Text>
            </View>
            <BarChart
              data={(data.soldPerMonth ?? []).map((m) => ({label: m.month.slice(0, 3), value: m.quantity}))}
              formatValue={(v) => String(Math.round(v))}
              height={rs(140)}
            />
          </Card>

          {/* Quick actions */}
          <View style={styles.quickRow}>
            {(
              [
                {label: 'Record Sale', icon: ShoppingCart, go: () => goTo('sales')},
                {label: 'Add Stock', icon: PackagePlus, go: () => goTo('products')},
                {label: 'New Khata', icon: Users, go: () => goTo('parties')},
                {label: 'Reports', icon: BarChart3, go: () => {
                  useNavStore.getState().openMore('reports');
                  goTo('more');
                }},
              ] as const
            ).map((action, i) => (
              <Pressable
                key={action.label}
                accessibilityRole="button"
                accessibilityLabel={action.label}
                onPress={() => {
                  selectionTick();
                  action.go();
                }}
                style={({pressed}) => [styles.quickBtn, pressed && styles.pressed]}>
                <View style={[styles.quickIcon, i === 0 && {backgroundColor: palette.primary}]}>
                  <action.icon
                    size={rs(18)}
                    color={i === 0 ? palette.onPrimary : palette.primary}
                    strokeWidth={2.2}
                  />
                </View>
                <Text style={styles.quickLabel} numberOfLines={1}>
                  {action.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Khata net position */}
          <Text style={styles.section}>Khata Net Position</Text>
          <Card style={styles.card} index={1}>
            <View style={styles.khataHeader}>
              <View style={{flex: 1}}>
                <Text style={styles.khataTitle}>Merchant Ledger Balance</Text>
              </View>
              <Pressable
                onPress={() => {
                  selectionTick();
                  goTo('parties');
                }}
                style={({pressed}) => [styles.netPill, pressed && styles.pressed]}>
                <Text style={styles.netPillText}>Net Payable</Text>
              </Pressable>
            </View>

            <Text style={styles.khataOwedLabel}>Current Net Owed:</Text>
            <Text style={styles.khataOwedValue} numberOfLines={1} adjustsFontSizeToFit>
              {money(netOwed)}
            </Text>

            {/* Split bar — you pay vs you receive */}
            <View style={styles.splitBar}>
              <View style={[styles.splitPay, {flex: Math.max(0.001, payPct), backgroundColor: palette.danger}]} />
              <View style={[styles.splitReceive, {flex: Math.max(0.001, 100 - payPct), backgroundColor: palette.success}]} />
            </View>
            <View style={styles.splitLegend}>
              <View style={styles.splitLegendItem}>
                <View style={[styles.legendDot, {backgroundColor: palette.danger}]} />
                <Text style={styles.splitLegendText} numberOfLines={1}>You Pay (Karigar/Wholesale)</Text>
              </View>
              <View style={styles.splitLegendItem}>
                <View style={[styles.legendDot, {backgroundColor: palette.success}]} />
                <Text style={styles.splitLegendText} numberOfLines={1}>You Receive (Customer)</Text>
              </View>
            </View>

            <View style={[styles.khataRow, styles.khataRowBorder]}>
              <View style={styles.khataCell}>
                <Text style={styles.khataCellLabel}>You Pay</Text>
                <Text style={[styles.khataCellValue, {color: palette.danger}]}>{money(youPay)}</Text>
                <Text style={styles.khataCellSub}>Vendors & Karigars</Text>
              </View>
              <View style={styles.khataDivider} />
              <View style={styles.khataCell}>
                <Text style={styles.khataCellLabel}>You Receive</Text>
                <Text style={[styles.khataCellValue, {color: palette.success}]}>{money(youReceive)}</Text>
                <Text style={styles.khataCellSub}>Customers & Advances</Text>
              </View>
            </View>
          </Card>

          {/* Recent counter activity */}
          <View style={styles.activityHeader}>
            <Text style={styles.section}>Recent Counter Activity</Text>
            <Pressable
              onPress={() => openInvoices('all')}
              style={({pressed}) => [styles.viewAll, pressed && styles.pressed]}>
              <Text style={styles.viewAllText}>View all</Text>
              <ChevronRight size={rs(14)} color={palette.muted} />
            </Pressable>
          </View>
          {data.recentInvoices.length === 0 ? (
            <Card style={styles.card}>
              <Empty text="No activity yet — record your first sale" />
            </Card>
          ) : (
            data.recentInvoices.slice(0, 4).map((inv, i) => {
              const outstanding = Math.max(0, inv.total - inv.amountPaid);
              const paidFull = outstanding <= 0;
              return (
                <Pressable
                  key={inv.id}
                  onPress={() => {
                    selectionTick();
                    onStatusPress(
                      inv.status === 'PAID' ? 'Paid' : inv.status === 'PARTIAL' ? 'Partial' : 'Unpaid',
                    );
                  }}>
                  <Card style={styles.card} index={i}>
                    <View style={styles.activityRow}>
                      <View style={[styles.activityIcon, {backgroundColor: palette.mutedBg}]}>
                        <Wallet size={rs(16)} color={palette.primary} />
                      </View>
                      <View style={{flex: 1, minWidth: 0}}>
                        <Text style={styles.activityTitle} numberOfLines={1}>
                          {inv.customerName ?? 'Walk-in Customer'}
                        </Text>
                        <Text style={styles.activityMeta} numberOfLines={1}>
                          Invoice {inv.invoiceNumber} · {formatDate(inv.date)}
                        </Text>
                      </View>
                      <View style={{alignItems: 'flex-end', gap: rs(3)}}>
                        <Text style={styles.activityAmount}>+{money(inv.total)}</Text>
                        <Badge
                          text={paidFull ? 'Paid' : inv.status === 'PARTIAL' ? 'Partial' : 'Due'}
                          tone={paidFull ? 'success' : inv.status === 'PARTIAL' ? 'warning' : 'muted'}
                        />
                      </View>
                    </View>
                  </Card>
                </Pressable>
              );
            })
          )}

          {/* Create new bill CTA */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Create new bill or order"
            onPress={() => {
              actionPress();
              goTo('billing');
            }}
            style={({pressed}) => [styles.cta, pressed && styles.ctaPressed]}>
            <Plus size={rs(20)} color={palette.onPrimary} strokeWidth={2.6} />
            <Text style={styles.ctaText}>Create New Bill / Order</Text>
          </Pressable>
        </ScrollView>
      )}

      {/* Scan-to-sell: camera scanner + instant sale dialog */}
      <BarcodeScannerModal visible={scanOpen} onClose={() => setScanOpen(false)} onDetected={handleScanDetected} />
      <QuickSaleSheet product={saleProduct} onClose={() => setSaleProduct(null)} />
    </Screen>
  );
}

const makeStyles = (c: MobileColors) =>
  StyleSheet.create({
    scrollContent: {
      paddingBottom: spacing.xxxl,
    },
    pressed: {opacity: 0.65},
    card: {
      marginHorizontal: CARD_MARGIN,
    },
    /* Status chips */
    chipRow: {
      flexDirection: 'row',
      gap: rs(8),
      marginHorizontal: CARD_MARGIN,
      marginBottom: rs(8),
    },
    chip: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: rs(6),
      borderRadius: radii.full,
      borderWidth: 1,
      paddingHorizontal: rs(10),
      paddingVertical: rs(7),
    },
    chipInfo: {
      backgroundColor: c.mutedBg,
      borderColor: c.border,
    },
    chipWarning: {
      backgroundColor: c.warningSoft,
      borderColor: c.warning,
    },
    chipDanger: {
      backgroundColor: c.dangerSoft,
      borderColor: c.danger,
    },
    chipDot: {
      width: rs(6),
      height: rs(6),
      borderRadius: radii.full,
      flexShrink: 0,
    },
    chipText: {
      fontSize: typography.caption,
      fontWeight: '600',
      color: c.text,
      flexShrink: 1,
    },
    /* Revenue hero */
    revenueHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    revenueLabel: {
      fontSize: typography.label,
      fontWeight: '700',
      letterSpacing: 0.6,
      color: c.muted,
    },
    deltaBox: {
      borderRadius: radii.full,
      paddingHorizontal: rs(8),
      paddingVertical: rs(3),
    },
    deltaText: {
      fontSize: typography.caption,
      fontWeight: '800',
    },
    revenueValue: {
      fontSize: rs(30),
      fontWeight: '800',
      color: c.text,
      marginTop: rs(6),
    },
    revenueSub: {
      fontSize: typography.secondary,
      color: c.muted,
      marginTop: rs(2),
    },
    revenueSubValue: {
      fontWeight: '700',
      color: c.text,
    },
    chartHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: spacing.md,
      marginBottom: rs(8),
    },
    chartTitle: {
      fontSize: typography.caption,
      fontWeight: '700',
      letterSpacing: 0.6,
      color: c.muted,
    },
    chartRange: {
      fontSize: typography.caption,
      color: c.muted,
    },
    /* Quick actions */
    quickRow: {
      flexDirection: 'row',
      gap: rs(8),
      marginHorizontal: CARD_MARGIN,
      marginTop: spacing.md,
    },
    quickBtn: {
      flex: 1,
      alignItems: 'center',
      gap: rs(6),
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: radii.md,
      paddingVertical: rs(12),
    },
    quickIcon: {
      width: rs(38),
      height: rs(38),
      borderRadius: radii.full,
      backgroundColor: c.mutedBg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    quickLabel: {
      fontSize: typography.caption,
      fontWeight: '600',
      color: c.text,
    },
    /* Sections */
    section: {
      fontSize: typography.h3,
      fontWeight: '700',
      color: c.text,
      marginHorizontal: CARD_MARGIN,
      marginTop: spacing.xl,
      marginBottom: spacing.sm,
    },
    /* Khata net position */
    khataHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.md,
    },
    khataTitle: {
      fontSize: typography.secondary,
      fontWeight: '600',
      color: c.muted,
    },
    netPill: {
      borderRadius: radii.full,
      backgroundColor: c.warningSoft,
      paddingHorizontal: rs(10),
      paddingVertical: rs(4),
    },
    netPillText: {
      fontSize: typography.caption,
      fontWeight: '700',
      color: c.warning,
    },
    khataOwedLabel: {
      fontSize: typography.secondary,
      color: c.muted,
    },
    khataOwedValue: {
      fontSize: rs(28),
      fontWeight: '800',
      color: c.danger,
      marginTop: rs(2),
      marginBottom: spacing.md,
    },
    splitBar: {
      flexDirection: 'row',
      height: rs(10),
      borderRadius: radii.full,
      overflow: 'hidden',
      gap: rs(2),
    },
    splitPay: {
      borderRadius: radii.full,
    },
    splitReceive: {
      borderRadius: radii.full,
    },
    splitLegend: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: rs(12),
      marginTop: rs(8),
    },
    splitLegendItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rs(5),
    },
    legendDot: {
      width: rs(7),
      height: rs(7),
      borderRadius: radii.full,
    },
    splitLegendText: {
      fontSize: typography.caption,
      color: c.muted,
      fontWeight: '600',
    },
    khataRow: {
      flexDirection: 'row',
      marginTop: spacing.md,
    },
    khataRowBorder: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.border,
      paddingTop: spacing.md,
    },
    khataCell: {
      flex: 1,
      gap: rs(2),
    },
    khataCellLabel: {
      fontSize: typography.caption,
      color: c.muted,
      fontWeight: '600',
    },
    khataCellValue: {
      fontSize: typography.h2,
      fontWeight: '800',
      color: c.text,
    },
    khataCellSub: {
      fontSize: typography.caption,
      color: c.muted,
    },
    khataDivider: {
      width: StyleSheet.hairlineWidth,
      backgroundColor: c.border,
      marginHorizontal: spacing.md,
    },
    /* Activity */
    activityHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingRight: CARD_MARGIN,
    },
    viewAll: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    viewAllText: {
      fontSize: typography.secondary,
      fontWeight: '600',
      color: c.muted,
    },
    activityRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rs(10),
    },
    activityIcon: {
      width: rs(34),
      height: rs(34),
      borderRadius: radii.full,
      alignItems: 'center',
      justifyContent: 'center',
    },
    activityTitle: {
      fontSize: typography.body,
      fontWeight: '700',
      color: c.text,
    },
    activityMeta: {
      fontSize: typography.caption,
      color: c.muted,
      marginTop: rs(1),
    },
    activityAmount: {
      fontSize: typography.body,
      fontWeight: '800',
      color: c.text,
    },
    /* CTA */
    cta: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: rs(8),
      backgroundColor: c.primary,
      borderRadius: radii.lg,
      minHeight: 52,
      marginHorizontal: CARD_MARGIN,
      marginTop: spacing.xl,
    },
    ctaPressed: {opacity: 0.85},
    ctaText: {
      fontSize: typography.body,
      fontWeight: '700',
      color: c.onPrimary,
    },
  });
