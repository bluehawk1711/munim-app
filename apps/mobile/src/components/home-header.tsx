/**
 * HomeHeader — the mobile app's custom header (all screens).
 *
 * One compact row: screen title on the left, actions on the right. The shop
 * name is intentionally NOT repeated here — it already lives in Settings and
 * the Home hero, and printing it on every screen just ate vertical space.
 *
 * Scroll-aware: screens report their vertical scroll offset through
 * `headerScrollHandlers` (onScroll + scrollEventThrottle) and the header
 * compacts — smaller title and tighter padding — once content is scrolled,
 * giving more room to the content beneath.
 *
 * All colors are theme tokens (no hardcoded hex), so it follows the accent
 * theme + dark mode.
 */

import React, {useEffect} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {BarChart3, Plus, ScanLine, Search, SlidersHorizontal, Store} from 'lucide-react-native';
import {colors, useThemeStyles} from '../theme';
import {useAppStore} from '../lib/store';
import {useNavStore} from '../lib/nav-store';
import {rs, typography, spacing, radii, CARD_MARGIN} from '../lib/responsive';
import {selectionTick} from '../lib/haptics';

/* ─── Scroll-offset store ────────────────────────────────────────────── */
/**
 * Minimal external store so the header re-renders on scroll without wiring
 * every screen into props/context. Screens spread `headerScrollHandlers`
 * onto their ScrollView/FlatList/FlashList; the header compacts past the
 * threshold. Offset resets on mount so switching screens starts expanded.
 */
const COMPACT_THRESHOLD = 24;
const EXPAND_THRESHOLD = 18; // Hysteresis: expand at a lower threshold to prevent jitter

let headerOffset = 0;
let isCompact = false;
const listeners = new Set<() => void>();

