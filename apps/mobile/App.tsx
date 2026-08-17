/**
 * Munim mobile — shop management on the go.
 * Talks to the shared Munim API server (apps/api), which reuses the same
 * @munim/core business logic and database as the web and desktop apps.
 *
 * Theming: `ThemeProvider` owns light/dark mode (system default, persisted
 * override in Settings). The root consumes `useTheme()` so every screen
 * re-renders with the active palette when the mode changes.
 *
 * @format
 */

import React from 'react';
import {Pressable, StatusBar, StyleSheet, Text, View} from 'react-native';
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
  LayoutGrid,
} from 'lucide-react-native';
import {colors, SafeScreen} from './src/components/ui';
import {ThemeProvider, useTheme, useThemeStyles} from './src/theme';
import {PinProvider} from './src/lib/pin-provider';
import {MobileQueryProvider} from './src/lib/query';
import {useAppStore} from './src/lib/store';
import {loadHapticsEnabled, selectionTick} from './src/lib/haptics';
import {loadForceTransition} from './src/lib/force-transition';
import {HomeScreen} from './src/screens/HomeScreen';
import {ProductsScreen} from './src/screens/ProductsScreen';
import {SalesScreen} from './src/screens/SalesScreen';
import {BillingScreen} from './src/screens/BillingScreen';
import {PartiesScreen} from './src/screens/PartiesScreen';
import {MoreScreen} from './src/screens/MoreScreen';

type Tab = 'home' | 'products' | 'sales' | 'billing' | 'parties' | 'more';

const TABS: {key: Tab; label: string; icon: React.ComponentType<{size?: number; color?: string; strokeWidth?: number}>}[] = [
  {key: 'home', label: 'Home', icon: Home},
  {key: 'products', label: 'Stock', icon: Package},
  {key: 'sales', label: 'Sales', icon: ShoppingCart},
  {key: 'billing', label: 'Bills', icon: FileText},
  {key: 'parties', label: 'Khata', icon: Users},
  {key: 'more', label: 'More', icon: LayoutGrid},
];

const makeStyles = () =>
  StyleSheet.create({
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

function TabBar({tab, onSelect}: {tab: Tab; onSelect: (tab: Tab) => void}) {
  const styles = useThemeStyles(makeStyles);
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
            onPress={() => {
              if (tab !== item.key) {
                // Native iOS-style tick only when the tab actually changes.
                selectionTick();
                onSelect(item.key);
              }
            }}
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

function AppInner() {
  const {mode} = useTheme();
  const styles = useThemeStyles(makeStyles);
  // Active tab lives in the shared client-state store (@munim/store) so any
  // screen can read/navigate without prop drilling.
  const tab = useAppStore(s => s.activeView) as Tab;
  const setTab = React.useCallback((t: Tab) => useAppStore.getState().setActiveView(t), []);

  // Restore persisted preferences before any feedback/animation can fire.
  React.useEffect(() => {
    loadHapticsEnabled().catch(() => {});
    loadForceTransition().catch(() => {});
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={mode === 'dark' ? 'light-content' : 'dark-content'} />
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
            {tab === 'more' ? <MoreScreen /> : null}
          </Animated.View>
        </View>
        <Animated.View entering={SlideInDown.duration(320)}>
          <TabBar tab={tab} onSelect={setTab} />
        </Animated.View>
      </SafeScreen>
    </SafeAreaProvider>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <PinProvider>
        <MobileQueryProvider>
          <AppInner />
        </MobileQueryProvider>
      </PinProvider>
    </ThemeProvider>
  );
}
