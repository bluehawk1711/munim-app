import React, {useEffect, useState} from 'react';
import {Alert, Pressable, StyleSheet, Switch, Text, View} from 'react-native';
import {KeyRound} from 'lucide-react-native';
import {createDb, getSettings, pingDatabase, updateSettings} from '@munim/core';
import {themes, themeLabels, themeNames, themeSwatches} from '@munim/theme';
import {getCore, getSavedDatabaseUrl, saveDatabaseUrl} from '../lib/core';
import {useAsync} from '../lib/use-async';
import {Badge, Button, Card, Field, Header, Loading, Screen, colors} from '../components/ui';
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
      'This replaces your current PIN with 1234.',
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
            });
          },
        },
      ],
    );
  }

  if (settings && !shopLoaded) {
    return <Loading />;
  }

  return (
    <Screen>
      <Header title="Settings" subtitle="Connect to the shared Neon database" />
      <Card>
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
      <Card>
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
          <Switch
            value={mode === 'dark'}
            onValueChange={toggle}
            trackColor={{true: colors.primary, false: colors.border}}
            thumbColor="#ffffff"
          />
        </View>
      </Card>
      <Card>
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
      <Card>
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
      <Card>
        <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 8}}>
          <KeyRound size={16} color={colors.primary} style={{marginRight: 6}} />
          <Text style={{fontSize: 14, fontWeight: '700', color: colors.text}}>App lock</Text>
        </View>
        <Text style={{fontSize: 12, color: colors.muted, lineHeight: 17, marginBottom: 10}}>
          A 4-digit PIN unlocks this phone — stored locally (hashed), never sent to the database.
        </Text>
        <View style={{flexDirection: 'row', gap: 8, marginBottom: 12}}>
          <Badge
            text={pin.lockEnabled ? 'PIN lock enabled' : 'Lock disabled'}
            tone={pin.lockEnabled ? 'success' : 'muted'}
          />
          {pin.isTestAccount ? <Badge text="Test account — PIN 1234" tone="warning" /> : null}
        </View>
        {pinError ? (
          <Text style={{color: colors.danger, fontSize: 12, fontWeight: '600', marginBottom: 10}}>
            {pinError}
          </Text>
        ) : null}
        {pin.lockEnabled ? (
          <>
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
                title="Reset test"
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
      <Card>
        <Text style={{fontSize: 14, fontWeight: '700', marginBottom: 10, color: colors.text}}>Shop profile</Text>
        <Field label="Shop name (appears on bills)" value={shopName} onChangeText={setShopName} />
        <Field label="Address" value={shopAddress} onChangeText={setShopAddress} />
        <Field label="Phones (comma separated)" value={shopPhones} onChangeText={setShopPhones} />
        <Field label="Email" value={shopEmail} onChangeText={setShopEmail} />
        <Field label="Currency code" value={currency} onChangeText={setCurrency} placeholder="INR" />
        <Field label="Low-stock alert at" value={lowStockThreshold} onChangeText={setLowStockThreshold} keyboardType="numeric" placeholder="5" />
        <Button title={savingShop ? 'Saving…' : 'Save shop profile'} onPress={handleSaveShop} loading={savingShop} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
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
