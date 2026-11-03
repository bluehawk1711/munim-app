/**
 * ReportFilterSheet — mobile's full report filter form.
 *
 * Uses the SAME `ReportFilterFormValues` shape and `toReportFilters` mapping
 * as web/desktop, so every platform asks the API the same question. Web and
 * desktop share the @munim/ui `ReportFilterPanel`; this is its RN twin.
 */

import React, {useEffect, useState} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {ChevronDown, RotateCcw, Search} from 'lucide-react-native';
import {
  REPORT_METALS,
  REPORT_PAYMENT_STATUSES,
  REPORT_PRODUCT_TYPES,
  REPORT_SOLD_STATES,
  countActiveReportFilters,
  dashboardPresetRange,
  emptyReportFilterForm,
  type ReportFilterFormValues,
  type ReportMetal,
  type ReportPaymentStatus,
  type ReportProductType,
  type ReportSoldState,
} from '@munim/core';
import {Button, colors} from './ui';
import {BottomSheetScrollView, BottomSheetTextInput, MunimBottomSheet} from './BottomSheet';
import {DateField} from './date-field';
import {SheetPicker, type PickerOption} from './SheetPicker';
import {useThemeStyles} from '../theme';
import {rs, spacing, radii, typography, TOUCH_TARGET} from '../lib/responsive';

export type ReportFilterOptionSets = {
  articles: {id: string; name: string}[];
  categories: {id: string; name: string}[];
  colors: {name: string}[];
  sizes: {name: string}[];
  parties: {id: string; name: string}[];
};

const PRODUCT_TYPE_LABELS: Record<ReportProductType, string> = {
  gold: 'Gold',
  silver: 'Silver',
  diamond: 'Diamond',
  platinum: 'Platinum',
  other: 'Other',
};

const PAYMENT_LABELS: Record<ReportPaymentStatus, string> = {
  any: 'Any payment',
  paid: 'Paid',
  partial: 'Partial',
  unpaid: 'Unpaid',
  draft: 'Draft',
};

const SOLD_LABELS: Record<ReportSoldState, string> = {
  all: 'All items',
  sold: 'Sold',
  unsold: 'Unsold',
};

type PickerKey = 'articleId' | 'categoryId' | 'subCategoryId' | 'color' | 'size' | 'partyId';

type PickerConfig = {
  key: PickerKey;
  title: string;
  options: PickerOption[];
};

