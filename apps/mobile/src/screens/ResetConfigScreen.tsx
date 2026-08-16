/**
 * Mobile connection settings — reachable from the login screen's
 * "Connection settings" link. Shows the saved setup (masked) and lets the user
 * clear the DB URL + Cloudinary credentials, which sends them back to the
 * onboarding screen (handled by PinProvider).
 */
import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import Animated, {FadeInDown} from 'react-native-reanimated';
import {ShieldCheck} from 'lucide-react-native';
import {colors, Button, SafeScreen} from '../components/ui';
import {useThemeStyles} from '../theme';
import {
  clearAppSetup,
  getSavedAppSetup,
  maskDatabaseHost,
  type AppSetupConfig,
} from '../lib/app-config';
import {useAsync} from '../lib/use-async';

export function ResetConfigScreen({
  onCleared,
  onCancel,
}: {
  onCleared: () => void;
  onCancel: () => void;
}) {
  const styles = useThemeStyles(makeStyles);
  const {data: setup} = useAsync<AppSetupConfig | null>(() => getSavedAppSetup(), []);
  const [clearing, setClearing] = React.useState(false);

  async function handleClear() {
    if (clearing) return;
    setClearing(true);
    try {
      await clearAppSetup();
      onCleared();
    } finally {
      setClearing(false);
    }
  }

  return (
    <SafeScreen>
      <View style={styles.screen}>
        <Animated.View entering={FadeInDown.duration(300)} style={styles.iconBadge}>
          <ShieldCheck size={26} color={colors.primary} strokeWidth={2.2} />
        </Animated.View>
        <Animated.Text entering={FadeInDown.duration(300).delay(60)} style={styles.title}>
          Connection settings
        </Animated.Text>
        <Animated.Text entering={FadeInDown.duration(300).delay(100)} style={styles.subtitle}>
          Saved on this device only — never in the shared database.
        </Animated.Text>

        <Animated.View entering={FadeInDown.duration(280).delay(160)} style={styles.card}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>DATABASE</Text>
            <Text style={styles.infoValue} numberOfLines={1}>
              {setup ? maskDatabaseHost(setup.databaseUrl) : 'Not configured'}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>CLOUDINARY</Text>
            <Text style={styles.infoValue} numberOfLines={1}>
              {setup?.cloudinary ? `${setup.cloudinary.cloudName} (images enabled)` : 'Not configured'}
            </Text>
          </View>

          <Button
            title={clearing ? 'Clearing…' : 'Clear & start over'}
            variant="danger"
            loading={clearing}
            onPress={() => void handleClear()}
          />
          <Text style={styles.hint}>
            Wrong connection string or credentials? Clearing returns you to the setup screen.
          </Text>
        </Animated.View>

        <Pressable
          onPress={onCancel}
          style={({pressed}) => [styles.linkButton, pressed && {opacity: 0.6}]}
          accessibilityRole="button">
          <Text style={styles.linkText}>Back to login</Text>
        </Pressable>
      </View>
    </SafeScreen>
  );
}

const makeStyles = () =>
  StyleSheet.create({
    screen: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
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
    title: {fontSize: 21, fontWeight: '700', color: colors.text},
    subtitle: {fontSize: 13, color: colors.muted, marginTop: 4, textAlign: 'center'},
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
    infoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    infoLabel: {fontSize: 11, fontWeight: '700', color: colors.muted, letterSpacing: 0.6},
    infoValue: {fontSize: 12, fontWeight: '600', color: colors.text, flexShrink: 1},
    hint: {fontSize: 11, color: colors.muted, marginTop: 10, textAlign: 'center', lineHeight: 15},
    linkButton: {alignItems: 'center', paddingVertical: 14},
    linkText: {fontSize: 13, fontWeight: '500', color: colors.muted, textDecorationLine: 'underline'},
  });
