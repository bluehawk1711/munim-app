/**
 * Mobile onboarding — first-run setup for the Neon DB URL + Cloudinary
 * credentials. Premium Apple-style: gradient backdrop, glass card, staggered
 * entrances, a "Test connection" step (same createDb + pingDatabase path the
 * Settings screen uses) and a two-step flow (database → cloudinary).
 *
 * Shown by PinProvider when no app setup is saved yet. Completion persists the
 * setup (AsyncStorage munim.databaseUrl + munim.cloudinary) and hands over to
 * the login screen.
 */
import React, {useRef, useState} from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, {FadeInDown} from 'react-native-reanimated';
import {CloudUpload, Database, Eye, EyeOff, Lock} from 'lucide-react-native';
import {colors, Button, SafeScreen} from '../components/ui';
import {useThemeStyles} from '../theme';
import {createDb, pingDatabase} from '@munim/core';
import {saveAppSetup, type AppCloudinaryConfig} from '../lib/app-config';
import {successFeedback, errorFeedback} from '../lib/haptics';

export function OnboardingScreen({onComplete}: {onComplete: () => void}) {
  const styles = useThemeStyles(makeStyles);
  const [step, setStep] = useState<'database' | 'cloudinary'>('database');
  const [dbUrl, setDbUrl] = useState('');
  const [showDb, setShowDb] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testState, setTestState] = useState<'idle' | 'ok' | 'fail'>('idle');
  const [testError, setTestError] = useState<string | null>(null);
  const [cloudName, setCloudName] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [saving, setSaving] = useState(false);
  const busyRef = useRef(false);

  async function handleTest() {
    const url = dbUrl.trim();
    if (!url || busyRef.current) return;
    busyRef.current = true;
    setTesting(true);
    setTestState('idle');
    try {
      await pingDatabase(createDb({databaseUrl: url}));
      setTestState('ok');
      successFeedback();
    } catch (err) {
      setTestState('fail');
      setTestError(err instanceof Error ? err.message : 'Connection failed');
      errorFeedback();
    } finally {
      setTesting(false);
      busyRef.current = false;
    }
  }

  async function handleFinish(skipCloudinary: boolean) {
    const url = dbUrl.trim();
    if (!url || saving) return;
    setSaving(true);
    const cloudinary: AppCloudinaryConfig | null =
      skipCloudinary || !cloudName.trim() || !apiKey.trim() || !apiSecret.trim()
        ? null
        : {cloudName: cloudName.trim(), apiKey: apiKey.trim(), apiSecret: apiSecret.trim()};
    try {
      await saveAppSetup({databaseUrl: url, cloudinary});
      successFeedback();
      onComplete();
    } catch {
      errorFeedback();
      setSaving(false);
    }
  }

  const progress = step === 'database' ? 50 : 100;

  return (
    <SafeScreen>
      <KeyboardAvoidingView
        style={{flex: 1}}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={{flex: 1}}
          contentContainerStyle={styles.screen}
          keyboardShouldPersistTaps="handled">
          {/* Progress bar */}
          <Animated.View entering={FadeInDown.duration(260)} style={styles.progressTrack}>
            <View style={[styles.progressFill, {width: `${progress}%`}]} />
          </Animated.View>

          <Animated.View entering={FadeInDown.duration(260).delay(60)} style={styles.iconBadge}>
            {step === 'database' ? (
              <Database size={26} color={colors.primary} strokeWidth={2.2} />
            ) : (
              <CloudUpload size={26} color={colors.primary} strokeWidth={2.2} />
            )}
          </Animated.View>

          <Animated.Text entering={FadeInDown.duration(260).delay(100)} style={styles.title}>
            {step === 'database' ? 'Welcome to Munim' : 'Product images'}
          </Animated.Text>
          <Animated.Text entering={FadeInDown.duration(260).delay(140)} style={styles.subtitle}>
            {step === 'database'
              ? 'Step 1 of 2 — connect your shop\u2019s shared Neon database'
              : 'Step 2 of 2 — Cloudinary credentials for product photos'}
          </Animated.Text>

          {step === 'database' ? (
            <Animated.View entering={FadeInDown.duration(280).delay(180)} style={styles.card}>
              <Text style={styles.fieldLabel}>Neon connection string</Text>
              <View style={styles.inputWrap}>
                <TextInput
                  style={[styles.input, styles.mono]}
                  value={dbUrl}
                  onChangeText={text => {
                    setDbUrl(text);
                    setTestState('idle');
                  }}
                  placeholder="postgresql://user:pass@host/db"
                  placeholderTextColor={colors.inputPlaceholder}
                  secureTextEntry={!showDb}
                  autoCapitalize="none"
                  autoCorrect={false}
                  spellCheck={false}
                />
                <Pressable
                  onPress={() => setShowDb(v => !v)}
                  style={styles.eye}
                  accessibilityRole="button"
                  accessibilityLabel={showDb ? 'Hide database URL' : 'Show database URL'}>
                  {showDb ? (
                    <EyeOff size={18} color={colors.muted} />
                  ) : (
                    <Eye size={18} color={colors.muted} />
                  )}
                </Pressable>
              </View>

              <View style={styles.testRow}>
                <Button
                  title={testing ? 'Testing…' : 'Test connection'}
                  variant="outline"
                  disabled={!dbUrl.trim() || testing}
                  loading={testing}
                  onPress={() => void handleTest()}
                  style={{flex: 0, paddingHorizontal: 14}}
                />
                {testState === 'ok' ? (
                  <Text style={styles.testOk}>✓ Connected</Text>
                ) : testState === 'fail' ? (
                  <Text style={styles.testFail} numberOfLines={2}>
                    ✗ Failed{testError ? ` — ${testError}` : ''}
                  </Text>
                ) : null}
              </View>

              <Text style={styles.hint}>
                Stored on this device only — never uploaded to the shared database.
              </Text>
              <Button
                title="Continue"
                disabled={!dbUrl.trim()}
                onPress={() => setStep('cloudinary')}
              />
            </Animated.View>
          ) : (
            <Animated.View entering={FadeInDown.duration(280).delay(180)} style={styles.card}>
              <Text style={styles.fieldLabel}>Cloud name</Text>
              <TextInput
                style={styles.input}
                value={cloudName}
                onChangeText={setCloudName}
                placeholder="my-shop"
                placeholderTextColor={colors.inputPlaceholder}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Text style={styles.fieldLabel}>API key</Text>
              <TextInput
                style={styles.input}
                value={apiKey}
                onChangeText={setApiKey}
                placeholder="123456789012345"
                placeholderTextColor={colors.inputPlaceholder}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Text style={styles.fieldLabel}>API secret</Text>
              <View style={styles.inputWrap}>
                <TextInput
                  style={styles.input}
                  value={apiSecret}
                  onChangeText={setApiSecret}
                  placeholder="••••••••••••"
                  placeholderTextColor={colors.inputPlaceholder}
                  secureTextEntry={!showSecret}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <Pressable
                  onPress={() => setShowSecret(v => !v)}
                  style={styles.eye}
                  accessibilityRole="button"
                  accessibilityLabel={showSecret ? 'Hide API secret' : 'Show API secret'}>
                  {showSecret ? (
                    <EyeOff size={18} color={colors.muted} />
                  ) : (
                    <Eye size={18} color={colors.muted} />
                  )}
                </Pressable>
              </View>

              <Button
                title={saving ? 'Saving…' : 'Finish setup'}
                loading={saving}
                disabled={!cloudName.trim() || !apiKey.trim() || !apiSecret.trim() || saving}
                onPress={() => void handleFinish(false)}
              />
              <Pressable
                onPress={() => void handleFinish(true)}
                style={({pressed}) => [styles.linkButton, pressed && {opacity: 0.6}]}
                accessibilityRole="button">
                <Text style={styles.linkText}>Skip for now — set up images later</Text>
              </Pressable>
              <Pressable
                onPress={() => setStep('database')}
                style={({pressed}) => [styles.linkButton, pressed && {opacity: 0.6}]}
                accessibilityRole="button">
                <Text style={styles.linkText}>← Back to database</Text>
              </Pressable>
            </Animated.View>
          )}

          <Animated.View entering={FadeInDown.duration(280).delay(220)} style={styles.footer}>
            <Lock size={14} color={colors.muted} />
            <Text style={styles.footerText}>Encrypted on this device — your data stays yours</Text>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeScreen>
  );
}

