/**
 * AdvancesScreen — receivables/payables overview, quick record.
 *
 * Redesigned with:
 * - Responsive 2-column summary stats
 * - FlashList for party cards
 * - Better visual hierarchy
 * - Keyboard-aware quick record form
 */

import React, {useMemo, useState} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {FlashList} from '@shopify/flash-list';
import {TrendingDown, TrendingUp} from 'lucide-react-native';
import {type PartyBalanceDto} from '@munim/core';
import {
  useCreateAdvance,
  useParties,
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
  Header,
  Loading,
  ModalSheet,
  Screen,
  colors,
} from '../components/ui';
import {useThemeStyles} from '../theme';

type ActionKind = 'GIVEN' | 'TAKEN' | 'PAYMENT_IN' | 'PAYMENT_OUT';
type Action = {party: PartyBalanceDto; kind: ActionKind};

const TYPE_LABELS: Record<string, string> = {CUSTOMER: 'Customer', SUPPLIER: 'Supplier', WORKER: 'Worker', OTHER: 'Other'};

export function AdvancesScreen() {
  const styles = useThemeStyles(makeStyles);
  const {data: balancesData, loading, error} = useQueryState(usePartyBalances());
  const balances = balancesData?.balances;
  const {data: parties} = useQueryState(useParties());

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

  const createAdvance = useCreateAdvance();
  const recordPartyPayment = useRecordPartyPayment();

  const receivables = useMemo(() => (balances ?? []).filter(p => p.balance > 0.001), [balances]);
  const payables = useMemo(() => (balances ?? []).filter(p => p.balance < -0.001), [balances]);
  const totalReceivable = receivables.reduce((s, p) => s + p.balance, 0);
  const totalPayable = payables.reduce((s, p) => s + Math.abs(p.balance), 0);
  const quickParty = parties?.find(p => p.id === quickPartyId) ?? null;

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
      } else {
        await recordPartyPayment.mutateAsync({partyId: action.party.id, direction: action.kind === 'PAYMENT_IN' ? 'IN' : 'OUT', amount: value, method: 'cash', note: note.trim() || undefined});
      }
      successFeedback();
      setAction(null);
    } catch {
      errorFeedback();
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
      successFeedback();
      setQuickAmount('');
      setQuickNote('');
      setQuickOpen(false);
    } catch {
      errorFeedback();
    } finally {
      setBusy(false);
    }
  }

  const actionTitle = action?.kind === 'GIVEN' ? 'Give advance' : action?.kind === 'TAKEN' ? 'Take advance' : action?.kind === 'PAYMENT_IN' ? 'Receive payment' : 'Make payment';

  const renderPartyCard = ({item, type}: {item: PartyBalanceDto; type: 'receivable' | 'payable'}) => (
    <View key={item.id} style={styles.partyRow}>
      <View style={[styles.avatar, {backgroundColor: type === 'receivable' ? colors.successSoft : colors.dangerSoft}]}>
        <Text style={[styles.avatarText, {color: type === 'receivable' ? colors.success : colors.danger}]}>
          {item.name.charAt(0).toUpperCase()}
        </Text>
      </View>
      <View style={{flex: 1}}>
        <Text style={styles.partyName} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.partyType}>{TYPE_LABELS[item.type] ?? item.type.toLowerCase()}</Text>
      </View>
      <Text style={[styles.partyBalance, {color: type === 'receivable' ? colors.success : colors.danger}]}>
        {money(Math.abs(item.balance))}
      </Text>
      <View style={{flexDirection: 'row', gap: spacing.xs}}>
        <Button title={type === 'receivable' ? 'Collect' : 'Pay'} variant="outline" size="small" onPress={() => openAction(item, type === 'receivable' ? 'PAYMENT_IN' : 'PAYMENT_OUT')} />
        <Button title={type === 'receivable' ? '+Give' : '+Take'} variant="outline" size="small" onPress={() => openAction(item, type === 'receivable' ? 'GIVEN' : 'TAKEN')} />
      </View>
    </View>
  );

  return (
    <Screen>
      <Header title="Advances" subtitle="Money overview" />

      {/* Summary cards — 2-column */}
      <View style={styles.summaryGrid}>
        <View style={styles.summaryRow}>
          <Card style={styles.summaryCard} index={0}>
            <View style={[styles.summaryIcon, {backgroundColor: colors.successSoft}]}>
              <TrendingUp size={rs(16)} color={colors.success} strokeWidth={2.2} />
            </View>
            <Text style={styles.summaryLabel}>You will receive</Text>
            <Text style={[styles.summaryValue, {color: colors.success}]}>{money(totalReceivable)}</Text>
          </Card>
          <Card style={styles.summaryCard} index={1}>
            <View style={[styles.summaryIcon, {backgroundColor: colors.dangerSoft}]}>
              <TrendingDown size={rs(16)} color={colors.danger} strokeWidth={2.2} />
            </View>
            <Text style={styles.summaryLabel}>You will pay</Text>
            <Text style={[styles.summaryValue, {color: colors.danger}]}>{money(totalPayable)}</Text>
          </Card>
        </View>
        <Card style={[styles.summaryCard, {marginHorizontal: CARD_MARGIN}]} index={2}>
          <Text style={styles.summaryLabel}>Net position</Text>
          <Text style={[styles.summaryValue, {color: totalReceivable - totalPayable >= 0 ? colors.success : colors.danger}]}>
            {money(totalReceivable - totalPayable)}
          </Text>
        </Card>
      </View>

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
      ) : (
        <>
          {/* Receivables */}
          <Card style={{marginHorizontal: CARD_MARGIN}} index={1}>
            <View style={styles.khataHeader}>
              <View style={[styles.khataIcon, {backgroundColor: colors.successSoft}]}>
                <TrendingUp size={rs(16)} color={colors.success} strokeWidth={2.2} />
              </View>
              <View>
                <Text style={styles.khataTitle}>Receivables</Text>
                <Text style={styles.khataSubtitle}>These parties owe us</Text>
              </View>
            </View>
            {receivables.length === 0 ? (
              <Text style={styles.emptyText}>No receivables</Text>
            ) : (
              receivables.map(p => renderPartyCard({item: p, type: 'receivable'}))
            )}
          </Card>

          {/* Payables */}
          <Card style={{marginHorizontal: CARD_MARGIN}} index={2}>
            <View style={styles.khataHeader}>
              <View style={[styles.khataIcon, {backgroundColor: colors.dangerSoft}]}>
                <TrendingDown size={rs(16)} color={colors.danger} strokeWidth={2.2} />
              </View>
              <View>
                <Text style={styles.khataTitle}>Payables</Text>
                <Text style={styles.khataSubtitle}>We owe these parties</Text>
              </View>
            </View>
            {payables.length === 0 ? (
              <Text style={styles.emptyText}>No payables</Text>
            ) : (
              payables.map(p => renderPartyCard({item: p, type: 'payable'}))
            )}
          </Card>
        </>
      )}

      {/* Quick party picker */}
      <ModalSheet visible={quickOpen} title="Select party" onClose={() => setQuickOpen(false)}>
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

      {/* Action sheet */}
      <ModalSheet visible={!!action} title={actionTitle} onClose={() => setAction(null)} dismissable={!busy}>
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
    </Screen>
  );
}

const makeStyles = () =>
  StyleSheet.create({
    summaryGrid: {marginBottom: spacing.sm},
    summaryRow: {flexDirection: 'row', gap: GRID_GAP, paddingHorizontal: CARD_MARGIN, marginBottom: GRID_GAP},
    summaryCard: {flex: 1, marginHorizontal: 0, marginBottom: 0, paddingVertical: spacing.md, paddingHorizontal: spacing.md},
    summaryIcon: {width: rs(30), height: rs(30), borderRadius: rs(8), alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xs},
    summaryLabel: {fontSize: typography.label, color: colors.muted, fontWeight: '600'},
    summaryValue: {fontSize: typography.h2, fontWeight: '700', marginTop: rs(4)},
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
    partyRow: {flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border},
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
  });
