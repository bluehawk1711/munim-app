import React, {useEffect, useState} from 'react';
import {ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View} from 'react-native';
import {FileText, KeyRound} from 'lucide-react-native';
import * as Print from 'expo-print';
import {themes, themeLabels, themeNames, themeSwatches} from '@munim/theme';
import {
  getSavedApiKey,
  getSavedApiUrl,
  pingApiUrl,
  saveApiKey,
  saveApiUrl,
} from '../lib/api';
import {useQueryState, useSettings, useUpdateSettings, useGoldRates, useSaveGoldRates, useBackfillGoldKarats, useSyncProductPrices} from '@munim/query';
import {
  buildSampleBill,
  mergeBillTemplateSettings,
  renderBillHtml,
  resolveGoldRateTable,
  type LabourType,
  type RateDisplayUnit,
  type SampleBillKind,
} from '@munim/core';
import {savePdf} from '../lib/save-pdf';
import {Badge, Button, Card, Field, LabourField, Loading, ModalSheet, Screen, Section, colors} from '../components/ui';
import {HomeHeader, headerScrollHandlers} from '../components/home-header';
import {ThemeToggleButton} from '../components/theme-toggle';
import {
  successFeedback,
  errorFeedback,
  isHapticsEnabled,
  setHapticsEnabled,
  selectionTick,
} from '../lib/haptics';
import {
  isForceTransitionEnabled,
  setForceTransitionEnabled,
} from '../lib/force-transition';
import {useTheme, useThemeStyles} from '../theme';
import {usePinLock} from '../lib/pin-provider';

