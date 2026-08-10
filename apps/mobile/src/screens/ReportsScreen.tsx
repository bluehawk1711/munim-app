import React, {useState} from 'react';
import {ScrollView, Share, StyleSheet, Text, TextInput, View} from 'react-native';
import {getReport, reportToCsv, type ReportType} from '@munim/core';
import {getCore} from '../lib/core';
import {useAsync} from '../lib/use-async';
import {money} from '../lib/format';
import {Button, Card, Empty, ErrorBox, Header, Loading, Screen, Section, colors} from '../components/ui';
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

  const {data: report, loading, error, reload} = useAsync(
    async () =>
      getReport(
        await getCore(),
        active,
        active === 'sold' && startDate ? startDate : undefined,
        active === 'sold' && endDate ? endDate : undefined,
      ),
    [active],
  );

  function generate() {
    setActive(type);
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
          {type === 'sold' ? (
            <View style={{marginTop: 4}}>
              <Text style={styles.label}>Date range</Text>
              <Text style={styles.dateHint}>YYYY-MM-DD (e.g. 2026-01-01)</Text>
              <TextInput
                style={styles.input}
                value={startDate}
                onChangeText={setStartDate}
                placeholder="Start date"
                placeholderTextColor={colors.inputPlaceholder}
              />
              <TextInput
                style={[styles.input, {marginTop: 8}]}
                value={endDate}
                onChangeText={setEndDate}
                placeholder="End date (optional)"
                placeholderTextColor={colors.inputPlaceholder}
              />
            </View>
          ) : null}
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
    dateHint: {fontSize: 11, color: colors.muted, marginBottom: 4},
    exportRow: {flexDirection: 'row', gap: 8, marginTop: 12},
    exportGrow: {flex: 1},
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 14,
      color: colors.text,
      backgroundColor: colors.card,
    },
    productRow: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
    name: {fontSize: 15, fontWeight: '600', color: colors.text},
    meta: {fontSize: 12, color: colors.muted, marginTop: 2},
    revenue: {fontSize: 15, fontWeight: '700', color: colors.text},
    totals: {gap: 6},
    totalLabel: {fontSize: 12, color: colors.muted, fontWeight: '600'},
    totalValue: {fontSize: 20, fontWeight: '700', color: colors.text},
  });
