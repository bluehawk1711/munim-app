/**
 * PartiesScreen — party management, ledger, advances, payments.
 *
 * Redesigned with:
 * - Responsive party cards with balance indicators
 * - BottomSheet-based ledger view
 * - FlashList for party list
 * - Keyboard-aware forms
 */

import React, {useState} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {FlashList} from '@shopify/flash-list';
import {formatDate} from '@munim/core';
import {X} from 'lucide-react-native';
import {
  useAdvances,
  useCreateAdvance,
  useCreateParty,
  useParty,
  usePartyBalances,
  useQueryState,
  useRecordPartyPayment,
  useSettleAdvance,
} from '@munim/query';
import {money} from '../lib/format';
import {successFeedback, errorFeedback} from '../lib/haptics';
import {rw, rh, rs, typography, spacing, radii, CARD_MARGIN, TOUCH_TARGET} from '../lib/responsive';
import {
  Badge,
  Button,
  Card,
  Empty,
  Field,
  Loading,
  ModalSheet,
  Screen,
  colors,
} from '../components/ui';
import {HomeHeader, headerScrollHandlers} from '../components/home-header';
import {useThemeStyles} from '../theme';

export function PartiesScreen() {
  const styles = useThemeStyles(makeStyles);
  const {data: balancesData, loading} = useQueryState(usePartyBalances());
  const parties = balancesData?.balances;

  // Selection / ledger
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const partyQ = useQueryState(useParty(selectedId));
  const advancesQ = useQueryState(useAdvances(selectedId ?? undefined));
  const ledger = partyQ.data?.ledger ?? null;
  const ledgerLoading = partyQ.loading;
  const openAdvances = (advancesQ.data ?? []).filter(a => a.status === 'OPEN');
  const selected = parties?.find(p => p.id === selectedId) ?? null;

  // Sheets
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [advanceOpen, setAdvanceOpen] = useState(false);
  const [direction, setDirection] = useState<'GIVEN' | 'TAKEN'>('GIVEN');
  const [amount, setAmount] = useState('');
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentDirection, setPaymentDirection] = useState<'IN' | 'OUT'>('IN');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [saving, setSaving] = useState(false);

  // Mutations
  const settleAdvance = useSettleAdvance();
  const createParty = useCreateParty();
  const createAdvance = useCreateAdvance();
  const recordPartyPayment = useRecordPartyPayment();

  async function handleAddParty() {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      const party = await createParty.mutateAsync({name: newName.trim(), type: 'CUSTOMER'});
      successFeedback(`${newName} added to khata`);
      setAddOpen(false);
      setNewName('');
      setSelectedId(party.id);
    } catch {
      errorFeedback('Failed to add party');
    } finally {
      setSaving(false);
    }
  }

  async function handleAdvance() {
    if (!selectedId) return;
    const value = Number(amount);
    if (!value || value <= 0) return;
    setSaving(true);
    try {
      await createAdvance.mutateAsync({partyId: selectedId, direction, amount: value});
      successFeedback(`Advance ${direction === 'GIVEN' ? 'given' : 'taken'} for ${money(value)}`);
      setAdvanceOpen(false);
      setAmount('');
    } catch {
      errorFeedback('Failed to record advance');
    } finally {
      setSaving(false);
    }
  }

  async function handlePayment() {
    if (!selectedId) return;
    const value = Number(paymentAmount);
    if (!value || value <= 0) return;
    setSaving(true);
    try {
      await recordPartyPayment.mutateAsync({partyId: selectedId, direction: paymentDirection, amount: value, method: 'cash'});
      successFeedback(`Payment ${paymentDirection === 'IN' ? 'received' : 'made'} for ${money(value)}`);
      setPaymentOpen(false);
      setPaymentAmount('');
    } catch {
      errorFeedback('Failed to record payment');
    } finally {
      setSaving(false);
    }
  }

  async function handleSettleAdvance(id: string) {
    try {
      await settleAdvance.mutateAsync(id);
      successFeedback();
    } catch {
      errorFeedback();
    }
  }

  const renderParty = ({item, index}: {item: {id: string; name: string; phone: string | null; balance: number; given: number; taken: number; type: string}; index: number}) => (
    <Card style={{marginHorizontal: CARD_MARGIN}} index={index}>
      <Pressable onPress={() => setSelectedId(item.id === selectedId ? null : item.id)} hitSlop={6}>
        <View style={styles.partyRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{item.name.charAt(0).toUpperCase()}</Text>
          </View>
          <View style={{flex: 1, minWidth: 0}}>
            <Text style={styles.partyName} numberOfLines={1}>
              {item.name}
            </Text>
            {item.phone ? (
              <Text style={[styles.partyPhone, {color: colors.muted}]} numberOfLines={1}>
                {item.phone}
              </Text>
            ) : null}
            <View style={{flexDirection: 'row', gap: spacing.xs, marginTop: rs(10)}}>
              <Badge text={`Given ${money(item.given)}`} tone="danger" />
              <Badge text={`Taken ${money(item.taken)}`} tone="success" />
            </View>
          </View>
          <Text
            style={[styles.partyBalance, {color: item.balance > 0 ? colors.danger : item.balance < 0 ? colors.success : colors.muted}]}>
            {item.balance > 0 ? `${money(item.balance)} due` : item.balance < 0 ? `${money(-item.balance)} owed` : 'Settled'}
          </Text>
        </View>
      </Pressable>

      {/* Expanded actions */}
      {item.id === selectedId ? (
        <View style={styles.expandedActions}>
          <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm}}>
            <Text style={[styles.openLabel, {marginBottom: 0}]}>Actions</Text>
            <Pressable onPress={() => setSelectedId(null)} hitSlop={8} style={{padding: rs(4)}}>
              <X size={rs(18)} color={colors.muted} />
            </Pressable>
          </View>
          <View style={styles.actionRow}>
            <Button title="Advance given" variant="outline" size="small" style={{flex: 1}} onPress={() => { setDirection('GIVEN'); setAmount(''); setAdvanceOpen(true); }} />
            <Button title="Advance taken" variant="outline" size="small" style={{flex: 1}} onPress={() => { setDirection('TAKEN'); setAmount(''); setAdvanceOpen(true); }} />
          </View>
          <View style={styles.actionRow}>
            <Button title="Money in" variant="outline" size="small" style={{flex: 1}} onPress={() => { setPaymentDirection('IN'); setPaymentAmount(''); setPaymentOpen(true); }} />
            <Button title="Money out" variant="outline" size="small" style={{flex: 1}} onPress={() => { setPaymentDirection('OUT'); setPaymentAmount(''); setPaymentOpen(true); }} />
          </View>
          {openAdvances.length > 0 ? (
            <View style={{marginTop: spacing.sm}}>
              <Text style={styles.openLabel}>Open advances</Text>
              {openAdvances.map(a => (
                <View key={a.id} style={styles.advanceRow}>
                  <View style={{flex: 1, minWidth: 0}}>
                    <Text style={[styles.advanceAmount, {fontSize: typography.body}]}>
                      {money(a.amount)}
                      <Text style={{color: a.direction === 'GIVEN' ? colors.danger : colors.success, fontWeight: '400', marginLeft: rs(4)}}>
                        {a.direction === 'GIVEN' ? 'given' : 'taken'}
                      </Text>
                    </Text>
                    <Text style={[styles.advanceDate, {color: colors.muted}]}>{formatDate(a.date)}</Text>
                  </View>
                  <Button title="Settle" variant="outline" size="small" onPress={() => handleSettleAdvance(a.id)} style={{minWidth: rs(80)}} />
                </View>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}
    </Card>
  );

  return (
    <Screen>
      <HomeHeader title="Khata" />

      {loading || !parties ? (
        <Loading />
      ) : (
        <FlashList
          data={parties}
          renderItem={renderParty}
          keyExtractor={item => item.id}
          {...headerScrollHandlers}
          ListHeaderComponent={
            <View style={{marginHorizontal: CARD_MARGIN, marginBottom: spacing.sm}}>
              <Button title="+ Add party" onPress={() => setAddOpen(true)} />
            </View>
          }
          ListEmptyComponent={<Empty text="No parties yet" />}
          contentContainerStyle={{paddingBottom: spacing.xxxl}}
        />
      )}

      {/* Ledger display below list when a party is selected */}
      {ledger && selected ? (
        <Card style={{marginHorizontal: CARD_MARGIN, marginTop: spacing.sm}}>
          <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'}}>
            <Text style={[styles.ledgerTitle, {marginBottom: 0}]}>Ledger — {selected.name}</Text>
            <Pressable onPress={() => setSelectedId(null)} hitSlop={8} style={{padding: rs(4)}}>
              <X size={rs(18)} color={colors.muted} />
            </Pressable>
          </View>
          <View style={{height: spacing.sm}} />
          {ledgerLoading ? (
            <Loading rows={3} />
          ) : ledger.lines.length === 0 ? (
            <Text style={{color: colors.muted, fontSize: typography.secondary}}>No transactions yet</Text>
          ) : (
            ledger.lines.map(line => (
              <View key={line.id} style={styles.ledgerLine}>
                <View style={{flex: 1}}>
                  <Text style={{fontSize: typography.secondary, color: colors.text}}>{line.description}</Text>
                  <Text style={{fontSize: typography.caption, color: colors.muted}}>{formatDate(line.date)}</Text>
                </View>
                <Text style={{fontSize: typography.secondary, fontWeight: '600', color: line.balance > 0 ? colors.danger : line.balance < 0 ? colors.success : colors.text}}>
                  {money(line.balance)}
                </Text>
              </View>
            ))
          )}
        </Card>
      ) : null}

      {/* Add party — centered modal */}
      <ModalSheet visible={addOpen} title="Add party" onClose={() => setAddOpen(false)} dismissable={!saving} centered>
        <Field label="Name" value={newName} onChangeText={setNewName} placeholder="e.g. Ramesh" />
        <Button title={saving ? 'Adding…' : 'Add party'} onPress={handleAddParty} loading={saving} />
      </ModalSheet>

      {/* Advance — centered modal */}
      <ModalSheet visible={advanceOpen} title={direction === 'GIVEN' ? 'Advance given' : 'Advance taken'} onClose={() => setAdvanceOpen(false)} dismissable={!saving} centered>
        <Field label="Amount" value={amount} onChangeText={setAmount} keyboardType="numeric" />
        <Button title={saving ? 'Saving…' : 'Save advance'} onPress={handleAdvance} loading={saving} />
      </ModalSheet>

      {/* Payment — centered modal */}
      <ModalSheet visible={paymentOpen} title={paymentDirection === 'IN' ? 'Money in' : 'Money out'} onClose={() => setPaymentOpen(false)} dismissable={!saving} centered>
        <Field label="Amount" value={paymentAmount} onChangeText={setPaymentAmount} keyboardType="numeric" />
        <Button title={saving ? 'Recording…' : 'Record payment'} onPress={handlePayment} loading={saving} />
      </ModalSheet>
    </Screen>
  );
}

const makeStyles = () =>
  StyleSheet.create({
    partyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.md,
    },
    avatar: {
      width: rs(42),
      height: rs(42),
      borderRadius: rs(21),
      backgroundColor: colors.mutedSoft,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    avatarText: {fontSize: typography.secondary, fontWeight: '700', color: colors.text},
    partyName: {fontSize: typography.body, fontWeight: '600', color: colors.text},
    partyPhone: {fontSize: typography.caption, marginTop: rs(2)},
    partyBalance: {fontSize: typography.secondary, fontWeight: '600'},
    expandedActions: {marginTop: spacing.lg, paddingTop: spacing.lg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, gap: spacing.md},
    actionRow: {flexDirection: 'row', gap: spacing.sm},
    openLabel: {fontSize: typography.caption, color: colors.muted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: rs(0.4), marginBottom: spacing.sm},
    advanceRow: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, paddingVertical: spacing.sm},
    advanceAmount: {fontSize: typography.body, fontWeight: '600', color: colors.text},
    advanceDate: {fontSize: typography.caption, marginTop: rs(2)},
    ledgerTitle: {fontSize: typography.h3, fontWeight: '700', color: colors.text, marginBottom: spacing.sm},
    ledgerLine: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
  });
