/**
 * HomeScreen — Munim mobile dashboard.
 *
 * Dynamic charts (react-native-svg) replace the old text-only stat grid:
 *   Revenue (6-mo bars) + KPI chips → deep-link to Stock / Invoices
 *   Ledger donut (receivables vs payables)      — real split from core
 *   Sales by category donut, Invoice status donut (tappable → filtered list)
 *   Stock distribution donut, Units sold bar chart
 *   Top products, recent invoices & advances
 *
 * Chart colors use semantic/theme tokens (chart1..chart5 + status colors) so
 * they follow the accent theme AND stay legible in dark mode. No hardcoded
 * grays or CSS-variable strings (those can't render on React Native).
 */

import React from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {formatDate} from '@munim/core';
import {useDashboard, useQueryState} from '@munim/query';
import {money} from '../lib/format';
import {rs, typography, spacing, radii, CARD_MARGIN} from '../lib/responsive';
import {Badge, Card, ErrorBox, Header, Loading, Screen} from '../components/ui';
import {BarChart, DonutChart, chartColors, type DonutSegment} from '../components/charts';
import {useTheme, useThemeStyles} from '../theme';
import {useAppStore} from '../lib/store';
import {useNavStore, type InvoiceStatusFilter} from '../lib/nav-store';
import type {MobileColors} from '@munim/theme';

/** Server status label → invoice status filter (for deep-linking). */
const STATUS_TO_FILTER: Record<string, InvoiceStatusFilter> = {
  Paid: 'PAID',
  Partial: 'PARTIAL',
  Unpaid: 'UNPAID',
  Draft: 'DRAFT',
};

