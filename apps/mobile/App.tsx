/**
 * Munim mobile — shop management on the go.
 * Shares the SAME Neon database and business logic (@munim/core) as the web
 * and desktop apps. No API server.
 *
 * @format
 */

import React, {useState} from 'react';
import {Pressable, StatusBar, StyleSheet, Text, useColorScheme, View} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {colors, SafeScreen} from './src/components/ui';
import {HomeScreen} from './src/screens/HomeScreen';
import {ProductsScreen} from './src/screens/ProductsScreen';
import {SalesScreen} from './src/screens/SalesScreen';
import {BillingScreen} from './src/screens/BillingScreen';
import {PartiesScreen} from './src/screens/PartiesScreen';
import {JobLettersScreen} from './src/screens/JobLettersScreen';
import {SettingsScreen} from './src/screens/SettingsScreen';

type Tab = 'home' | 'products' | 'sales' | 'billing' | 'parties' | 'letters' | 'settings';

const TABS: {key: Tab; label: string; icon: string}[] = [
  {key: 'home', label: 'Home', icon: '🏠'},
  {key: 'products', label: 'Stock', icon: '📦'},
  {key: 'sales', label: 'Sales', icon: '🛒'},
  {key: 'billing', label: 'Bills', icon: '🧾'},
  {key: 'parties', label: 'Khata', icon: '👥'},
  {key: 'letters', label: 'Letters', icon: '📜'},
  {key: 'settings', label: 'Settings', icon: '⚙️'},
];

function App() {
  const isDarkMode = useColorScheme() === 'dark';
  const [tab, setTab] = useState<Tab>('home');

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <SafeScreen>
        <View style={styles.content}>
          {tab === 'home' ? <HomeScreen /> : null}
          {tab === 'products' ? <ProductsScreen /> : null}
          {tab === 'sales' ? <SalesScreen /> : null}
          {tab === 'billing' ? <BillingScreen /> : null}
          {tab === 'parties' ? <PartiesScreen /> : null}
          {tab === 'letters' ? <JobLettersScreen /> : null}
          {tab === 'settings' ? <SettingsScreen /> : null}
        </View>
        <View style={styles.tabBar}>
          {TABS.map(item => {
            const active = tab === item.key;
            return (
              <Pressable key={item.key} style={styles.tabItem} onPress={() => setTab(item.key)}>
                <Text style={{fontSize: 18}}>{item.icon}</Text>
                <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{item.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </SafeScreen>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  content: {flex: 1},
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingVertical: 6,
  },
  tabItem: {flex: 1, alignItems: 'center', paddingVertical: 2},
  tabLabel: {fontSize: 10, marginTop: 2, color: colors.muted, fontWeight: '600'},
  tabLabelActive: {color: colors.primary},
});

export default App;