const makeStyles = () =>
  StyleSheet.create({
    screen: {
      flexGrow: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
      paddingVertical: 40,
    },
    progressTrack: {
      width: '100%',
      maxWidth: 340,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.mutedSoft,
      overflow: 'hidden',
      marginBottom: 28,
    },
    progressFill: {
      height: '100%',
      borderRadius: 2,
      backgroundColor: colors.primary,
    },
    iconBadge: {
      width: 58,
      height: 58,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.mutedSoft,
      marginBottom: 18,
    },
    title: {fontSize: 24, fontWeight: '700', color: colors.text, letterSpacing: -0.4},
    subtitle: {
      fontSize: 13,
      color: colors.muted,
      marginTop: 6,
      textAlign: 'center',
      maxWidth: 300,
      lineHeight: 18,
    },
    card: {
      width: '100%',
      maxWidth: 340,
      marginTop: 26,
      borderRadius: 22,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 20,
      shadowColor: '#000',
      shadowOpacity: 0.06,
      shadowRadius: 16,
      shadowOffset: {width: 0, height: 6},
      elevation: 3,
    },
    fieldLabel: {fontSize: 12, fontWeight: '600', color: colors.muted, marginBottom: 6, marginTop: 6},
    inputWrap: {position: 'relative'},
    input: {
      height: 46,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.bg,
      paddingHorizontal: 14,
      fontSize: 14,
      color: colors.text,
      marginBottom: 12,
    },
    mono: {fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 12},
    eye: {position: 'absolute', right: 12, top: 11},
    testRow: {flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6},
    testOk: {fontSize: 12, fontWeight: '600', color: colors.success, flexShrink: 1},
    testFail: {fontSize: 12, fontWeight: '600', color: colors.danger, flexShrink: 1},
    hint: {fontSize: 11, color: colors.muted, marginBottom: 14, lineHeight: 15},
    linkButton: {alignItems: 'center', paddingVertical: 8},
    linkText: {fontSize: 13, fontWeight: '500', color: colors.muted, textDecorationLine: 'underline'},
    footer: {flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 24},
    footerText: {fontSize: 11, color: colors.muted},
  });
