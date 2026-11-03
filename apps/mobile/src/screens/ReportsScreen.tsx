/**
 * ReportsScreen — Analytics Suite, redesigned to the reference layout.
 *
 * Sections:
 *   HomeHeader ("Reports")
 *   ANALYTICS SUITE eyebrow + subtitle
 *   Report-type pills (Monthly / Daily / Weekly / … )
 *   REPORT WINDOW card — period text, Edit (custom range), Run Report,
 *     Share CSV
 *   Hero tiles — GROSS SALES + EST. PROFIT (with margin), driven by the
 *     shared `getReport` totals
 *   TURNOVER TRAJECTORY — 6-month LineChart from the shared dashboard stats
 *     (sales-type reports only; stock reports skip it)
 *   ITEMIZED RECORDS — per-product cards with revenue, sold/stock, cost
 *     basis, profit (+%); sort by Revenue / Profit / Qty
 *
 * Only real data/features are rendered — no fake deltas, bill counts or
 * print buttons (mobile reports export = Share CSV).
 */

import React, {useDeferredValue, useMemo, useState} from 'react';
import {Pressable, Share, StyleSheet, Text, TextInput, View} from 'react-native';
import {
  BarChart3,
  CalendarRange,
  Search,
  TrendingUp,
} from 'lucide-react-native';
import {
  reportToCsv,
  emptyReportFilterForm,
  toReportFilters,
  countActiveReportFilters,
  hasReportNarrowing,
  formatCurrency,
  formatWeight,
  type ReportFilterFormValues,
  type ReportFilters,
  type ReportRow,
  type ReportType,
} from '@munim/core';
import {useArticles, useCatalog, useDashboard, useParties, useQueryState, useReport} from '@munim/query';
import {money} from '../lib/format';
import {successFeedback, selectionTick} from '../lib/haptics';
import {LineChart} from '../components/charts';
import {Button, Card, Empty, ErrorBox, Loading, Screen, colors} from '../components/ui';
import {ReportFilterSheet, type ReportFilterOptionSets} from '../components/ReportFilterSheet';
import {HomeHeader} from '../components/home-header';
import {ParallaxScrollView} from '../components/ParallaxScrollView';
import {useThemeStyles} from '../theme';
import {rs, spacing, radii, CARD_MARGIN} from '../lib/responsive';

const REPORT_OPTIONS: {key: ReportType; label: string}[] = [
  {key: 'monthly', label: 'Monthly Sales'},
  {key: 'daily', label: 'Daily Sales'},
  {key: 'weekly', label: 'Weekly Sales'},
  {key: 'yearly', label: 'Yearly Sales'},
  {key: 'stock', label: 'Product Stock'},
  {key: 'low_stock', label: 'Low Stock'},
  {key: 'sold', label: 'Sold Products'},
];

const SALES_TYPES: ReportType[] = ['daily', 'weekly', 'monthly', 'yearly', 'sold'];

type SortKey = 'revenue' | 'profit' | 'qty';

