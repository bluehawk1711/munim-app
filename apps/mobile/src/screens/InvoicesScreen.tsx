import React, {useState} from 'react';
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {Search, Trash2} from 'lucide-react-native';
import {
  deleteInvoice,
  listInvoices,
  recordInvoicePayment,
  formatDate,
  type InvoiceFilters,
} from '@munim/core';
import {getCore} from '../lib/core';
import {useAsync} from '../lib/use-async';
import {money} from '../lib/format';
import {successFeedback, errorFeedback, selectionTick} from '../lib/haptics';
import {
  Badge,
  Button,
  Card,
  Empty,
  Field,
  Header,
  Loading,
  ModalSheet,
  Screen,
  StatBox,
  colors,
} from '../components/ui';
import {useThemeStyles} from '../theme';

type StatusFilter = 'all' | 'PAID' | 'PARTIAL' | 'UNPAID' | 'DRAFT';

const STATUS_CHIPS: {key: StatusFilter; label: string}[] = [
  {key: 'all', label: 'All'},
  {key: 'PAID', label: 'Paid'},
  {key: 'PARTIAL', label: 'Partial'},
  {key: 'UNPAID', label: 'Unpaid'},
  {key: 'DRAFT', label: 'Draft'},
];

const PAGE_SIZE = 15;

type InvoiceRow = {
  id: string;
  invoiceNumber: string;
  customerName: string | null;
  date: Date;
  status: 'DRAFT' | 'UNPAID' | 'PARTIAL' | 'PAID';
  total: number;
  amountPaid: number;
  items: {productName: string | null}[];
};

