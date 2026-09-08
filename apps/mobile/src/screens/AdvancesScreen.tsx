/**
 * AdvancesScreen — receivables/payables overview, quick record.
 *
 * Redesigned with:
 * - Responsive 2-column summary stats
 * - FlashList for party cards
 * - Better visual hierarchy
 * - Keyboard-aware quick record form
 */

import React, {useEffect, useMemo, useRef, useState} from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {FlashList} from '@shopify/flash-list';
import {formatDate} from '@munim/core';
import {TrendingDown, TrendingUp} from 'lucide-react-native';
import {type PartyBalanceDto} from '@munim/core';
import type BottomSheet from '@gorhom/bottom-sheet';
import {
  useCreateAdvance,
  useParties,
  useParty,
  usePartyBalances,
  useQueryState,
  useRecordPartyPayment,
} from '@munim/query';
import {money} from '../lib/format';
import {successFeedback, errorFeedback, selectionTick} from '../lib/haptics';
import {rw, rh, rs, typography, spacing, radii, GRID_GAP, CARD_MARGIN, TOUCH_TARGET} from '../lib/responsive';
import {
  Button,
  Card,
  Empty,
  Field,
  Loading,
  ModalSheet,
  Screen,
  ThreeDotMenu,
  colors,
} from '../components/ui';
import {HomeHeader, headerScrollHandlers} from '../components/home-header';
import {MunimBottomSheet, BottomSheetScrollView} from '../components/BottomSheet';
import {useThemeStyles} from '../theme';

type ActionKind = 'GIVEN' | 'TAKEN' | 'PAYMENT_IN' | 'PAYMENT_OUT';
type Action = {party: PartyBalanceDto; kind: ActionKind};
type BalanceFilter = 'all' | 'get' | 'give' | 'settled';

const TYPE_LABELS: Record<string, string> = {CUSTOMER: 'Customer', SUPPLIER: 'Supplier', WORKER: 'Worker', OTHER: 'Other'};