export function ReportFilterSheet({
  visible,
  onClose,
  value,
  options,
  onApply,
  busy,
}: {
  visible: boolean;
  onClose: () => void;
  value: ReportFilterFormValues;
  options: ReportFilterOptionSets;
  /** Called once, with the finished draft, when "Run report" is pressed. */
  onApply: (next: ReportFilterFormValues) => void;
  busy?: boolean;
}) {
  const styles = useThemeStyles(makeStyles);
  const [picker, setPicker] = useState<PickerConfig | null>(null);
  // Draft-in-sheet: typing/narrowing here never re-renders the report list
  // behind the sheet; the parent only sees the form on "Run report".
  const [draft, setDraft] = useState<ReportFilterFormValues>(value);

  useEffect(() => {
    if (visible) setDraft(value);
  }, [visible, value]);

  const set = <K extends keyof ReportFilterFormValues,>(key: K, next: ReportFilterFormValues[K]) =>
    setDraft(prev => ({...prev, [key]: next}));

  const openPicker = (config: PickerConfig) => {
    setPicker(config);
  };

  const refOptions = (items: {id: string; name: string}[]) =>
    items.map(item => ({value: item.id, label: item.name}));

  const nameOptions = (items: {name: string}[]) =>
    items.map(item => ({value: item.name, label: item.name}));

  const activeCount = countActiveReportFilters(draft);

  const pickerLabel = (key: PickerKey, fallback: string): string => {
    const current = draft[key];
    if (!current) return fallback;
    if (key === 'color' || key === 'size') return current;
    const list =
      key === 'articleId'
        ? options.articles
        : key === 'partyId'
          ? options.parties
          : options.categories;
    return list.find(item => item.id === current)?.name ?? fallback;
  };

  const renderPickerRow = (key: PickerKey, label: string, title: string, config: PickerConfig) => (
    <Pressable
      key={key}
      accessibilityRole="button"
      onPress={() => openPicker(config)}
      style={({pressed}) => [styles.pickerRow, pressed && {opacity: 0.75}]}>
      <View style={{flex: 1, minWidth: 0}}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <Text style={styles.pickerValue} numberOfLines={1}>
          {pickerLabel(key, `All ${label.toLowerCase()}s`)}
        </Text>
      </View>
      <ChevronDown size={rs(16)} color={colors.muted} strokeWidth={2.2} />
    </Pressable>
  );

  return (
    <>
      <MunimBottomSheet visible={visible} title="Report filters" onClose={onClose} snapPoints={['92%']}>
        <BottomSheetScrollView
          style={{flex: 1}}
          contentContainerStyle={{paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl}}
          keyboardShouldPersistTaps="handled">
        <Text style={styles.note}>
          Every filter below applies to the next run on all report types.
        </Text>

        {/* Search */}
        <View style={styles.searchRow}>
          <Search size={rs(16)} color={colors.muted} strokeWidth={2.2} />
          <BottomSheetTextInput
            value={draft.search}
            onChangeText={v => set('search', v)}
            placeholder="Product, SKU, barcode…"
            placeholderTextColor={colors.muted}
            style={styles.searchInput}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        {/* Classification pickers */}
        <View style={styles.pickerGrid}>
          {renderPickerRow('articleId', 'Article', 'Select article', {
            key: 'articleId',
            title: 'Select article',
            options: refOptions(options.articles),
          })}
          {renderPickerRow('categoryId', 'Category', 'Select category', {
            key: 'categoryId',
            title: 'Select category',
            options: refOptions(options.categories),
          })}
          {renderPickerRow('subCategoryId', 'Sub-category', 'Select sub-category', {
            key: 'subCategoryId',
            title: 'Select sub-category',
            options: refOptions(options.categories),
          })}
          {renderPickerRow('color', 'Color', 'Select color', {
            key: 'color',
            title: 'Select color',
            options: nameOptions(options.colors),
          })}
          {renderPickerRow('size', 'Size', 'Select size', {
            key: 'size',
            title: 'Select size',
            options: nameOptions(options.sizes),
          })}
          {renderPickerRow('partyId', 'Customer / party', 'Select party', {
            key: 'partyId',
            title: 'Select party',
            options: refOptions(options.parties),
          })}
        </View>

        {/* Product type + metal */}
        <Text style={styles.sectionLabel}>PRODUCT TYPE</Text>
        <ChipRow
          options={[
            {value: '', label: 'All'},
            ...REPORT_PRODUCT_TYPES.map(t => ({value: t, label: PRODUCT_TYPE_LABELS[t]})),
          ]}
          selected={draft.productType}
          onSelect={v => set('productType', v as ReportProductType | '')}
        />
        <Text style={styles.sectionLabel}>METAL</Text>
        <ChipRow
          options={[{value: '', label: 'All'}, ...REPORT_METALS.map(m => ({value: m, label: m}))]}
          selected={draft.metal}
          onSelect={v => set('metal', v as ReportMetal | '')}
        />

        {/* Numeric ranges */}
        <Text style={styles.sectionLabel}>RANGES</Text>
        <View style={styles.rangeRow}>
          <RangeInput label="Gold karat" minValue={draft.goldKaratMin} maxValue={draft.goldKaratMax} onMin={v => set('goldKaratMin', v)} onMax={v => set('goldKaratMax', v)} />
          <RangeInput label="Silver purity %" minValue={draft.silverPurityMin} maxValue={draft.silverPurityMax} onMin={v => set('silverPurityMin', v)} onMax={v => set('silverPurityMax', v)} />
          <RangeInput label="Sold weight (gm)" minValue={draft.weightMinGm} maxValue={draft.weightMaxGm} onMin={v => set('weightMinGm', v)} onMax={v => set('weightMaxGm', v)} />
        </View>

        {/* Sold + payment state */}
        <Text style={styles.sectionLabel}>SOLD STATE</Text>
        <ChipRow
          options={REPORT_SOLD_STATES.map(s => ({value: s, label: SOLD_LABELS[s]}))}
          selected={draft.soldState}
          onSelect={v => set('soldState', v as ReportSoldState)}
        />
        <Text style={styles.sectionLabel}>PAYMENT STATUS</Text>
        <ChipRow
          options={REPORT_PAYMENT_STATUSES.map(s => ({value: s, label: PAYMENT_LABELS[s]}))}
          selected={draft.paymentStatus}
          onSelect={v => set('paymentStatus', v as ReportPaymentStatus)}
        />

        {/* Time window */}
        <Text style={styles.sectionLabel}>TIME WINDOW</Text>
        <View style={styles.quickRow}>
          {(['today', 'week', 'month'] as const).map(key => (
            <Pressable
              key={key}
              accessibilityRole="button"
              onPress={() => {
                const range = dashboardPresetRange(key);
                setDraft(prev => ({...prev, startDate: range.from, endDate: range.to}));
              }}
              style={({pressed}) => [styles.quickChip, pressed && {opacity: 0.75}]}>
              <Text style={styles.quickChipText}>
                {key === 'today' ? 'Today' : key === 'week' ? 'This week' : 'This month'}
              </Text>
            </Pressable>
          ))}
        </View>
        <DateField label="Start date" value={draft.startDate} onChange={v => set('startDate', v)} placeholder="Any start date" />
        <DateField label="End date" value={draft.endDate} onChange={v => set('endDate', v)} placeholder="Any end date" />

        {/* Actions */}
        <View style={styles.actionRow}>
          <Button
            title="Clear all"
            variant="outline"
            size="small"
            disabled={activeCount === 0}
            onPress={() => setDraft(emptyReportFilterForm())}
            style={styles.actionBtn}
            icon={<RotateCcw size={rs(14)} color={colors.muted} strokeWidth={2.2} />}
          />
          <Button
            title={activeCount > 0 ? `Run report · ${activeCount} filter${activeCount === 1 ? '' : 's'}` : 'Run report'}
            onPress={() => onApply(draft)}
            loading={busy}
            style={styles.actionGrow}
          />
        </View>
        </BottomSheetScrollView>
      </MunimBottomSheet>

      <SheetPicker
        visible={picker !== null}
        onClose={() => setPicker(null)}
        title={picker?.title ?? 'Select'}
        options={picker?.options ?? []}
        selected={picker ? draft[picker.key] || null : null}
        showNone
        onSelect={v => {
          if (picker) set(picker.key, v ?? '');
        }}
      />
    </>
  );
}