export function InvoicesScreen() {
  const styles = useThemeStyles(makeStyles);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [page, setPage] = useState(1);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const filters: InvoiceFilters = {search, status, page, pageSize: PAGE_SIZE};
  const {loading, error, reload} = useAsync(async () => {
    const res = await listInvoices(await getCore(), filters);
    setInvoices(res.invoices);
    setTotalCount(res.pagination.totalCount);
    setTotalPages(res.pagination.totalPages);
    return res;
  }, [search, status, page]);

  // Reset to page 1 when a filter changes (web parity — avoids landing on an
  // empty page N). Page resets happen alongside the filter state update, so
  // the query runs exactly once per change.
  function setSearchFilter(value: string) {
    setSearch(value);
    setPage(1);
  }
  function setStatusFilter(value: StatusFilter) {
    setStatus(value);
    setPage(1);
  }

  const [paying, setPaying] = useState<InvoiceRow | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payBusy, setPayBusy] = useState(false);
  const [deleting, setDeleting] = useState<InvoiceRow | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const summary = invoices.reduce(
    (acc, inv) => ({
      total: acc.total + inv.total,
      unpaid: acc.unpaid + Math.max(0, inv.total - inv.amountPaid),
      collected: acc.collected + inv.amountPaid,
    }),
    {total: 0, unpaid: 0, collected: 0},
  );

  function openPayment(inv: InvoiceRow) {
    setPaying(inv);
    setPayAmount(String(Math.max(0, inv.total - inv.amountPaid)));
  }

  async function confirmPayment() {
    if (!paying) {
      return;
    }
    const amount = Number(payAmount);
    if (!amount || amount <= 0) {
      return;
    }
    setPayBusy(true);
    try {
      await recordInvoicePayment(await getCore(), paying.id, {amount, method: 'cash'});
      successFeedback();
      setPaying(null);
      reload();
    } catch {
      errorFeedback();
    } finally {
      setPayBusy(false);
    }
  }

  async function confirmDelete() {
    if (!deleting) {
      return;
    }
    setDeleteBusy(true);
    try {
      await deleteInvoice(await getCore(), deleting.id);
      successFeedback();
      setDeleting(null);
      reload();
    } catch {
      errorFeedback();
    } finally {
      setDeleteBusy(false);
    }
  }

  const badgeTone = (s: InvoiceRow['status']): 'success' | 'warning' | 'muted' =>
    s === 'PAID' ? 'success' : s === 'PARTIAL' ? 'warning' : 'muted';

  return (
    <Screen>
      <Header title="Invoices" subtitle="All bills & statuses — same as web & desktop" />

      <FlatList
        data={invoices}
        keyExtractor={item => item.id}
        keyboardShouldPersistTaps="handled"
        // Dim the list while a filter/page change refetches, so the refresh
        // is visible even when rows are already populated.
        style={loading && invoices.length > 0 ? {opacity: 0.55} : null}
        ListHeaderComponent={
          <View>
            {/* Search + status filter */}
            <View style={styles.searchWrap}>
              <View style={styles.searchBox}>
                <Search size={15} color={colors.muted} />
                <TextInput
                  value={search}
                  onChangeText={setSearchFilter}
                  placeholder="Search invoice #, customer…"
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

            {/* Summary strip */}
            <View style={styles.statsRow}>
              <StatBox label="Total" value={money(summary.total)} index={0} />
              <StatBox label="Unpaid" value={money(summary.unpaid)} valueColor={colors.warning} index={1} />
              <StatBox label="Collected" value={money(summary.collected)} valueColor={colors.success} index={2} />
            </View>
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <Loading rows={5} />
          ) : error ? (
            <Empty text={error} />
          ) : (
            <Empty text="No invoices found — create your first bill to start tracking money" />
          )
        }
        contentContainerStyle={{paddingBottom: 40}}
        renderItem={({item, index}) => {
          const outstanding = item.total - item.amountPaid;
          return (
            <Card index={index}>
              <View style={styles.row}>
                <View style={{flex: 1}}>
                  <View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
                    <Text style={styles.number}>{item.invoiceNumber}</Text>
                    <Badge text={item.status} tone={badgeTone(item.status)} />
                  </View>
                  <Text style={styles.name}>{item.customerName ?? 'Walk-in customer'}</Text>
                  <Text style={styles.meta}>
                    {formatDate(item.date)} · {item.items.length} item
                    {item.items.length !== 1 ? 's' : ''}
                    {item.items[0]?.productName ? ` · ${item.items[0].productName}` : ''}
                  </Text>
                </View>
                <View style={{alignItems: 'flex-end', gap: 4}}>
                  <Text style={styles.total}>{money(item.total)}</Text>
                  {outstanding > 0 ? (
                    <Text style={{fontSize: 11, color: colors.warning, fontWeight: '600'}}>
                      Due: {money(outstanding)}
                    </Text>
                  ) : (
                    <Text style={{fontSize: 11, color: colors.success, fontWeight: '600'}}>Paid ✓</Text>
                  )}
                  <View style={{flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2}}>
                    <Button
                      title="Pay"
                      variant="outline"
                      disabled={outstanding <= 0}
                      onPress={() => openPayment(item)}
                      style={{paddingVertical: 6, paddingHorizontal: 14}}
                    />
                    <Pressable
                      onPress={() => setDeleting(item)}
                      hitSlop={8}
                      style={({pressed}) => [styles.deleteBtn, pressed && {opacity: 0.5}]}
                      accessibilityLabel={`Delete ${item.invoiceNumber}`}>
                      <Trash2 size={16} color={colors.danger} />
                    </Pressable>
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
                title="← Prev"
                variant="outline"
                disabled={page <= 1}
                onPress={() => setPage(p => Math.max(1, p - 1))}
                style={{flex: 1}}
              />
              <Text style={styles.pagerText}>
                Page {page} of {totalPages} · {totalCount}
              </Text>
              <Button
                title="Next →"
                variant="outline"
                disabled={page >= totalPages}
                onPress={() => setPage(p => p + 1)}
                style={{flex: 1}}
              />
            </View>
          ) : null
        }
      />

      {/* Record payment */}
      <ModalSheet
        visible={!!paying}
        title={paying ? `Record payment — ${paying.invoiceNumber}` : ''}
        onClose={() => setPaying(null)}
        dismissable={!payBusy}>
        {paying ? (
          <>
            <View style={styles.paySummary}>
              <View style={{flex: 1}}>
                <Text style={styles.payLabel}>Total</Text>
                <Text style={styles.payValue}>{money(paying.total)}</Text>
              </View>
              <View style={{flex: 1}}>
                <Text style={styles.payLabel}>Already paid</Text>
                <Text style={styles.payValue}>{money(paying.amountPaid)}</Text>
              </View>
            </View>
            <Field
              label="Amount to receive"
              value={payAmount}
              onChangeText={setPayAmount}
              keyboardType="numeric"
            />
            <Button
              title={payBusy ? 'Saving…' : 'Confirm payment'}
              onPress={() => void confirmPayment()}
              loading={payBusy}
              disabled={!Number(payAmount) || Number(payAmount) <= 0}
            />
          </>
        ) : null}
      </ModalSheet>

      {/* Delete confirm */}
      <ModalSheet
        visible={!!deleting}
        title={deleting ? `Delete ${deleting.invoiceNumber}?` : ''}
        onClose={() => setDeleting(null)}
        dismissable={!deleteBusy}>
        <Text style={styles.deleteNote}>
          This invoice will be removed and its stock restored — the same as deleting it on web or
          desktop.
        </Text>
        <Button
          title={deleteBusy ? 'Deleting…' : 'Delete invoice'}
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
    row: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
    number: {fontSize: 12, color: colors.muted, fontFamily: 'monospace', fontWeight: '600'},
    name: {fontSize: 15, fontWeight: '600', color: colors.text, marginTop: 3},
    meta: {fontSize: 11, color: colors.muted, marginTop: 2},
    total: {fontSize: 15, fontWeight: '700', color: colors.text},
    deleteBtn: {
      width: 32,
      height: 32,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.dangerSoft,
    },
    pager: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginHorizontal: 16,
      marginTop: 4,
    },
    pagerText: {fontSize: 11, color: colors.muted, fontWeight: '600'},
    paySummary: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 12,
    },
    payLabel: {fontSize: 11, color: colors.muted, fontWeight: '600'},
    payValue: {fontSize: 17, fontWeight: '700', color: colors.text, marginTop: 2},
    deleteNote: {
      fontSize: 13,
      color: colors.muted,
      lineHeight: 19,
      marginBottom: 14,
    },
  });
