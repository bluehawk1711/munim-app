/**
 * Mobile onboarding — first-run setup for the shared API server URL (+ API
 * key). Premium Apple-style: tinted backdrop with soft accent blobs, glass
 * card, staggered entrances, and a "Test connection" step (same pingApiUrl
 * path the Settings screen uses). One step — the API proxies database +
 * Cloudinary, so nothing else needs configuring.
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
import Animated, {
  Easing,
  FadeInDown,
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import {
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Globe2,
  KeyRound,
  Lock,
  ShieldCheck,
  Sparkles,
  XCircle,
} from 'lucide-react-native';
import {colors, Button, SafeScreen} from '../components/ui';
import {useThemeStyles} from '../theme';
import type {MobileColors} from '@munim/theme';
import {pingApiUrl} from '../lib/api';
import {saveAppSetup} from '../lib/app-config';
import {successFeedback, errorFeedback} from '../lib/haptics';

type TestState = 'idle' | 'testing' | 'ok' | 'fail';

export function OnboardingScreen({onComplete}: {onComplete: () => void}) {
  const styles = useThemeStyles(makeStyles);
  const [apiUrl, setApiUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [testState, setTestState] = useState<TestState>('idle');
  const [testError, setTestError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const busyRef = useRef(false);

  async function handleTest() {
    const url = apiUrl.trim();
    if (!url || busyRef.current) return;
    busyRef.current = true;
    setTestState('testing');
    setTestError(null);
    try {
      await pingApiUrl(url, apiKey.trim() || undefined);
      setTestState('ok');
      successFeedback();
    } catch (err) {
      setTestState('fail');
      setTestError(err instanceof Error ? err.message : 'Connection failed');
      errorFeedback();
    } finally {
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

  const urlValid = apiUrl.trim().length > 0;
  const canTest = urlValid && testState !== 'testing';
  const canContinue = urlValid && testState === 'ok' && !saving;

  return (
    <SafeScreen>
      <View style={styles.gradientWrap}>
        <BackdropBlobs styles={styles} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.screen}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <Animated.View
            entering={FadeInDown.duration(360).easing(Easing.out(Easing.cubic))}
            style={styles.brandRow}>
            <View style={styles.brandBadge}>
              <Sparkles size={18} color={colors.onPrimary} strokeWidth={2.4} />
            </View>
            <Text style={styles.brandText}>Munim</Text>
          </Animated.View>

          <Animated.Text
            entering={FadeInDown.duration(380).delay(60).easing(Easing.out(Easing.cubic))}
            style={styles.title}>
            Welcome to Munim
          </Animated.Text>
          <Animated.Text
            entering={FadeInDown.duration(380).delay(110).easing(Easing.out(Easing.cubic))}
            style={styles.subtitle}>
            Connect your shop&rsquo;s shared Munim server — the same data on web, desktop and mobile, kept in sync for everyone on your team.
          </Animated.Text>

          <Animated.View
            entering={FadeInDown.duration(420).delay(170).easing(Easing.out(Easing.cubic))}
            style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.iconBadge}>
                <Globe2 size={20} color={colors.primary} strokeWidth={2.2} />
              </View>
              <View style={styles.flex}>
                <Text style={styles.cardTitle}>Server connection</Text>
                <Text style={styles.cardHint}>
                  One-time setup. Stored on this device only — never in your database.
                </Text>
              </View>
            </View>

            <View style={styles.fieldBlock}>
              <Text style={styles.label}>
                API server URL
                <Text style={styles.required}> *</Text>
              </Text>
              <View style={[styles.inputWrap, urlValid && styles.inputWrapFocused]}>
                <Globe2 size={16} color={colors.muted} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={apiUrl}
                  onChangeText={text => {
                    setApiUrl(text);
                    if (testState !== 'idle') {
                      setTestState('idle');
                      setTestError(null);
                    }
                  }}
                  placeholder="https://api.munim.app"
                  placeholderTextColor={colors.inputPlaceholder}
                  autoCapitalize="none"
                  autoCorrect={false}
                  spellCheck={false}
                  keyboardType="url"
                  autoComplete="off"
                  returnKeyType="next"
                  onSubmitEditing={() => void handleTest()}
                />
              </View>
            </View>

            <View style={styles.fieldBlock}>
              <Text style={styles.label}>
                API key <Text style={styles.optional}>(optional)</Text>
              </Text>
              <View style={[styles.inputWrap, apiKey.length > 0 && styles.inputWrapFocused]}>
                <KeyRound size={16} color={colors.muted} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, styles.inputWithTrailing]}
                  value={apiKey}
                  onChangeText={setApiKey}
                  placeholder="Only needed if not baked into the build"
                  placeholderTextColor={colors.inputPlaceholder}
                  secureTextEntry={!showKey}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="off"
                  returnKeyType="done"
                  onSubmitEditing={() => void handleFinish()}
                />
                <Pressable
                  onPress={() => setShowKey(v => !v)}
                  style={styles.eye}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel={showKey ? 'Hide API key' : 'Show API key'}>
                  {showKey ? (
                    <EyeOff size={18} color={colors.muted} />
                  ) : (
                    <Eye size={18} color={colors.muted} />
                  )}
                </Pressable>
              </View>
              <Text style={styles.fieldHint}>
                Leave blank if your build already includes it.
              </Text>
            </View>

            <View style={styles.testRow}>
              <Button
                title={
                  testState === 'testing'
                    ? 'Testing…'
                    : testState === 'ok'
                    ? 'Retest'
                    : 'Test connection'
                }
                variant="outline"
                disabled={!canTest}
                loading={testState === 'testing'}
                onPress={() => void handleTest()}
                icon={<Globe2 size={14} color={colors.text} strokeWidth={2.2} />}
                style={styles.testButton}
              />
              <StatusPill state={testState} error={testError} />
            </View>

            <Button
              title={saving ? 'Connecting…' : 'Continue to Munim'}
              disabled={!canContinue}
              loading={saving}
              onPress={() => void handleFinish()}
              icon={<ArrowRight size={16} color={colors.onPrimary} strokeWidth={2.4} />}
              style={styles.continueButton}
            />

            <Text style={styles.legalText}>
              By continuing you trust this device with your shop credentials. You can change the
              server later in Settings.
            </Text>
          </Animated.View>

          <Animated.View
            entering={FadeInDown.duration(380).delay(240).easing(Easing.out(Easing.cubic))}
            style={styles.trustRow}>
            <TrustChip icon={<ShieldCheck size={14} color={colors.success} strokeWidth={2.4} />}>
              End-to-end TLS
            </TrustChip>
            <TrustChip icon={<Lock size={14} color={colors.success} strokeWidth={2.4} />}>
              Stored on this device
            </TrustChip>
            <TrustChip icon={<CheckCircle2 size={14} color={colors.success} strokeWidth={2.4} />}>
              Same data as web/desktop
            </TrustChip>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeScreen>
  );
}

/* ─── Sub-components ─────────────────────────────────────────────────── */

