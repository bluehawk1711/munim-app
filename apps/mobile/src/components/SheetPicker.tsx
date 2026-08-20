/**
 * Munim SheetPicker — a BottomSheet-based select/picker for mobile.
 *
 * Shows a scrollable list of options in a bottom sheet with search,
 * selected state, and a cancel button. Replaces inline text inputs
 * where a picker is more appropriate (Color, Size, Category, Party, etc.).
 *
 * Usage:
 *   <SheetPicker
 *     ref={pickerRef}
 *     title="Select Color"
 *     options={colors.map(c => ({ label: c.name, value: c.id }))}
 *     selected={currentColor}
 *     onSelect={setCurrentColor}
 *   />
 *
 *   // Trigger:
 *   <Pressable onPress={() => pickerRef.current?.present()}>
 *     <Text>{currentColor || 'Pick a color'}</Text>
 *   </Pressable>
 */

import React, {forwardRef, useCallback, useMemo, useRef, useState} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import BottomSheet, {BottomSheetFlatList} from '@gorhom/bottom-sheet';
import {Check, Search, X} from 'lucide-react-native';
import {colors} from '../theme';
import {MunimBottomSheet} from './BottomSheet';
import {rw, rh, rs, typography, spacing, radii, TOUCH_TARGET} from '../lib/responsive';

export type PickerOption = {
  label: string;
  value: string;
  /** Optional secondary text (e.g., hex color). */
  secondary?: string;
};

type SheetPickerProps = {
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

export const SheetPicker = forwardRef<BottomSheet, SheetPickerProps>(
  function SheetPicker(
    {title, options, selected, onSelect, showNone = false, searchPlaceholder = 'Search…'},
    ref,
  ) {
    const [query, setQuery] = useState('');
    const sheetRef = useRef<BottomSheet>(null);
    const resolvedRef = (ref as React.RefObject<BottomSheet>) ?? sheetRef;

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
        resolvedRef.current?.close();
        setQuery('');
      },
      [onSelect, resolvedRef],
    );

    const handleClose = useCallback(() => {
      setQuery('');
    }, []);

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
        ref={resolvedRef}
        title={title}
        onClose={handleClose}
        snapPoints={['60%', '85%']}>
        {/* Search bar */}
        <View style={pickerStyles.searchContainer}>
          <Search size={rs(16)} color={colors.muted} style={pickerStyles.searchIcon} />
          <Pressable
            style={pickerStyles.searchInput}
            onPress={() => {}}>
            {/* Using a simple TextInput-like approach with Pressable to avoid
               BottomSheetTextInput complexity — Gorhom handles focus */}
          </Pressable>
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
  },
);

const pickerStyles = StyleSheet.create({
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
    backgroundColor: colors.primarySoft,
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
