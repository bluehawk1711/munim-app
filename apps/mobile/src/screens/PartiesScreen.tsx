/**
 * PartiesScreen — party management, ledger, advances, payments.
 *
 * Redesigned with:
 * - Responsive party cards with balance indicators
 * - BottomSheet-based ledger view
 * - FlashList for party list
 * - Keyboard-aware forms
 */

import React, {useMemo, useState} from 'react';
import {Pressable, StyleSheet, Text, TextInput, View} from 'react-native';
import {FlashList} from '@shopify/flash-list';
import {formatDate} from '@munim/core';
import type {PartyUpdateValues} from '@munim/core';
import {Search, X} from 'lucide-react-native';
import {
  useAdvances,
  useCreateAdvance,
  useCreateParty,
  useDeleteParty,
  useParty,
  usePartyBalances,
  useQueryState,
  useRecordPartyPayment,
  useSettleAdvance,
  useUpdateParty,
} from '@munim/query';
import {money} from '../lib/format';
import {successFeedback, errorFeedback} from '../lib/haptics';
import {rs, typography, spacing, radii, CARD_MARGIN, TOUCH_TARGET} from '../lib/responsive';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  Empty,
  Field,
  Loading,
  ModalSheet,
  Screen,
  colors,
} from '../components/ui';
import {HomeHeader, headerScrollHandlers} from '../components/home-header';
import {useThemeStyles} from '../theme';

type PartyType = 'CUSTOMER' | 'SUPPLIER' | 'WORKER' | 'OTHER';

const TYPE_LABELS: Record<PartyType, string> = {
  CUSTOMER: 'Customer',
  SUPPLIER: 'Supplier',
  WORKER: 'Worker',
  OTHER: 'Other',
};

