/**
 * Keyboard-aware form container for Munim mobile.
 *
 * Wraps forms in a layout that keeps action buttons visible above the
 * keyboard and allows scrolling to focused inputs. Works with both
 * Gorhom BottomSheet content and full-screen forms.
 *
 * Layout:
 *   KeyboardAvoidingView
 *   └─ ScrollView (or BottomSheetScrollView)
 *      ├─ form content (flex: 1)
 *      └─ footer (sticky above keyboard)
 *
 * Usage (full-screen):
 *   <KeyboardForm footer={<Button title="Save" />}>
 *     <Field ... />
 *     <Field ... />
 *   </KeyboardForm>
 *
 * Usage (inside BottomSheet):
 *   <KeyboardForm
 *     inSheet
 *     footer={<Button title="Save" />}
 *   >
 *     <Field ... />
 *   </KeyboardForm>
 */

import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {BottomSheetScrollView} from '@gorhom/bottom-sheet';
import {spacing} from '../lib/responsive';
import {colors, useThemeStyles} from '../theme';

type KeyboardFormProps = {
  /** Form field children. */
  children: React.ReactNode;
  /** Sticky footer pinned above the keyboard / safe area. */
  footer?: React.ReactNode;
  /** Set to true when rendering inside a Gorhom BottomSheet. */
  inSheet?: boolean;
  /** Extra style on the outermost container. */
  style?: ViewStyle;
  /** Extra style on the scroll content container. */
  contentContainerStyle?: ViewStyle;
  /** Override the keyboard vertical offset (iOS). */
  keyboardOffset?: number;
};

export function KeyboardForm({
  children,
  footer,
  inSheet = false,
  style,
  contentContainerStyle,
  keyboardOffset = 0,
}: KeyboardFormProps) {
  const insets = useSafeAreaInsets();
  const styles = useThemeStyles(makeStyles);
  const ScrollComponent = inSheet ? BottomSheetScrollView : ScrollView;

  return (
    <KeyboardAvoidingView
      style={[styles.container, style]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? keyboardOffset : 0}>
      <ScrollComponent
        contentContainerStyle={[
          styles.scrollContent,
          inSheet && {paddingBottom: spacing.xl},
          contentContainerStyle,
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        showsVerticalScrollIndicator={false}>
        {children}
      </ScrollComponent>
      {footer ? (
        <View style={[styles.footer, {paddingBottom: insets.bottom + spacing.sm}]}>
          {footer}
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

/** Theme-aware footer border — a hairline `border` token works on light AND
 *  dark surfaces (the old rgba-black line vanished in dark mode). */
const makeStyles = () =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    scrollContent: {
      flexGrow: 1,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
    },
    footer: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
  });
