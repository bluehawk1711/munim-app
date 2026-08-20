/**
 * HomeScreen — Munim mobile dashboard.
 *
 * Redesigned with a responsive 2-column grid for stat cards, proper
 * visual hierarchy, and consistent responsive values from ../lib/responsive.
 *
 * Layout:
 *   ┌───────────────┐ ┌───────────────┐
 *   │ Revenue       │ │ This Month    │
 *   │ ₹xxxx         │ │ ₹xxxx         │
 *   └───────────────┘ └───────────────┘
 *   ┌───────────────┐ ┌───────────────┐
 *   │ Receivables   │ │ Payables      │
 *   │ ₹xxxx         │ │ ₹xxxx         │
 *   └───────────────┘ └───────────────┘
 *   ┌───────────────┐ ┌───────────────┐
 *   │ Low Stock     │ │ Unpaid        │
 *   │ xx items      │ │ ₹xxxx         │
 *   └───────────────┘ └───────────────┘
 */

import React from 'react';
import {ScrollView, StyleSheet, Text, View} from 'react-native';
import {formatDate} from '@munim/core';
import {useDashboard, useQueryState} from '@munim/query';
import {money} from '../lib/format';
import {rw, rh, rs, typography, spacing, radii, GRID_GAP, CARD_MARGIN} from '../lib/responsive';
import {Badge, Card, ErrorBox, Header, Loading, Screen, StatBox, colors} from '../components/ui';
import {useThemeStyles} from '../theme';