export function HomeScreen() {
  const styles = useThemeStyles(makeStyles);
  const {colors: palette} = useTheme();
  const {data, error, loading, reload} = useQueryState(useDashboard());

  const chartPalette = chartColors(palette);

  const barData = (data?.monthlySales ?? []).map((m) => ({
    label: m.month.slice(0, 3),
    value: m.revenue,
  }));

  const soldPerMonth = (data?.soldPerMonth ?? []).map((m) => ({
    label: m.month.slice(0, 3),
    value: m.quantity,
  }));

  const categorySegments: DonutSegment[] = (data?.salesByCategory ?? []).map((s, i) => ({
    name: s.name,
    value: s.value,
    color: chartPalette[i % chartPalette.length]!,
  }));

  // Distinct semantic colors per invoice status (Paid/Partial/Unpaid/Draft).
  const statusSegments: DonutSegment[] = (data?.invoiceStatus ?? [])
    .map((s) => ({
      name: s.name,
      value: s.value,
      color:
        s.name === 'Paid'
          ? palette.success
          : s.name === 'Partial'
            ? palette.warning
            : s.name === 'Unpaid'
              ? palette.danger
              : palette.muted,
    }))
    .filter((s, i, arr) => arr.findIndex(x => x.name === s.name) === i);

  // Stock distribution (counts) — In Stock / Low / Out.
  const stockSegments: DonutSegment[] = (data?.stockDistribution ?? [])
    .map(s => ({
      name: s.name,
      value: s.value,
      color:
        s.name === 'In Stock'
          ? palette.success
          : s.name === 'Low Stock'
            ? palette.warning
            : s.name === 'Out of Stock'
              ? palette.danger
              : palette.muted,
    }))
    .filter(s => s.value > 0);

  // Real ledger split: receivables (customers owe us + advances given) vs
  // payables (advances we took) — computed in core's getDashboard.
  const ledgerSegments: DonutSegment[] = [
    ...(data && data.receivables > 0
      ? [{name: 'Receivables', value: data.receivables, color: palette.success}]
      : []),
    ...(data && data.payables > 0
      ? [{name: 'Payables', value: data.payables, color: palette.danger}]
      : []),
  ];

  /** Deep-link: switch to the given tab (from Home). */
  function goTo(tab: 'products' | 'more') {
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

  return (
    <Screen>
      <Header title="Munim" subtitle="Dashboard" size="large" />
      {error ? (
        <ErrorBox message={error} onRetry={reload} />
      ) : loading || !data ? (
        <Loading />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {/* Revenue + 6-month bar chart */}
          <Card style={styles.card} index={0}>
            <View style={styles.revenueHeader}>
              <View>
                <Text style={styles.statLabel}>Total revenue</Text>
                <Text style={styles.revenueValue} numberOfLines={1} adjustsFontSizeToFit>
                  {money(data.totalRevenue)}
                </Text>
              </View>
              <View style={styles.monthBox}>
                <Text style={styles.monthBoxLabel}>This month</Text>
                <Text style={styles.monthBoxValue} numberOfLines={1} adjustsFontSizeToFit>
                  {money(data.monthlyRevenue)}
                </Text>
              </View>
            </View>

            <Text style={styles.chartTitle}>Revenue · last 6 months</Text>
            <BarChart data={barData} />

            {/* Tappable KPI chips */}
            <View style={styles.chipRow}>
              <Pressable
                onPress={() => openInvoices('UNPAID')}
                style={({pressed}) => [styles.chip, {borderColor: palette.warning}, pressed && styles.chipPressed]}>
                <View style={[styles.chipDot, {backgroundColor: palette.warning}]} />
                <Text style={styles.chipLabel} numberOfLines={1}>Unpaid</Text>
                <Text style={[styles.chipValue, {color: palette.warning}]} numberOfLines={1}>
                  {money(data.unpaidAmount)}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => goTo('products')}
                style={({pressed}) => [styles.chip, {borderColor: palette.danger}, pressed && styles.chipPressed]}>
                <View style={[styles.chipDot, {backgroundColor: palette.danger}]} />
                <Text style={styles.chipLabel} numberOfLines={1}>Low / out</Text>
                <Text style={[styles.chipValue, {color: palette.danger}]} numberOfLines={1}>
                  {data.lowStockCount} / {data.outOfStockCount}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => openInvoices('all')}
                style={({pressed}) => [styles.chip, {borderColor: palette.primary}, pressed && styles.chipPressed]}>
                <View style={[styles.chipDot, {backgroundColor: palette.primary}]} />
                <Text style={styles.chipLabel} numberOfLines={1}>Sales</Text>
                <Text style={[styles.chipValue, {color: palette.primary}]} numberOfLines={1}>
                  {data.invoicesCount}
                </Text>
              </Pressable>
            </View>
          </Card>

          {/* Ledger — receivables vs payables */}
          <Text style={styles.section}>Ledger</Text>
          <Card style={styles.card} index={1}>
            {ledgerSegments.length === 0 ? (
              <Text style={styles.emptyText}>No open receivables or payables</Text>
            ) : (
              <DonutChart segments={ledgerSegments} centerSub="net position" />
            )}
          </Card>

          {/* Sales by category */}
          <Text style={styles.section}>Sales by category</Text>
          <Card style={styles.card} index={2}>
            {categorySegments.length === 0 ? (
              <Text style={styles.emptyText}>No sales yet</Text>
            ) : (
              <DonutChart segments={categorySegments} centerSub="by category" />
            )}
          </Card>

          {/* Invoice status — tappable legend → filtered invoice list */}
          <Text style={styles.section}>Invoice status</Text>
          <Card style={styles.card} index={3}>
            {statusSegments.length === 0 ? (
              <Text style={styles.emptyText}>No invoices yet</Text>
            ) : (
              <DonutChart
                segments={statusSegments}
                centerSub="invoices · tap to open"
                formatValue={(v) => String(v)}
                onSegmentPress={onStatusPress}
              />
            )}
          </Card>

          {/* Stock distribution */}
          <Text style={styles.section}>Stock distribution</Text>
          <Card style={styles.card} index={4}>
            {stockSegments.length === 0 ? (
              <Text style={styles.emptyText}>No products yet</Text>
            ) : (
              <DonutChart
                segments={stockSegments}
                centerSub="products"
                formatValue={(v) => String(v)}
              />
            )}
          </Card>

          {/* Units sold per month */}
          <Text style={styles.section}>Units sold · last 6 months</Text>
          <Card style={styles.card} index={5}>
            <BarChart data={soldPerMonth} formatValue={(v) => String(v)} />
          </Card>

          {/* Top products */}
          <Text style={styles.section}>Top products</Text>
          {data.topProducts.length === 0 ? (
            <Card style={styles.card} index={0}>
              <Text style={styles.emptyText}>No sales yet</Text>
            </Card>
          ) : (
            <Card style={styles.card} index={6}>
              {data.topProducts.slice(0, 4).map((p, i) => {
                const max = Math.max(...data.topProducts.map((t) => t.revenue), 1);
                const pct = Math.max(4, Math.min(100, (p.revenue / max) * 100));
                return (
                  <View key={p.productName + (p.sku ?? '')} style={[styles.barRow, i > 0 && styles.barRowBorder]}>
                    <View style={styles.barHeader}>
                      <Text style={styles.barName} numberOfLines={1}>
                        {p.productName}
                      </Text>
                      <Text style={styles.barMeta}>
                        {p.quantitySold} sold · {money(p.revenue)}
                      </Text>
                    </View>
                    <View style={styles.barTrack}>
                      <View style={[styles.barFill, {width: `${pct}%`}]} />
                    </View>
                  </View>
                );
              })}
            </Card>
          )}

          {/* Recent invoices */}
          <Text style={styles.section}>Recent invoices</Text>
          {data.recentInvoices.length === 0 ? (
            <Card style={styles.card}>
              <Text style={styles.emptyText}>No invoices yet</Text>
            </Card>
          ) : (
            data.recentInvoices.map((inv, i) => (
              <Card key={inv.id} style={styles.card} index={i}>
                <View style={styles.invRow}>
                  <View style={{flex: 1}}>
                    <Text style={styles.invNumber}>{inv.invoiceNumber}</Text>
                    <Text style={styles.invMeta}>
                      {inv.customerName ?? 'Walk-in'} · {formatDate(inv.date)}
                    </Text>
                  </View>
                  <View style={{alignItems: 'flex-end', gap: rs(4)}}>
                    <Text style={styles.invTotal}>{money(inv.total)}</Text>
                    <Badge
                      text={inv.status}
                      tone={inv.status === 'PAID' ? 'success' : inv.status === 'PARTIAL' ? 'warning' : 'muted'}
                    />
                  </View>
                </View>
              </Card>
            ))
          )}

          {/* Recent advances */}
          <Text style={styles.section}>Recent advances</Text>
          {data.recentAdvances.length === 0 ? (
            <Card style={styles.card}>
              <Text style={styles.emptyText}>No open advances</Text>
            </Card>
          ) : (
            data.recentAdvances.map((adv, i) => (
              <Card key={adv.id} style={styles.card} index={i}>
                <View style={styles.invRow}>
                  <View style={{flex: 1}}>
                    <Text style={styles.invNumber}>{adv.partyName ?? 'Party'}</Text>
                    <Text style={styles.invMeta}>{formatDate(adv.date)}</Text>
                  </View>
                  <Text
                    style={{
                      fontWeight: '700',
                      fontSize: typography.body,
                      color: adv.direction === 'GIVEN' ? palette.danger : palette.success,
                    }}>
                    {adv.direction === 'GIVEN' ? 'Given ' : 'Taken '}
                    {money(adv.amount)}
                  </Text>
                </View>
              </Card>
            ))
          )}
        </ScrollView>
      )}
    </Screen>
  );
}

