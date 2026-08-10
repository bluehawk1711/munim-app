import React from 'react';
import {ScrollView, StyleSheet, Text, View} from 'react-native';
import {getDashboard, formatDate} from '@munim/core';
import {getCore} from '../lib/core';
import {useAsync} from '../lib/use-async';
import {money} from '../lib/format';
import {Badge, Card, ErrorBox, Header, Loading, Screen, StatBox, colors} from '../components/ui';
import {useThemeStyles} from '../theme';

export function HomeScreen() {
  const styles = useThemeStyles(makeStyles);
  const {data, error, loading, reload} = useAsync(async () => getDashboard(await getCore()), []);

  return (
    <Screen>
      <Header title="Munim" subtitle="Dashboard — shared with web & desktop" />
      {error ? (
        <ErrorBox message={error} onRetry={reload} />
      ) : loading || !data ? (
        <Loading />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={styles.grid}>
            <StatBox index={0} label="Total revenue" value={money(data.totalRevenue)} />
            <StatBox index={1} label="This month" value={money(data.monthlyRevenue)} />
            <StatBox index={2} label="Unpaid" value={money(data.unpaidAmount)} valueColor={colors.warning} />
            <StatBox index={3} label="Receivables" value={money(data.receivables)} valueColor={colors.danger} />
            <StatBox index={4} label="Payables" value={money(data.payables)} valueColor={colors.success} />
            <StatBox
              index={5}
              label="Low / out of stock"
              value={`${data.lowStockCount} / ${data.outOfStockCount}`}
              valueColor={data.lowStockCount > 0 ? colors.warning : colors.text}
            />
          </View>

          <Text style={styles.section}>Recent invoices</Text>
          {data.recentInvoices.length === 0 ? (
            <Card>
              <Text style={{color: colors.muted, fontSize: 13}}>No invoices yet</Text>
            </Card>
          ) : (
            data.recentInvoices.map((inv, i) => (
              <Card key={inv.id} index={i}>
                <View style={styles.invRow}>
                  <View style={{flex: 1}}>
                    <Text style={{fontWeight: '600', color: colors.text, fontSize: 14}}>
                      {inv.invoiceNumber}
                    </Text>
                    <Text style={{color: colors.muted, fontSize: 12, marginTop: 2}}>
                      {inv.customerName ?? 'Walk-in'} · {formatDate(inv.date)}
                    </Text>
                  </View>
                  <View style={{alignItems: 'flex-end', gap: 4}}>
                    <Text style={{fontWeight: '700', color: colors.text}}>{money(inv.total)}</Text>
                    <Badge
                      text={inv.status}
                      tone={inv.status === 'PAID' ? 'success' : inv.status === 'PARTIAL' ? 'warning' : 'muted'}
                    />
                  </View>
                </View>
              </Card>
            ))
          )}

          <Text style={styles.section}>Recent advances</Text>
          {data.recentAdvances.length === 0 ? (
            <Card>
              <Text style={{color: colors.muted, fontSize: 13}}>No open advances</Text>
            </Card>
          ) : (
            data.recentAdvances.map((adv, i) => (
              <Card key={adv.id} index={i}>
                <View style={styles.invRow}>
                  <Text style={{flex: 1, color: colors.text, fontSize: 14}}>
                    {adv.partyName ?? 'Party'}
                    {'\n'}
                    <Text style={{color: colors.muted, fontSize: 12}}>{formatDate(adv.date)}</Text>
                  </Text>
                  <Text
                    style={{
                      fontWeight: '700',
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
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      paddingHorizontal: 16,
    },
    section: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.text,
      marginHorizontal: 16,
      marginTop: 18,
      marginBottom: 10,
    },
    invRow: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
  });
