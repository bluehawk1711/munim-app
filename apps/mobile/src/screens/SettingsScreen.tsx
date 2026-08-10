import React, {useEffect, useState} from 'react';
import {Text, View} from 'react-native';
import {createDb, getSettings, pingDatabase, updateSettings} from '@munim/core';
import {getCore, getSavedDatabaseUrl, saveDatabaseUrl} from '../lib/core';
import {useAsync} from '../lib/use-async';
import {Button, Card, Field, Header, Loading, Screen, colors} from '../components/ui';

export function SettingsScreen() {
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
      setTestResult('ok');
    } catch {
      setTestResult('fail');
    } finally {
      setTesting(false);
    }
  }

  async function handleSaveUrl() {
    await saveDatabaseUrl(url);
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
      reload();
    } catch {
      // ignore
    } finally {
      setSavingShop(false);
    }
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
