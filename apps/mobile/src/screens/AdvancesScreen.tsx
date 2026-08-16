import React, {useMemo, useState} from 'react';
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {ChevronDown, TrendingDown, TrendingUp} from 'lucide-react-native';
import {
  createAdvance,
  getPartyBalances,
  listParties,
  recordPayment,
  type PartyBalance,
} from '@munim/core';
import {getCore} from '../lib/core';
import {useAsync} from '../lib/use-async';
import {money} from '../lib/format';
import {successFeedback, errorFeedback, selectionTick} from '../lib/haptics';
import {
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

type ActionKind = 'GIVEN' | 'TAKEN' | 'PAYMENT_IN' | 'PAYMENT_OUT';

type Action = {
  party: PartyBalance;
  kind: ActionKind;
};

const TYPE_LABELS: Record<string, string> = {
  CUSTOMER: 'Customer',
  SUPPLIER: 'Supplier',
  WORKER: 'Worker',
  OTHER: 'Other',
};

export function AdvancesScreen() {
  const styles = useThemeStyles(makeStyles);
  const {data: balances, loading, error, reload} = useAsync(
    async () => getPartyBalances(await getCore()),
    [],
  );
  const {data: parties} = useAsync(async () => listParties(await getCore()), []);

  const [action, setAction] = useState<Action | null>(null);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  // Quick record — its own state so values never leak into the action sheet
  // (or the other way around).
  const [quickOpen, setQuickOpen] = useState(false);
  const [quickPartyId, setQuickPartyId] = useState('');
  const [quickKind, setQuickKind] = useState<'GIVEN' | 'TAKEN'>('GIVEN');
  const [quickAmount, setQuickAmount] = useState('');
  const [quickNote, setQuickNote] = useState('');

  const receivables = useMemo(() => (balances ?? []).filter(p => p.balance > 0.001), [balances]);
  const payables = useMemo(() => (balances ?? []).filter(p => p.balance < -0.001), [balances]);
  const totalReceivable = receivables.reduce((s, p) => s + p.balance, 0);
  const totalPayable = payables.reduce((s, p) => s + Math.abs(p.balance), 0);
  const quickParty = parties?.find(p => p.id === quickPartyId) ?? null;

  function openAction(party: PartyBalance, kind: ActionKind) {
    setAction({party, kind});
    setAmount('');
    setNote('');
  }

  async function submitAction() {
    if (!action) {
      return;
    }
    const value = Number(amount);
    if (!value || value <= 0) {
      return;
    }
    setBusy(true);
    try {
      const core = await getCore();
      if (action.kind === 'GIVEN' || action.kind === 'TAKEN') {
        await createAdvance(core, {
          partyId: action.party.id,
          direction: action.kind,
          amount: value,
          note: note.trim() || undefined,
        });
      } else {
        await recordPayment(core, {
          partyId: action.party.id,
          direction: action.kind === 'PAYMENT_IN' ? 'IN' : 'OUT',
          amount: value,
          method: 'cash',
          note: note.trim() || undefined,
        });
      }
      successFeedback();
      setAction(null);
      reload();
    } catch {
      errorFeedback();
    } finally {
      setBusy(false);
    }
  }

  async function submitQuick() {
    if (!quickPartyId) {
      return;
    }
    const value = Number(quickAmount);
    if (!value || value <= 0) {
      return;
    }
    setBusy(true);
    try {
      await createAdvance(await getCore(), {
        partyId: quickPartyId,
        direction: quickKind,
        amount: value,
        note: quickNote.trim() || undefined,
      });
      successFeedback();
      setQuickAmount('');
      setQuickNote('');
      setQuickOpen(false);
      reload();
    } catch {
      errorFeedback();
    } finally {
      setBusy(false);
    }
  }

  function selectQuickParty(id: string) {
    selectionTick();
    setQuickPartyId(id);
    setQuickOpen(false);
  }

  const actionTitle =
    action?.kind === 'GIVEN'
      ? 'Give advance'
      : action?.kind === 'TAKEN'
      ? 'Take advance'
      : action?.kind === 'PAYMENT_IN'
      ? 'Receive payment'
      : 'Make payment';

  return (
    <Screen>
      <Header title="Advances" subtitle="Whom I gave money, whom I still have to pay" />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{paddingBottom: 60}}>
        {/* Summary */}
        <View style={styles.statsRow}>
          <StatBox
            label="We are owed (udhaar)"
            value={money(totalReceivable)}
            valueColor={colors.success}
            index={0}
          />
          <StatBox label="We owe (payable)" value={money(totalPayable)} valueColor={colors.danger} index={1} />
          <StatBox
            label="Net position"
            value={money(totalReceivable - totalPayable)}
            valueColor={colors.primary}
            index={2}
          />
        </View>

        {/* Quick record */}
        <Card index={0}>
          <Text style={styles.cardTitle}>Quick record</Text>
          <Pressable
            onPress={() => setQuickOpen(true)}
            style={({pressed}) => [
              styles.partyPicker,
              pressed && {opacity: 0.7},
            ]}>
            <View style={{flex: 1}}>
              <Text style={styles.pickerLabel}>Party</Text>
              <Text style={styles.pickerValue}>
                {quickParty ? quickParty.name : 'Select party…'}
              </Text>
            </View>
            <ChevronDown size={18} color={colors.muted} />
          </Pressable>

          <View style={styles.kindRow}>
            <Pressable
              onPress={() => {
                selectionTick();
                setQuickKind('GIVEN');
              }}
              style={[
                styles.kindChip,
                quickKind === 'GIVEN' && {backgroundColor: colors.primary, borderColor: colors.primary},
              ]}>
              <Text style={[styles.kindChipText, quickKind === 'GIVEN' && {color: colors.onPrimary}]}>
                I gave advance (they owe me)
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                selectionTick();
                setQuickKind('TAKEN');
              }}
              style={[
                styles.kindChip,
                quickKind === 'TAKEN' && {backgroundColor: colors.primary, borderColor: colors.primary},
              ]}>
              <Text style={[styles.kindChipText, quickKind === 'TAKEN' && {color: colors.onPrimary}]}>
                I took advance (I owe them)
              </Text>
            </Pressable>
          </View>

          <View style={{flexDirection: 'row', gap: 8}}>
            <Field
              label="Amount"
              value={quickAmount}
              onChangeText={setQuickAmount}
              keyboardType="numeric"
              style={{flex: 1}}
            />
            <Field
              label="Note (optional)"
              value={quickNote}
              onChangeText={setQuickNote}
              style={{flex: 2}}
            />
          </View>
          <Button
            title={busy ? 'Saving…' : 'Record advance'}
            onPress={() => void submitQuick()}
            loading={busy}
            disabled={!quickPartyId || !Number(quickAmount) || Number(quickAmount) <= 0}
          />
        </Card>

        {loading || !balances ? (
          <Loading rows={4} />
        ) : error ? (
          <Empty text={error} />
        ) : (
          <>
            {/* Receivables — money given out */}
            <Card index={1}>
              <View style={styles.khataHeader}>
                <View style={styles.khataTitleWrap}>
                  <View style={[styles.khataIcon, {backgroundColor: colors.successSoft}]}>
                    <TrendingUp size={16} color={colors.success} strokeWidth={2.2} />
                  </View>
                  <View>
                    <Text style={styles.khataTitle}>Whom I gave advance / money</Text>
                    <Text style={styles.khataSubtitle}>These parties owe us money (receivables)</Text>
                  </View>
                </View>
              </View>
              {receivables.length === 0 ? (
                <Text style={styles.emptyText}>
                  No receivables — you haven&apos;t given anyone money.
                </Text>
              ) : (
                receivables.map(p => (
                  <View key={p.id} style={styles.partyRow}>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>{p.name.charAt(0).toUpperCase()}</Text>
                    </View>
                    <View style={{flex: 1}}>
                      <Text style={styles.partyName} numberOfLines={1}>
                        {p.name}
                      </Text>
                      <Text style={styles.partyType}>
                        {TYPE_LABELS[p.type] ?? p.type.toLowerCase()}
                      </Text>
                    </View>
                    <Text style={[styles.partyBalance, {color: colors.success}]}>
                      {money(p.balance)}
                    </Text>
                    <View style={{flexDirection: 'row', gap: 6}}>
                      <Button
                        title="Collect"
                        variant="outline"
                        onPress={() => openAction(p, 'PAYMENT_IN')}
                        style={styles.miniBtn}
                      />
                      <Button
                        title="+Give"
                        variant="outline"
                        onPress={() => openAction(p, 'GIVEN')}
                        style={styles.miniBtn}
                      />
                    </View>
                  </View>
                ))
              )}
            </Card>

            {/* Payables — money owed to others */}
            <Card index={2}>
              <View style={styles.khataHeader}>
                <View style={styles.khataTitleWrap}>
                  <View style={[styles.khataIcon, {backgroundColor: colors.dangerSoft}]}>
                    <TrendingDown size={16} color={colors.danger} strokeWidth={2.2} />
                  </View>
                  <View>
                    <Text style={styles.khataTitle}>Whom I still have to give money</Text>
                    <Text style={styles.khataSubtitle}>We owe these parties (payables)</Text>
                  </View>
                </View>
              </View>
              {payables.length === 0 ? (
                <Text style={styles.emptyText}>No payables — you owe no one.</Text>
              ) : (
                payables.map(p => (
                  <View key={p.id} style={styles.partyRow}>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>{p.name.charAt(0).toUpperCase()}</Text>
                    </View>
                    <View style={{flex: 1}}>
                      <Text style={styles.partyName} numberOfLines={1}>
                        {p.name}
                      </Text>
                      <Text style={styles.partyType}>
                        {TYPE_LABELS[p.type] ?? p.type.toLowerCase()}
                      </Text>
                    </View>
                    <Text style={[styles.partyBalance, {color: colors.danger}]}>
                      {money(Math.abs(p.balance))}
                    </Text>
                    <View style={{flexDirection: 'row', gap: 6}}>
                      <Button
                        title="Pay"
                        variant="outline"
                        onPress={() => openAction(p, 'PAYMENT_OUT')}
                        style={styles.miniBtn}
                      />
                      <Button
                        title="+Take"
                        variant="outline"
                        onPress={() => openAction(p, 'TAKEN')}
                        style={styles.miniBtn}
                      />
                    </View>
                  </View>
                ))
              )}
            </Card>
          </>
        )}
      </ScrollView>

      {/* Quick-record party picker */}
      <ModalSheet visible={quickOpen} title="Select party" onClose={() => setQuickOpen(false)}>
        {parties && parties.length > 0 ? (
          <FlatList
            data={parties}
            keyExtractor={item => item.id}
            style={{maxHeight: 340}}
            renderItem={({item}) => (
              <Pressable
                onPress={() => selectQuickParty(item.id)}
                style={({pressed}) => [
                  styles.pickRow,
                  pressed && {backgroundColor: colors.mutedBg},
                ]}>
                <Text style={{flex: 1, fontSize: 15, color: colors.text, fontWeight: '600'}}>
                  {item.name}
                </Text>
                <Text style={{fontSize: 12, color: colors.muted}}>
                  {TYPE_LABELS[item.type] ?? item.type.toLowerCase()}
                </Text>
              </Pressable>
            )}
          />
        ) : (
          <Empty text="No parties yet — add one from the Khata tab first" />
        )}
      </ModalSheet>

      {/* Action sheet (Collect / Pay / +Give / +Take) */}
      <ModalSheet visible={!!action} title={actionTitle} onClose={() => setAction(null)} dismissable={!busy}>
        {action ? (
          <>
            <View style={styles.actionParty}>
              <View style={{flex: 1}}>
                <Text style={styles.partyName}>{action.party.name}</Text>
                <Text style={styles.partyType}>
                  {TYPE_LABELS[action.party.type] ?? action.party.type.toLowerCase()}
                </Text>
              </View>
              <View style={{alignItems: 'flex-end'}}>
                <Text style={styles.payLabel}>Current balance</Text>
                <Text
                  style={[
                    styles.partyBalance,
                    {color: action.party.balance > 0 ? colors.success : action.party.balance < 0 ? colors.danger : colors.text},
                  ]}>
                  {money(action.party.balance)}
                </Text>
              </View>
            </View>
            <Field label="Amount" value={amount} onChangeText={setAmount} keyboardType="numeric" />
            <Field label="Note (optional)" value={note} onChangeText={setNote} />
            <Button
              title={busy ? 'Saving…' : 'Confirm'}
              onPress={() => void submitAction()}
              loading={busy}
              disabled={!Number(amount) || Number(amount) <= 0}
            />
          </>
        ) : null}
      </ModalSheet>
    </Screen>
  );
}

