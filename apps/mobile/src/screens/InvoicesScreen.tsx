import React, {useState} from 'react';
import {
  FlatList,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Print from 'expo-print';
import {Search, Trash2, Download, Share2} from 'lucide-react-native';
import {
  buildBillDocument,
  formatDate,
  renderBillHtml,
  type InvoiceFilters,
  type InvoiceDto,
} from '@munim/core';
import {
  useDeleteInvoice,
  useInvoices,
  useQueryState,
  useRecordInvoicePayment,
  useSettings,
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
import {useNavStore} from '../lib/nav-store';

type StatusFilter = 'all' | 'PAID' | 'PARTIAL' | 'UNPAID' | 'DRAFT';

const STATUS_CHIPS: {key: StatusFilter; label: string}[] = [
  {key: 'all', label: 'All'},
  {key: 'PAID', label: 'Paid'},
  {key: 'PARTIAL', label: 'Partial'},
  {key: 'UNPAID', label: 'Unpaid'},
  {key: 'DRAFT', label: 'Draft'},
];

const PAGE_SIZE = 15;

export function InvoicesScreen() {
  const styles = useThemeStyles(makeStyles);
  const [search, setSearch] = useState('');
  // Deep-linked status filter (Home → invoice status chart). Consumed once on
  // mount, then reset so a manual visit defaults back to All.
  const [status, setStatus] = useState<StatusFilter>(() => useNavStore.getState().invoiceFilter);
  React.useEffect(() => {
    useNavStore.getState().setInvoiceFilter('all');
  }, []);
  const [page, setPage] = useState(1);

  const filters: InvoiceFilters = {search, status, page, pageSize: PAGE_SIZE};
  // Cached list — the shared @munim/query hook owns fetch + invalidation.
  const {data, loading, error} = useQueryState(useInvoices(filters));
  const invoices: InvoiceDto[] = data?.invoices ?? [];
  const totalCount = data?.pagination.totalCount ?? 0;
  const totalPages = data?.pagination.totalPages ?? 0;

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

  const [paying, setPaying] = useState<InvoiceDto | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payBusy, setPayBusy] = useState(false);
  const [deleting, setDeleting] = useState<InvoiceDto | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [exporting, setExporting] = useState<InvoiceDto | null>(null);
  const [exportBusy, setExportBusy] = useState(false);
  const recordPayment = useRecordInvoicePayment(paying?.id ?? '');
  const deleteInvoice = useDeleteInvoice();
  const {data: settings} = useQueryState(useSettings());

  const summary = invoices.reduce(
    (acc, inv) => ({
      total: acc.total + inv.total,
      unpaid: acc.unpaid + Math.max(0, inv.total - inv.amountPaid),
      collected: acc.collected + inv.amountPaid,
    }),
    {total: 0, unpaid: 0, collected: 0},
  );

  function openPayment(inv: InvoiceDto) {
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
      await recordPayment.mutateAsync({amount, method: 'cash'});
      successFeedback(`Payment of ${money(amount)} recorded for ${paying.invoiceNumber}`);
      setPaying(null);
    } catch {
      errorFeedback('Failed to record payment');
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
      await deleteInvoice.mutateAsync(deleting.id);
      successFeedback(`${deleting.invoiceNumber} deleted`);
      setDeleting(null);
    } catch {
      errorFeedback('Failed to delete invoice');
    } finally {
      setDeleteBusy(false);
    }
  }

  async function handleExportInvoice(inv: InvoiceDto) {
    if (!settings) return;
    setExporting(inv);
    setExportBusy(true);
    try {
      const shop = {name: settings.shopName, address: settings.shopAddress ?? '', phones: settings.shopPhones, email: settings.shopEmail ?? ''};
      const doc = buildBillDocument({
        billNo: inv.invoiceNumber,
        date: inv.date,
        customerName: inv.customerName ?? '',
        customerPhone: inv.customerPhone ?? '',
        customerAddress: inv.customerAddress ?? '',
        shop: shop ?? {name: settings.shopName, address: '', phones: [], email: ''},
        lines: inv.items.map(it => ({
          productName: it.productName,
          sku: it.sku ?? '',
          color: it.color ?? '',
          size: it.size ?? '',
          quantity: it.quantity,
          price: it.price,
        })),
        discount: inv.discount,
        deliveryCharge: inv.deliveryCharge,
        amountPaid: inv.amountPaid,
        status: inv.status,
        currency: settings.currency ?? 'INR',
      });
      const html = renderBillHtml(doc);
      const {uri} = await Print.printToFileAsync({html, base64: false});
      await Share.share({url: uri, message: `Invoice ${inv.invoiceNumber} — ${settings.shopName}`});
      successFeedback(`Invoice ${inv.invoiceNumber} exported`);
    } catch {
      // user cancelled or print failed
    } finally {
      setExporting(null);
      setExportBusy(false);
    }
  }

  const badgeTone = (s: InvoiceDto['status']): 'success' | 'warning' | 'muted' =>
    s === 'PAID' ? 'success' : s === 'PARTIAL' ? 'warning' : 'muted';

  return (
    <Screen>
      <HomeHeader title="Invoices" />

      <FlatList
        data={invoices}
        keyExtractor={item => item.id}
        keyboardShouldPersistTaps="handled"
        {...headerScrollHandlers}
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
          const exportingThis = exporting?.id === item.id;
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
                <View style={{alignItems: 'flex-end', gap: 6, marginTop: 2}}>
                  <Text style={styles.total}>{money(item.total)}</Text>
                  {outstanding > 0 ? (
                    <Text style={{fontSize: 11, color: colors.warning, fontWeight: '600'}}>
                      Due: {money(outstanding)}
                    </Text>
                  ) : (
                    <Text style={{fontSize: 11, color: colors.success, fontWeight: '600'}}>Paid ✓</Text>
                  )}
                  <View style={{flexDirection: 'row', alignItems: 'center', gap: 6}}>
                    <Button
                      title={exportingThis ? 'Preparing…' : 'Export'}
                      variant="outline"
                      onPress={() => handleExportInvoice(item)}
                      loading={exportingThis}
                      icon={<Download size={14} />}
                      style={{paddingVertical: 6, paddingHorizontal: 12}}
                    />
                    <Button
                      title="Pay"
                      variant="outline"
                      disabled={outstanding <= 0}
                      onPress={() => openPayment(item)}
                      style={{paddingVertical: 6, paddingHorizontal: 12}}
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

      {/* Record payment — centered modal */}
      <ModalSheet
        visible={!!paying}
        title={paying ? `Record payment — ${paying.invoiceNumber}` : ''}
        onClose={() => setPaying(null)}
        dismissable={!payBusy}
        centered
      >
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

      {/* Delete confirm — centered modal */}
      <ModalSheet
        visible={!!deleting}
        title={deleting ? `Delete ${deleting.invoiceNumber}?` : ''}
        onClose={() => setDeleting(null)}
        dismissable={!deleteBusy}
        centered
      >
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