const makeStyles = (c: MobileColors) =>
  StyleSheet.create({
    scrollContent: {
      paddingBottom: spacing.xxxl,
    },
    card: {
      marginHorizontal: CARD_MARGIN,
    },
    revenueHeader: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      marginBottom: spacing.md,
    },
    statLabel: {
      fontSize: typography.label,
      color: c.muted,
      fontWeight: '600',
    },
    revenueValue: {
      fontSize: typography.valueLarge,
      fontWeight: '700',
      color: c.text,
      marginTop: rs(2),
    },
    monthBox: {
      alignItems: 'flex-end',
    },
    monthBoxLabel: {
      fontSize: typography.caption,
      color: c.muted,
      fontWeight: '600',
    },
    monthBoxValue: {
      fontSize: typography.h3,
      fontWeight: '700',
      color: c.primary,
      marginTop: rs(2),
    },
    chartTitle: {
      fontSize: typography.secondary,
      fontWeight: '600',
      color: c.text,
      marginBottom: rs(10),
    },
    chipRow: {
      flexDirection: 'row',
      gap: rs(8),
      marginTop: spacing.md,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rs(5),
      borderWidth: 1,
      borderRadius: radii.full,
      paddingHorizontal: rs(9),
      paddingVertical: rs(5),
      flex: 1,
      flexWrap: 'nowrap',
    },
    chipPressed: {opacity: 0.6},
    chipDot: {
      width: rs(6),
      height: rs(6),
      borderRadius: radii.full,
      flexShrink: 0,
    },
    chipLabel: {
      fontSize: typography.caption,
      color: c.muted,
      fontWeight: '600',
      flexShrink: 0,
    },
    chipValue: {
      fontSize: typography.caption,
      fontWeight: '700',
      flexShrink: 1,
    },
    section: {
      fontSize: typography.h3,
      fontWeight: '700',
      color: c.text,
      marginHorizontal: CARD_MARGIN,
      marginTop: spacing.xl,
      marginBottom: spacing.sm,
    },
    invRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    invNumber: {
      fontWeight: '600',
      color: c.text,
      fontSize: typography.body,
    },
    invMeta: {
      color: c.muted,
      fontSize: typography.caption,
      marginTop: rs(2),
    },
    invTotal: {
      fontWeight: '700',
      color: c.text,
      fontSize: typography.body,
    },
    barRow: {
      paddingVertical: spacing.sm,
      gap: rs(6),
    },
    barRowBorder: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.border,
    },
    barHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    barName: {
      fontSize: typography.secondary,
      fontWeight: '600',
      color: c.text,
      flex: 1,
    },
    barMeta: {
      fontSize: typography.caption,
      color: c.muted,
    },
    barTrack: {
      height: rs(5),
      borderRadius: rs(3),
      backgroundColor: c.border,
      overflow: 'hidden',
    },
    barFill: {
      height: '100%',
      borderRadius: rs(3),
      backgroundColor: c.primary,
    },
    emptyText: {
      color: c.muted,
      fontSize: typography.secondary,
    },
  });