/** Client-side row search — matches every facet the report row carries. */
function matchesRow(r: ReportRow, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [
    r.productName,
    r.sku,
    r.articleName,
    r.categoryName,
    r.subCategoryName,
    r.productType,
    r.color,
    r.size,
    r.purity,
    r.goldKarat != null ? `${r.goldKarat}K` : null,
    r.silverPercentage != null ? `${r.silverPercentage}%` : null,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .includes(q);
}

/** Hero figure: ₹ with no decimals (₹17,587) via the shared formatter. */
const heroMoney = (v: number) => formatCurrency(Math.round(v));

export function ReportsScreen() {
  const styles = useThemeStyles(makeStyles);
  const [type, setType] = useState<ReportType>('monthly');
  // One shared filter form (same shape as web/desktop) committed on "Run report".
  const [form, setForm] = useState<ReportFilterFormValues>(emptyReportFilterForm);
  const [active, setActive] = useState<ReportFilters>({type: 'monthly'});
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('revenue');
  const [rowQuery, setRowQuery] = useState('');
  // Defer the filter input so typing never blocks the (possibly long) list.
  const deferredQuery = useDeferredValue(rowQuery);

  const {data: report, loading, error, reload} = useQueryState(useReport(active));
  // Shared dashboard stats power the turnover trajectory (cached by
  // react-query — the Home screen fetches the same data).
  const dashQ = useQueryState(useDashboard());

  // Filter option sources — same masters as the rest of the mobile app.
  const articlesQ = useQueryState(useArticles());
  const colorsQ = useQueryState(useCatalog('color'));
  const sizesQ = useQueryState(useCatalog('size'));
  const categoriesQ = useQueryState(useCatalog('category'));
  const partiesQ = useQueryState(useParties());

  const optionSets: ReportFilterOptionSets = {
    articles: articlesQ.data ?? [],
    categories: categoriesQ.data ?? [],
    colors: colorsQ.data ?? [],
    sizes: sizesQ.data ?? [],
    parties: partiesQ.data ?? [],
  };

  const activeFilterCount = countActiveReportFilters(form);

  const isSalesType = SALES_TYPES.includes(active.type);
  // Dashboard charts are shop-wide and cannot honour narrowing facets.
  const narrowing = hasReportNarrowing(active);

  function runReport() {
    setActive(toReportFilters(type, form));
    setFilterOpen(false);
  }

  /** Sheet "Run report" — commits the sheet's draft in one go. */
  function applyFilters(next: ReportFilterFormValues) {
    setForm(next);
    setActive(toReportFilters(type, next));
    setFilterOpen(false);
  }

  async function handleShareCsv() {
    if (!report || report.rows.length === 0) {
      return;
    }
    const csv = reportToCsv(report);
    const summary = report.rows.length > 0
      ? `Totals — Revenue ${money(report.totals.revenue)} · Profit ${money(report.totals.profit)} · ${report.totals.soldQuantity} items sold`
      : '';
    try {
      await Share.share({
        title: `${report.title}.csv`,
        message: `${report.title}\n${report.periodLabel}\n\n${csv}\n${summary}`,
      });
      successFeedback(`${report.title} exported`);
    } catch {
      // user dismissed the share sheet — nothing to do
    }
  }

  // Trajectory data + peak month (sales-type reports only).
  const trajectory = useMemo(
    () =>
      (dashQ.data?.monthlySales ?? []).map(m => ({label: m.month.slice(0, 3), value: m.revenue})),
    [dashQ.data],
  );
  const peak = useMemo(() => {
    if (trajectory.length === 0) return null;
    return trajectory.reduce((best, cur) => (cur.value > best.value ? cur : best));
  }, [trajectory]);

  // Sorted + row-search-filtered itemized records (API returns revenue-desc).
  // `deferredQuery` keeps the search box responsive on long reports.
  const rows = useMemo(() => {
    const list = (report?.rows ?? []).filter(r => matchesRow(r, deferredQuery));
    if (sortKey === 'profit') list.sort((a, b) => b.profit - a.profit);
    else if (sortKey === 'qty') list.sort((a, b) => b.soldQuantity - a.soldQuantity);
    return list;
  }, [report, sortKey, deferredQuery]);

  // Day-wise Daily Sales — core fills `days` for the daily report only; the
  // flat list stays for every other type. The row search narrows day rows too.
  const dayGroups = useMemo(() => {
    if (!report?.days?.length) return null;
    if (!deferredQuery.trim()) return report.days;
    return report.days
      .map(d => ({...d, rows: d.rows.filter(r => matchesRow(r, deferredQuery))}))
      .filter(d => d.rows.length > 0);
  }, [report, deferredQuery]);

  const margin =
    report && report.totals.revenue > 0
      ? (report.totals.profit / report.totals.revenue) * 100
      : 0;

  // Window caption: custom range when set, else the report's period label.
  const windowText = report?.periodLabel ?? '—';

  return (
    <Screen>
      <HomeHeader title="Reports" />

      <ParallaxScrollView
        headerHeight={rs(150)}
        collapsedHeaderHeight={0}
        contentContainerStyle={{paddingBottom: 110}}
        header={
          <>
            <Text style={styles.eyebrow}>ANALYTICS SUITE</Text>
            <Text style={styles.lead}>Sales, stock & profit insights</Text>

            {/* Report type pills */}
            <View style={styles.typeWrap}>
              {REPORT_OPTIONS.map(opt => {
                const selected = type === opt.key;
                return (
                  <PressablePill
                    key={opt.key}
                    label={opt.label}
                    selected={selected}
                    onPress={() => {
                      selectionTick();
                      setType(opt.key);
                    }}
                  />
                );
              })}
            </View>
          </>
        }>

        {/* Report window + filters card */}
        <Card index={0} style={styles.windowCard}>
          <View style={styles.windowRow}>
            <View style={styles.windowIcon}>
              <CalendarRange size={rs(15)} color={colors.primary} strokeWidth={2.2} />
            </View>
            <View style={{flex: 1}}>
              <Text style={styles.windowLabel}>REPORT WINDOW</Text>
              <Text style={styles.windowValue} numberOfLines={1}>
                {windowText}
              </Text>
            </View>
            <Button
              title={activeFilterCount > 0 ? `Filters · ${activeFilterCount}` : 'Filters'}
              variant="outline"
              size="small"
              onPress={() => setFilterOpen(true)}
              style={styles.editBtn}
            />
          </View>

          <View style={styles.actionRow}>
            <Button
              title="Run Report"
              onPress={runReport}
              loading={loading}
              style={styles.actionGrow}
            />
            <Button
              title="Share CSV"
              variant="outline"
              disabled={!report || report.rows.length === 0}
              onPress={handleShareCsv}
              style={styles.actionGrow}
            />
          </View>
        </Card>

        {error ? (
          <ErrorBox message={error} onRetry={reload} />
        ) : loading || !report ? (
          <Loading />
        ) : (
          <>
            {/* Hero tiles */}
            <View style={styles.heroRow}>
              <Card index={1} style={styles.heroCard}>
                <View style={styles.heroTop}>
                  <Text style={styles.heroLabel}>GROSS SALES</Text>
                  <View style={styles.heroIcon}>
                    <BarChart3 size={rs(13)} color={colors.muted} strokeWidth={2.2} />
                  </View>
                </View>
                <Text style={styles.heroValue} numberOfLines={1} adjustsFontSizeToFit>
                  {heroMoney(report.totals.revenue)}
                </Text>
                <Text style={styles.heroSub}>
                  {report.totals.soldQuantity} units sold
                  {(report.totals.weightSoldGm ?? 0) > 0
                    ? ` · ${formatWeight(report.totals.weightSoldGm)}`
                    : ''}
                </Text>
              </Card>
              <Card index={2} style={styles.heroCard}>
                <View style={styles.heroTop}>
                  <Text style={styles.heroLabel}>EST. PROFIT</Text>
                  <View style={styles.heroIcon}>
                    <TrendingUp size={rs(13)} color={colors.success} strokeWidth={2.2} />
                  </View>
                </View>
                <Text style={styles.heroValue} numberOfLines={1} adjustsFontSizeToFit>
                  {heroMoney(report.totals.profit)}
                </Text>
                <Text
                  style={[
                    styles.heroSub,
                    {color: report.totals.profit < 0 ? colors.danger : colors.success, fontWeight: '700'},
                  ]}>
                  {margin.toFixed(1)}% margin
                </Text>
              </Card>
            </View>

            {/* Turnover trajectory (sales reports only). Hidden while a
                narrowing filter is applied — this chart is shop-wide. */}
            {isSalesType && !narrowing && trajectory.length > 0 ? (
              <Card index={3} style={styles.chartCard}>
                <View style={styles.chartHeader}>
                  <Text style={styles.chartTitle}>TURNOVER TRAJECTORY</Text>
                  {peak && peak.value > 0 ? (
                    <Text style={styles.chartRange} numberOfLines={1}>
                      Peak · {peak.label}
                    </Text>
                  ) : null}
                </View>
                <LineChart data={trajectory} />
              </Card>
            ) : null}

            {/* Row search — client-side over the loaded report rows. */}
            <View style={styles.rowSearch}>
              <Search size={rs(15)} color={colors.muted} strokeWidth={2.2} />
              <TextInput
                value={rowQuery}
                onChangeText={setRowQuery}
                placeholder="Search this report — product, SKU, article…"
                placeholderTextColor={colors.inputPlaceholder}
                style={styles.rowSearchInput}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
              />
            </View>

            {/* Itemized records — day-wise Daily Sales shows one section per
                DATE with that day's products + takings; other types keep the
                flat sortable list. */}
            {dayGroups ? (
              dayGroups.length === 0 ? (
                <Empty text="No rows match your search" />
              ) : (
                dayGroups.map((d, di) => (
                  <View key={d.day}>
                    <View style={styles.dayHeader}>
                      <View style={{flex: 1, paddingRight: 8}}>
                        <Text style={styles.sectionTitle}>{d.label}</Text>
                        <Text style={styles.sectionCount}>
                          {d.invoices} invoice{d.invoices !== 1 ? 's' : ''} ·{' '}
                          {d.daySoldQuantity} sold
                        </Text>
                      </View>
                      <Text style={styles.dayRevenue}>{money(d.dayRevenue)}</Text>
                    </View>
                    {d.rows.length === 0 ? (
                      <Empty text="No sales this day" />
                    ) : (
                      d.rows.map((r, i) => (
                        <RecordCard key={`${d.day}-${r.sku ?? 'n'}-${i}`} r={r} index={di * 100 + i} />
                      ))
                    )}
                  </View>
                ))
              )
            ) : (
              <>
            <View style={styles.sectionRow}>
              <Text style={styles.sectionTitle}>Itemized Records</Text>
              <Text style={styles.sectionCount}>{rows.length} Products</Text>
            </View>
            <View style={styles.sortRow}>
              {(
                [
                  {key: 'revenue', label: 'Revenue'},
                  {key: 'profit', label: 'Profit'},
                  {key: 'qty', label: 'Qty sold'},
                ] as {key: SortKey; label: string}[]
              ).map(opt => (
                <PressablePill
                  key={opt.key}
                  label={opt.label}
                  selected={sortKey === opt.key}
                  onPress={() => {
                    selectionTick();
                    setSortKey(opt.key);
                  }}
                />
              ))}
            </View>

            {rows.length === 0 ? (
              <Empty
                text={
                  rowQuery.trim()
                    ? 'No rows match your search'
                    : 'No data for this report in the selected period'
                }
              />
            ) : (
              rows.map((r, i) => (
                <RecordCard key={`${r.productId ?? 'x'}-${i}`} r={r} index={i} />
              ))
            )}
              </>
            )}

            {/* Totals strip */}
            {report.rows.length > 0 ? (
              <Card index={99} style={styles.totalsCard}>
                <View style={styles.totalsRow}>
                  <Text style={styles.totalsLabel}>Total revenue</Text>
                  <Text style={styles.totalsValue}>{money(report.totals.revenue)}</Text>
                </View>
                <View style={styles.totalsRow}>
                  <Text style={styles.totalsLabel}>Total profit</Text>
                  <Text style={styles.totalsValue}>{money(report.totals.profit)}</Text>
                </View>
                <View style={styles.totalsRow}>
                  <Text style={styles.totalsLabel}>Items sold</Text>
                  <Text style={styles.totalsValue}>{report.totals.soldQuantity}</Text>
                </View>
                {(report.totals.weightSoldGm ?? 0) > 0 ? (
                  <View style={styles.totalsRow}>
                    <Text style={styles.totalsLabel}>Weight sold</Text>
                    <Text style={styles.totalsValue}>{formatWeight(report.totals.weightSoldGm)}</Text>
                  </View>
                ) : null}
                {(report.totals.materialReceivedGm ?? 0) > 0 ||
                (report.totals.materialReceivedValue ?? 0) > 0 ? (
                  <View style={styles.totalsRow}>
                    <Text style={styles.totalsLabel}>Material received</Text>
                    <Text style={styles.totalsValue}>
                      {(report.totals.materialReceivedGm ?? 0) > 0
                        ? `${formatWeight(report.totals.materialReceivedGm)} · `
                        : ''}
                      ₹{money(report.totals.materialReceivedValue ?? 0)}
                    </Text>
                  </View>
                ) : null}
              </Card>
            ) : null}
          </>
        )}
      </ParallaxScrollView>

      {/* Outside the scroll view so the Gorhom sheet can overlay the screen. */}
      <ReportFilterSheet
        visible={filterOpen}
        onClose={() => setFilterOpen(false)}
        value={form}
        options={optionSets}
        onApply={applyFilters}
        busy={loading}
      />
    </Screen>
  );
}

/* ─── Itemized record card (flat list + per-day Daily Sales) ─────────── */

const RecordCard = React.memo(function RecordCard({
  r,
  index,
}: {
  r: ReportRow;
  index: number;
}) {
  const styles = useThemeStyles(makeStyles);
  const marginPct = r.revenue > 0 ? Math.round((r.profit / r.revenue) * 100) : 0;
  const avgPerUnit = r.soldQuantity > 0 ? Math.round(r.revenue / r.soldQuantity) : null;
  return (
    <Card index={index} style={styles.recordCard}>
      <View style={styles.recordTop}>
        <View style={styles.recordMain}>
          <Text style={styles.recordName} numberOfLines={1}>
            {r.productName}
          </Text>
          <Text style={styles.recordMeta} numberOfLines={1}>
            {[
              r.articleName || null,
              r.categoryName || null,
              r.subCategoryName || null,
              r.productType || null,
              r.color || null,
              r.size || null,
              r.weight != null ? formatWeight(r.weight, r.weightUnit) : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        </View>
        <Text style={styles.recordRevenue}>{formatCurrency(r.revenue)}</Text>
      </View>

      <View style={styles.recordMid}>
        <Text style={styles.recordSold}>
          {r.soldQuantity} sold ·{' '}
          {r.stock <= 0 ? (
            <Text style={{color: colors.danger, fontWeight: '700'}}>0 in stock</Text>
          ) : (
            `${r.stock} in stock`
          )}
        </Text>
        {avgPerUnit != null ? (
          <Text style={styles.recordAvg}>Avg {formatCurrency(avgPerUnit)} / pc</Text>
        ) : null}
      </View>

      <View style={styles.recordBottom}>
        <Text style={styles.recordCost}>
          Cost basis {formatCurrency(r.revenue - r.profit)}
        </Text>
        <Text
          style={[
            styles.recordProfit,
            {color: r.profit < 0 ? colors.danger : colors.success},
          ]}>
          {r.profit < 0
            ? `Profit ${formatCurrency(r.profit)}`
            : `Profit +${formatCurrency(r.profit)}`}{' '}
          ({marginPct}%)
        </Text>
      </View>
    </Card>
  );
});

/* ─── Pill (report type / sort selector) ─────────────────────────────── */

function PressablePill({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const styles = useThemeStyles(makeStyles);
  return (
    <Pressable
      onPress={onPress}
      hitSlop={4}
      style={({pressed}) => [styles.pill, selected && styles.pillSelected, pressed && {opacity: 0.75}]}>
      <Text style={[styles.pillText, selected && styles.pillTextSelected]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const makeStyles = () =>
  StyleSheet.create({
    eyebrow: {
      fontSize: rs(11),
      fontWeight: '800',
      letterSpacing: 0.8,
      color: colors.primary,
      paddingHorizontal: CARD_MARGIN,
    },
    lead: {
      fontSize: rs(13),
      color: colors.muted,
      marginTop: rs(2),
      marginBottom: spacing.sm,
      paddingHorizontal: CARD_MARGIN,
    },
    typeWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: rs(6),
      marginBottom: spacing.sm,
      paddingHorizontal: CARD_MARGIN,
    },
    pill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rs(3),
      borderRadius: radii.full,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      paddingHorizontal: rs(10),
      paddingVertical: rs(5),
      minHeight: rs(30),
    },
    pillSelected: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    pillText: {
      fontSize: rs(11.5),
      fontWeight: '700',
      color: colors.muted,
    },
    pillTextSelected: {color: colors.onPrimary},
    windowCard: {marginBottom: spacing.sm},
    windowRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rs(9),
    },
    windowIcon: {
      width: rs(30),
      height: rs(30),
      borderRadius: radii.sm,
      backgroundColor: colors.accent,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    windowLabel: {
      fontSize: rs(9.5),
      fontWeight: '800',
      letterSpacing: 0.8,
      color: colors.muted,
    },
    windowValue: {
      fontSize: rs(15),
      fontWeight: '800',
      color: colors.text,
      marginTop: rs(1),
    },
    windowEditor: {marginTop: spacing.sm},
    quickRangeRow: {
      flexDirection: 'row' as const,
      flexWrap: 'wrap' as const,
      alignItems: 'center' as const,
      gap: rs(6),
      marginBottom: spacing.sm,
    },
    quickRangeLabel: {fontSize: 11, fontWeight: '700' as const, color: colors.muted},
    quickRangeChip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    quickRangeChipText: {fontSize: 11, fontWeight: '600', color: colors.muted},
    editBtn: {
      minWidth: rs(84),
      paddingHorizontal: rs(18),
      marginLeft: rs(4),
    },
    actionRow: {
      flexDirection: 'row',
      gap: rs(8),
      marginTop: spacing.md,
    },
    actionGrow: {flex: 1},
    heroRow: {
      flexDirection: 'row',
      gap: rs(8),
      marginBottom: spacing.sm,
    },
    heroCard: {flex: 1},
    heroTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    heroLabel: {
      fontSize: rs(9.5),
      fontWeight: '800',
      letterSpacing: 0.8,
      color: colors.muted,
    },
    heroIcon: {
      width: rs(22),
      height: rs(22),
      borderRadius: radii.full,
      backgroundColor: colors.mutedSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    heroValue: {
      fontSize: rs(21),
      fontWeight: '800',
      color: colors.text,
      marginTop: rs(4),
    },
    heroSub: {
      fontSize: rs(10.5),
      color: colors.muted,
      marginTop: rs(2),
    },
    chartCard: {marginBottom: spacing.sm},
    chartHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: rs(4),
    },
    chartTitle: {
      fontSize: rs(10),
      fontWeight: '800',
      letterSpacing: 0.8,
      color: colors.muted,
    },
    chartRange: {
      fontSize: rs(10.5),
      fontWeight: '700',
      color: colors.primary,
    },
    sectionRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      marginTop: spacing.xs,
      marginBottom: rs(6),
      paddingHorizontal: CARD_MARGIN,
    },
    sectionTitle: {
      fontSize: rs(16),
      fontWeight: '800',
      color: colors.text,
    },
    sectionCount: {
      fontSize: rs(11),
      fontWeight: '700',
      color: colors.muted,
    },
    // Day-wise Daily Sales — one header per date (label + takings)
    dayHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: spacing.sm,
      marginBottom: rs(6),
      paddingHorizontal: CARD_MARGIN,
    },
    dayRevenue: {
      fontSize: rs(14),
      fontWeight: '800',
      color: colors.success,
    },
    sortRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: rs(6),
      marginBottom: spacing.sm,
      paddingHorizontal: CARD_MARGIN,
    },
    // Row search — client-side filter over the loaded report rows.
    rowSearch: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rs(8),
      marginHorizontal: CARD_MARGIN,
      marginBottom: spacing.sm,
      paddingHorizontal: rs(12),
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      minHeight: rs(42),
    },
    rowSearchInput: {
      flex: 1,
      fontSize: rs(13),
      color: colors.text,
      paddingVertical: rs(9),
    },
    recordCard: {marginBottom: spacing.sm},
    recordTop: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: rs(10),
    },
    recordMain: {flex: 1, minWidth: 0},
    recordName: {
      fontSize: rs(14.5),
      fontWeight: '700',
      color: colors.text,
    },
    recordMeta: {
      fontSize: rs(11),
      color: colors.muted,
      marginTop: rs(2),
    },
    recordRevenue: {
      fontSize: rs(15),
      fontWeight: '800',
      color: colors.primary,
    },
    recordMid: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: rs(7),
    },
    recordSold: {
      fontSize: rs(12),
      fontWeight: '600',
      color: colors.text,
    },
    recordAvg: {
      fontSize: rs(10.5),
      color: colors.muted,
    },
    recordBottom: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: rs(5),
      gap: rs(8),
    },
    recordCost: {
      fontSize: rs(10.5),
      color: colors.muted,
      flexShrink: 1,
    },
    recordProfit: {
      fontSize: rs(11),
      fontWeight: '800',
      textAlign: 'right',
    },
    totalsCard: {marginTop: spacing.xs},
    totalsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: rs(3),
    },
    totalsLabel: {
      fontSize: rs(12),
      fontWeight: '600',
      color: colors.muted,
    },
    totalsValue: {
      fontSize: rs(15),
      fontWeight: '800',
      color: colors.text,
    },
  });