const TYPE_FILTERS: ReadonlyArray<{key: PartyType | 'ALL'; label: string}> = [
  {key: 'ALL', label: 'All'},
  {key: 'CUSTOMER', label: 'Customers'},
  {key: 'SUPPLIER', label: 'Suppliers'},
  {key: 'WORKER', label: 'Workers'},
  {key: 'OTHER', label: 'Other'},
];

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
  const [newPhone, setNewPhone] = useState('');
  const [newType, setNewType] = useState<PartyType>('CUSTOMER');
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editType, setEditType] = useState<PartyType>('CUSTOMER');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [advanceOpen, setAdvanceOpen] = useState(false);
  const [direction, setDirection] = useState<'GIVEN' | 'TAKEN'>('GIVEN');
  const [amount, setAmount] = useState('');
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentDirection, setPaymentDirection] = useState<'IN' | 'OUT'>('IN');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [saving, setSaving] = useState(false);

  // Directory search + type filter (parity with web/desktop parties).
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<PartyType | 'ALL'>('ALL');

  // Mutations
  const settleAdvance = useSettleAdvance();
  const createParty = useCreateParty();
  const updateParty = useUpdateParty();
  const deleteParty = useDeleteParty();
  const createAdvance = useCreateAdvance();
  const recordPartyPayment = useRecordPartyPayment();

  const filteredParties = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (parties ?? []).filter(p => {
      const matchesSearch =
        !q || p.name.toLowerCase().includes(q) || (p.phone ?? '').toLowerCase().includes(q);
      const matchesType = typeFilter === 'ALL' || p.type === typeFilter;
      return matchesSearch && matchesType;
    });
  }, [parties, search, typeFilter]);

  async function handleAddParty() {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      const party = await createParty.mutateAsync({
        name: newName.trim(),
        phone: newPhone.trim() || undefined,
        type: newType,
      });
      successFeedback(`${newName} added to khata`);
      setAddOpen(false);
      setNewName('');
      setNewPhone('');
      setNewType('CUSTOMER');
      setSelectedId(party.id);
    } catch {
      errorFeedback('Failed to add party');
    } finally {
      setSaving(false);
    }
  }

  function openEditParty() {
    if (!selected) return;
    setEditName(selected.name);
    setEditPhone(selected.phone ?? '');
    setEditType(selected.type as PartyType);
    setEditOpen(true);
  }

  async function handleEditParty() {
    if (!selectedId || !editName.trim()) return;
    const values: PartyUpdateValues = {
      name: editName.trim(),
      phone: editPhone.trim(),
      type: editType,
    };
    setSaving(true);
    try {
      await updateParty.mutateAsync({id: selectedId, values});
      successFeedback('Party updated');
      setEditOpen(false);
    } catch {
      errorFeedback('Failed to update party');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteParty() {
    if (!selectedId) return;
    setSaving(true);
    try {
      await deleteParty.mutateAsync(selectedId);
      successFeedback('Party deleted');
      setDeleteOpen(false);
      setSelectedId(null);
    } catch {
      errorFeedback('Failed to delete party');
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
            <View style={{flexDirection: 'row', alignItems: 'center', gap: spacing.xs}}>
              <Text style={styles.partyName} numberOfLines={1}>
                {item.name}
              </Text>
              <Badge text={TYPE_LABELS[item.type as PartyType] ?? item.type} tone="muted" />
            </View>
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
          <View style={styles.actionRow}>
            <Button title="Edit details" variant="outline" size="small" style={{flex: 1}} onPress={openEditParty} />
            <Button title="Delete" variant="danger" size="small" style={{flex: 1}} onPress={() => setDeleteOpen(true)} />
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
      <HomeHeader
        title="Khata"
        addLabel="Add party"
        onAddPress={() => {
          setNewName('');
          setNewPhone('');
          setNewType('CUSTOMER');
          setAddOpen(true);
        }}
      />

      {/* Search + type filter (parity with web/desktop) */}
      <View style={styles.searchWrap}>
        <Search size={rs(16)} color={colors.muted} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search name or phone…"
          placeholderTextColor={colors.inputPlaceholder}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
        {search ? (
          <Pressable onPress={() => setSearch('')} style={styles.searchClear} accessibilityLabel="Clear search">
            <X size={rs(16)} color={colors.muted} />
          </Pressable>
        ) : null}
      </View>
      <View style={styles.chipRow}>
        {TYPE_FILTERS.map(f => {
          const active = typeFilter === f.key;
          return (
            <Pressable
              key={f.key}
              onPress={() => setTypeFilter(f.key)}
              style={({pressed}) => [styles.chip, active && styles.chipActive, pressed && {opacity: 0.8}]}>
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{f.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {loading || !parties ? (
        <Loading />
      ) : (
        <FlashList
          data={filteredParties}
          renderItem={renderParty}
          keyExtractor={item => item.id}
          {...headerScrollHandlers}
          ListEmptyComponent={
            <Empty text={search.trim() || typeFilter !== 'ALL' ? 'No parties match your search' : 'No parties yet'} />
          }
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
        <Field label="Phone" value={newPhone} onChangeText={setNewPhone} placeholder="e.g. 98765 43210" keyboardType="phone-pad" />
        <TypeSelector value={newType} onChange={setNewType} />
        <Button title={saving ? 'Adding…' : 'Add party'} onPress={handleAddParty} loading={saving} />
      </ModalSheet>

      {/* Edit party — centered modal */}
      <ModalSheet visible={editOpen} title="Edit party" onClose={() => setEditOpen(false)} dismissable={!saving} centered>
        <Field label="Name" value={editName} onChangeText={setEditName} placeholder="e.g. Ramesh" />
        <Field label="Phone" value={editPhone} onChangeText={setEditPhone} placeholder="e.g. 98765 43210" keyboardType="phone-pad" />
        <TypeSelector value={editType} onChange={setEditType} />
        <Button title={saving ? 'Saving…' : 'Save changes'} onPress={handleEditParty} loading={saving} disabled={!editName.trim()} />
      </ModalSheet>

      {/* Delete party — confirm */}
      <ConfirmDialog
        visible={deleteOpen}
        title="Delete party?"
        message={`${selected?.name ?? 'This party'} — their advances and ledger history will be removed.`}
        confirmLabel="Delete"
        destructive
        onCancel={() => setDeleteOpen(false)}
        onConfirm={() => void handleDeleteParty()}
      />

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

/** Party-type picker used by the Add / Edit party sheets (parity with web's select). */
function TypeSelector({value, onChange}: {value: PartyType; onChange: (t: PartyType) => void}) {
  const styles = useThemeStyles(makeStyles);
  return (
    <View>
      <Text style={[styles.openLabel, {marginBottom: spacing.xs}]}>Type</Text>
      <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs}}>
        {(Object.keys(TYPE_LABELS) as PartyType[]).map(t => {
          const active = value === t;
          return (
            <Pressable
              key={t}
              onPress={() => onChange(t)}
              style={({pressed}) => [styles.chip, active && styles.chipActive, pressed && {opacity: 0.8}]}>
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{TYPE_LABELS[t]}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
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
    searchWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: CARD_MARGIN,
      marginBottom: spacing.sm,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.full,
      backgroundColor: colors.card,
      paddingLeft: spacing.md,
      paddingRight: rs(4),
      height: TOUCH_TARGET,
    },
    searchIcon: {marginRight: spacing.sm},
    searchInput: {flex: 1, fontSize: typography.secondary, color: colors.text, paddingVertical: 0},
    searchClear: {padding: rs(4)},
    chipRow: {flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginHorizontal: CARD_MARGIN, marginBottom: spacing.sm},
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rs(5),
      borderRadius: radii.full,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      paddingHorizontal: rs(11),
      paddingVertical: rs(6),
    },
    chipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    chipText: {fontSize: rs(11.5), fontWeight: '600', color: colors.muted},
    chipTextActive: {color: colors.onPrimary},
  });