export function HomeScreen() {
  const styles = useThemeStyles(makeStyles);
  const {data, error, loading, reload} = useQueryState(useDashboard());

  return (
    <Screen>
      <Header title="Munim" subtitle="Dashboard" />
      {error ? (
        <ErrorBox message={error} onRetry={reload} />
      ) : loading || !data ? (
        <Loading />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {/* 2-column stat grid */}
          <View style={styles.grid}>
            <View style={styles.gridRow}>
              <Card style={styles.gridCard} index={0}>
                <Text style={styles.statLabel}>Total revenue</Text>
                <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
                  {money(data.totalRevenue)}
                </Text>
              </Card>
              <Card style={styles.gridCard} index={1}>
                <Text style={styles.statLabel}>This month</Text>
                <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
                  {money(data.monthlyRevenue)}
                </Text>
              </Card>
            </View>
            <View style={styles.gridRow}>
              <Card style={styles.gridCard} index={2}>
                <Text style={styles.statLabel}>Receivables</Text>
                <Text style={[styles.statValue, {color: colors.danger}]} numberOfLines={1} adjustsFontSizeToFit>
                  {money(data.receivables)}
                </Text>
              </Card>
              <Card style={styles.gridCard} index={3}>
                <Text style={styles.statLabel}>Payables</Text>
                <Text style={[styles.statValue, {color: colors.success}]} numberOfLines={1} adjustsFontSizeToFit>
                  {money(data.payables)}
                </Text>
              </Card>
            </View>
            <View style={styles.gridRow}>
              <Card style={styles.gridCard} index={4}>
                <Text style={styles.statLabel}>Low / out of stock</Text>
                <Text
                  style={[styles.statValue, data.lowStockCount > 0 ? {color: colors.warning} : null]}
                  numberOfLines={1}
                  adjustsFontSizeToFit>
                  {data.lowStockCount} / {data.outOfStockCount}
                </Text>
              </Card>
              <Card style={styles.gridCard} index={5}>
                <Text style={styles.statLabel}>Unpaid</Text>
                <Text style={[styles.statValue, {color: colors.warning}]} numberOfLines={1} adjustsFontSizeToFit>
                  {money(data.unpaidAmount)}
                </Text>
              </Card>
            </View>
          </View>

          {/* Recent invoices */}
          <Text style={styles.section}>Recent invoices</Text>
          {data.recentInvoices.length === 0 ? (
            <Card style={{marginHorizontal: CARD_MARGIN}}>
              <Text style={styles.emptyText}>No invoices yet</Text>
            </Card>
          ) : (
            data.recentInvoices.map((inv, i) => (
              <Card key={inv.id} style={{marginHorizontal: CARD_MARGIN}} index={i}>
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

          {/* Top products */}
          <Text style={styles.section}>Top products</Text>
          {data.topProducts.length === 0 ? (
            <Card style={{marginHorizontal: CARD_MARGIN}}>
              <Text style={styles.emptyText}>No sales yet</Text>
            </Card>
          ) : (
            <Card style={{marginHorizontal: CARD_MARGIN}} index={0}>
              {data.topProducts.slice(0, 4).map((p, i) => {
                const max = Math.max(...data.topProducts.map(t => t.revenue), 1);
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

          {/* Invoice status */}
          <Text style={styles.section}>Invoice status</Text>
          <Card style={{marginHorizontal: CARD_MARGIN}} index={0}>
            {data.invoiceStatus.length === 0 ? (
              <Text style={styles.emptyText}>No invoices yet</Text>
            ) : (
              <View style={styles.statusRow}>
                {data.invoiceStatus.map(s => {
                  const toneColor =
                    s.name === 'Paid' ? colors.success : s.name === 'Partial' ? colors.warning : colors.danger;
                  return (
                    <View key={s.name} style={[styles.statusChip, {borderColor: toneColor}]}>
                      <View style={[styles.statusDot, {backgroundColor: toneColor}]} />
                      <Text style={styles.statusText}>{s.name}</Text>
                      <Text style={styles.statusCount}>{s.value}</Text>
                    </View>
                  );
                })}
              </View>
            )}
          </Card>

          {/* Recent advances */}
          <Text style={styles.section}>Recent advances</Text>
          {data.recentAdvances.length === 0 ? (
            <Card style={{marginHorizontal: CARD_MARGIN}}>
              <Text style={styles.emptyText}>No open advances</Text>
            </Card>
          ) : (
            data.recentAdvances.map((adv, i) => (
              <Card key={adv.id} style={{marginHorizontal: CARD_MARGIN}} index={i}>
                <View style={styles.invRow}>
                  <View style={{flex: 1}}>
                    <Text style={styles.invNumber}>{adv.partyName ?? 'Party'}</Text>
                    <Text style={styles.invMeta}>{formatDate(adv.date)}</Text>
                  </View>
                  <Text
                    style={{
                      fontWeight: '700',
                      fontSize: typography.body,
                      color: adv.direction === 'GIVEN' ? colors.danger : colors.success,
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

const makeStyles = () =>
  StyleSheet.create({
    scrollContent: {
      paddingBottom: spacing.xxxl,
    },
    grid: {
      paddingHorizontal: CARD_MARGIN,
      marginBottom: spacing.sm,
    },
    gridRow: {
      flexDirection: 'row',
      gap: GRID_GAP,
      marginBottom: GRID_GAP,
    },
    gridCard: {
      flex: 1,
      marginHorizontal: 0,
      marginBottom: 0,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
    },
    statLabel: {
      fontSize: typography.label,
      color: colors.muted,
      fontWeight: '600',
    },
    statValue: {
      fontSize: typography.valueLarge,
      fontWeight: '700',
      color: colors.text,
      marginTop: rs(4),
    },
    section: {
      fontSize: typography.h3,
      fontWeight: '700',
      color: colors.text,
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
      color: colors.text,
      fontSize: typography.body,
    },
    invMeta: {
      color: colors.muted,
      fontSize: typography.caption,
      marginTop: rs(2),
    },
    invTotal: {
      fontWeight: '700',
      color: colors.text,
      fontSize: typography.body,
    },
    barRow: {
      paddingVertical: spacing.sm,
      gap: rs(6),
    },
    barRowBorder: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    barHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    barName: {
      fontSize: typography.secondary,
      fontWeight: '600',
      color: colors.text,
      flex: 1,
    },
    barMeta: {
      fontSize: typography.caption,
      color: colors.muted,
    },
    barTrack: {
      height: rs(5),
      borderRadius: rs(3),
      backgroundColor: colors.border,
      overflow: 'hidden',
    },
    barFill: {
      height: '100%',
      borderRadius: rs(3),
      backgroundColor: colors.primary,
    },
    statusRow: {
      flexDirection: 'row',
      gap: rs(8),
    },
    statusChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rs(6),
      borderWidth: 1,
      borderRadius: radii.full,
      paddingHorizontal: rs(10),
      paddingVertical: rs(6),
      flex: 1,
      justifyContent: 'center',
    },
    statusDot: {
      width: rs(8),
      height: rs(8),
      borderRadius: rs(4),
    },
    statusText: {
      fontSize: typography.caption,
      color: colors.text,
      fontWeight: '600',
    },
    statusCount: {
      fontSize: typography.caption,
      color: colors.muted,
    },
    emptyText: {
      color: colors.muted,
      fontSize: typography.secondary,
    },
  });
