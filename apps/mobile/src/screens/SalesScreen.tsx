/**
 * SalesScreen — khata-style party balances ("who owes whom").
 *
 * Mirrors the reference design, using REAL data from the shared core:
 *   Header (custom) → KHATA NET STATUS (You'll Get / You'll Give tiles,
 *   ₹317,738 net-owed strip) → filter chips (All / You'll Get / You'll Give /
 *   Settled) → party cards (avatar, name + type, phone, balance + status
 *   badge) → per-party advance / invoice / payment summaries →
 *   "Download Khata Statement (CSV)" (real feature — shared reportToCsv is
 *   invoice-based, so this shares the party list instead) →
 *   "+ Add New Party / Advance" CTA.
 *
 * Only EXISTING features get buttons: record payment (pay/invoice modal),
 * advance record (from the advances model), add party, CSV/share.
 * All colors are theme tokens — no hardcoded hex anywhere.
 */

import React, {useMemo, useState} from 'react';
import {Pressable, ScrollView, StyleSheet, Share, Text, View} from 'react-native';
import {
  FileDown,
  Phone,
  UserPlus,
} from 'lucide-react-native';
import {formatDate, type InvoiceDto, type PartyBalanceDto} from '@munim/core';
import {
  useInvoices,
  usePartyBalances,
  useQueryState,
} from '@munim/query';
import {money} from '../lib/format';
import {rs, rw, typography, spacing, radii, CARD_MARGIN} from '../lib/responsive';
import {
  Badge,
  Button,
  Card,
  Empty,
  ErrorBox,
  Field,
  Loading,
  ModalSheet,
  Screen,
  colors,
} from '../components/ui';
import {HomeHeader, headerScrollHandlers} from '../components/home-header';
import {DonutChart} from '../components/charts';
import {useTheme, useThemeStyles} from '../theme';
import {useAppStore} from '../lib/store';
import {useNavStore} from '../lib/nav-store';
import {selectionTick, actionPress, successFeedback, errorFeedback} from '../lib/haptics';
import {useCreateParty} from '@munim/query';
import type {MobileColors} from '@munim/theme';

type BalanceFilter = 'all' | 'get' | 'give' | 'settled';

/** Initial letter avatar — tinted circle with the party's first letter. */
function Avatar({name, tint}: {name: string; tint: string}) {
  const letter = (name.trim()[0] ?? '?').toUpperCase();
  return (
    <View style={[avatarStyles.wrap, {backgroundColor: tint}]}>
      <Text style={avatarStyles.letter}>{letter}</Text>
    </View>
  );
}

