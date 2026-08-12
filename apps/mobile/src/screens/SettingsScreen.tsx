import React, {useEffect, useState} from 'react';
import {Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View} from 'react-native';
import {KeyRound} from 'lucide-react-native';
import {createDb, getSettings, pingDatabase, updateSettings} from '@munim/core';
import {themes, themeLabels, themeNames, themeSwatches} from '@munim/theme';
import {getCore, getSavedDatabaseUrl, saveDatabaseUrl} from '../lib/core';
import {useAsync} from '../lib/use-async';
import {Badge, Button, Card, Field, Header, Loading, Screen, Section, colors} from '../components/ui';
import {ThemeToggleButton} from '../components/theme-toggle';
import {
  successFeedback,
  errorFeedback,
  isHapticsEnabled,
  setHapticsEnabled,
  selectionTick,
} from '../lib/haptics';
import {useTheme} from '../theme';
import {usePinLock} from '../lib/pin-provider';

export function SettingsScreen() {
  const {mode, toggle, themeName, setThemeName} = useTheme();
  const pin = usePinLock();
  const [pinCurrent, setPinCurrent] = useState('');
  const [pinNew, setPinNew] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [pinBusy, setPinBusy] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);
  const [pwCurrent, setPwCurrent] = useState('');
  const [pwNew, setPwNew] = useState('');
  const [pwConfirm, setPwConfirm] = useState('');
  const {data: settings, reload} = useAsync(async () => getSettings(await getCore()), []);
  const [url, setUrl] = useState('');
  const [urlLoaded, setUrlLoaded] = useState(false);
  const [shopName, setShopName] = useState('');
  const [shopAddress, setShopAddress] = useState('');
  const [shopPhones, setShopPhones] = useState('');
  const [shopEmail, setShopEmail] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [lowStockThreshold, setLowStockThreshold] = useState('5');
  const [shopLoaded, setShopLoaded] = useState(false);
  const [savingShop, setSavingShop] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'idle' | 'ok' | 'fail'>('idle');
  const scrollRef = React.useRef<ScrollView>(null);
  const dbSectionY = React.useRef(0);
  // Lazy-init from the in-memory flag (loaded at app start) so the switch
  // never flashes the wrong state when re-entering the Settings section.
  const [haptics, setHaptics] = useState(() => isHapticsEnabled());

  // Still sync once in case the app-start load resolved after mount.
  useEffect(() => {
    setHaptics(isHapticsEnabled());
  }, []);

  useEffect(() => {
    if (!urlLoaded) {
      getSavedDatabaseUrl().then(saved => {
        setUrl(saved ?? '');
        setUrlLoaded(true);
      });
    }
  }, [urlLoaded]);

  useEffect(() => {
    if (settings && !shopLoaded) {
      setShopName(settings.shopName);
      setShopAddress(settings.shopAddress ?? '');
      setShopPhones((settings.shopPhones ?? []).join(', '));
      setShopEmail(settings.shopEmail ?? '');
      setCurrency(settings.currency);
      setLowStockThreshold(String(settings.lowStockThreshold));
      setShopLoaded(true);
    }
  }, [settings, shopLoaded]);

  async function handleTest() {
    if (!url.trim()) {
      return;
    }
    setTesting(true);
    setTestResult('idle');
    try {
      await pingDatabase(createDb({databaseUrl: url.trim()}));
      successFeedback();
      setTestResult('ok');
    } catch {
      errorFeedback();
      setTestResult('fail');
    } finally {
      setTesting(false);
    }
  }

  async function handleSaveUrl() {
    try {
      await saveDatabaseUrl(url);
      successFeedback();
    } catch {
      errorFeedback();
    }
    setTestResult('idle');
  }

  async function handleSaveShop() {
    setSavingShop(true);
    try {
      await updateSettings(await getCore(), {
        shopName: shopName.trim() || 'My Shop',
        shopAddress: shopAddress.trim() || undefined,
        shopPhones: shopPhones.split(',').map(s => s.trim()).filter(Boolean),
        shopEmail: shopEmail.trim() || undefined,
        currency: currency.trim() || 'INR',
        lowStockThreshold: Math.max(0, Number(lowStockThreshold) || 0),
      });
      successFeedback();
      reload();
    } catch {
      errorFeedback();
      // ignore
    } finally {
      setSavingShop(false);
    }
  }

  async function handleChangePassword() {
    if (pwNew !== pwConfirm) {
      setPinError('New passwords do not match.');
      errorFeedback();
      return;
    }
    setPinError(null);
    setPinBusy(true);
    const err = await pin.changePassword(pwCurrent, pwNew);
    setPinBusy(false);
    if (err) {
      setPinError(err);
      errorFeedback();
      return;
    }
    successFeedback();
    setPwCurrent('');
    setPwNew('');
    setPwConfirm('');
  }

  async function handleChangePin() {
    if (pinNew !== pinConfirm) {
      setPinError('New PINs do not match.');
      errorFeedback();
      return;
    }
    setPinError(null);
    setPinBusy(true);
    const err = await pin.changePin(pinCurrent, pinNew);
    setPinBusy(false);
    if (err) {
      setPinError(err);
      errorFeedback();
      return;
    }
    successFeedback();
    setPinCurrent('');
    setPinNew('');
    setPinConfirm('');
  }

  async function handleDisablePin() {
    setPinError(null);
    setPinBusy(true);
    const err = await pin.disable(pinCurrent);
    setPinBusy(false);
    if (err) {
      setPinError(err);
      errorFeedback();
      return;
    }
    successFeedback();
    setPinCurrent('');
    setPinNew('');
    setPinConfirm('');
  }

  async function handleEnablePin() {
    if (pinNew !== pinConfirm) {
      setPinError('PINs do not match.');
      errorFeedback();
      return;
    }
    setPinError(null);
    setPinBusy(true);
    const err = await pin.enable(pinNew);
    setPinBusy(false);
    if (err) {
      setPinError(err);
      errorFeedback();
      return;
    }
    successFeedback();
    setPinNew('');
    setPinConfirm('');
  }

  function handleResetToTest() {
    Alert.alert(
      'Reset to test account?',
      'This replaces your credentials with test@munim.app / 1234 / PIN 1234.',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            void pin.resetToTest().then(() => {
              successFeedback();
              setPinCurrent('');
              setPinNew('');
              setPinConfirm('');
              setPwCurrent('');
              setPwNew('');
              setPwConfirm('');
            });
          },
        },
      ],
    );
  }

  function handleLogOut() {
    Alert.alert('Lock the app now?', 'You\'ll need your email, password and PIN to unlock.', [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Lock now',
        style: 'destructive',
        onPress: () => {
          void pin.lockNow().then(() => {
            successFeedback();
          });
        },
      },
    ]);
  }

  if (settings && !shopLoaded) {
    return <Loading />;
  }

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{paddingBottom: 90}}>
      <Header title="Settings" subtitle="Shop profile, appearance, security & database" />
      {urlLoaded && !url.trim() ? (
        <Pressable
          onPress={() => scrollRef.current?.scrollTo({y: dbSectionY.current, animated: true})}
          accessibilityRole="button"
          style={({pressed}) => [styles.dbBanner, pressed && {opacity: 0.75}]}>
          <Text style={styles.dbBannerTitle}>Database not connected</Text>
          <Text style={styles.dbBannerSub}>
            Tap to paste your Neon connection string
          </Text>
        </Pressable>
      ) : null}
      <Section title="Shop profile" />
      <Card index={1}>
        <Field label="Shop name (appears on bills)" value={shopName} onChangeText={setShopName} />
        <Field label="Address" value={shopAddress} onChangeText={setShopAddress} />
        <Field label="Phones (comma separated)" value={shopPhones} onChangeText={setShopPhones} />
        <Field label="Email" value={shopEmail} onChangeText={setShopEmail} />
        <Field label="Currency code" value={currency} onChangeText={setCurrency} placeholder="INR" />
        <Field label="Low-stock alert at" value={lowStockThreshold} onChangeText={setLowStockThreshold} keyboardType="numeric" placeholder="5" />
        <Button title={savingShop ? 'Saving…' : 'Save shop profile'} onPress={handleSaveShop} loading={savingShop} />
      </Card>
      <Section title="Appearance" index={1} />
      <Card index={1}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
          <View style={{flex: 1, paddingRight: 12}}>
            <Text style={{fontSize: 14, fontWeight: '700', color: colors.text}}>Dark mode</Text>
            <Text style={{fontSize: 12, color: colors.muted, marginTop: 2}}>
              Follows your system until you switch here
            </Text>
          </View>
          <ThemeToggleButton isDark={mode === 'dark'} onToggle={toggle} />
        </View>
      </Card>
      <Card index={2}>
        <Text style={{fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 2}}>
          Color theme
        </Text>
        <Text style={{fontSize: 12, color: colors.muted, marginBottom: 12}}>
          Each theme adapts to light &amp; dark mode
        </Text>
        <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 10}}>
          {themeNames.map(name => {
            const [primary, accent] = themeSwatches[name];
            const active = themeName === name;
            const checkColor = themes[name][mode].primaryForeground;
            return (
              <Pressable
                key={name}
                accessibilityRole="button"
                accessibilityLabel={`${themeLabels[name]} theme`}
                onPress={() => {
                  selectionTick();
                  setThemeName(name);
                }}
                style={({pressed}) => [
                  styles.swatchOption,
                  {borderColor: colors.border},
                  active && {borderColor: colors.primary, borderWidth: 2},
                  pressed && {opacity: 0.7, transform: [{scale: 0.94}]},
                ]}>
                <View
                  style={[
                    styles.swatch,
                    {backgroundColor: primary, borderColor: accent},
                    active && styles.swatchActive,
                  ]}>
                  {active ? <Text style={[styles.swatchCheck, {color: checkColor}]}>✓</Text> : null}
                </View>
                <Text style={[styles.swatchLabel, {color: active ? colors.text : colors.muted}, active && {fontWeight: '700'}]}>
                  {themeLabels[name]}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Card>
      <Card index={3}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
          <View style={{flex: 1, paddingRight: 12}}>
            <Text style={{fontSize: 14, fontWeight: '700', color: colors.text}}>Haptic feedback</Text>
            <Text style={{fontSize: 12, color: colors.muted, marginTop: 2}}>
              Ticks, dings &amp; buzzes on buttons and actions
            </Text>
          </View>
          <Switch
            value={haptics}
            onValueChange={value => {
              setHaptics(value);
              void setHapticsEnabled(value);
            }}
            trackColor={{true: colors.primary, false: colors.border}}
            thumbColor="#ffffff"
          />
        </View>
      </Card>
      <Section title="Security" index={2} />
      <Card index={1}>
        <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 8}}>
          <KeyRound size={16} color={colors.primary} style={{marginRight: 6}} />
          <Text style={{fontSize: 14, fontWeight: '700', color: colors.text}}>App lock</Text>
        </View>
        <Text style={{fontSize: 12, color: colors.muted, lineHeight: 17, marginBottom: 10}}>
          Sign in with your email + password, then a 4-digit PIN — stored locally (hashed), never
          sent to the database. Your session is remembered on this device.
        </Text>
        <View style={{flexDirection: 'row', gap: 8, marginBottom: 12}}>
          <Badge
            text={pin.lockEnabled ? 'PIN lock enabled' : 'Lock disabled'}
            tone={pin.lockEnabled ? 'success' : 'muted'}
          />
          {pin.accountEmail ? <Badge text={pin.accountEmail} tone="muted" /> : null}
          {pin.isTestAccount ? <Badge text="Test account — 1234" tone="warning" /> : null}
        </View>
        {pinError ? (
          <Text style={{color: colors.danger, fontSize: 12, fontWeight: '600', marginBottom: 10}}>
            {pinError}
          </Text>
        ) : null}
        {pin.lockEnabled ? (
          <>
            <Text style={{fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: 4}}>
              Change password
            </Text>
            <Field
              label="Current password"
              value={pwCurrent}
              onChangeText={setPwCurrent}
              secureTextEntry
            />
            <Field
              label="New password"
              value={pwNew}
              onChangeText={setPwNew}
              secureTextEntry
            />
            <Field
              label="Confirm new password"
              value={pwConfirm}
              onChangeText={setPwConfirm}
              secureTextEntry
            />
            <Button
              title={pinBusy ? 'Saving…' : 'Change password'}
              variant="outline"
              loading={pinBusy}
              onPress={() => void handleChangePassword()}
            />
            <Text style={{fontSize: 13, fontWeight: '700', color: colors.text, marginTop: 14, marginBottom: 4}}>
              Change PIN
            </Text>
            <Field
              label="Current PIN"
              value={pinCurrent}
              onChangeText={setPinCurrent}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={4}
            />
            <Field
              label="New PIN"
              value={pinNew}
              onChangeText={setPinNew}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={4}
            />
            <Field
              label="Confirm new PIN"
              value={pinConfirm}
              onChangeText={setPinConfirm}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={4}
            />
            <Button
              title={pinBusy ? 'Saving…' : 'Change PIN'}
              loading={pinBusy}
              onPress={() => void handleChangePin()}
            />
            <View style={{flexDirection: 'row', gap: 8, marginTop: 10}}>
              <Button
                title="Disable lock"
                variant="outline"
                disabled={pinBusy}
                onPress={() => void handleDisablePin()}
                style={{flex: 1}}
              />
              <Button
                title="Log out"
                variant="outline"
                disabled={pinBusy}
                onPress={() => handleLogOut()}
                style={{flex: 1}}
              />
            </View>
            <View style={{flexDirection: 'row', marginTop: 8}}>
              <Button
                title="Reset test account"
                variant="outline"
                disabled={pinBusy}
                onPress={() => handleResetToTest()}
                style={{flex: 1}}
              />
            </View>
          </>
        ) : (
          <>
            <Field
              label="New PIN"
              value={pinNew}
              onChangeText={setPinNew}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={4}
            />
            <Field
              label="Confirm new PIN"
              value={pinConfirm}
              onChangeText={setPinConfirm}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={4}
            />
            <Button
              title={pinBusy ? 'Saving…' : 'Enable lock'}
              loading={pinBusy}
              onPress={() => void handleEnablePin()}
            />
          </>
        )}
      </Card>
      <View
        onLayout={e => {
          dbSectionY.current = e.nativeEvent.layout.y;
        }}>
      <Section title="Database" index={3} />
      <Card index={1}>
        <Text style={{fontSize: 13, color: colors.muted, lineHeight: 19, marginBottom: 12}}>
          Munim has no API server. This app talks directly to the same Neon Postgres database used by the
          web and desktop apps. Paste your connection string below.
        </Text>
        <Field label="Neon connection string" value={url} onChangeText={setUrl} placeholder="postgresql://user:pass@host/db?sslmode=require" />
        <View style={{flexDirection: 'row', gap: 10, marginTop: 4}}>
          <Button title={testing ? 'Testing…' : 'Test'} variant="outline" onPress={handleTest} loading={testing} style={{flex: 1}} />
          <Button title="Save URL" onPress={handleSaveUrl} style={{flex: 1}} />
        </View>
        {testResult === 'ok' ? (
          <Text style={{color: colors.success, fontSize: 13, marginTop: 10, fontWeight: '600'}}>✓ Connected</Text>
        ) : testResult === 'fail' ? (
          <Text style={{color: colors.danger, fontSize: 13, marginTop: 10, fontWeight: '600'}}>✗ Connection failed</Text>
        ) : null}
      </Card>
      </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  dbBanner: {
    backgroundColor: colors.warningSoft,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.warning,
    marginHorizontal: 16,
    marginBottom: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  dbBannerTitle: {fontSize: 13, fontWeight: '700', color: colors.warning},
  dbBannerSub: {fontSize: 12, color: colors.muted, marginTop: 2},
  swatchOption: {
    alignItems: 'center',
    gap: 6,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
    width: '30%',
    maxWidth: 104,
  },
  swatch: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatchActive: {
    transform: [{scale: 1.08}],
  },
  swatchCheck: {fontSize: 15, fontWeight: '800'},
  swatchLabel: {fontSize: 10, fontWeight: '600'},
});
