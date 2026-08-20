/**
 * Munim mobile UI primitives — the shared component kit for all screens.
 *
 * All sizes use responsive utilities from ../lib/responsive so the UI
 * scales correctly across device widths.
 *
 * Components: Screen, Header, Section, Card, Button, Field, SelectField,
 * Badge, StatBox, Row, Loading, Empty, ErrorBox, ModalSheet, SafeScreen,
 * AccordionCard, EmptyState, ErrorState, InlineSpinner, ConfirmDialog.
 */

import React from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type DimensionValue,
  type KeyboardTypeOptions,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import Animated, {
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import {SafeAreaView} from 'react-native-safe-area-context';
import {ChevronDown, ChevronRight, MoreVertical, X} from 'lucide-react-native';
import {colors, useTheme, useThemeStyles} from '../theme';
import {actionPress} from '../lib/haptics';
import {
  rw,
  rh,
  rs,
  rFont,
  spacing,
  typography,
  radii,
  TOUCH_TARGET,
  CARD_MARGIN,
} from '../lib/responsive';

export {colors};

/* ─── Style factory ─────────────────────────────────────────────────── */

const makeStyles = () =>
  StyleSheet.create({
    screen: {flex: 1, backgroundColor: colors.bg},
    header: {paddingHorizontal: CARD_MARGIN, paddingTop: rh(8), paddingBottom: rh(12)},
    title: {fontSize: typography.h1, fontWeight: '700', color: colors.text},
    subtitle: {fontSize: typography.caption, color: colors.muted, marginTop: rs(2)},
    card: {
      backgroundColor: colors.card,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.lg,
      marginHorizontal: CARD_MARGIN,
      marginBottom: spacing.sm,
    },
    button: {
      backgroundColor: colors.primary,
      borderRadius: radii.md,
      paddingVertical: spacing.md,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      minHeight: TOUCH_TARGET,
    },
    buttonText: {color: colors.onPrimary, fontSize: typography.body, fontWeight: '600'},
    buttonOutline: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    },
    buttonOutlineText: {color: colors.text},
    buttonDanger: {backgroundColor: colors.danger},
    buttonSmall: {paddingVertical: spacing.sm, minHeight: rs(36)},
    buttonTextSmall: {fontSize: typography.secondary},
    field: {marginBottom: spacing.md},
    label: {fontSize: typography.label, fontWeight: '600', color: colors.muted, marginBottom: rs(5)},
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      fontSize: typography.body,
      color: colors.text,
      backgroundColor: colors.card,
      minHeight: TOUCH_TARGET,
    },
    inputMultiline: {
      minHeight: rs(80),
      textAlignVertical: 'top' as const,
      paddingTop: spacing.md,
    },
    select: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      fontSize: typography.body,
      color: colors.text,
      backgroundColor: colors.card,
      minHeight: TOUCH_TARGET,
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'space-between' as const,
    },
    badge: {paddingHorizontal: rs(8), paddingVertical: rs(3), borderRadius: radii.full},
    badgeText: {fontSize: typography.badge, fontWeight: '700'},
    stat: {
      backgroundColor: colors.card,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.lg,
      flex: 1,
    },
    statLabel: {fontSize: typography.label, color: colors.muted, fontWeight: '600'},
    statValue: {fontSize: typography.h3, fontWeight: '700', color: colors.text, marginTop: rs(4)},
    row: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      paddingVertical: spacing.md,
    },
    modalOverlay: {flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end' as const},
    modalSheet: {
      backgroundColor: colors.card,
      borderTopLeftRadius: radii.xl,
      borderTopRightRadius: radii.xl,
      padding: spacing.lg,
      maxHeight: '85%',
    },
    modalTitle: {fontSize: typography.h2, fontWeight: '700', color: colors.text, marginBottom: spacing.lg},
    tabBar: {
      flexDirection: 'row' as const,
      backgroundColor: colors.card,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingVertical: rs(6),
    },
    tabItem: {flex: 1, alignItems: 'center' as const, paddingVertical: rs(4)},
    tabLabel: {fontSize: typography.tab, marginTop: rs(3), color: colors.muted, fontWeight: '600'},
    tabLabelActive: {color: colors.primary, fontWeight: '700'},
    section: {
      fontSize: typography.h3,
      fontWeight: '700',
      color: colors.text,
      marginHorizontal: CARD_MARGIN,
      marginTop: spacing.xl,
      marginBottom: spacing.sm,
    },
  });