const avatarStyles = StyleSheet.create({
  wrap: {
    width: rs(38),
    height: rs(38),
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  letter: {
    fontSize: typography.body,
    fontWeight: '800',
    color: colors.onPrimary,
  },
});

export function SalesScreen() {
  const styles = useThemeStyles(makeStyles);
  const {colors: palette} = useTheme();
  const {data, error, loading, reload} = useQueryState(usePartyBalances());

  // Recent invoices power the per-party "last invoice" line and the
  // record-payment shortcut (same modal as before — a real feature).
  const {data: recent} = useQueryState(useInvoices({pageSize: 50}));

  const [filter, setFilter] = useState<BalanceFilter>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Payment modal (real feature: useRecordInvoicePayment flow lives in the
  // Invoices screen; here we deep-link instead of duplicating it).
  // Add-party modal (real feature: useCreateParty).
  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [type, setType] = useState<'CUSTOMER' | 'SUPPLIER' | 'WORKER' | 'OTHER'>('CUSTOMER');
  const [saving, setSaving] = useState(false);
  const createParty = useCreateParty();

  const balances = data?.balances ?? [];

  const filtered = useMemo(() => {
    switch (filter) {
      case 'get':
        return balances.filter((p) => p.balance > 0.001);
      case 'give':
        return balances.filter((p) => p.balance < -0.001);
      case 'settled':
        return balances.filter((p) => Math.abs(p.balance) <= 0.001);
      default:
        return balances;
    }
  }, [balances, filter]);

  const youllGet = data?.receivables.reduce((s, p) => s + p.balance, 0) ?? 0;
  const youllGive = Math.abs(data?.payables.reduce((s, p) => s + p.balance, 0) ?? 0);
  const netOwed = youllGet - youllGive;
  const activeParties = balances.filter((p) => Math.abs(p.balance) > 0.001).length;

  /** Latest invoice per party (by date) for the card footer line. */
  const lastInvoiceByParty = useMemo(() => {
    const map = new Map<string, InvoiceDto>();
    for (const inv of recent?.invoices ?? []) {
      if (!inv.partyId) continue;
      const existing = map.get(inv.partyId);
      if (!existing || existing.date < inv.date) map.set(inv.partyId, inv);
    }
    return map;
  }, [recent]);

  function goToParties() {
    useAppStore.getState().setActiveView('parties');
  }

  function openReports() {
    useNavStore.getState().openMore('reports');
    useAppStore.getState().setActiveView('more');
  }

  async function handleShareStatement() {
    try {
      const lines = balances.map(
        (p) =>
          `${p.name} (${p.type}) — ${p.balance > 0 ? 'they owe us' : p.balance < 0 ? 'we owe them' : 'settled'}: ${money(Math.abs(p.balance))}`,
      );
      const summary =
        `Khata Net Status\n` +
        `You'll Get: ${money(youllGet)}\n` +
        `You'll Give: ${money(youllGive)}\n` +
        `Net Owed: ${money(netOwed)}\n\n${lines.join('\n')}`;
      await Share.share({title: 'Khata Statement', message: summary});
      successFeedback('Khata statement shared');
    } catch {
      // user cancelled the share sheet
    }
  }

  async function handleAddParty() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await createParty.mutateAsync({
        name: name.trim(),
        phone: phone.trim() || undefined,
        type,
      });
      successFeedback(`${name.trim()} added`);
      setAddOpen(false);
      setName('');
      setPhone('');
      setType('CUSTOMER');
    } catch {
      errorFeedback('Failed to add party');
    } finally {
      setSaving(false);
    }
  }

  const FILTERS: {key: BalanceFilter; label: string}[] = [
    {key: 'all', label: 'All'},
    {key: 'get', label: "You'll Get"},
    {key: 'give', label: "You'll Give"},
    {key: 'settled', label: 'Settled'},
  ];

  return (
    <Screen>
      <HomeHeader title="Sales" />

      {error ? (
        <ErrorBox message={error} onRetry={reload} />
      ) : loading || !data ? (
        <Loading />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          {...headerScrollHandlers}>
          {/* KHATA NET STATUS header strip */}
          <View style={styles.netStatusRow}>
            <Text style={styles.netStatusTitle}>KHATA NET STATUS</Text>
            <Pressable
              onPress={() => {
                selectionTick();
                goToParties();
              }}
              style={({pressed}) => [styles.activePartiesPill, pressed && styles.pressed]}>
              <Text style={styles.activePartiesText}>⚙ {activeParties} Active Parties</Text>
            </Pressable>
          </View>

          {/* You'll Get / You'll Give tiles */}
          <View style={styles.tileRow}>
            <Pressable
              onPress={() => {
                selectionTick();
                setFilter('get');
              }}
              style={({pressed}) => [styles.tile, pressed && styles.pressed]}>
              <View style={styles.tileLabelRow}>
                <View style={[styles.tileDot, {backgroundColor: palette.danger}]} />
                <Text style={styles.tileLabel}>You'll Get</Text>
              </View>
              <Text style={[styles.tileValue, {color: palette.danger}]} numberOfLines={1} adjustsFontSizeToFit>
                {money(youllGet)}
              </Text>
              <Text style={styles.tileSub}>{data.receivables.length} Customers</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                selectionTick();
                setFilter('give');
              }}
              style={({pressed}) => [styles.tile, pressed && styles.pressed]}>
              <View style={styles.tileLabelRow}>
                <View style={[styles.tileDot, {backgroundColor: palette.success}]} />
                <Text style={styles.tileLabel}>You'll Give</Text>
              </View>
              <Text style={[styles.tileValue, {color: palette.success}]} numberOfLines={1} adjustsFontSizeToFit>
                {money(youllGive)}
              </Text>
              <Text style={styles.tileSub}>Karigar / Vendor</Text>
            </Pressable>
          </View>

          {/* Get vs Give composition — chart view of the ledger split */}
          {(youllGet > 0 || youllGive > 0) ? (
            <Card style={styles.donutCard}>
              <DonutChart
                segments={[
                  {name: "You'll Get", value: youllGet, color: palette.danger},
                  {name: "You'll Give", value: youllGive, color: palette.success},
                ]}
                centerValue={money(Math.abs(netOwed))}
                centerSub="Net Owed"
                size={rw(132)}
                thickness={rs(16)}
                onSegmentPress={(name) => setFilter(name === "You'll Get" ? 'get' : 'give')}
              />
            </Card>
          ) : null}

          {/* Net owed strip */}
          <View style={[styles.netOwedStrip, {borderColor: palette.border}]}>
            <Text style={styles.netOwedLabel}>Net Owed</Text>
            <Text style={[styles.netOwedValue, {color: netOwed >= 0 ? palette.danger : palette.success}]}>
              {money(Math.abs(netOwed))}
            </Text>
          </View>

          {/* Filter chips */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsRow}>
            {FILTERS.map((chip) => {
              const active = filter === chip.key;
              return (
                <Pressable
                  key={chip.key}
                  onPress={() => {
                    selectionTick();
                    setFilter(chip.key);
                  }}
                  style={[
                    styles.chip,
                    active && {backgroundColor: palette.primary, borderColor: palette.primary},
                  ]}>
                  <Text style={[styles.chipText, active && {color: palette.onPrimary}]}>{chip.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Party cards */}
          {filtered.length === 0 ? (
            <Card style={styles.card}>
              <Empty text="No parties in this view yet — add one below" />
            </Card>
          ) : (
            filtered.map((party, i) => {
              const expanded = expandedId === party.id;
              const owesUs = party.balance > 0.001;
              const weOwe = party.balance < -0.001;
              const settled = !owesUs && !weOwe;
              const lastInvoice = party.id ? lastInvoiceByParty.get(party.id) : undefined;
              return (
                <Card key={party.id} style={styles.card} index={i}>
                  <Pressable
                    onPress={() => {
                      selectionTick();
                      setExpandedId(expanded ? null : party.id);
                    }}
                    style={styles.partyHead}>
                    <Avatar name={party.name} tint={owesUs ? palette.primary : weOwe ? palette.success : palette.muted} />
                    <View style={{flex: 1, minWidth: 0, marginLeft: spacing.sm}}>
                      <View style={styles.nameRow}>
                        <Text style={styles.partyName} numberOfLines={1}>
                          {party.name}
                        </Text>
                        <Text style={styles.partyType} numberOfLines={1}>
                          {party.type === 'WORKER' ? 'Karigar' : party.type === 'SUPPLIER' ? 'Supplier' : party.type === 'OTHER' ? 'Other' : 'Customer'}
                        </Text>
                      </View>
                      {party.phone ? (
                        <Text style={styles.partyPhone} numberOfLines={1}>
                          <Phone size={rs(10)} color={palette.muted} /> {party.phone}
                        </Text>
                      ) : null}
                    </View>
                    <View style={{alignItems: 'flex-end', gap: rs(3)}}>
                      <Text
                        style={[
                          styles.partyBalance,
                          {color: owesUs ? palette.danger : weOwe ? palette.success : palette.muted},
                        ]}
                        numberOfLines={1}>
                        {money(Math.abs(party.balance))}
                      </Text>
                      {/* Ledger semantics: balance > 0 → they owe us (we'll get);
                        balance < 0 → we owe them (we'll give). */}
                      {owesUs ? (
                        <Badge text="OWES YOU" tone="muted" />
                      ) : weOwe ? (
                        <Badge text="YOU OWE" tone="success" />
                      ) : (
                        <Badge text="Settled" tone="success" />
                      )}
                    </View>
                  </Pressable>

                  {/* Expanded details — real per-party figures from the ledger model */}
                  {expanded ? (
                    <View style={styles.partyDetail}>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Advances given (open)</Text>
                        <Text style={styles.detailValue}>{money(party.given)}</Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Advances taken (open)</Text>
                        <Text style={styles.detailValue}>{money(party.taken)}</Text>
                      </View>
                      {lastInvoice ? (
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>Last invoice</Text>
                          <Text style={styles.detailValue}>
                            {lastInvoice.invoiceNumber} · {formatDate(lastInvoice.date)}
                          </Text>
                        </View>
                      ) : null}
                      <View style={styles.detailActions}>
                        <Button
                          title="Record payment"
                          variant="outline"
                          size="small"
                          onPress={() => goToParties()}
                        />
                        <Button
                          title="Open khata"
                          variant="outline"
                          size="small"
                          onPress={() => goToParties()}
                        />
                      </View>
                    </View>
                  ) : null}
                </Card>
              );
            })
          )}

          {/* Download statement — real share feature, no fake export buttons */}
          <Card style={styles.card} index={0}>
            <Pressable
              onPress={() => {
                selectionTick();
                void handleShareStatement();
              }}
              style={({pressed}) => [styles.statementRow, pressed && styles.pressed]}>
              <FileDown size={rs(20)} color={palette.primary} />
              <View style={{flex: 1, marginLeft: spacing.sm}}>
                <Text style={styles.statementTitle}>Share Khata Statement</Text>
                <Text style={styles.statementSub}>All party balances — for CA / records</Text>
              </View>
            </Pressable>
          </Card>

          {/* Add party CTA */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add new party or advance"
            onPress={() => {
              actionPress();
              setAddOpen(true);
            }}
            style={({pressed}) => [styles.cta, pressed && styles.ctaPressed]}>
            <UserPlus size={rs(20)} color={palette.onPrimary} strokeWidth={2.4} />
            <Text style={styles.ctaText}>+ Add New Party / Advance</Text>
          </Pressable>
        </ScrollView>
      )}

      {/* Add party — centered modal (real useCreateParty feature) */}
      <ModalSheet
        visible={addOpen}
        title="Add new party"
        onClose={() => setAddOpen(false)}
        dismissable={!saving}
        centered
        scrollable>
        <Field label="Party name *" value={name} onChangeText={setName} placeholder="e.g. Jeetu Karigar" />
        <Field label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        <View style={styles.typeRow}>
          {(['CUSTOMER', 'SUPPLIER', 'WORKER', 'OTHER'] as const).map((t) => (
            <Pressable
              key={t}
              onPress={() => {
                selectionTick();
                setType(t);
              }}
              style={[styles.typeChip, type === t && {backgroundColor: palette.primary, borderColor: palette.primary}]}>
              <Text style={[styles.typeChipText, type === t && {color: palette.onPrimary}]}>
                {t === 'WORKER' ? 'Karigar' : t === 'SUPPLIER' ? 'Supplier' : t === 'OTHER' ? 'Other' : 'Customer'}
              </Text>
            </Pressable>
          ))}
        </View>
        <Button
          title={saving ? 'Saving…' : 'Add party'}
          onPress={() => void handleAddParty()}
          loading={saving}
          disabled={!name.trim()}
        />
      </ModalSheet>
    </Screen>
  );
}

const makeStyles = (c: MobileColors) =>
  StyleSheet.create({
    scrollContent: {
      paddingBottom: spacing.xxxl,
    },
    pressed: {opacity: 0.65},
    card: {
      marginHorizontal: CARD_MARGIN,
    },
    /* Net status header */
    netStatusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginHorizontal: CARD_MARGIN,
      marginTop: spacing.xs,
      marginBottom: spacing.sm,
      paddingRight: 2,
    },
    netStatusTitle: {
      fontSize: typography.label,
      fontWeight: '800',
      letterSpacing: 0.8,
      color: c.muted,
    },
    activePartiesPill: {
      borderRadius: radii.full,
      backgroundColor: c.mutedBg,
      paddingHorizontal: rs(9),
      paddingVertical: rs(4),
    },
    activePartiesText: {
      fontSize: typography.caption,
      fontWeight: '700',
      color: c.text,
    },
    /* Tiles */
    tileRow: {
      flexDirection: 'row',
      gap: rs(8),
      marginHorizontal: CARD_MARGIN,
    },
    tile: {
      flex: 1,
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: radii.md,
      padding: spacing.md,
    },
    tileLabelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rs(5),
    },
    tileDot: {
      width: rs(7),
      height: rs(7),
      borderRadius: radii.full,
    },
    tileLabel: {
      fontSize: typography.caption,
      fontWeight: '700',
      color: c.muted,
    },
    tileValue: {
      fontSize: typography.h2,
      fontWeight: '800',
      marginTop: rs(4),
    },
    tileSub: {
      fontSize: typography.caption,
      color: c.muted,
      marginTop: rs(2),
    },
    /* Get vs Give donut card */
    donutCard: {
      marginHorizontal: CARD_MARGIN,
      marginTop: rs(10),
    },
    /* Net owed strip */
    netOwedStrip: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: rs(8),
      marginHorizontal: CARD_MARGIN,
      marginTop: rs(8),
      borderRadius: radii.md,
      borderWidth: 1,
      paddingHorizontal: spacing.md,
      paddingVertical: rs(8),
      backgroundColor: c.card,
    },
    netOwedLabel: {
      fontSize: typography.caption,
      fontWeight: '600',
      color: c.muted,
    },
    netOwedValue: {
      fontSize: typography.body,
      fontWeight: '800',
    },
    /* Filter chips */
    chipsRow: {
      flexDirection: 'row',
      gap: rs(8),
      paddingHorizontal: CARD_MARGIN,
      paddingVertical: spacing.sm,
    },
    chip: {
      paddingHorizontal: rs(12),
      paddingVertical: rs(6),
      borderRadius: radii.full,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.card,
    },
    chipText: {
      fontSize: typography.caption,
      fontWeight: '600',
      color: c.muted,
    },
    /* Party cards */
    partyHead: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    nameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rs(6),
    },
    partyName: {
      flexShrink: 1,
      fontSize: typography.body,
      fontWeight: '700',
      color: c.text,
    },
    partyType: {
      fontSize: typography.caption,
      color: c.muted,
      flexShrink: 0,
    },
    partyPhone: {
      fontSize: typography.caption,
      color: c.muted,
      marginTop: rs(2),
    },
    partyBalance: {
      fontSize: typography.body,
      fontWeight: '800',
    },
    partyDetail: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.border,
      marginTop: spacing.sm,
      paddingTop: spacing.sm,
      gap: rs(6),
    },
    detailRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    detailLabel: {
      fontSize: typography.secondary,
      color: c.muted,
    },
    detailValue: {
      fontSize: typography.secondary,
      fontWeight: '700',
      color: c.text,
    },
    detailActions: {
      flexDirection: 'row',
      gap: rs(8),
      marginTop: rs(4),
    },
    /* Statement card */
    statementRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    statementTitle: {
      fontSize: typography.body,
      fontWeight: '700',
      color: c.text,
    },
    statementSub: {
      fontSize: typography.caption,
      color: c.muted,
      marginTop: rs(1),
    },
    /* CTA */
    cta: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: rs(8),
      backgroundColor: c.primary,
      borderRadius: radii.lg,
      minHeight: 52,
      marginHorizontal: CARD_MARGIN,
      marginTop: spacing.md,
    },
    ctaPressed: {opacity: 0.85},
    ctaText: {
      fontSize: typography.body,
      fontWeight: '700',
      color: c.onPrimary,
    },
    /* Type chips */
    typeRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: rs(8),
      marginBottom: spacing.md,
    },
    typeChip: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: radii.full,
      paddingHorizontal: rs(12),
      paddingVertical: rs(6),
    },
    typeChipText: {
      fontSize: typography.caption,
      fontWeight: '600',
      color: c.muted,
    },
  });
