/**
 * Mobile PIN lock screen — shown by PinProvider while the app is locked.
 * Apple-style: dot indicators, big numpad, springy shake on a wrong PIN, and
 * haptic feedback (tick per digit, error buzz on failure, success ding on
 * unlock). Mirrors the web/desktop lock screen from @munim/ui.
 */
import React, {useEffect, useRef, useState} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import Animated, {
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import {Lock, Delete} from 'lucide-react-native';
import {colors, SafeScreen} from '../components/ui';
import {useThemeStyles} from '../theme';
import {selectionTick, errorFeedback, successFeedback} from '../lib/haptics';
import type {PinContextValue} from '../lib/pin-provider';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'] as const;

const makeStyles = () =>
  StyleSheet.create({
    screen: {flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24},
    iconBadge: {
      width: 58,
      height: 58,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.mutedSoft,
      marginBottom: 18,
    },
    title: {fontSize: 21, fontWeight: '700', color: colors.text},
    subtitle: {fontSize: 13, color: colors.muted, marginTop: 4},
    dots: {flexDirection: 'row', gap: 14, marginVertical: 28},
    dot: {width: 14, height: 14, borderRadius: 7, borderWidth: 2},
    dotFilled: {borderColor: colors.primary, backgroundColor: colors.primary},
    dotEmpty: {borderColor: colors.border, backgroundColor: 'transparent'},
    message: {height: 20, marginBottom: 8},
    messageError: {fontSize: 13, fontWeight: '600', color: colors.danger},
    messageHint: {fontSize: 12, color: colors.muted},
    keypad: {flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', width: 264, gap: 12},
    key: {
      width: 80,
      height: 62,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.mutedSoft,
    },
    keyText: {fontSize: 21, fontWeight: '600', color: colors.text},
    recover: {marginTop: 24, fontSize: 12, fontWeight: '500', color: colors.muted},
  });

export function PinLockScreen({lock}: {lock: PinContextValue}) {
  const styles = useThemeStyles(makeStyles);
  const [entry, setEntry] = useState('');
  const [error, setError] = useState<string | null>(null);
  const busyRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shake = useSharedValue(0);

  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{translateX: shake.value}],
  }));

  useEffect(() => {
    if (error) {
      shake.value = withSequence(
        withTiming(-9, {duration: 50}),
        withTiming(8, {duration: 50}),
        withTiming(-6, {duration: 50}),
        withTiming(4, {duration: 50}),
        withTiming(0, {duration: 60}),
      );
    }
  }, [error, shake]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  async function press(digit: string) {
    if (busyRef.current) return;
    selectionTick();
    setError(null);
    const next = (entry + digit).slice(0, 4);
    setEntry(next);
    if (next.length === 4) {
      busyRef.current = true;
      // Small delay so the 4th dot renders before the result.
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        void (async () => {
          const ok = await lock.unlock(next);
          if (ok) {
            successFeedback();
            setEntry('');
          } else {
            errorFeedback();
            setError('Wrong PIN — try again.');
            setEntry('');
          }
          busyRef.current = false;
        })();
      }, 140);
    }
  }

  function backspace() {
    if (busyRef.current) return;
    selectionTick();
    setError(null);
    setEntry(e => e.slice(0, -1));
  }

  return (
    <SafeScreen>
      <View style={styles.screen}>
        <Animated.View entering={FadeInDown.duration(300)} style={styles.iconBadge}>
          <Lock size={26} color={colors.primary} strokeWidth={2.2} />
        </Animated.View>
        <Animated.Text entering={FadeInDown.duration(300).delay(60)} style={styles.title}>
          Enter your PIN
        </Animated.Text>
        <Animated.Text entering={FadeInDown.duration(300).delay(100)} style={styles.subtitle}>
          {lock.isTestAccount ? 'Test account is active' : 'Munim is locked'}
        </Animated.Text>

        <Animated.View style={[styles.dots, shakeStyle]}>
          {[0, 1, 2, 3].map(i => (
            <View
              key={i}
              style={[styles.dot, i < entry.length ? styles.dotFilled : styles.dotEmpty]}
            />
          ))}
        </Animated.View>

        <Animated.View style={styles.message} entering={FadeInUp.duration(160)}>
          {error ? (
            <Text style={styles.messageError}>{error}</Text>
          ) : lock.isTestAccount ? (
            <Text style={styles.messageHint}>
              Test account PIN is <Text style={{color: colors.text, fontWeight: '700'}}>1234</Text>
            </Text>
          ) : null}
        </Animated.View>

        <Animated.View entering={FadeInUp.duration(260).delay(120)} style={styles.keypad}>
          {KEYS.map((k, i) => {
            if (k === '') return <View key={i} style={styles.key} />;
            if (k === 'del') {
              return (
                <Pressable
                  key={i}
                  accessibilityRole="button"
                  accessibilityLabel="Delete digit"
                  onPress={backspace}
                  style={({pressed}) => [styles.key, {backgroundColor: 'transparent'}, pressed && {opacity: 0.6}]}>
                  <Delete size={22} color={colors.muted} />
                </Pressable>
              );
            }
            return (
              <Pressable
                key={i}
                accessibilityRole="button"
                accessibilityLabel={`Digit ${k}`}
                onPress={() => press(k)}
                style={({pressed}) => [styles.key, pressed && {opacity: 0.7, transform: [{scale: 0.92}]}]}>
                <Text style={styles.keyText}>{k}</Text>
              </Pressable>
            );
          })}
        </Animated.View>

        {!lock.isTestAccount && (
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              selectionTick();
              void lock.resetToTest();
            }}
            style={({pressed}) => pressed && {opacity: 0.6}}>
            <Text style={styles.recover}>Forgot PIN? Reset to the test account (1234)</Text>
          </Pressable>
        )}
      </View>
    </SafeScreen>
  );
}