export function AdvancesScreen() {
  const styles = useThemeStyles(makeStyles);
  const {data: balancesData, loading, error} = useQueryState(usePartyBalances());
  const balances = balancesData?.balances;
  const {data: parties} = useQueryState(useParties());

  // Filter
  const [filter, setFilter] = useState<BalanceFilter>('all');

  // Action sheet
  const [action, setAction] = useState<Action | null>(null);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  // Quick record
  const [quickOpen, setQuickOpen] = useState(false);
  const [quickPartyId, setQuickPartyId] = useState('');
  const [quickKind, setQuickKind] = useState<'GIVEN' | 'TAKEN'>('GIVEN');
  const [quickAmount, setQuickAmount] = useState('');
  const [quickNote, setQuickNote] = useState('');

  // Party detail / ledger sheet
  const [selectedPartyId, setSelectedPartyId] = useState<string | null>(null);
  const ledgerSheetRef = useRef<BottomSheet>(null);
  const partyDetailQ = useQueryState(useParty(selectedPartyId));
  const partyDetail = partyDetailQ.data;
  const ledgerLoading = partyDetailQ.loading;
  const snapPoints = useMemo(() => ['85%'], []);

  useEffect(() => {
    if (selectedPartyId) {
      ledgerSheetRef.current?.snapToIndex(0);
    } else {
      ledgerSheetRef.current?.close();
    }
  }, [selectedPartyId]);

  const createAdvance = useCreateAdvance();
  const recordPartyPayment = useRecordPartyPayment();

  const receivables = useMemo(() => (balances ?? []).filter(p => p.balance > 0.001), [balances]);
  const payables = useMemo(() => (balances ?? []).filter(p => p.balance < -0.001), [balances]);
  const settled = useMemo(() => (balances ?? []).filter(p => Math.abs(p.balance) <= 0.001), [balances]);
  const totalReceivable = receivables.reduce((s, p) => s + p.balance, 0);
  const totalPayable = payables.reduce((s, p) => s + Math.abs(p.balance), 0);
  const quickParty = parties?.find(p => p.id === quickPartyId) ?? null;

  const filteredParties = useMemo(() => {
    const all = balances ?? [];
    if (filter === 'get') return all.filter(p => p.balance > 0.001);
    if (filter === 'give') return all.filter(p => p.balance < -0.001);
    if (filter === 'settled') return all.filter(p => Math.abs(p.balance) <= 0.001);
    return all;
  }, [balances, filter]);

  function openAction(party: PartyBalanceDto, kind: ActionKind) {
    setAction({party, kind});
    setAmount('');
    setNote('');
  }

  async function submitAction() {
    if (!action) return;
    const value = Number(amount);
    if (!value || value <= 0) return;
    setBusy(true);
    try {
      if (action.kind === 'GIVEN' || action.kind === 'TAKEN') {
        await createAdvance.mutateAsync({partyId: action.party.id, direction: action.kind, amount: value, note: note.trim() || undefined});
        successFeedback(`Advance ${action.kind === 'GIVEN' ? 'given' : 'taken'} for ${money(value)}`);
      } else {
        await recordPartyPayment.mutateAsync({partyId: action.party.id, direction: action.kind === 'PAYMENT_IN' ? 'IN' : 'OUT', amount: value, method: 'cash', note: note.trim() || undefined});
        successFeedback(`Payment ${action.kind === 'PAYMENT_IN' ? 'received' : 'made'} for ${money(value)}`);
      }
      setAction(null);
    } catch {
      errorFeedback('Action failed');
    } finally {
      setBusy(false);
    }
  }

  async function submitQuick() {
    if (!quickPartyId) return;
    const value = Number(quickAmount);
    if (!value || value <= 0) return;
    setBusy(true);
    try {
      await createAdvance.mutateAsync({partyId: quickPartyId, direction: quickKind, amount: value, note: quickNote.trim() || undefined});
      successFeedback(`Quick record: ${quickKind === 'GIVEN' ? 'advance given' : 'advance taken'} for ${money(value)}`);
      setQuickAmount('');
      setQuickNote('');
      setQuickOpen(false);
    } catch {
      errorFeedback('Quick record failed');
    } finally {
      setBusy(false);
    }
  }

  const actionTitle = action?.kind === 'GIVEN' ? 'Give advance' : action?.kind === 'TAKEN' ? 'Take advance' : action?.kind === 'PAYMENT_IN' ? 'Receive payment' : 'Make payment';

  const renderPartyCard = ({item, type}: {item: PartyBalanceDto; type: 'receivable' | 'payable' | 'settled'}) => (
    <View key={item.id} style={styles.partyRow}>
      <Pressable onPress={() => { selectionTick(); setSelectedPartyId(item.id); }} style={{flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md, minWidth: 0}}>
        <View style={[styles.avatar, {backgroundColor: type === 'receivable' ? colors.successSoft : type === 'payable' ? colors.dangerSoft : colors.mutedSoft}]}>
          <Text style={[styles.avatarText, {color: type === 'receivable' ? colors.success : type === 'payable' ? colors.danger : colors.muted}]}>
            {item.name.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={{flex: 1, minWidth: 0}}>
          <Text style={styles.partyName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.partyType}>{TYPE_LABELS[item.type] ?? item.type.toLowerCase()}</Text>
        </View>
        <Text style={[styles.partyBalance, {color: type === 'receivable' ? colors.success : type === 'payable' ? colors.danger : colors.muted}]} numberOfLines={1}>
          {type === 'settled' ? 'Settled' : money(Math.abs(item.balance))}
        </Text>
      </Pressable>
      <ThreeDotMenu
        actions={
          type === 'receivable'
            ? [
                {label: 'Collect payment', onPress: () => openAction(item, 'PAYMENT_IN')},
                {label: 'Give advance', onPress: () => openAction(item, 'GIVEN')},
              ]
            : [
                {label: 'Make payment', onPress: () => openAction(item, 'PAYMENT_OUT')},
                {label: 'Take advance', onPress: () => openAction(item, 'TAKEN')},
              ]
        }
      />
    </View>
  );

  return (
    <Screen>
      <HomeHeader title="Khata & Advance" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{paddingBottom: spacing.xxxl}}
        {...headerScrollHandlers}>
        {/* Summary cards — 2-column */}
        <View style={styles.summaryGrid}>
          <View style={styles.summaryRow}>
            <Card style={styles.summaryCard} index={0}>
              <View style={[styles.summaryIcon, {backgroundColor: colors.successSoft}]}>
                <TrendingUp size={rs(16)} color={colors.success} strokeWidth={2.2} />
              </View>
              <Text style={styles.summaryLabel} numberOfLines={1}>You'll Get</Text>
              <Text style={[styles.summaryValue, {color: colors.success}]}>{money(totalReceivable)}</Text>
            </Card>
            <Card style={styles.summaryCard} index={1}>
              <View style={[styles.summaryIcon, {backgroundColor: colors.dangerSoft}]}>
                <TrendingDown size={rs(16)} color={colors.danger} strokeWidth={2.2} />
              </View>
              <Text style={styles.summaryLabel} numberOfLines={1}>You'll Give</Text>
              <Text style={[styles.summaryValue, {color: colors.danger}]}>{money(totalPayable)}</Text>
            </Card>
          </View>
          <Card style={[styles.summaryCard, {marginHorizontal: CARD_MARGIN}]} index={2}>
            <Text style={styles.summaryLabel}>Net position</Text>
            <Text style={[styles.summaryValue, {color: totalReceivable - totalPayable >= 0 ? colors.success : colors.danger, marginTop: spacing.sm}]}>
              {money(totalReceivable - totalPayable)}
            </Text>
            <View style={{flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm}}>
              <Text style={[styles.summaryLabel, {color: colors.success}]}>{money(totalReceivable)} you'll get</Text>
              <Text style={[styles.summaryLabel, {color: colors.danger}]}>{money(totalPayable)} you'll give</Text>
            </View>
          </Card>
        </View>

        {/* Filter chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {(['all', 'get', 'give', 'settled'] as const).map(f => (
            <Pressable key={f} onPress={() => { selectionTick(); setFilter(f); }} style={[styles.filterChip, filter === f && styles.filterChipActive]}>
              <Text style={[styles.filterChipText, filter === f && styles.filterChipTextActive]}>
                {f === 'all' ? 'All' : f === 'get' ? "You'll Get" : f === 'give' ? "You'll Give" : 'Settled'}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Quick record */}
        <Card style={{marginHorizontal: CARD_MARGIN}} index={0}>
          <Text style={styles.cardTitle}>Quick record</Text>
          <Pressable onPress={() => setQuickOpen(true)} style={styles.partyPicker}>
            <View style={{flex: 1}}>
              <Text style={styles.pickerLabel}>Party</Text>
              <Text style={styles.pickerValue}>{quickParty ? quickParty.name : 'Select party…'}</Text>
            </View>
            <Text style={{color: colors.muted}}>▾</Text>
          </Pressable>
          <View style={styles.kindRow}>
            <Pressable onPress={() => { selectionTick(); setQuickKind('GIVEN'); }} style={[styles.kindChip, quickKind === 'GIVEN' && styles.kindChipActive]}>
              <Text style={[styles.kindChipText, quickKind === 'GIVEN' && styles.kindChipTextActive]}>I gave (they owe me)</Text>
            </Pressable>
            <Pressable onPress={() => { selectionTick(); setQuickKind('TAKEN'); }} style={[styles.kindChip, quickKind === 'TAKEN' && styles.kindChipActive]}>
              <Text style={[styles.kindChipText, quickKind === 'TAKEN' && styles.kindChipTextActive]}>I took (I owe them)</Text>
            </Pressable>
          </View>
          <View style={{flexDirection: 'row', gap: spacing.sm}}>
            <Field label="Amount" value={quickAmount} onChangeText={setQuickAmount} keyboardType="numeric" style={{flex: 1}} />
            <Field label="Note" value={quickNote} onChangeText={setQuickNote} style={{flex: 2}} />
          </View>
          <Button
            title={busy ? 'Saving…' : 'Record advance'}
            onPress={() => void submitQuick()}
            loading={busy}
            disabled={!quickPartyId || !Number(quickAmount) || Number(quickAmount) <= 0}
          />
        </Card>

        {/* Party lists */}
        {loading || !balances ? (
          <Loading rows={4} />
        ) : error ? (
          <Empty text={error} />
        ) : filteredParties.length === 0 ? (
          <Empty text={filter === 'all' ? 'No parties yet.' : `No ${filter === 'get' ? "receivables" : filter === 'give' ? "payables" : "settled parties"}.`} />
        ) : (
          <Card style={{marginHorizontal: CARD_MARGIN}} index={1}>
            <View style={styles.khataHeader}>
              <View style={[styles.khataIcon, {backgroundColor: colors.mutedSoft}]}>
                <TrendingUp size={rs(16)} color={colors.muted} strokeWidth={2.2} />
              </View>
              <View style={{flex: 1}}>
                <Text style={styles.khataTitle}>
                  {filter === 'all' ? 'All Parties' : filter === 'get' ? 'Receivables' : filter === 'give' ? 'Payables' : 'Settled'}
                </Text>
                <Text style={styles.khataSubtitle}>
                  {filteredParties.length} {filteredParties.length === 1 ? 'party' : 'parties'}
                </Text>
              </View>
            </View>
            {filteredParties.map(p => renderPartyCard({item: p, type: p.balance > 0.001 ? 'receivable' : p.balance < -0.001 ? 'payable' : 'settled'}))}
          </Card>
        )}
      </ScrollView>

      {/* Quick party picker — centered modal */}
      <ModalSheet visible={quickOpen} title="Select party" onClose={() => setQuickOpen(false)} centered scrollable>
        <FlashList
          data={parties ?? []}
          renderItem={({item}) => (
            <Pressable
              onPress={() => { selectionTick(); setQuickPartyId(item.id); setQuickOpen(false); }}
              style={({pressed}) => [styles.pickRow, pressed && {backgroundColor: colors.mutedSoft}]}>
              <Text style={{flex: 1, fontSize: typography.body, color: colors.text, fontWeight: '600'}}>{item.name}</Text>
              <Text style={{fontSize: typography.caption, color: colors.muted}}>{TYPE_LABELS[item.type] ?? item.type.toLowerCase()}</Text>
            </Pressable>
          )}
          keyExtractor={item => item.id}
        />
      </ModalSheet>

      {/* Action sheet — centered modal */}
      <ModalSheet visible={!!action} title={actionTitle} onClose={() => setAction(null)} dismissable={!busy} centered>
        {action ? (
          <>
            <View style={styles.actionParty}>
              <View style={{flex: 1}}>
                <Text style={styles.partyName}>{action.party.name}</Text>
                <Text style={styles.partyType}>{TYPE_LABELS[action.party.type] ?? action.party.type.toLowerCase()}</Text>
              </View>
              <View style={{alignItems: 'flex-end'}}>
                <Text style={{fontSize: typography.caption, color: colors.muted, fontWeight: '600'}}>Balance</Text>
                <Text style={[styles.partyBalance, {color: action.party.balance > 0 ? colors.success : action.party.balance < 0 ? colors.danger : colors.text}]}>
                  {money(action.party.balance)}
                </Text>
              </View>
            </View>
            <Field label="Amount" value={amount} onChangeText={setAmount} keyboardType="numeric" />
            <Field label="Note (optional)" value={note} onChangeText={setNote} />
            <Button title={busy ? 'Saving…' : 'Confirm'} onPress={() => void submitAction()} loading={busy} disabled={!Number(amount) || Number(amount) <= 0} />
          </>
        ) : null}
      </ModalSheet>

      {/* Party ledger bottom sheet */}
      <MunimBottomSheet
        ref={ledgerSheetRef}
        title={partyDetail?.party.name ?? 'Party'}
        onClose={() => setSelectedPartyId(null)}
        snapPoints={snapPoints}
        initialIndex={-1}>
        <BottomSheetScrollView contentContainerStyle={{paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl}}>
          {ledgerLoading ? (
            <Loading rows={4} />
          ) : partyDetail ? (
            <View>
              {/* Party summary */}
              <View style={styles.actionParty}>
                <View style={{flex: 1}}>
                  <Text style={styles.partyName}>{partyDetail.party.name}</Text>
                  <Text style={styles.partyType}>{TYPE_LABELS[partyDetail.party.type] ?? partyDetail.party.type.toLowerCase()}</Text>
                </View>
                <View style={{alignItems: 'flex-end'}}>
                  <Text style={{fontSize: typography.caption, color: colors.muted, fontWeight: '600'}}>Balance</Text>
                  <Text style={[styles.partyBalance, {color: partyDetail.ledger.balance > 0 ? colors.success : partyDetail.ledger.balance < 0 ? colors.danger : colors.text}]}>
                    {money(partyDetail.ledger.balance)}
                  </Text>
                </View>
              </View>

              {/* Ledger lines */}
              <Text style={[styles.cardTitle, {marginBottom: spacing.sm}]}>Ledger history</Text>
              {partyDetail.ledger.lines.length === 0 ? (
                <Empty text="No transactions yet." />
              ) : (
                partyDetail.ledger.lines.map(line => (
                  <View key={line.id} style={styles.ledgerLine}>
                    <View style={{flex: 1, minWidth: 0}}>
                      <Text style={{fontSize: typography.secondary, color: colors.text}} numberOfLines={2}>{line.description}</Text>
                      <Text style={{fontSize: typography.caption, color: colors.muted, marginTop: rs(2)}}>{formatDate(line.date)}</Text>
                    </View>
                    <View style={{alignItems: 'flex-end', marginLeft: spacing.sm}}>
                      <Text style={{fontSize: typography.badge, fontWeight: '600', color: line.kind === 'ADVANCE_GIVEN' || line.kind === 'PAYMENT_OUT' ? colors.danger : line.kind === 'ADVANCE_TAKEN' || line.kind === 'PAYMENT_IN' ? colors.success : colors.primary}}>
                        {line.debit > 0 ? `+${money(line.debit)}` : line.credit > 0 ? `-${money(line.credit)}` : '—'}
                      </Text>
                      <Text style={{fontSize: typography.caption, color: colors.muted, marginTop: rs(2)}}>
                        Bal: {money(line.balance)}
                      </Text>
                    </View>
                  </View>
                ))
              )}
            </View>
          ) : null}
        </BottomSheetScrollView>
      </MunimBottomSheet>
    </Screen>
  );
}