function StatusPill({state, error}: {state: TestState; error: string | null}) {
  const styles = useThemeStyles(makeStyles);
  if (state === 'idle') {
    return (
      <Text style={styles.statusHint} numberOfLines={2}>
        Tap <Text style={styles.statusHintBold}>Test connection</Text> to verify your server is
        reachable.
      </Text>
    );
  }
  if (state === 'testing') {
    return (
      <Animated.View entering={FadeIn.duration(180)} style={[styles.statusPill, styles.statusPillTesting]}>
        <PulseDot color={colors.primary} />
        <Text style={styles.statusPillText} numberOfLines={1}>
          Testing…
        </Text>
      </Animated.View>
    );
  }
  if (state === 'ok') {
    return (
      <Animated.View entering={FadeInDown.duration(220)} style={[styles.statusPill, styles.statusPillOk]}>
        <CheckCircle2 size={14} color={colors.success} strokeWidth={2.6} />
        <Text style={[styles.statusPillText, styles.statusPillTextOk]} numberOfLines={1}>
          Connected
        </Text>
      </Animated.View>
    );
  }
  return (
    <Animated.View entering={FadeInDown.duration(220)} style={[styles.statusPill, styles.statusPillFail]}>
      <XCircle size={14} color={colors.danger} strokeWidth={2.6} />
      <Text style={[styles.statusPillText, styles.statusPillTextFail]} numberOfLines={2}>
        {error ? error : 'Failed'}
      </Text>
    </Animated.View>
  );
}

function PulseDot({color}: {color: string}) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0.8);
  React.useEffect(() => {
    scale.value = withRepeat(withTiming(1.6, {duration: 800, easing: Easing.out(Easing.cubic)}), -1, true);
    opacity.value = withRepeat(withTiming(0, {duration: 800, easing: Easing.out(Easing.cubic)}), -1, true);
  }, [opacity, scale]);
  const ringStyle = useAnimatedStyle(() => ({transform: [{scale: scale.value}], opacity: opacity.value}));
  return (
    <View style={pulseStyles.wrap}>
      <Animated.View style={[pulseStyles.ring, {borderColor: color}, ringStyle]} />
      <View style={[pulseStyles.dot, {backgroundColor: color}]} />
    </View>
  );
}

function TrustChip({icon, children}: {icon: React.ReactNode; children: React.ReactNode}) {
  const styles = useThemeStyles(makeStyles);
  return (
    <View style={styles.trustChip}>
      {icon}
      <Text style={styles.trustChipText}>{children}</Text>
    </View>
  );
}

