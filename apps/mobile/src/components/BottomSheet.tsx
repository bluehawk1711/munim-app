/**
 * Munim BottomSheet system — built on @gorhom/bottom-sheet.
 *
 * Every bottom sheet in the app goes through these components so behavior
 * (keyboard handling, backdrop, safe area, dismiss) is consistent.
 *
 * Usage:
 *   <BottomSheet
 *     ref={sheetRef}
 *     title="Edit Product"
 *     onClose={() => sheetRef.current?.close()}
 *   >
 *     <BottomSheetScrollView>
 *       ... form content ...
 *     </BottomSheetScrollView>
 *     <BottomSheetFooter>
 *       <Button title="Save" onPress={handleSave} />
 *     </BottomSheetFooter>
 *   </BottomSheet>
 */

import React, {forwardRef, useCallback, useMemo, useRef} from 'react';
import {
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetFooter,
  BottomSheetHandle,
  BottomSheetScrollView,
  BottomSheetTextInput,
  type BottomSheetBackdropProps,
  type BottomSheetFooterProps,
  type BottomSheetHandleProps,
} from '@gorhom/bottom-sheet';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {colors} from '../theme';
import {actionPress} from '../lib/haptics';
import {rw, rh, rs, typography, spacing, radii, SCREEN} from '../lib/responsive';

/* ─── Handle ─────────────────────────────────────────────────────────── */

function Handle(props: BottomSheetHandleProps) {
  return (
    <View style={handleStyles.container}>
      <View style={handleStyles.indicator} />
      {props.title ? (
        <Text style={handleStyles.title}>{props.title}</Text>
      ) : null}
    </View>
  );
}

const handleStyles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingTop: rs(8),
    paddingBottom: rs(4),
  },
  indicator: {
    width: rw(36),
    height: rs(4),
    borderRadius: rs(2),
    backgroundColor: colors.muted,
    opacity: 0.4,
  },
  title: {
    fontSize: typography.h2,
    fontWeight: '700',
    color: colors.text,
    marginTop: rs(8),
    marginBottom: rs(2),
  },
});

/* ─── Backdrop ───────────────────────────────────────────────────────── */

function Backdrop(props: BottomSheetBackdropProps) {
  return (
    <BottomSheetBackdrop
      {...props}
      appearsOnIndex={0}
      disappearsOnIndex={-1}
      opacity={0.45}
      onPress={Keyboard.dismiss}
    />
  );
}

/* ─── Footer ─────────────────────────────────────────────────────────── */

export function SheetFooter({children, style}: {children: React.ReactNode; style?: ViewStyle}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[{paddingHorizontal: spacing.lg, paddingBottom: insets.bottom + spacing.sm}, style]}>
      {children}
    </View>
  );
}

/* ─── Main BottomSheet wrapper ───────────────────────────────────────── */

export type MunimBottomSheetProps = {
  /** Ref to the underlying Gorhom BottomSheet. */
  ref?: React.RefObject<BottomSheet>;
  /** Sheet title shown in the handle. */
  title?: string;
  /** Callback when the sheet is closed/dismissed. */
  onClose?: () => void;
  /** Snap points. Default ['90%']. */
  snapPoints?: (string | number)[];
  /** Children rendered inside the sheet. */
  children: React.ReactNode;
  /** Extra style on the sheet container. */
  style?: ViewStyle;
  /** Enable/disable the backdrop. Default true. */
  enableBackdrop?: boolean;
  /** Whether the sheet can be dismissed by swiping down. Default true. */
  enableDismissOnDrag?: boolean;
  /** Index of the initially open snap point. Default 0. */
  initialIndex?: number;
};

/**
 * Gorhom BottomSheet with Munim styling, keyboard handling, safe area,
 * backdrop, handle, and consistent dismiss behavior.
 *
 * Wrap your app (or the screen that uses BottomSheet) in
 * `<GestureHandlerRootView>` at least once. The mobile app's App.tsx
 * already provides this via SafeAreaProvider + the root view.
 */
export const MunimBottomSheet = forwardRef<BottomSheet, MunimBottomSheetProps>(
  function MunimBottomSheet(
    {
      title,
      onClose,
      snapPoints: snapPointsProp,
      children,
      style,
      enableBackdrop = true,
      enableDismissOnDrag = true,
      initialIndex = 0,
    },
    ref,
  ) {
    const insets = useSafeAreaInsets();
    const sheetRef = useRef<BottomSheet>(null);
    const resolvedRef = (ref as React.RefObject<BottomSheet>) ?? sheetRef;

    const snapPoints = useMemo(
      () => snapPointsProp ?? ['90%'],
      [snapPointsProp],
    );

    const handleClose = useCallback(() => {
      resolvedRef.current?.close();
      onClose?.();
    }, [onClose, resolvedRef]);

    const handleDismiss = useCallback(() => {
      onClose?.();
    }, [onClose]);

    const renderHandle = useCallback(
      (props: BottomSheetHandleProps) => <Handle {...props} title={title} />,
      [title],
    );

    const renderBackdrop = useCallback(
      (props: BottomSheetBackdropProps) => <Backdrop {...props} />,
      [],
    );

    const backgroundStyle = useMemo(
      () => ({
        backgroundColor: colors.card,
        borderRadius: radii.xl,
      }),
      [],
    );

    const handleIndicatorStyle = useMemo(
      () => ({
        backgroundColor: colors.muted,
        opacity: 0.4,
      }),
      [],
    );

    return (
      <BottomSheet
        ref={resolvedRef}
        index={initialIndex}
        snapPoints={snapPoints}
        enablePanDownToClose={enableDismissOnDrag}
        enableDynamicSizing={false}
        onClose={handleDismiss}
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore"
        android_keyboardInputMode="adjustResize"
        handleComponent={renderHandle}
        backdropComponent={enableBackdrop ? renderBackdrop : undefined}
        backgroundStyle={backgroundStyle}
        handleIndicatorStyle={handleIndicatorStyle}
        style={style}>
        {children}
      </BottomSheet>
    );
  },
);

export {BottomSheetScrollView, BottomSheetTextInput, BottomSheetFooter};
export type {BottomSheetFooterProps};