function ChipRow({
  options,
  selected,
  onSelect,
}: {
  options: {value: string; label: string}[];
  selected: string;
  onSelect: (value: string) => void;
}) {
  const styles = useThemeStyles(makeStyles);
  return (
    <View style={styles.chipRow}>
      {options.map(opt => {
        const active = opt.value === selected;
        return (
          <Pressable
            key={opt.value || 'all'}
            accessibilityRole="button"
            accessibilityState={{selected: active}}
            onPress={() => onSelect(opt.value)}
            style={({pressed}) => [styles.chip, active && styles.chipActive, pressed && {opacity: 0.75}]}>
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{opt.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function RangeInput({
  label,
  minValue,
  maxValue,
  onMin,
  onMax,
}: {
  label: string;
  minValue: string;
  maxValue: string;
  onMin: (v: string) => void;
  onMax: (v: string) => void;
}) {
  const styles = useThemeStyles(makeStyles);
  return (
    <View style={styles.rangeField}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.rangeInputs}>
        <BottomSheetTextInput
          value={minValue}
          onChangeText={onMin}
          placeholder="Min"
          placeholderTextColor={colors.muted}
          keyboardType="decimal-pad"
          style={styles.rangeInput}
          accessibilityLabel={`${label} minimum`}
        />
        <BottomSheetTextInput
          value={maxValue}
          onChangeText={onMax}
          placeholder="Max"
          placeholderTextColor={colors.muted}
          keyboardType="decimal-pad"
          style={styles.rangeInput}
          accessibilityLabel={`${label} maximum`}
        />
      </View>
    </View>
  );
}

const makeStyles = () =>
  StyleSheet.create({
    note: {
      fontSize: typography.caption,
      color: colors.muted,
      marginBottom: spacing.sm,
    },
    searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: colors.mutedSoft,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing.md,
      height: TOUCH_TARGET,
      marginBottom: spacing.sm,
    },
    searchInput: {
      flex: 1,
      fontSize: typography.body,
      color: colors.text,
      paddingVertical: 0,
    },
    pickerGrid: {
      gap: rs(6),
      marginBottom: spacing.sm,
    },
    pickerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.md,
      backgroundColor: colors.card,
      paddingHorizontal: spacing.md,
      paddingVertical: rs(8),
      minHeight: TOUCH_TARGET,
    },
    fieldLabel: {
      fontSize: typography.caption,
      fontWeight: '700',
      color: colors.muted,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    pickerValue: {
      fontSize: typography.body,
      fontWeight: '600',
      color: colors.text,
      marginTop: rs(1),
    },
    sectionLabel: {
      fontSize: rs(10),
      fontWeight: '800',
      letterSpacing: 0.7,
      color: colors.muted,
      marginTop: spacing.sm,
      marginBottom: rs(5),
    },
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: rs(6),
    },
    chip: {
      paddingHorizontal: rs(10),
      paddingVertical: rs(5),
      minHeight: rs(30),
      justifyContent: 'center' as const,
      borderRadius: radii.full,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    chipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    chipText: {
      fontSize: rs(11.5),
      fontWeight: '600',
      color: colors.muted,
    },
    chipTextActive: {color: colors.onPrimary},
    rangeRow: {gap: rs(8)},
    rangeField: {gap: rs(3)},
    rangeInputs: {flexDirection: 'row', gap: rs(6)},
    rangeInput: {
      flex: 1,
      height: TOUCH_TARGET,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.md,
      backgroundColor: colors.card,
      paddingHorizontal: spacing.md,
      fontSize: typography.body,
      color: colors.text,
    },
    quickRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: rs(6),
      marginBottom: spacing.sm,
    },
    quickChip: {
      paddingHorizontal: rs(10),
      paddingVertical: rs(5),
      minHeight: rs(30),
      justifyContent: 'center' as const,
      borderRadius: radii.full,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    quickChipText: {fontSize: rs(11.5), fontWeight: '600', color: colors.muted},
    actionRow: {
      flexDirection: 'row',
      gap: rs(8),
      marginTop: spacing.lg,
      marginBottom: spacing.xl,
    },
    actionBtn: {paddingHorizontal: rs(14)},
    actionGrow: {flex: 1},
  });