function BackdropBlobs({styles}: {styles: ReturnType<typeof makeStyles>}) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View style={styles.blobA} />
      <View style={styles.blobB} />
    </View>
  );
}

/* ─── Styles ─────────────────────────────────────────────────────────── */

const pulseStyles = StyleSheet.create({
  wrap: {width: 16, height: 16, alignItems: 'center', justifyContent: 'center'},
  ring: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
  },
  dot: {width: 6, height: 6, borderRadius: 3},
});

const makeStyles = (c: MobileColors) =>
  StyleSheet.create({
    flex: {flex: 1},
    gradientWrap: {
      ...StyleSheet.absoluteFill,
      backgroundColor: c.bg,
    },
    blobA: {
      position: 'absolute',
      top: -120,
      right: -80,
      width: 320,
      height: 320,
      borderRadius: 160,
      backgroundColor: c.primary,
      opacity: 0.18,
    },
    blobB: {
      position: 'absolute',
      bottom: -160,
      left: -100,
      width: 360,
      height: 360,
      borderRadius: 180,
      backgroundColor: c.accent,
      opacity: 0.35,
    },
    screen: {
      flexGrow: 1,
      paddingHorizontal: 24,
      paddingTop: 24,
      paddingBottom: 32,
    },
    brandRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 36,
    },
    brandBadge: {
      width: 30,
      height: 30,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.primary,
      shadowColor: c.primary,
      shadowOpacity: 0.35,
      shadowRadius: 8,
      shadowOffset: {width: 0, height: 4},
      elevation: 4,
    },
    brandText: {
      fontSize: 15,
      fontWeight: '700',
      color: c.text,
      letterSpacing: 0.2,
    },
    title: {
      fontSize: 30,
      fontWeight: '800',
      color: c.text,
      letterSpacing: -0.6,
      lineHeight: 36,
    },
    subtitle: {
      fontSize: 15,
      color: c.muted,
      marginTop: 10,
      lineHeight: 22,
      maxWidth: 340,
    },
    card: {
      width: '100%',
      maxWidth: 380,
      alignSelf: 'center',
      marginTop: 28,
      borderRadius: 24,
      backgroundColor: c.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      padding: 20,
      shadowColor: '#000',
      shadowOpacity: 0.08,
      shadowRadius: 24,
      shadowOffset: {width: 0, height: 12},
      elevation: 6,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      marginBottom: 18,
    },
    iconBadge: {
      width: 38,
      height: 38,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.mutedSoft,
    },
    cardTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: c.text,
    },
    cardHint: {
      fontSize: 12,
      color: c.muted,
      marginTop: 2,
      lineHeight: 17,
    },
    fieldBlock: {marginBottom: 14},
    label: {
      fontSize: 12,
      fontWeight: '600',
      color: c.muted,
      marginBottom: 6,
      letterSpacing: 0.2,
    },
    required: {color: c.danger, fontWeight: '700'},
    optional: {
      color: c.inputPlaceholder,
      fontWeight: '500',
    },
    inputWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.bg,
      paddingHorizontal: 12,
    },
    inputWrapFocused: {
      borderColor: c.primary,
      shadowColor: c.primary,
      shadowOpacity: 0.18,
      shadowRadius: 8,
      shadowOffset: {width: 0, height: 4},
      elevation: 2,
    },
    inputIcon: {marginRight: 8},
    input: {
      flex: 1,
      height: 46,
      fontSize: 15,
      color: c.text,
      paddingVertical: 0,
    },
    inputWithTrailing: {paddingRight: 4},
    eye: {padding: 6},
    fieldHint: {
      fontSize: 11,
      color: c.muted,
      marginTop: 6,
      lineHeight: 15,
    },
    testRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginTop: 6,
      marginBottom: 14,
    },
    testButton: {flexShrink: 0},
    statusHint: {
      flex: 1,
      fontSize: 11,
      color: c.muted,
      lineHeight: 15,
    },
    statusHintBold: {fontWeight: '700', color: c.text},
    statusPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      flexShrink: 1,
    },
    statusPillTesting: {
      backgroundColor: c.mutedSoft,
    },
    statusPillOk: {backgroundColor: c.successSoft},
    statusPillFail: {backgroundColor: c.dangerSoft},
    statusPillText: {fontSize: 11, fontWeight: '600', color: c.muted, flexShrink: 1},
    statusPillTextOk: {color: c.success},
    statusPillTextFail: {color: c.danger},
    continueButton: {marginTop: 4},
    legalText: {
      fontSize: 11,
      color: c.muted,
      marginTop: 12,
      lineHeight: 15,
      textAlign: 'center',
    },
    trustRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      gap: 8,
      marginTop: 24,
      maxWidth: 380,
      alignSelf: 'center',
    },
    trustChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: c.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
    },
    trustChipText: {
      fontSize: 11,
      fontWeight: '600',
      color: c.text,
    },
  });