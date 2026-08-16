import React from 'react';
import {
  ActivityIndicator,
  Modal,
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
// Colors come from @munim/theme (via the dynamic proxy in ../theme) — the
// single source of truth for web, desktop AND mobile. The proxy resolves the
// active mode's palette, so these tokens flip with dark mode automatically.
import {colors, useTheme, useThemeStyles} from '../theme';
import {actionPress} from '../lib/haptics';

export {colors};

const makeStyles = () =>
  StyleSheet.create({
    screen: {flex: 1, backgroundColor: colors.bg},
    header: {paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12},
    title: {fontSize: 22, fontWeight: '700', color: colors.text},
    subtitle: {fontSize: 13, color: colors.muted, marginTop: 2},
    card: {
      backgroundColor: colors.card,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      marginHorizontal: 16,
      marginBottom: 10,
    },
    button: {
      backgroundColor: colors.primary,
      borderRadius: 10,
      paddingVertical: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    buttonText: {color: colors.onPrimary, fontSize: 15, fontWeight: '600'},
    buttonOutline: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    },
    buttonOutlineText: {color: colors.text},
    buttonDanger: {backgroundColor: colors.danger},
    field: {marginBottom: 12},
    label: {fontSize: 12, fontWeight: '600', color: colors.muted, marginBottom: 5},
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 15,
      color: colors.text,
      backgroundColor: colors.card,
    },
    badge: {paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999},
    badgeText: {fontSize: 11, fontWeight: '700'},
    stat: {
      backgroundColor: colors.card,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      flex: 1,
    },
    statLabel: {fontSize: 11, color: colors.muted, fontWeight: '600'},
    statValue: {fontSize: 18, fontWeight: '700', color: colors.text, marginTop: 4},
    row: {flexDirection: 'row', alignItems: 'center', paddingVertical: 10},
    modalOverlay: {flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end'},
    modalSheet: {
      backgroundColor: colors.card,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      padding: 18,
      maxHeight: '85%',
    },
    modalTitle: {fontSize: 17, fontWeight: '700', color: colors.text, marginBottom: 14},
    tabBar: {
      flexDirection: 'row',
      backgroundColor: colors.card,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingVertical: 6,
    },
    tabItem: {flex: 1, alignItems: 'center', paddingVertical: 4},
    tabLabel: {fontSize: 10, marginTop: 2, color: colors.muted, fontWeight: '600'},
    tabLabelActive: {color: colors.primary},
    section: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.text,
      marginHorizontal: 16,
      marginTop: 18,
      marginBottom: 10,
    },
  });

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

/** Animated section heading (Apple-style staggered entrance). */
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

type ButtonProps = {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'outline' | 'danger';
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Button({title, onPress, variant = 'primary', disabled, loading, style}: ButtonProps) {
  const styles = useThemeStyles(makeStyles);
  const isOutline = variant === 'outline';
  const isDanger = variant === 'danger';
  return (
    <Pressable
      onPress={() => {
        // Native feedback for confirmations; outline buttons (selectors,
        // filters) stay quiet to avoid haptic noise.
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
        (disabled || loading) && {opacity: 0.5},
        pressed && {transform: [{scale: 0.97}], opacity: 0.9},
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={isOutline ? colors.text : colors.onPrimary} />
      ) : (
        <Text style={[styles.buttonText, isOutline && styles.buttonOutlineText]}>{title}</Text>
      )}
    </Pressable>
  );
}

type FieldProps = {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  secureTextEntry?: boolean;
  maxLength?: number;
  /** Renders a taller multi-line textarea (notes / terms). */
  multiline?: boolean;
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
        style={[styles.input, multiline && {minHeight: 76, textAlignVertical: 'top', paddingTop: 10}]}
        placeholderTextColor={colors.inputPlaceholder}
        autoCapitalize={multiline ? 'sentences' : 'none'}
      />
    </View>
  );
}

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
  const styles = useThemeStyles(makeStyles);
  return (
    <Pressable onPress={onPress} style={styles.row}>
      <Text style={{flex: 1, fontSize: 14, color: colors.text}} numberOfLines={1}>
        {label}
      </Text>
      {value ? (
        <Text style={{fontSize: 14, fontWeight: '600', color: valueColor ?? colors.text}} numberOfLines={1}>
          {value}
        </Text>
      ) : null}
    </Pressable>
  );
}

/**
 * Shimmer loading blocks — a soft highlight sweeps left-to-right (premium
 * alternative to a spinner/pulse). Used by the list screens while data loads.
 */
function ShimmerBlock({
  height,
  width,
  radius = 10,
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

/** Full list skeleton: header-ish lines + card-shaped placeholder rows. */
export function Loading({rows = 5}: {rows?: number}) {
  const styles = useThemeStyles(makeStyles);
  return (
    <View style={{padding: 16}}>
      {Array.from({length: rows}).map((_, i) => (
        <View
          key={i}
          style={[
            styles.card,
            {marginHorizontal: 0, marginBottom: 10, padding: 14, gap: 10},
          ]}>
          <View style={{flexDirection: 'row', alignItems: 'center', gap: 10}}>
            <ShimmerBlock height={40} width={40} radius={8} />
            <View style={{flex: 1, gap: 6}}>
              <ShimmerBlock height={12} width="70%" />
              <ShimmerBlock height={10} width="45%" />
            </View>
          </View>
          <ShimmerBlock height={10} width="85%" />
        </View>
      ))}
    </View>
  );
}

export function Empty({text}: {text: string}) {
  return (
    <View style={{flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40}}>
      <Text style={{color: colors.muted, fontSize: 14}}>{text}</Text>
    </View>
  );
}

export function ErrorBox({message, onRetry}: {message: string; onRetry?: () => void}) {
  return (
    <View style={{flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32}}>
      <Text style={{color: colors.danger, fontSize: 14, textAlign: 'center'}}>{message}</Text>
      {onRetry ? (
        <Button title="Retry" onPress={onRetry} style={{marginTop: 16, paddingHorizontal: 32}} />
      ) : null}
    </View>
  );
}

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
  /** When false the sheet cannot be dismissed (no back button, no overlay
   *  tap) — used for in-flight operations like the DB connection test. */
  dismissable?: boolean;
}) {
  const styles = useThemeStyles(makeStyles);
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={() => {
        if (dismissable) onClose();
      }}>
      <Pressable
        style={styles.modalOverlay}
        onPress={() => {
          if (dismissable) onClose();
        }}>
        <Pressable style={styles.modalSheet} onPress={() => {}}>
          <Text style={styles.modalTitle}>{title}</Text>
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export function SafeScreen({children}: {children: React.ReactNode}) {
  const styles = useThemeStyles(makeStyles);
  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      {children}
    </SafeAreaView>
  );
}

export type TextStyleOverride = StyleProp<TextStyle>;
