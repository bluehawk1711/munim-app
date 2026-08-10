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
import Animated, {
  FadeIn,
  FadeOut,
  SlideInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import {
  Home,
  Package,
  ShoppingCart,
  FileText,
  Users,
  ScrollText,
  BarChart3,
  Settings,
} from 'lucide-react-native';
import {colors, SafeScreen} from './src/components/ui';
import {HomeScreen} from './src/screens/HomeScreen';
import {ProductsScreen} from './src/screens/ProductsScreen';
import {SalesScreen} from './src/screens/SalesScreen';
import {BillingScreen} from './src/screens/BillingScreen';
import {PartiesScreen} from './src/screens/PartiesScreen';
import {JobLettersScreen} from './src/screens/JobLettersScreen';
import {ReportsScreen} from './src/screens/ReportsScreen';
import {SettingsScreen} from './src/screens/SettingsScreen';

type Tab =
  | 'home'
  | 'products'
  | 'sales'
  | 'billing'
  | 'parties'
  | 'letters'
  | 'reports'
  | 'settings';

const TABS: {key: Tab; label: string; icon: React.ComponentType<{size?: number; color?: string; strokeWidth?: number}>}[] = [
  {key: 'home', label: 'Home', icon: Home},
  {key: 'products', label: 'Stock', icon: Package},
  {key: 'sales', label: 'Sales', icon: ShoppingCart},
  {key: 'billing', label: 'Bills', icon: FileText},
  {key: 'parties', label: 'Khata', icon: Users},
  {key: 'letters', label: 'Letters', icon: ScrollText},
  {key: 'reports', label: 'Reports', icon: BarChart3},
  {key: 'settings', label: 'Settings', icon: Settings},
];

function TabBar({tab, onSelect}: {tab: Tab; onSelect: (tab: Tab) => void}) {
  const [barWidth, setBarWidth] = React.useState(0);
  const indicatorX = useSharedValue(0);
  const activeIndex = Math.max(0, TABS.findIndex(t => t.key === tab));
  const cellWidth = barWidth / TABS.length;

  React.useEffect(() => {
    indicatorX.value = withSpring(activeIndex * cellWidth, {damping: 20, stiffness: 220});
  }, [activeIndex, cellWidth, indicatorX]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{translateX: indicatorX.value + (cellWidth - 24) / 2}],
  }));

  return (
    <View
      style={styles.tabBar}
      onLayout={e => setBarWidth(e.nativeEvent.layout.width)}>
      {TABS.map(item => {
        const active = tab === item.key;
        const Icon = item.icon;
        return (
          <Pressable
            key={item.key}
            style={styles.tabItem}
            onPress={() => onSelect(item.key)}
            hitSlop={6}>
            <Animated.View
              entering={FadeIn.duration(160)}
              style={styles.iconWrap}>
              <Icon
                size={20}
                color={active ? colors.primary : colors.muted}
                strokeWidth={active ? 2.4 : 2}
              />
            </Animated.View>
            <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
              {item.label}
            </Text>
          </Pressable>
        );
      })}
      <Animated.View style={[styles.indicator, indicatorStyle]} />
    </View>
  );
}

function App() {
  const isDarkMode = useColorScheme() === 'dark';
  const [tab, setTab] = useState<Tab>('home');

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <SafeScreen>
        <View style={styles.content}>
          <Animated.View
            key={tab}
            entering={FadeIn.duration(220).delay(40)}
            exiting={FadeOut.duration(120)}
            style={styles.screen}>
            {tab === 'home' ? <HomeScreen /> : null}
            {tab === 'products' ? <ProductsScreen /> : null}
            {tab === 'sales' ? <SalesScreen /> : null}
            {tab === 'billing' ? <BillingScreen /> : null}
            {tab === 'parties' ? <PartiesScreen /> : null}
            {tab === 'letters' ? <JobLettersScreen /> : null}
            {tab === 'reports' ? <ReportsScreen /> : null}
            {tab === 'settings' ? <SettingsScreen /> : null}
          </Animated.View>
        </View>
        <Animated.View entering={SlideInDown.duration(320)}>
          <TabBar tab={tab} onSelect={setTab} />
        </Animated.View>
      </SafeScreen>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  content: {flex: 1},
  screen: {flex: 1},
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingVertical: 6,
    paddingBottom: 8,
  },
  tabItem: {flex: 1, alignItems: 'center', paddingVertical: 4, zIndex: 2},
  iconWrap: {alignItems: 'center'},
  tabLabel: {fontSize: 10, marginTop: 3, color: colors.muted, fontWeight: '600'},
  tabLabelActive: {color: colors.primary, fontWeight: '700'},
  indicator: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: 24,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.primary,
  },
});

export default App;