const makeStyles = () =>
  StyleSheet.create({
    summaryGrid: {marginBottom: spacing.sm},
    summaryRow: {flexDirection: 'row', gap: GRID_GAP, paddingHorizontal: CARD_MARGIN, marginBottom: GRID_GAP},
    summaryCard: {flex: 1, marginHorizontal: 0, marginBottom: 0, paddingVertical: spacing.md, paddingHorizontal: spacing.md},
    summaryIcon: {width: rs(30), height: rs(30), borderRadius: rs(8), alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xs},
    summaryLabel: {fontSize: typography.label, color: colors.muted, fontWeight: '600', flexShrink: 1},
    summaryValue: {fontSize: typography.h2, fontWeight: '700', marginTop: rs(4)},
    filterRow: {paddingHorizontal: CARD_MARGIN, paddingVertical: spacing.sm, gap: spacing.sm},
    filterChip: {paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card},
    filterChipActive: {backgroundColor: colors.primary, borderColor: colors.primary},
    filterChipText: {fontSize: typography.caption, fontWeight: '600', color: colors.muted},
    filterChipTextActive: {color: colors.onPrimary},
    cardTitle: {fontSize: typography.h3, fontWeight: '700', color: colors.text, marginBottom: spacing.md},
    partyPicker: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      marginBottom: spacing.sm,
      backgroundColor: colors.card,
    },
    pickerLabel: {fontSize: typography.caption, color: colors.muted, fontWeight: '600'},
    pickerValue: {fontSize: typography.body, color: colors.text, marginTop: rs(2)},
    kindRow: {flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm},
    kindChip: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.md,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.sm,
      alignItems: 'center',
      backgroundColor: colors.card,
    },
    kindChipActive: {backgroundColor: colors.primary, borderColor: colors.primary},
    kindChipText: {fontSize: typography.caption, fontWeight: '600', color: colors.muted, textAlign: 'center'},
    kindChipTextActive: {color: colors.onPrimary},
    khataHeader: {flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm},
    khataIcon: {width: rs(30), height: rs(30), borderRadius: rs(8), alignItems: 'center', justifyContent: 'center'},
    khataTitle: {fontSize: typography.h3, fontWeight: '700', color: colors.text},
    khataSubtitle: {fontSize: typography.caption, color: colors.muted, marginTop: rs(1)},
    emptyText: {fontSize: typography.secondary, color: colors.muted, textAlign: 'center', paddingVertical: spacing.xl},
    partyRow: {flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border},
    avatar: {width: rs(32), height: rs(32), borderRadius: rs(16), alignItems: 'center', justifyContent: 'center'},
    avatarText: {fontSize: typography.secondary, fontWeight: '700'},
    partyName: {fontSize: typography.secondary, fontWeight: '600', color: colors.text},
    partyType: {fontSize: typography.caption, color: colors.muted, textTransform: 'capitalize', marginTop: rs(1)},
    partyBalance: {fontSize: typography.secondary, fontWeight: '700'},
    pickRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    actionParty: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.mutedSoft,
      borderRadius: radii.md,
      padding: spacing.md,
      marginBottom: spacing.md,
    },
    ledgerLine: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
  });
