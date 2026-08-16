/**
 * ThemeToggleButton — mobile's themed-circle dark-mode toggle.
 *
 * Mirrors the shared AnimatedThemeToggle (packages/ui) used by web + desktop:
 * a circular control with a subtle border and tinted fill (the "themed
 * circle", so it stays visible on light AND dark surfaces) and a Sun/Moon
 * that crossfades + spins on toggle. React Native has no CSS variables or
 * View Transitions, so the animation is a reanimated opacity/rotate/scale
 * morph of the two icons.
 *
 * - Circle surface = `colors.card` + `colors.border` — the exact token pair
 *   that produces the web/desktop white-in-light / zinc-in-dark look, and it
 *   adapts to the active accent theme automatically.
 * - Sun is amber-500 (#f59e0b, same as the web icon); Moon is `colors.text`
 *   so it flips with the mode like the web/desktop icons do.
 * - Press pop + selection haptic (respects the Settings haptics toggle);
 *   reduced-motion users get an instant flip, no spin — unless "Force
 *   animation play" is enabled in Settings, which plays the spin anyway.
 */
import React, {useEffect} from 'react';
import {Pressable, StyleSheet} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import {Moon, Sun} from 'lucide-react-native';
import {colors, useThemeStyles} from '../theme';
import {selectionTick} from '../lib/haptics';
import {isForceTransitionEnabled} from '../lib/force-transition';

const makeStyles = () =>
  StyleSheet.create({
    circle: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      // Subtle lift — matches the web/desktop `shadow-sm` on the toggle.
      shadowColor: '#000',
      shadowOpacity: 0.08,
      shadowRadius: 3,
      shadowOffset: {width: 0, height: 1},
      elevation: 2,
    },
    pressed: {
      opacity: 0.82,
      transform: [{scale: 0.94}],
    },
  });

export function ThemeToggleButton({
  isDark,
  onToggle,
  size = 40,
}: {
  isDark: boolean;
  onToggle: () => void;
  /** Circle diameter in px — 40 matches the web/desktop toggle (size-10). */
  size?: number;
}) {
  const styles = useThemeStyles(makeStyles);
  // Respect the OS reduced-motion preference UNLESS the user opted into
  // forcing the transition from Settings.
  const reduceMotion = useReducedMotion() && !isForceTransitionEnabled();
  // 0 = light, 1 = dark; drives the crossfade + spin.
  const progress = useSharedValue(isDark ? 1 : 0);
  // Read at render time (outside the worklets) so reanimated captures the
  // plain string; flips with the mode like the web/desktop Moon icons.
  const moonColor = colors.text;

  useEffect(() => {
    if (reduceMotion) {
      progress.value = isDark ? 1 : 0;
      return;
    }
    progress.value = withTiming(isDark ? 1 : 0, {
      duration: 500,
      easing: Easing.inOut(Easing.cubic),
    });
  }, [isDark, progress, reduceMotion]);

  const sunStyle = useAnimatedStyle(() => ({
    opacity: 1 - progress.value,
    transform: [
      {rotate: `${90 * progress.value}deg`},
      {scale: 1 - 0.6 * progress.value},
    ],
  }));

  const moonStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [
      {rotate: `${-90 * (1 - progress.value)}deg`},
      {scale: 0.4 + 0.6 * progress.value},
    ],
  }));

  const icon = size * 0.5;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        isDark ? 'Switch to light mode' : 'Switch to dark mode'
      }
      accessibilityState={{checked: isDark}}
      hitSlop={8}
      onPress={() => {
        selectionTick();
        onToggle();
      }}
      style={({pressed}) => [
        styles.circle,
        {width: size, height: size, borderRadius: size / 2},
        pressed && styles.pressed,
      ]}>
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {alignItems: 'center', justifyContent: 'center'},
          sunStyle,
        ]}>
        <Sun size={icon} color="#f59e0b" />
      </Animated.View>
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {alignItems: 'center', justifyContent: 'center'},
          moonStyle,
        ]}>
        <Moon size={icon} color={moonColor} />
      </Animated.View>
    </Pressable>
  );
}