const makeStyles = () =>
  StyleSheet.create({
    statsRow: {flexDirection: 'row', gap: 10, marginHorizontal: 16, marginBottom: 10},
    cardTitle: {fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 12},
    partyPicker: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      marginBottom: 10,
      backgroundColor: colors.card,
    },
    pickerLabel: {fontSize: 11, color: colors.muted, fontWeight: '600'},
    pickerValue: {fontSize: 15, color: colors.text, marginTop: 2},
    kindRow: {flexDirection: 'row', gap: 8, marginBottom: 10},
    kindChip: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingVertical: 9,
      paddingHorizontal: 8,
      alignItems: 'center',
      backgroundColor: colors.card,
    },
    kindChipText: {fontSize: 11, fontWeight: '600', color: colors.muted, textAlign: 'center'},
    khataHeader: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6},
    khataTitleWrap: {flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1},
    khataIcon: {width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center'},
    khataTitle: {fontSize: 14, fontWeight: '700', color: colors.text},
    khataSubtitle: {fontSize: 11, color: colors.muted, marginTop: 1},
    emptyText: {fontSize: 12, color: colors.muted, textAlign: 'center', paddingVertical: 20},
    partyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 9,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    avatar: {
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: colors.mutedSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: {fontSize: 13, fontWeight: '700', color: colors.text},
    partyName: {fontSize: 14, fontWeight: '600', color: colors.text},
    partyType: {fontSize: 11, color: colors.muted, textTransform: 'capitalize', marginTop: 1},
    partyBalance: {fontSize: 14, fontWeight: '700'},
    miniBtn: {paddingVertical: 5, paddingHorizontal: 10},
    pickRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 4,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    actionParty: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.mutedSoft,
      borderRadius: 10,
      padding: 12,
      marginBottom: 12,
    },
    payLabel: {fontSize: 11, color: colors.muted, fontWeight: '600'},
  });
