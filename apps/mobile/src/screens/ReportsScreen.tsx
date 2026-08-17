import React, {useState} from 'react';
import {ScrollView, Share, StyleSheet, Text, View} from 'react-native';
import {reportToCsv, formatWeight, type ReportType} from '@munim/core';
import {getApi} from '../lib/api';
import {useAsync} from '../lib/use-async';
import {money} from '../lib/format';
import {Button, Card, Empty, ErrorBox, Header, Loading, Screen, Section, colors} from '../components/ui';
import {DateField} from '../components/date-field';
import {useThemeStyles} from '../theme';

const REPORT_OPTIONS: {key: ReportType; label: string}[] = [
  {key: 'daily', label: 'Daily Sales'},
  {key: 'weekly', label: 'Weekly Sales'},
  {key: 'monthly', label: 'Monthly Sales'},
  {key: 'yearly', label: 'Yearly Sales'},
  {key: 'stock', label: 'Product Stock'},
  {key: 'low_stock', label: 'Low Stock'},
  {key: 'sold', label: 'Sold Products'},
];

export function ReportsScreen() {
  const styles = useThemeStyles(makeStyles);
  const [type, setType] = useState<ReportType>('monthly');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [active, setActive] = useState<ReportType>('monthly');
  // Dates are committed on "Generate report" (like web/desktop) and apply to
  // ANY report type — empty range falls back to the type's default period.
  const [activeStart, setActiveStart] = useState('');
  const [activeEnd, setActiveEnd] = useState('');

  const {data: report, loading, error, reload} = useAsync(
    async () =>
      (await getApi()).reports.get({
        type: active,
        startDate: activeStart || undefined,
        endDate: activeEnd || undefined,
      }),
    [active, activeStart, activeEnd],
  );

  function generate() {
    setActive(type);
    setActiveStart(startDate);
    setActiveEnd(endDate);
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
    } catch {
      // user dismissed the share sheet — nothing to do
    }
  }

  return (
    <Screen>
      <Header title="Reports" subtitle="Sales, stock & profit — shared with web & desktop" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{paddingBottom: 90}}>
        <Card index={0}>
          <Text style={styles.label}>Report type</Text>
          <View style={styles.chips}>
            {REPORT_OPTIONS.map(opt => {
              const selected = type === opt.key;
              return (
                <Button
                  key={opt.key}
                  title={opt.label}
                  variant={selected ? 'primary' : 'outline'}
                  onPress={() => setType(opt.key)}
                  style={styles.chip}
                />
              );
            })}
          </View>
          <View style={{marginTop: 4}}>
            <Text style={styles.label}>Date range (optional — applies to any report)</Text>
            <DateField label="Start date" value={startDate} onChange={setStartDate} placeholder="Start date" />
            <DateField label="End date" value={endDate} onChange={setEndDate} placeholder="End date (optional)" />
          </View>
          <View style={styles.exportRow}>
            <Button
              title={loading ? 'Generating…' : 'Generate report'}
              onPress={generate}
              loading={loading}
              style={styles.exportGrow}
            />
            <Button
              title="Share CSV"
              variant="outline"
              disabled={!report || report.rows.length === 0}
              onPress={handleShareCsv}
              style={styles.exportGrow}
            />
          </View>
        </Card>

        {error ? (
          <ErrorBox message={error} onRetry={reload} />
        ) : loading || !report ? (
          <Loading />
        ) : (
          <>
            <Section title={`${report.title} · ${report.periodLabel}`} />
            {report.rows.length === 0 ? (
              <Empty text="No data for this report in the selected period" />
            ) : (
              report.rows.map((r, i) => (
                <Card key={`${r.productId}-${i}`} index={i}>
                  <View style={styles.productRow}>
                    <View style={{flex: 1}}>
                      <Text style={styles.name}>{r.productName}</Text>
                      <Text style={styles.meta}>
                        {r.sku ?? '—'}
                        {r.color || r.size ? ` · ${[r.color, r.size].filter(Boolean).join(' / ')}` : ''}
                      </Text>
                    </View>
                    <View style={{alignItems: 'flex-end', gap: 3}}>
                      <Text style={styles.revenue}>{money(r.revenue)}</Text>
                      <Text style={styles.meta}>
                        {r.stock} stock · {r.soldQuantity} sold
                        {r.soldWeight > 0 ? ` · ${formatWeight(r.soldWeight)}` : ''}
                      </Text>
                      <Text style={[styles.meta, {color: r.profit < 0 ? colors.danger : colors.success}]}>
                        Profit {money(r.profit)}
                      </Text>
                    </View>
                  </View>
                </Card>
              ))
            )}

            {report.rows.length > 0 ? (
              <Card index={99}>
                <View style={styles.totals}>
                  <Text style={styles.totalLabel}>Total revenue</Text>
                  <Text style={styles.totalValue}>{money(report.totals.revenue)}</Text>
                  <Text style={styles.totalLabel}>Total profit</Text>
                  <Text style={styles.totalValue}>{money(report.totals.profit)}</Text>
                  <Text style={styles.totalLabel}>Items sold</Text>
                  <Text style={styles.totalValue}>{report.totals.soldQuantity}</Text>
                  <Text style={styles.totalLabel}>Weight sold</Text>
                  <Text style={styles.totalValue}>
                    {report.totals.soldWeight > 0 ? formatWeight(report.totals.soldWeight) : '—'}
                  </Text>
                </View>
              </Card>
            ) : null}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const makeStyles = () =>
  StyleSheet.create({
    label: {fontSize: 12, fontWeight: '600', color: colors.muted, marginBottom: 5},
    chips: {flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10},
    chip: {paddingHorizontal: 14, paddingVertical: 9},
    exportRow: {flexDirection: 'row', gap: 8, marginTop: 12},
    exportGrow: {flex: 1},
    productRow: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
    name: {fontSize: 15, fontWeight: '600', color: colors.text},
    meta: {fontSize: 12, color: colors.muted, marginTop: 2},
    revenue: {fontSize: 15, fontWeight: '700', color: colors.text},
    totals: {gap: 6},
    totalLabel: {fontSize: 12, color: colors.muted, fontWeight: '600'},
    totalValue: {fontSize: 20, fontWeight: '700', color: colors.text},
  });