function setHeaderOffset(y: number) {
  const next = Math.max(0, y);
  // Dead-zone: skip if <2px change to reduce jitter during slow scrolls.
  if (Math.abs(next - headerOffset) < 2) return;
  headerOffset = next;
  // Hysteresis: compact at COMPACT_THRESHOLD, expand at EXPAND_THRESHOLD
  if (isCompact && next < EXPAND_THRESHOLD) isCompact = false;
  else if (!isCompact && next > COMPACT_THRESHOLD) isCompact = true;
  listeners.forEach(l => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Spread onto any ScrollView / FlatList / FlashList driving this header. */
export const headerScrollHandlers = {
  onScroll: (e: {nativeEvent: {contentOffset: {y: number}}}) => {
    setHeaderOffset(e.nativeEvent.contentOffset.y);
  },
  scrollEventThrottle: 16 as const,
};

export function resetHeaderScroll() {
  setHeaderOffset(0);
}

/* ─── Header ─────────────────────────────────────────────────────────── */

export function HomeHeader({
  title = 'Home',
  /** When provided, an accent "+" action renders FIRST in the header actions
   * (e.g. Parties → Add party). Screens that omit it are unchanged. */
  onAddPress,
  addLabel = 'Add',
  /** When provided, a barcode-scan button renders in the header actions.
   * Only the Home screen passes it — other screens keep Search/Profile. */
  onScanPress,
  /** When provided, a filter/options button renders in the header actions
   * (Billing → bill options, Invoices → bill filters). `optionsActive` shows
   * a dot when a non-default filter/option is in effect. */
  onOptionsPress,
  optionsActive = false,
  optionsLabel = 'Filters and options',
  /** When provided, an analytics button renders in the header actions and
   * opens the screen's analytics bottom sheet (keeps stat strips off-screen). */
  onAnalyticsPress,
  analyticsLabel = 'Analytics',
}: {
  title?: string;
  onAddPress?: () => void;
  addLabel?: string;
  onScanPress?: () => void;
  onOptionsPress?: () => void;
  optionsActive?: boolean;
  optionsLabel?: string;
  onAnalyticsPress?: () => void;
  analyticsLabel?: string;
}) {
  const styles = useThemeStyles(makeStyles);

  // Scroll state from the external store (re-renders only on real changes).
  const compact = React.useSyncExternalStore(
    subscribe,
    () => isCompact,
    () => false,
  );

  // Fresh screen → start expanded (previous screen's scroll shouldn't leak).
  useEffect(() => {
    resetHeaderScroll();
  }, [title]);

  function openSearch() {
    selectionTick();
    // Search lives in the Inventory screen — jump there.
    useAppStore.getState().setActiveView('products');
  }

  function openProfile() {
    selectionTick();
    useNavStore.getState().openMore('settings');
    useAppStore.getState().setActiveView('more');
  }

  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]}>
      <View style={styles.topRow}>
        <Text style={[styles.title, compact && styles.titleCompact]} numberOfLines={1}>
          {title}
        </Text>
        <View style={styles.actions}>
          {onAddPress ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={addLabel}
              onPress={() => {
                selectionTick();
                onAddPress();
              }}
              style={({pressed}) => [styles.iconBtn, styles.iconBtnAccent, pressed && styles.iconBtnPressed]}>
              <Plus size={rs(18)} color={colors.primary} strokeWidth={2.6} />
            </Pressable>
          ) : null}
          {onScanPress ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Scan barcode to sell"
              onPress={onScanPress}
              style={({pressed}) => [styles.iconBtn, styles.iconBtnAccent, pressed && styles.iconBtnPressed]}>
              <ScanLine size={rs(18)} color={colors.primary} strokeWidth={2.2} />
            </Pressable>
          ) : null}
          {onOptionsPress ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={optionsLabel}
              accessibilityState={{selected: optionsActive}}
              onPress={() => {
                selectionTick();
                onOptionsPress();
              }}
              style={({pressed}) => [
                styles.iconBtn,
                optionsActive && styles.iconBtnAccent,
                pressed && styles.iconBtnPressed,
              ]}>
              <SlidersHorizontal
                size={rs(18)}
                color={optionsActive ? colors.primary : colors.text}
                strokeWidth={2.2}
              />
              {optionsActive ? <View style={styles.iconDot} /> : null}
            </Pressable>
          ) : null}
          {onAnalyticsPress ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={analyticsLabel}
              onPress={() => {
                selectionTick();
                onAnalyticsPress();
              }}
              style={({pressed}) => [styles.iconBtn, pressed && styles.iconBtnPressed]}>
              <BarChart3 size={rs(18)} color={colors.text} strokeWidth={2.2} />
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Search products"
            onPress={openSearch}
            style={({pressed}) => [styles.iconBtn, pressed && styles.iconBtnPressed]}>
            <Search size={rs(18)} color={colors.text} strokeWidth={2.2} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Profile and settings"
            onPress={openProfile}
            style={({pressed}) => [styles.iconBtn, pressed && styles.iconBtnPressed]}>
            <Store size={rs(18)} color={colors.primary} strokeWidth={2.2} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const makeStyles = () =>
  StyleSheet.create({
    wrap: {
      paddingHorizontal: CARD_MARGIN,
      paddingTop: rs(6),
      paddingBottom: spacing.sm,
    },
    wrapCompact: {
      paddingTop: rs(2),
      paddingBottom: rs(6),
    },
    topRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: rs(8),
    },
    actions: {
      flexDirection: 'row',
      gap: rs(6),
      flexShrink: 0,
    },
    iconBtn: {
      width: rs(34),
      height: rs(34),
      borderRadius: radii.full,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconBtnAccent: {borderColor: colors.mutedSoft, backgroundColor: colors.mutedSoft},
    iconBtnPressed: {opacity: 0.6},
    iconDot: {
      position: 'absolute',
      top: rs(6),
      right: rs(7),
      width: rs(6),
      height: rs(6),
      borderRadius: radii.full,
      backgroundColor: colors.primary,
    },
    title: {
      flex: 1,
      fontSize: typography.h1,
      fontWeight: '800',
      color: colors.text,
    },
    titleCompact: {
      fontSize: rs(17),
      fontWeight: '700',
    },
  });