export function SettingsScreen() {
  const styles = useThemeStyles(makeStyles);
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
  const {data: settings} = useQueryState(useSettings());
  const updateSettings = useUpdateSettings();
  const [url, setUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [urlLoaded, setUrlLoaded] = useState(false);
  const [shopName, setShopName] = useState('');
  const [shopAddress, setShopAddress] = useState('');
  const [shopPhones, setShopPhones] = useState('');
  const [shopEmail, setShopEmail] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [lowStockThreshold, setLowStockThreshold] = useState('5');
  const [allowZeroTotal, setAllowZeroTotal] = useState(true);
  const [shopLoaded, setShopLoaded] = useState(false);
  const [savingShop, setSavingShop] = useState(false);

  // ── Sample bill (Settings → Bills) — same dummy bills the web/desktop
  // Settings card generates, saved to Downloads via the shared savePdf. ──
  const [sampleBusy, setSampleBusy] = useState<SampleBillKind | null>(null);

  async function handleSampleBill(kind: SampleBillKind) {
    setSampleBusy(kind);
    try {
      const bill = buildSampleBill(kind);
      const html = renderBillHtml(
        bill,
        mergeBillTemplateSettings({template: kind === 'gold' ? 'jewellery' : 'ecommerce'}),
      );
      const {uri} = await Print.printToFileAsync({html, base64: false});
      const saved = await savePdf(uri, `${bill.billNo} (sample)`);
      if (saved) successFeedback();
      else errorFeedback();
    } catch {
      errorFeedback();
    } finally {
      setSampleBusy(null);
    }
  }

  // ── Gold rate table (dynamic karat pricing, shared by all 3 apps) ──────
  const goldRates = useGoldRates();
  const saveGoldRates = useSaveGoldRates();
  const backfillKarats = useBackfillGoldKarats();
  const syncPrices = useSyncProductPrices();
  /** Draft of the whole 0–24 table — seeded from the API, saved in one PUT. */
  const [karatDraft, setKaratDraft] = useState<Record<number, {ratePerGram: number; isCustom: boolean}>>({});
  // Raw text of each karat field while typing — the draft stores parsed
  // numbers, so without this "95." would re-render as "95" and swallow the dot.
  const [karatDraftText, setKaratDraftText] = useState<Record<number, string>>({});
  const [defaultLabourType, setDefaultLabourType] = useState<LabourType>('PERCENT');
  const [defaultLabourValue, setDefaultLabourValue] = useState('');
  const [silverRate, setSilverRate] = useState(''); // per-gram (the stored value)
  // Raw text while typing, in the SELECTED display unit — without this a
  // conversion (÷10 while the unit is ₹/10gm) would swallow a mid-typing dot.
  const [silverRateText, setSilverRateText] = useState<string | null>(null);
  const [rateDisplayUnit, setRateDisplayUnit] = useState<RateDisplayUnit>('gm');
  const [karatSheetOpen, setKaratSheetOpen] = useState(false);
  const [savingRates, setSavingRates] = useState(false);
  // DB connection test modal: opens first, stays open (non-dismissible) while
  // the ping is in flight, then flips to ok / fail with the error message.
  const [testOpen, setTestOpen] = useState(false);
  const [testState, setTestState] = useState<'testing' | 'ok' | 'fail'>('testing');
  const [testError, setTestError] = useState<string | null>(null);
  const scrollRef = React.useRef<ScrollView>(null);
  const dbSectionY = React.useRef(0);
  // Lazy-init from the in-memory flags (loaded at app start) so the switches
  // never flash the wrong state when re-entering the Settings section.
  const [haptics, setHaptics] = useState(() => isHapticsEnabled());
  const [forceTransition, setForceTransition] = useState(() =>
    isForceTransitionEnabled(),
  );

  // Still sync once in case the app-start load resolved after mount.
  useEffect(() => {
    setHaptics(isHapticsEnabled());
    setForceTransition(isForceTransitionEnabled());
  }, []);

  useEffect(() => {
    if (!urlLoaded) {
      void (async () => {
        const [savedUrl, savedKey] = await Promise.all([getSavedApiUrl(), getSavedApiKey()]);
        setUrl(savedUrl ?? '');
        setApiKey(savedKey ?? '');
        setUrlLoaded(true);
      })();
    }
  }, [urlLoaded]);

  useEffect(() => {
    if (settings && !shopLoaded) {
      setShopName(settings.shopName);
      setShopAddress(settings.shopAddress ?? '');
      setShopPhones(
        Array.isArray(settings.shopPhones) ? settings.shopPhones.join(', ') : typeof settings.shopPhones === 'string' ? settings.shopPhones : '',
      );
      setShopEmail(settings.shopEmail ?? '');
      setCurrency(settings.currency);
      setLowStockThreshold(String(settings.lowStockThreshold));
      setAllowZeroTotal(settings.allowZeroTotal ?? true);
      setDefaultLabourType(settings.defaultLabourType ?? 'PERCENT');
      setDefaultLabourValue(String(settings.defaultLabourValue ?? 0));
      setSilverRate(String(settings.silverRatePerGram ?? 0));
      setRateDisplayUnit(settings.rateDisplayUnit ?? 'gm');
      setSilverRateText(null);
      setShopLoaded(true);
    }
  }, [settings, shopLoaded]);

  // Seed the karat draft from the API (a save re-seeds it with fresh rows).
  useEffect(() => {
    const rows = goldRates.data?.rates;
    if (!rows) return;
    const next: Record<number, {ratePerGram: number; isCustom: boolean}> = {};
    for (const row of rows) next[row.karat] = {ratePerGram: row.ratePerGram, isCustom: row.isCustom};
    setKaratDraft(next);
    setKaratDraftText({});
  }, [goldRates.data]);

  /** Expanded 0–24 table — quoted rows plus every derived karat (core helper). */
  const karatTable = React.useMemo(
    () =>
      resolveGoldRateTable(
        Object.entries(karatDraft).map(([karat, value]) => ({
          karat: Number(karat),
          ratePerGram: value.ratePerGram,
          isCustom: value.isCustom,
        })),
      ),
    [karatDraft],
  );
  // Base karat = highest quoted karat (usually 24K); it scales derived rows.
  const goldBase = [...karatTable].reverse().find((row) => row.isCustom && row.ratePerGram > 0);
  const goldBaseKarat = goldBase?.karat ?? 24;
  const goldBaseRate = goldBase?.ratePerGram ?? 0;
  const quotedKarats = karatTable.filter((row) => row.isCustom && row.ratePerGram > 0).length;

  /** Edits a karat's rate — marks it quoted (pinned). */
  function setKaratRate(karat: number, text: string) {
    setKaratDraftText(prev => ({...prev, [karat]: text}));
    const parsed = Number.parseFloat(text);
    const ratePerGram = Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
    setKaratDraft(prev => ({...prev, [karat]: {ratePerGram, isCustom: true}}));
  }

  /** Drops a quote so the karat follows the base rate again. */
  function resetKarat(karat: number) {
    setKaratDraftText(prev => {
      const next = {...prev};
      delete next[karat];
      return next;
    });
    setKaratDraft(prev => ({...prev, [karat]: {ratePerGram: 0, isCustom: false}}));
  }

  /** Saves the whole table + the shop-wide labour + silver rate in one action. */
  async function handleSaveGoldRates() {
    setSavingRates(true);
    try {
      await saveGoldRates.mutateAsync({
        rates: karatTable.map((row) => ({
          karat: row.karat,
          ratePerGram: row.ratePerGram,
          isCustom: row.isCustom && row.ratePerGram > 0,
        })),
      });
      await updateSettings.mutateAsync({
        defaultLabourType,
        defaultLabourValue: Math.max(0, Number(defaultLabourValue) || 0),
        silverRatePerGram: Math.max(0, Number(silverRate) || 0),
        rateDisplayUnit,
      });
      successFeedback();
      setKaratSheetOpen(false);
      Alert.alert('Rates saved', 'Auto-priced gold & silver products now use the new rates.');
    } catch (err) {
      errorFeedback();
      Alert.alert('Could not save rates', err instanceof Error ? err.message : 'Try again.');
    } finally {
      setSavingRates(false);
    }
  }

  /** Fills `goldKarat` on existing gold products from their purity stamp. */
  async function handleBackfillKarats() {
    try {
      const result = await backfillKarats.mutateAsync();
      successFeedback();
      Alert.alert(
        'Karats filled',
        `${result.updated} gold product(s) updated from their purity stamp` +
          (result.skipped > 0 ? ` · ${result.skipped} couldn't be read` : ''),
      );
    } catch (err) {
      errorFeedback();
      Alert.alert('Backfill failed', err instanceof Error ? err.message : 'Try again.');
    }
  }

  /**
   * "Recalculate prices" — after the rates above change, freeze the freshly
   * computed price into every auto-priced product (same action as the other
   * two apps).
   */
  async function handleSyncPrices() {
    try {
      const r = await syncPrices.mutateAsync();
      if (r.scanned === 0) {
        successFeedback();
        Alert.alert('Nothing to recalculate', 'No auto-priced products yet.');
      } else if (r.updated === 0) {
        successFeedback();
        Alert.alert('Prices already match', 'Every auto-priced product already has today\u2019s rate.');
      } else {
        successFeedback();
        Alert.alert('Prices updated', `Re-priced ${r.updated} of ${r.scanned} auto-priced product(s).`);
      }
    } catch (err) {
      errorFeedback();
      Alert.alert('Recalculation failed', err instanceof Error ? err.message : 'Try again.');
    }
  }

  /** Runs the ping once, flipping the modal between loading → ok / fail. */
  async function runConnectionTest(connectionUrl: string, key?: string): Promise<boolean> {
    setTestState('testing');
    setTestError(null);
    try {
      await pingApiUrl(connectionUrl, key);
      successFeedback();
      setTestState('ok');
      return true;
    } catch (err) {
      errorFeedback();
      setTestState('fail');
      setTestError(err instanceof Error ? err.message : 'Connection failed');
      return false;
    }
  }

  function handleTest() {
    if (!url.trim()) {
      return;
    }
    // Open the modal first so the loading state is visible immediately, then
    // ping. The sheet can't be dismissed while the test is in flight.
    setTestOpen(true);
    void runConnectionTest(url.trim(), apiKey.trim() || undefined);
  }

  async function handleSaveConnection() {
    if (!url.trim()) {
      return;
    }
    setTestOpen(true);
    const ok = await runConnectionTest(url.trim(), apiKey.trim() || undefined);
    if (ok) {
      await saveApiUrl(url);
      if (apiKey.trim()) {
        await saveApiKey(apiKey);
      }
    }
  }

  async function handleSaveShop() {
    setSavingShop(true);
    try {
      await updateSettings.mutateAsync({
        shopName: shopName.trim() || 'My Shop',
        shopAddress: shopAddress.trim() || undefined,
        shopPhones: shopPhones.split(',').map(s => s.trim()).filter(Boolean),
        shopEmail: shopEmail.trim() || undefined,
        currency: currency.trim() || 'INR',
        lowStockThreshold: Math.max(0, Number(lowStockThreshold) || 0),
        allowZeroTotal,
      });
      successFeedback();
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
    try {
      const err = await pin.changePassword(pwCurrent, pwNew);
      if (err) {
        setPinError(err);
        errorFeedback();
        return;
      }
      successFeedback();
      setPwCurrent('');
      setPwNew('');
      setPwConfirm('');
    } finally {
      setPinBusy(false);
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
    try {
      const err = await pin.changePin(pinCurrent, pinNew);
      if (err) {
        setPinError(err);
        errorFeedback();
        return;
      }
      successFeedback();
      setPinCurrent('');
      setPinNew('');
      setPinConfirm('');
    } finally {
      setPinBusy(false);
    }
  }

  async function handleDisablePin() {
    setPinError(null);
    setPinBusy(true);
    try {
      const err = await pin.disable(pinCurrent);
      if (err) {
        setPinError(err);
        errorFeedback();
        return;
      }
      successFeedback();
      setPinCurrent('');
      setPinNew('');
      setPinConfirm('');
    } finally {
      setPinBusy(false);
    }
  }

  async function handleEnablePin() {
    if (pinNew !== pinConfirm) {
      setPinError('PINs do not match.');
      errorFeedback();
      return;
    }
    setPinError(null);
    setPinBusy(true);
    try {
      const err = await pin.enable(pinNew);
      if (err) {
        setPinError(err);
        errorFeedback();
        return;
      }
      successFeedback();
      setPinNew('');
      setPinConfirm('');
    } finally {
      setPinBusy(false);
    }
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
      <KeyboardAvoidingView style={{flex: 1}} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{paddingBottom: 90}} {...headerScrollHandlers}>
      <HomeHeader title="Settings" />
      {urlLoaded && !url.trim() ? (
        <Pressable
          onPress={() => scrollRef.current?.scrollTo({y: dbSectionY.current, animated: true})}
          accessibilityRole="button"
          style={({pressed}) => [styles.dbBanner, pressed && {opacity: 0.75}]}>
          <Text style={styles.dbBannerTitle}>Server not connected</Text>
          <Text style={styles.dbBannerSub}>
            Tap to add your API server URL
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
        <View style={styles.toggleRow}>
          <View style={{flex: 1, paddingRight: 12}}>
            <Text style={styles.switchLabel}>Allow ₹0 invoices</Text>
            <Text style={{fontSize: 12, color: colors.muted}}>Bills with ₹0 total can be created</Text>
          </View>
          <Switch
            value={allowZeroTotal}
            onValueChange={setAllowZeroTotal}
            trackColor={{true: colors.primary, false: colors.border}}
            thumbColor={colors.card}
          />
        </View>
        <Button title={savingShop ? 'Saving…' : 'Save shop profile'} onPress={handleSaveShop} loading={savingShop} />
      </Card>
      <Section title="Rates & labour" index={2} />
      <Card index={1}>
        <Text style={styles.switchLabel}>Dynamic pricing — gold &amp; silver</Text>
        <Text style={{fontSize: 12, color: colors.muted, marginTop: 2, marginBottom: 10}}>
          Gold: net weight × karat rate + labour. Silver: weight × purity × silver rate + labour.
          Un-quoted karats follow the base (highest quoted) karat.
        </Text>
        <Field
          label={`Gold base rate — ${goldBaseKarat}K (₹ per gram)`}
          value={goldBaseRate ? String(goldBaseRate) : ''}
          onChangeText={text => setKaratRate(goldBaseKarat, text)}
          keyboardType="numeric"
          placeholder="e.g. 7200"
        />
        <Field
          label={rateDisplayUnit === '10gm' ? 'Silver rate (₹ per 10 grams)' : 'Silver rate (₹ per gram)'}
          value={
            silverRateText ??
            (silverRate === '' || silverRate === '0'
              ? ''
              : rateDisplayUnit === '10gm'
                ? String(Math.round(Number(silverRate) * 1000) / 100)
                : silverRate)
          }
          onChangeText={text => {
            setSilverRateText(text);
            if (text === '') {
              setSilverRate('');
              return;
            }
            const parsed = Number(text);
            if (Number.isFinite(parsed)) {
              setSilverRate(String(rateDisplayUnit === '10gm' ? parsed / 10 : parsed));
            }
          }}
          keyboardType="numeric"
          placeholder={rateDisplayUnit === '10gm' ? 'e.g. 950' : 'e.g. 95'}
        />
        <View style={styles.unitRow}>
          <Text style={styles.unitLabel}>Show as</Text>
          {(['gm', '10gm'] as const).map(u => (
            <Pressable
              key={u}
              accessibilityState={{selected: rateDisplayUnit === u}}
              onPress={() => {
                setRateDisplayUnit(u);
                setSilverRateText(null);
              }}
              style={[styles.unitBtn, rateDisplayUnit === u && styles.unitBtnActive]}>
              <Text style={[styles.unitText, rateDisplayUnit === u && styles.unitTextActive]}>
                {u === 'gm' ? '₹/gm' : '₹/10gm'}
              </Text>
            </Pressable>
          ))}
        </View>
        <LabourField
          label="Default labour (gold)"
          type={defaultLabourType}
          value={defaultLabourValue === '0' ? '' : defaultLabourValue}
          onTypeChange={setDefaultLabourType}
          onValueChange={setDefaultLabourValue}
          placeholder="e.g. 12"
          hint="Used by gold products that have no labour of their own. Silver labour is always per product."
        />
        <Button
          variant="outline"
          title={`All karats (0–24) · ${quotedKarats} quoted`}
          onPress={() => setKaratSheetOpen(true)}
        />
        <View style={{height: 8}} />
        <Button title={savingRates ? 'Saving…' : 'Save rates & labour'} onPress={handleSaveGoldRates} loading={savingRates} />
        <View style={{height: 8}} />
        <Button
          variant="outline"
          title={backfillKarats.isPending ? 'Filling…' : 'Fill karats from purity'}
          onPress={handleBackfillKarats}
        />
        <View style={{height: 8}} />
        <Button
          variant="outline"
          title={syncPrices.isPending ? 'Recalculating…' : 'Recalculate prices'}
          onPress={handleSyncPrices}
        />
      </Card>
      <Section title="Bills" index={1} />
      <Card index={1}>
        <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 8}}>
          <FileText size={16} color={colors.primary} style={{marginRight: 6}} />
          <Text style={{fontSize: 14, fontWeight: '700', color: colors.text}}>Sample bill</Text>
        </View>
        <Text style={{fontSize: 12, color: colors.muted, lineHeight: 17, marginBottom: 10}}>
          Renders a dummy bill with the real template and saves the PDF to your device
          (Downloads on Android — first tap asks to grant the folder; share sheet on iOS).
          Check the layout, fonts and gold/silver rate lines without creating an invoice.
        </Text>
        <View style={{gap: 8}}>
          <Button
            title={sampleBusy === 'gold' ? 'Generating…' : 'Classic Jewellery (gold sample)'}
            variant="outline"
            loading={sampleBusy === 'gold'}
            disabled={sampleBusy !== null}
            onPress={() => void handleSampleBill('gold')}
          />
          <Button
            title={sampleBusy === 'silver' ? 'Generating…' : 'Modern E-commerce (silver sample)'}
            variant="outline"
            loading={sampleBusy === 'silver'}
            disabled={sampleBusy !== null}
            onPress={() => void handleSampleBill('silver')}
          />
        </View>
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
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: 12,
            paddingTop: 12,
            borderTopWidth: 1,
            borderTopColor: colors.border,
          }}>
          <View style={{flex: 1, paddingRight: 12}}>
            <Text style={{fontSize: 14, fontWeight: '700', color: colors.text}}>
              Force animation play
            </Text>
            <Text style={{fontSize: 12, color: colors.muted, marginTop: 2}}>
              Play the animation even when animations are off — this device only
            </Text>
          </View>
          <Switch
            value={forceTransition}
            onValueChange={value => {
              setForceTransition(value);
              void setForceTransitionEnabled(value);
            }}
            trackColor={{true: colors.primary, false: colors.border}}
            thumbColor={colors.inverseOnSurface}
          />
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
            thumbColor={colors.inverseOnSurface}
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
          sent to the server. Your session is remembered on this device.
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
      <Section title="Server" index={3} />
      <Card index={1}>
        <Text style={{fontSize: 13, color: colors.muted, lineHeight: 19, marginBottom: 12}}>
          This app talks to the shared Munim API server — the same one web & desktop use. Paste the
          server URL below — the API key is optional when EXPO_PUBLIC_API_KEY is baked into the build.
        </Text>
        <Field
          label="API server URL"
          value={url}
          onChangeText={setUrl}
          placeholder="https://api.munim.app"
        />
        <Field
          label="API key (optional)"
          value={apiKey}
          onChangeText={setApiKey}
          placeholder="Saved on this device only"
          secureTextEntry
        />
        <View style={{flexDirection: 'row', gap: 10, marginTop: 4}}>
          <Button title="Test" variant="outline" onPress={handleTest} style={{flex: 1}} />
          <Button title="Save connection" onPress={() => void handleSaveConnection()} style={{flex: 1}} />
        </View>
      </Card>
      </View>
      </ScrollView>
      </KeyboardAvoidingView>

      <ModalSheet
        visible={testOpen}
        title={
          testState === 'testing'
            ? 'Testing connection'
            : testState === 'ok'
              ? 'Connected'
              : 'Connection failed'
        }
        onClose={() => setTestOpen(false)}
        dismissable={testState !== 'testing'}
        centered
      >
        {testState === 'testing' ? (
          <View style={{alignItems: 'center', paddingVertical: 18, gap: 12}}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={{color: colors.muted, fontSize: 13, textAlign: 'center'}}>
              Contacting the server…
            </Text>
          </View>
        ) : (
          <>
            {testState === 'ok' ? (
              <Text
                style={{
                  color: colors.success,
                  fontSize: 14,
                  fontWeight: '600',
                  textAlign: 'center',
                }}>
                ✓ The server responded successfully.
              </Text>
            ) : (
              <>
                <Text style={{color: colors.danger, fontSize: 13, textAlign: 'center'}}>
                  Could not reach the server. Check the URL / key and try again.
                </Text>
                {testError ? (
                  <Text
                    style={{
                      color: colors.danger,
                      fontSize: 12,
                      marginTop: 8,
                      textAlign: 'center',
                    }}>
                    {testError}
                  </Text>
                ) : null}
              </>
            )}
            <View style={{flexDirection: 'row', gap: 10, marginTop: 16}}>
              {testState === 'fail' ? (
                <Button
                  title="Try again"
                  variant="outline"
                  onPress={() => void runConnectionTest(url.trim(), apiKey.trim() || undefined)}
                  style={{flex: 1}}
                />
              ) : null}
              <Button title="Close" onPress={() => setTestOpen(false)} style={{flex: 1}} />
            </View>
          </>
        )}
      </ModalSheet>

      <ModalSheet visible={karatSheetOpen} title="Karats 0–24" onClose={() => setKaratSheetOpen(false)} centered scrollable>
        <Text style={{fontSize: 12, color: colors.muted, marginBottom: 10}}>
          Type a rate to quote (pin) a karat; "derive" follows the {goldBaseKarat}K base rate.
        </Text>
        {karatTable.map(row => (
          <View key={row.karat} style={{flexDirection: 'row', alignItems: 'flex-end', gap: 8}}>
            <View style={{flex: 1}}>
              <Field
                label={`${row.karat}K · ${row.purityPercent}%${row.isCustom ? ' · quoted' : ''}`}
                value={karatDraftText[row.karat] ?? (row.ratePerGram ? String(row.ratePerGram) : '')}
                onChangeText={text => setKaratRate(row.karat, text)}
                keyboardType="numeric"
                placeholder="—"
              />
            </View>
            {row.isCustom ? (
              <Pressable
                onPress={() => resetKarat(row.karat)}
                accessibilityRole="button"
                style={({pressed}) => [styles.swatchOption, {width: undefined, maxWidth: undefined, paddingBottom: 20, paddingHorizontal: 10}, pressed && {opacity: 0.7}]}>
                <Text style={{fontSize: 12, fontWeight: '600', color: colors.primary}}>Derive</Text>
              </Pressable>
            ) : null}
          </View>
        ))}
        <Button title={savingRates ? 'Saving…' : 'Save rates & labour'} onPress={handleSaveGoldRates} loading={savingRates} />
      </ModalSheet>
    </Screen>
  );
}

/** Theme-aware — rebuilt on palette change (banner + swatch labels). */
const makeStyles = () =>
  StyleSheet.create({
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
  toggleRow: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border},
  unitRow: {flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: -2, marginBottom: 8},
  unitLabel: {fontSize: 12, color: colors.muted},
  unitBtn: {borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4},
  unitBtnActive: {borderColor: colors.primary, backgroundColor: colors.accent},
  unitText: {fontSize: 11, fontWeight: '600', color: colors.muted},
  unitTextActive: {color: colors.primary},
  switchLabel: {fontSize: 14, fontWeight: '600', color: colors.text},
});
