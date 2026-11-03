/**
 * Munim SheetPicker — a BottomSheet-based select/picker for mobile.
 *
 * Shows a scrollable list of options in a bottom sheet with search,
 * selected state, and a cancel button. Replaces inline text inputs
 * where a picker is more appropriate (Color, Size, Category, Party, etc.).
 *
 * Controlled by `visible` — mount it once next to the parent sheet and the
 * picker only overlays when open. (A ref/index-driven sheet used to mount open
 * at index 0, which is why the report filter sheet was unusable.)
 *
 * Usage:
 *   <SheetPicker
 *     visible={picker !== null}
 *     onClose={() => setPicker(null)}
 *     title="Select Color"
 *     options={colors.map(c => ({ label: c.name, value: c.id }))}
 *     selected={currentColor}
 *     onSelect={setCurrentColor}
 *   />
 */

import React, {useCallback, useMemo, useState} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {BottomSheetFlatList} from '@gorhom/bottom-sheet';
import {Check, Search, X} from 'lucide-react-native';
import {colors, useThemeStyles} from '../theme';
import {BottomSheetTextInput, MunimBottomSheet} from './BottomSheet';
import {rw, rh, rs, typography, spacing, radii, TOUCH_TARGET} from '../lib/responsive';

export type PickerOption = {
  label: string;
  value: string;
  /** Optional secondary text (e.g., hex color). */
  secondary?: string;
};

type SheetPickerProps = {
  /** Controlled visibility — the picker only overlays while true. */
  visible: boolean;
  /** Called for both dismiss gestures and after a selection. */
  onClose: () => void;
  /** Sheet title. */
  title: string;
  /** Available options. */
  options: PickerOption[];
  /** Currently selected value (null = none). */
  selected: string | null;
  /** Called when the user selects an option. */
  onSelect: (value: string | null) => void;
  /** Show a "None" option at the top that clears the selection. */
  showNone?: boolean;
  /** Placeholder for the search input. */
  searchPlaceholder?: string;
};

export function SheetPicker({
  visible,
  onClose,
  title,
  options,
  selected,
  onSelect,
  showNone = false,
  searchPlaceholder = 'Search…',
}: SheetPickerProps) {
    const [query, setQuery] = useState('');
    const pickerStyles = useThemeStyles(makePickerStyles);

    const filtered = useMemo(() => {
      if (!query.trim()) return options;
      const q = query.toLowerCase();
      return options.filter(
        o =>
          o.label.toLowerCase().includes(q) ||
          (o.secondary && o.secondary.toLowerCase().includes(q)),
      );
    }, [options, query]);

    const handleSelect = useCallback(
      (value: string | null) => {
        onSelect(value);
        setQuery('');
        onClose();
      },
      [onSelect, onClose],
    );

    const handleClose = useCallback(() => {
      setQuery('');
      onClose();
    }, [onClose]);

    const renderItem = useCallback(
      ({item}: {item: PickerOption}) => {
        const isActive = item.value === selected;
        return (
          <Pressable
            style={[pickerStyles.row, isActive && pickerStyles.rowActive]}
            onPress={() => handleSelect(item.value)}
            hitSlop={6}>
            <View style={pickerStyles.rowText}>
              <Text
                style={[pickerStyles.label, isActive && pickerStyles.labelActive]}
                numberOfLines={1}>
                {item.label}
              </Text>
              {item.secondary ? (
                <Text style={pickerStyles.secondary} numberOfLines={1}>
                  {item.secondary}
                </Text>
              ) : null}
            </View>
            {isActive ? (
              <Check size={rs(18)} color={colors.primary} strokeWidth={2.5} />
            ) : null}
          </Pressable>
        );
      },
      [selected, handleSelect],
    );

    const keyExtractor = useCallback((item: PickerOption) => item.value, []);

    return (
      <MunimBottomSheet
        visible={visible}
        title={title}
        onClose={handleClose}
        snapPoints={['60%', '85%']}>
        {/* Search bar */}
        <View style={pickerStyles.searchContainer}>
          <Search size={rs(16)} color={colors.muted} style={pickerStyles.searchIcon} />
          <BottomSheetTextInput
            value={query}
            onChangeText={setQuery}
            placeholder={searchPlaceholder}
            placeholderTextColor={colors.muted}
            style={pickerStyles.searchInput}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
          {query ? (
            <Pressable
              onPress={() => setQuery('')}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Clear search">
              <X size={rs(16)} color={colors.muted} />
            </Pressable>
          ) : null}
        </View>

        {/* Options list */}
        <BottomSheetFlatList
          data={filtered}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={pickerStyles.list}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            showNone ? (
              <Pressable
                style={[pickerStyles.row, !selected && pickerStyles.rowActive]}
                onPress={() => handleSelect(null)}
                hitSlop={6}>
                <View style={pickerStyles.rowText}>
                  <Text
                    style={[pickerStyles.label, !selected && pickerStyles.labelActive]}
                    numberOfLines={1}>
                    None
                  </Text>
                </View>
                {!selected ? (
                  <Check size={rs(18)} color={colors.primary} strokeWidth={2.5} />
                ) : null}
              </Pressable>
            ) : null
          }
          ListEmptyComponent={
            <View style={pickerStyles.empty}>
              <Text style={pickerStyles.emptyText}>No results</Text>
            </View>
          }
        />
      </MunimBottomSheet>
    );
}

/** Theme-aware picker styles — rebuilt on every palette change. */
const makePickerStyles = () =>
  StyleSheet.create({
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    backgroundColor: colors.mutedSoft,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    height: TOUCH_TARGET,
  },
  searchIcon: {
    marginRight: spacing.sm,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 0,
    fontSize: typography.body,
    color: colors.text,
  },
  list: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    marginBottom: rs(2),
    minHeight: TOUCH_TARGET,
  },
  rowActive: {
    backgroundColor: colors.mutedSoft,
  },
  rowText: {
    flex: 1,
  },
  label: {
    fontSize: typography.body,
    color: colors.text,
  },
  labelActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  secondary: {
    fontSize: typography.caption,
    color: colors.muted,
    marginTop: rs(2),
  },
  empty: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  emptyText: {
    fontSize: typography.body,
    color: colors.muted,
  },
});
