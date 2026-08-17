import React, {useState} from 'react';
import {FlatList, StyleSheet, Text, View} from 'react-native';
import Animated, {FadeInDown} from 'react-native-reanimated';
import {formatDate} from '@munim/core';
import {getApi} from '../lib/api';
import {useAsync} from '../lib/use-async';
import {money} from '../lib/format';
import {successFeedback, errorFeedback} from '../lib/haptics';
import {
  Badge,
  Button,
  Card,
  Empty,
  Field,
  Header,
  Loading,
  ModalSheet,
  Row,
  Screen,
  colors,
} from '../components/ui';
import {useThemeStyles} from '../theme';

export function PartiesScreen() {
  const styles = useThemeStyles(makeStyles);
  const {data: parties, loading, reload: reloadParties} = useAsync(
    async () => (await getApi()).parties.balances().then(r => r.balances),
    [],
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState('');

  const [advanceOpen, setAdvanceOpen] = useState(false);
  const [direction, setDirection] = useState<'GIVEN' | 'TAKEN'>('GIVEN');
  const [amount, setAmount] = useState('');

  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentDirection, setPaymentDirection] = useState<'IN' | 'OUT'>('IN');
  const [paymentAmount, setPaymentAmount] = useState('');

  const [saving, setSaving] = useState(false);
  const [ledger, setLedger] = useState<{lines: {id: string; date: string; description: string; debit: number; credit: number; balance: number}[]; balance: number} | null>(null);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [openAdvances, setOpenAdvances] = useState<{id: string; direction: 'GIVEN' | 'TAKEN'; amount: number; date: string}[] | null>(null);

  const selected = parties?.find(p => p.id === selectedId) ?? null;

  async function openLedger(party: {id: string}) {
    setSelectedId(party.id);
    setLedgerLoading(true);
    try {
      const api = await getApi();
      const [detail, advances] = await Promise.all([
        api.parties.get(party.id),
        api.advances.list(party.id),
      ]);
      setLedger(detail.ledger);
      setOpenAdvances(
        advances
          .filter(a => a.status === 'OPEN')
          .map(a => ({id: a.id, direction: a.direction, amount: a.amount, date: a.date})),
      );
    } catch {
      setLedger(null);
      setOpenAdvances(null);
    } finally {
      setLedgerLoading(false);
    }
  }

  async function handleSettleAdvance(id: string) {
    try {
      await (await getApi()).advances.settle(id);
      successFeedback();
      reloadParties();
      if (selected) {
        void openLedger(selected);
      }
    } catch {
      errorFeedback();
      // keep for retry
    }
  }

  async function handleAddParty() {
    if (!newName.trim()) {
      return;
    }
    setSaving(true);
    try {
      const party = await (await getApi()).parties.create({name: newName.trim(), type: 'CUSTOMER'});
      successFeedback();
      setAddOpen(false);
      setNewName('');
      reloadParties();
      void openLedger(party);
    } catch {
      errorFeedback();
      // keep modal open
    } finally {
      setSaving(false);
    }
  }

  async function handleAdvance() {
    if (!selectedId) {
      return;
    }
    const value = Number(amount);
    if (!value || value <= 0) {
      return;
    }
    setSaving(true);
    try {
      await (await getApi()).advances.create({partyId: selectedId, direction, amount: value});
      successFeedback();
      setAdvanceOpen(false);
      setAmount('');
      reloadParties();
      if (selected) {
        void openLedger(selected);
      }
    } catch {
      errorFeedback();
      // keep modal open
    } finally {
      setSaving(false);
    }
  }

  async function handlePayment() {
    if (!selectedId) {
      return;
    }
    const value = Number(paymentAmount);
    if (!value || value <= 0) {
      return;
    }
    setSaving(true);
    try {
      await (await getApi()).payments.create({
        partyId: selectedId,
        direction: paymentDirection,
        amount: value,
        method: 'cash',
      });
      successFeedback();
      setPaymentOpen(false);
      setPaymentAmount('');
      reloadParties();
      if (selected) {
        void openLedger(selected);
      }
    } catch {
      errorFeedback();
      // keep for retry
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen>
      <Header title="Parties & Khata" subtitle="Who owes whom — advances given & taken" />
      {loading || !parties ? (
        <Loading />
      ) : (
        <FlatList
          data={parties}
          keyExtractor={item => item.id}
          ListHeaderComponent={
            <Animated.View entering={FadeInDown.duration(280)} style={{marginHorizontal: 16, marginBottom: 10}}>
              <Button title="+ Add party" onPress={() => setAddOpen(true)} />
            </Animated.View>
          }
          ListEmptyComponent={<Empty text="No parties yet — add customers, suppliers or workers" />}
          contentContainerStyle={{paddingBottom: 90}}
          renderItem={({item, index}) => (
            <Card index={index}>
              <Row
                label={`${item.name}${item.phone ? ` · ${item.phone}` : ''}`}
                value={
                  item.balance > 0
                    ? `${money(item.balance)} due`
                    : item.balance < 0
                    ? `${money(-item.balance)} owed`
                    : 'Settled'
                }
                valueColor={item.balance > 0 ? colors.danger : item.balance < 0 ? colors.success : colors.muted}
                onPress={() => openLedger(item)}
              />
              {item.id === selectedId ? (
                <View style={{marginTop: 6, gap: 8}}>
                  <View style={{flexDirection: 'row', gap: 8}}>
                    <View style={{flex: 1}}>
                      <Badge text={`Given ${money(item.given)}`} tone="danger" />
                    </View>
                    <View style={{flex: 1}}>
                      <Badge text={`Taken ${money(item.taken)}`} tone="success" />
                    </View>
                  </View>
                  <View style={{flexDirection: 'row', gap: 8}}>
                    <Button
                      title="Advance given"
                      variant="outline"
                      style={{flex: 1}}
                      onPress={() => {
                        setDirection('GIVEN');
                        setAmount('');
                        setAdvanceOpen(true);
                      }}
                    />
                    <Button
                      title="Advance taken"
                      variant="outline"
                      style={{flex: 1}}
                      onPress={() => {
                        setDirection('TAKEN');
                        setAmount('');
                        setAdvanceOpen(true);
                      }}
                    />
                  </View>
                  <View style={{flexDirection: 'row', gap: 8}}>
                    <Button
                      title="Money in"
                      variant="outline"
                      style={{flex: 1}}
                      onPress={() => {
                        setPaymentDirection('IN');
                        setPaymentAmount('');
                        setPaymentOpen(true);
                      }}
                    />
                    <Button
                      title="Money out"
                      variant="outline"
                      style={{flex: 1}}
                      onPress={() => {
                        setPaymentDirection('OUT');
                        setPaymentAmount('');
                        setPaymentOpen(true);
                      }}
                    />
                  </View>
                  {openAdvances && openAdvances.length > 0 ? (
                    <View style={{gap: 6, marginTop: 4}}>
                      <Text style={{fontSize: 11, color: colors.muted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4}}>
                        Open advances
                      </Text>
                      {openAdvances.map(a => (
                        <View key={a.id} style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8}}>
                          <View style={{flex: 1}}>
                            <Text style={{fontSize: 13, color: colors.text, fontWeight: '600'}}>
                              {money(a.amount)}{' '}
                              <Text style={{color: a.direction === 'GIVEN' ? colors.danger : colors.success, fontWeight: '400'}}>
                                {a.direction === 'GIVEN' ? 'given' : 'taken'}
                              </Text>
                            </Text>
                            <Text style={{fontSize: 11, color: colors.muted}}>{formatDate(a.date)}</Text>
                          </View>
                          <Button title="Settle" variant="outline" onPress={() => handleSettleAdvance(a.id)} />
                        </View>
                      ))}
                    </View>
                  ) : null}
                </View>
              ) : null}
            </Card>
          )}
        />
      )}

      {ledger && selected ? (
        <Card index={1}>
          <Text style={styles.ledgerTitle}>Ledger — {selected.name}</Text>
          {ledgerLoading ? (
            <Loading />
          ) : ledger.lines.length === 0 ? (
            <Text style={{color: colors.muted, fontSize: 13}}>No transactions yet</Text>
          ) : (
            ledger.lines.map(line => (
              <View key={line.id} style={styles.ledgerLine}>
                <View style={{flex: 1}}>
                  <Text style={{fontSize: 13, color: colors.text}}>{line.description}</Text>
                  <Text style={{fontSize: 11, color: colors.muted}}>{formatDate(line.date)}</Text>
                </View>
                <Text style={{fontSize: 13, fontWeight: '600', color: line.balance > 0 ? colors.danger : line.balance < 0 ? colors.success : colors.text}}>
                  {money(line.balance)}
                </Text>
              </View>
            ))
          )}
        </Card>
      ) : null}

      <ModalSheet visible={addOpen} title="Add party" onClose={() => setAddOpen(false)} dismissable={!saving}>
        <Field label="Name" value={newName} onChangeText={setNewName} placeholder="e.g. Ramesh (supplier)" />
        <Button title="Add" onPress={handleAddParty} />
      </ModalSheet>

      <ModalSheet visible={advanceOpen} title={direction === 'GIVEN' ? 'Advance given' : 'Advance taken'} onClose={() => setAdvanceOpen(false)} dismissable={!saving}>
        <Field label="Amount" value={amount} onChangeText={setAmount} keyboardType="numeric" />
        <Button title="Save advance" onPress={handleAdvance} />
      </ModalSheet>

      <ModalSheet
        visible={paymentOpen}
        title={paymentDirection === 'IN' ? 'Money in (received)' : 'Money out (paid)'}
        onClose={() => setPaymentOpen(false)}
        dismissable={!saving}>
        <Field label="Amount" value={paymentAmount} onChangeText={setPaymentAmount} keyboardType="numeric" />
        <Button title="Record payment" onPress={handlePayment} />
      </ModalSheet>
    </Screen>
  );
}

const makeStyles = () =>
  StyleSheet.create({
    ledgerTitle: {fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 8},
    ledgerLine: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 6,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
  });