/* ─── Screen ────────────────────────────────────────────────────────── */

export function Screen({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useThemeStyles(makeStyles);
  return <View style={[styles.screen, style]}>{children}</View>;
}

/* ─── Header ────────────────────────────────────────────────────────── */

export function Header({title, subtitle}: {title: string; subtitle?: string}) {
  const styles = useThemeStyles(makeStyles);
  return (
    <View style={styles.header}>
      <Animated.Text entering={FadeInDown.duration(260)} style={styles.title}>
        {title}
      </Animated.Text>
      {subtitle ? (
        <Animated.Text entering={FadeInDown.duration(260).delay(60)} style={styles.subtitle}>
          {subtitle}
        </Animated.Text>
      ) : null}
    </View>
  );
}

/* ─── Section heading ───────────────────────────────────────────────── */

export function Section({title, index = 0}: {title: string; index?: number}) {
  const styles = useThemeStyles(makeStyles);
  return (
    <Animated.Text
      entering={FadeInDown.duration(260).delay(40 + index * 40)}
      style={styles.section}>
      {title}
    </Animated.Text>
  );
}

/* ─── Card ──────────────────────────────────────────────────────────── */

export function Card({
  children,
  style,
  index = 0,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  index?: number;
}) {
  const styles = useThemeStyles(makeStyles);
  return (
    <Animated.View
      entering={FadeInDown.duration(260).delay(index * 50)}
      style={[styles.card, style]}>
      {children}
    </Animated.View>
  );
}

/* ─── Button ────────────────────────────────────────────────────────── */

type ButtonProps = {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'outline' | 'danger';
  disabled?: boolean;
  loading?: boolean;
  size?: 'default' | 'small';
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  size = 'default',
  icon,
  style,
}: ButtonProps) {
  const styles = useThemeStyles(makeStyles);
  const isOutline = variant === 'outline';
  const isDanger = variant === 'danger';
  const isSmall = size === 'small';
  return (
    <Pressable
      onPress={() => {
        if (!isOutline && !disabled && !loading) {
          actionPress();
        }
        onPress();
      }}
      disabled={disabled || loading}
      style={({pressed}) => [
        styles.button,
        isOutline && styles.buttonOutline,
        isDanger && styles.buttonDanger,
        isSmall && styles.buttonSmall,
        (disabled || loading) && {opacity: 0.5},
        pressed && {transform: [{scale: 0.97}], opacity: 0.9},
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={isOutline ? colors.text : colors.onPrimary} size="small" />
      ) : icon ? (
        <View style={{flexDirection: 'row', alignItems: 'center', gap: rs(6)}}>
          {icon}
          <Text style={[styles.buttonText, isOutline && styles.buttonOutlineText, isSmall && styles.buttonTextSmall]}>
            {title}
          </Text>
        </View>
      ) : (
        <Text style={[styles.buttonText, isOutline && styles.buttonOutlineText, isSmall && styles.buttonTextSmall]}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}

/* ─── Field (text input) ────────────────────────────────────────────── */

type FieldProps = {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  secureTextEntry?: boolean;
  maxLength?: number;
  multiline?: boolean;
  editable?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  secureTextEntry,
  maxLength,
  multiline,
  editable = true,
  style,
}: FieldProps) {
  const styles = useThemeStyles(makeStyles);
  return (
    <View style={[styles.field, style]}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        keyboardType={keyboardType}
        secureTextEntry={secureTextEntry}
        maxLength={maxLength}
        multiline={multiline}
        editable={editable}
        style={[styles.input, multiline && styles.inputMultiline]}
        placeholderTextColor={colors.inputPlaceholder}
        autoCapitalize={multiline ? 'sentences' : 'none'}
      />
    </View>
  );
}

/* ─── SelectField (tap-to-open picker) ──────────────────────────────── */

type SelectFieldProps = {
  label: string;
  value: string;
  placeholder?: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
};

export function SelectField({label, value, placeholder = 'Select…', onPress, style}: SelectFieldProps) {
  const styles = useThemeStyles(makeStyles);
  return (
    <View style={[styles.field, style]}>
      <Text style={styles.label}>{label}</Text>
      <Pressable style={styles.select} onPress={onPress} hitSlop={6}>
        <Text
          style={{fontSize: typography.body, color: value ? colors.text : colors.inputPlaceholder, flex: 1}}
          numberOfLines={1}>
          {value || placeholder}
        </Text>
        <ChevronDown size={rs(16)} color={colors.muted} />
      </Pressable>
    </View>
  );
}

/* ─── Badge ─────────────────────────────────────────────────────────── */

export function Badge({text, tone}: {text: string; tone: 'success' | 'warning' | 'danger' | 'muted'}) {
  const styles = useThemeStyles(makeStyles);
  const bg =
    tone === 'success'
      ? colors.successSoft
      : tone === 'warning'
      ? colors.warningSoft
      : tone === 'danger'
      ? colors.dangerSoft
      : colors.mutedSoft;
  const fg =
    tone === 'success'
      ? colors.success
      : tone === 'warning'
      ? colors.warning
      : tone === 'danger'
      ? colors.danger
      : colors.muted;
  return (
    <View style={[styles.badge, {backgroundColor: bg}]}>
      <Text style={[styles.badgeText, {color: fg}]}>{text}</Text>
    </View>
  );
}

/* ─── StatBox ───────────────────────────────────────────────────────── */

export function StatBox({label, value, valueColor, index = 0}: {label: string; value: string; valueColor?: string; index?: number}) {
  const styles = useThemeStyles(makeStyles);
  return (
    <Animated.View entering={FadeInUp.duration(280).delay(index * 60)} style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, valueColor ? {color: valueColor} : null]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
    </Animated.View>
  );
}

/* ─── Row ───────────────────────────────────────────────────────────── */

export function Row({
  label,
  value,
  valueColor,
  onPress,
}: {
  label: string;
  value?: string;
  valueColor?: string;
  onPress?: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={{flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md}}>
      <Text style={{flex: 1, fontSize: typography.body, color: colors.text}} numberOfLines={1}>
        {label}
      </Text>
      {value ? (
        <Text style={{fontSize: typography.body, fontWeight: '600', color: valueColor ?? colors.text}} numberOfLines={1}>
          {value}
        </Text>
      ) : null}
    </Pressable>
  );
}

/* ─── ShimmerBlock ──────────────────────────────────────────────────── */

function ShimmerBlock({
  height,
  width,
  radius = rs(10),
  style,
}: {
  height: number;
  width?: DimensionValue;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const {mode} = useTheme();
  const x = useSharedValue(-120);

  React.useEffect(() => {
    x.value = withRepeat(withTiming(320, {duration: 1500}), -1, false);
  }, [x]);

  const sweep = useAnimatedStyle(() => ({
    transform: [{translateX: x.value}],
  }));

  return (
    <View
      style={[
        {
          height,
          width: width ?? '100%',
          borderRadius: radius,
          backgroundColor: colors.mutedSoft,
          overflow: 'hidden',
        },
        style,
      ]}>
      <Animated.View
        style={[
          {
            position: 'absolute',
            top: 0,
            bottom: 0,
            width: '55%',
            backgroundColor: mode === 'dark' ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.45)',
            transform: [{skewX: '-18deg'}],
          },
          sweep,
        ]}
      />
    </View>
  );
}

/* ─── Loading skeleton ──────────────────────────────────────────────── */

export function Loading({rows = 5}: {rows?: number}) {
  return (
    <View style={{padding: spacing.lg}}>
      {Array.from({length: rows}).map((_, i) => (
        <View
          key={i}
          style={[
            {
              backgroundColor: colors.card,
              borderRadius: radii.lg,
              borderWidth: 1,
              borderColor: colors.border,
              padding: spacing.lg,
              marginBottom: spacing.sm,
              gap: spacing.sm,
            },
          ]}>
          <View style={{flexDirection: 'row', alignItems: 'center', gap: spacing.sm}}>
            <ShimmerBlock height={rs(40)} width={rs(40)} radius={rs(8)} />
            <View style={{flex: 1, gap: rs(6)}}>
              <ShimmerBlock height={rs(12)} width="70%" />
              <ShimmerBlock height={rs(10)} width="45%" />
            </View>
          </View>
          <ShimmerBlock height={rs(10)} width="85%" />
        </View>
      ))}
    </View>
  );
}

/* ─── Empty state ───────────────────────────────────────────────────── */

export function Empty({text, action}: {text: string; action?: {label: string; onPress: () => void}}) {
  return (
    <View style={{flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xxxl}}>
      <Text style={{color: colors.muted, fontSize: typography.body, textAlign: 'center'}}>{text}</Text>
      {action ? (
        <Button
          title={action.label}
          onPress={action.onPress}
          variant="outline"
          style={{marginTop: spacing.lg, paddingHorizontal: spacing.xxl}}
        />
      ) : null}
    </View>
  );
}

/* ─── Error state ───────────────────────────────────────────────────── */

export function ErrorBox({message, onRetry}: {message: string; onRetry?: () => void}) {
  return (
    <View style={{flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xxxl}}>
      <Text style={{color: colors.danger, fontSize: typography.body, textAlign: 'center'}}>{message}</Text>
      {onRetry ? (
        <Button title="Retry" onPress={onRetry} style={{marginTop: spacing.lg, paddingHorizontal: spacing.xxl}} />
      ) : null}
    </View>
  );
}

/* ─── ModalSheet (legacy — kept for gradual migration) ──────────────── */

export function ModalSheet({
  visible,
  title,
  onClose,
  children,
  dismissable = true,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  dismissable?: boolean;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={() => {
        if (dismissable) onClose();
      }}>
      <Pressable
        style={{flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end'}}
        onPress={() => {
          if (dismissable) onClose();
        }}>
        <Pressable
          style={{
            backgroundColor: colors.card,
            borderTopLeftRadius: radii.xl,
            borderTopRightRadius: radii.xl,
            padding: spacing.lg,
            maxHeight: '85%',
          }}
          onPress={() => {}}>
          <Text style={{fontSize: typography.h2, fontWeight: '700', color: colors.text, marginBottom: spacing.lg}}>
            {title}
          </Text>
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/* ─── SafeScreen ────────────────────────────────────────────────────── */

export function SafeScreen({children}: {children: React.ReactNode}) {
  const styles = useThemeStyles(makeStyles);
  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      {children}
    </SafeAreaView>
  );
}

/* ─── AccordionCard ─────────────────────────────────────────────────── */

type AccordionCardProps = {
  /** Always-visible header content. */
  header: React.ReactNode;
  /** Expandable content. */
  children: React.ReactNode;
  /** Whether this card is currently expanded. */
  expanded: boolean;
  /** Called when the header is tapped. */
  onToggle: () => void;
  /** Optional trailing element in the header (e.g., 3-dot menu). */
  trailing?: React.ReactNode;
  /** Animation delay index. */
  index?: number;
};

export function AccordionCard({
  header,
  children,
  expanded,
  onToggle,
  trailing,
  index = 0,
}: AccordionCardProps) {
  const styles = useThemeStyles(makeStyles);
  return (
    <Animated.View
      entering={FadeInDown.duration(260).delay(index * 50)}
      style={styles.card}>
      <Pressable
        onPress={onToggle}
        style={{flexDirection: 'row', alignItems: 'center'}}
        hitSlop={6}>
        <View style={{flex: 1}}>{header}</View>
        {trailing ? <View style={{marginLeft: spacing.sm}}>{trailing}</View> : null}
        <Animated.View
          style={{transform: [{rotate: expanded ? '90deg' : '0deg'}], marginLeft: rs(4)}}>
          <ChevronRight size={rs(16)} color={colors.muted} />
        </Animated.View>
      </Pressable>
      {expanded ? (
        <Animated.View
          entering={FadeInDown.duration(200)}
          style={{marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border}}>
          {children}
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

/* ─── InlineSpinner ─────────────────────────────────────────────────── */

export function InlineSpinner({text}: {text?: string}) {
  return (
    <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: spacing.lg, gap: spacing.sm}}>
      <ActivityIndicator size="small" color={colors.primary} />
      {text ? <Text style={{fontSize: typography.secondary, color: colors.muted}}>{text}</Text> : null}
    </View>
  );
}

/* ─── ThreeDotMenu ──────────────────────────────────────────────────── */

export function ThreeDotMenu({actions}: {actions: {label: string; onPress: () => void; destructive?: boolean}[]}) {
  const [open, setOpen] = React.useState(false);
  return (
    <View>
      <Pressable
        onPress={() => setOpen(!open)}
        hitSlop={8}
        style={{padding: rs(4)}}>
        <MoreVertical size={rs(18)} color={colors.muted} />
      </Pressable>
      {open ? (
        <>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setOpen(false)}
          />
          <View
            style={{
              position: 'absolute',
              right: 0,
              top: rs(28),
              backgroundColor: colors.card,
              borderRadius: radii.md,
              borderWidth: 1,
              borderColor: colors.border,
              paddingVertical: rs(4),
              minWidth: rs(140),
              shadowColor: '#000',
              shadowOffset: {width: 0, height: 2},
              shadowOpacity: 0.15,
              shadowRadius: 8,
              elevation: 5,
              zIndex: 100,
            }}>
            {actions.map((action, i) => (
              <Pressable
                key={i}
                onPress={() => {
                  setOpen(false);
                  action.onPress();
                }}
                style={{
                  paddingHorizontal: spacing.lg,
                  paddingVertical: spacing.sm,
                  minHeight: TOUCH_TARGET,
                  justifyContent: 'center',
                }}>
                <Text
                  style={{
                    fontSize: typography.body,
                    color: action.destructive ? colors.danger : colors.text,
                  }}>
                  {action.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </>
      ) : null}
    </View>
  );
}

/* ─── ConfirmDialog ─────────────────────────────────────────────────── */

export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable
        style={{flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'center', alignItems: 'center', padding: spacing.xxl}}
        onPress={onCancel}>
        <Pressable
          onPress={() => {}}
          style={{
            backgroundColor: colors.card,
            borderRadius: radii.lg,
            padding: spacing.xl,
            width: '100%',
            maxWidth: rs(320),
          }}>
          <Text style={{fontSize: typography.h2, fontWeight: '700', color: colors.text, marginBottom: spacing.sm}}>
            {title}
          </Text>
          <Text style={{fontSize: typography.body, color: colors.muted, marginBottom: spacing.xl}}>
            {message}
          </Text>
          <View style={{flexDirection: 'row', gap: spacing.sm}}>
            <Button title={cancelLabel} variant="outline" onPress={onCancel} style={{flex: 1}} />
            <Button
              title={confirmLabel}
              variant={destructive ? 'danger' : 'primary'}
              onPress={onConfirm}
              style={{flex: 1}}
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export type TextStyleOverride = StyleProp<TextStyle>;
