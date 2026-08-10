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
  const [shopLoaded, setShopLoaded] = useState(false);
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
    try {
      await updateSettings(await getCore(), {shopName: shopName.trim() || 'My Shop'});
      reload();
    } catch {
      // ignore
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
        <Field label="Shop name (appears on bills)" value={shopName} onChangeText={setShopName} />
        <Button title="Save shop name" onPress={handleSaveShop} />
      </Card>
    </Screen>
  );
}
