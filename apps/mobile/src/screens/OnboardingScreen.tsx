/**
 * Mobile onboarding — first-run setup for the shared API server URL (+ API
 * key). Premium Apple-style: gradient backdrop, glass card, staggered
 * entrances, and a "Test connection" step (same pingApiUrl path the Settings
 * screen uses). One step — the API proxies database + Cloudinary, so nothing
 * else needs configuring.
 *
 * Shown by PinProvider when no app setup is saved yet. Completion persists the
 * setup (AsyncStorage munim.databaseUrl + munim.apiKey) and hands over to the
 * login screen.
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
import {Eye, EyeOff, Lock, Server} from 'lucide-react-native';
import {colors, Button, SafeScreen} from '../components/ui';
import {useThemeStyles} from '../theme';
import {pingApiUrl} from '../lib/api';
import {saveAppSetup} from '../lib/app-config';
import {successFeedback, errorFeedback} from '../lib/haptics';

export function OnboardingScreen({onComplete}: {onComplete: () => void}) {
  const styles = useThemeStyles(makeStyles);
  const [apiUrl, setApiUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testState, setTestState] = useState<'idle' | 'ok' | 'fail'>('idle');
  const [testError, setTestError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const busyRef = useRef(false);

  async function handleTest() {
    const url = apiUrl.trim();
    if (!url || busyRef.current) return;
    busyRef.current = true;
    setTesting(true);
    setTestState('idle');
    try {
      await pingApiUrl(url, apiKey.trim() || undefined);
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

  async function handleFinish() {
    const url = apiUrl.trim();
    if (!url || saving) return;
    setSaving(true);
    try {
      await saveAppSetup({apiUrl: url, apiKey: apiKey.trim()});
      successFeedback();
      onComplete();
    } catch {
      errorFeedback();
      setSaving(false);
    }
  }

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
            <View style={styles.progressFill} />
          </Animated.View>

          <Animated.View entering={FadeInDown.duration(260).delay(60)} style={styles.iconBadge}>
            <Server size={26} color={colors.primary} strokeWidth={2.2} />
          </Animated.View>

          <Animated.Text entering={FadeInDown.duration(260).delay(100)} style={styles.title}>
            Welcome to Munim
          </Animated.Text>
          <Animated.Text entering={FadeInDown.duration(260).delay(140)} style={styles.subtitle}>
            Connect your shop&rsquo;s shared Munim server — the same data as web &amp; desktop
          </Animated.Text>

          <Animated.View entering={FadeInDown.duration(280).delay(180)} style={styles.card}>
            <Text style={styles.fieldLabel}>API server URL</Text>
            <TextInput
              style={styles.input}
              value={apiUrl}
              onChangeText={text => {
                setApiUrl(text);
                setTestState('idle');
              }}
              placeholder="https://api.munim.app"
              placeholderTextColor={colors.inputPlaceholder}
              autoCapitalize="none"
              autoCorrect={false}
              spellCheck={false}
              keyboardType="url"
            />

            <Text style={styles.fieldLabel}>API key (optional)</Text>
            <View style={styles.inputWrap}>
              <TextInput
                style={styles.input}
                value={apiKey}
                onChangeText={setApiKey}
                placeholder="Only needed if not baked into the build"
                placeholderTextColor={colors.inputPlaceholder}
                secureTextEntry={!showKey}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Pressable
                onPress={() => setShowKey(v => !v)}
                style={styles.eye}
                accessibilityRole="button"
                accessibilityLabel={showKey ? 'Hide API key' : 'Show API key'}>
                {showKey ? (
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
                disabled={!apiUrl.trim() || testing}
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
              Stored on this device only. Images and data flow through your server, so no other
              credentials are needed — the API key can also be baked in at build time.
            </Text>
            <Button
              title={saving ? 'Saving…' : 'Continue'}
              disabled={!apiUrl.trim() || saving}
              loading={saving}
              onPress={() => void handleFinish()}
            />
          </Animated.View>

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
      width: '100%',
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
    eye: {position: 'absolute', right: 12, top: 11},
    testRow: {flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6},
    testOk: {fontSize: 12, fontWeight: '600', color: colors.success, flexShrink: 1},
    testFail: {fontSize: 12, fontWeight: '600', color: colors.danger, flexShrink: 1},
    hint: {fontSize: 11, color: colors.muted, marginBottom: 14, lineHeight: 15},
    footer: {flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 24},
    footerText: {fontSize: 11, color: colors.muted},
  });
