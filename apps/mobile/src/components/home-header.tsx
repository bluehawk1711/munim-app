/**
 * HomeHeader — the mobile app's custom header (all screens).
 *
 * Matches the reference design:
 *   ● SHOP NAME            (search) (profile)
 *   Home
 *   ● Store Counter Active · Today, 06 Sep 2026
 *
 * Scroll-aware: screens report their vertical scroll offset through
 * `headerScrollHandlers` (onScroll + scrollEventThrottle) and the header
 * compacts — smaller title, hidden status row — once content is scrolled,
 * giving more room to the content beneath.
 *
 * All colors are theme tokens (no hardcoded hex), so it follows the accent
 * theme + dark mode.
 */

import React, {useEffect} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {ScanLine, Search, Store} from 'lucide-react-native';
import {colors, useThemeStyles} from '../theme';
import {useQueryState, useSettings} from '@munim/query';
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
  /** When provided, a barcode-scan button renders in the header actions.
   * Only the Home screen passes it — other screens keep Search/Profile. */
  onScanPress,
}: {
  title?: string;
  onScanPress?: () => void;
}) {
  const styles = useThemeStyles(makeStyles);
  const {data: settings} = useQueryState(useSettings());
  // Shop name from Settings (uppercased, like the reference); falls back to
  // the app name before settings load.
  const shopName = (settings?.shopName ?? 'Munim').toUpperCase();

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

  const today = new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]}>
      <View style={styles.topRow}>
        <View style={styles.eyebrowWrap}>
          <View style={styles.eyebrowDot} />
          <Text style={styles.eyebrow} numberOfLines={1}>
            {shopName}
          </Text>
        </View>
        <View style={styles.actions}>
          {onScanPress ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Scan barcode to sell"
              onPress={onScanPress}
              style={({pressed}) => [styles.iconBtn, styles.iconBtnAccent, pressed && styles.iconBtnPressed]}>
              <ScanLine size={rs(18)} color={colors.primary} strokeWidth={2.2} />
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

      <Text style={[styles.title, compact && styles.titleCompact]} numberOfLines={1}>
        {title}
      </Text>

      {!compact ? (
        <View style={styles.statusRow}>
          <View style={styles.statusDot} />
          <Text style={styles.statusText}>Store Counter Active</Text>
          <Text style={styles.statusDate}>· Today, {today}</Text>
        </View>
      ) : null}
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
    },
    eyebrowWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rs(6),
      flexShrink: 1,
    },
    eyebrowDot: {
      width: rs(8),
      height: rs(8),
      borderRadius: radii.full,
      backgroundColor: colors.primary,
    },
    eyebrow: {
      fontSize: rs(11),
      fontWeight: '700',
      letterSpacing: 0.8,
      color: colors.muted,
    },
    actions: {
      flexDirection: 'row',
      gap: rs(6),
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
    title: {
      fontSize: typography.h1,
      fontWeight: '800',
      color: colors.text,
      marginTop: rs(6),
    },
    titleCompact: {
      fontSize: rs(17),
      fontWeight: '700',
      marginTop: rs(2),
    },
    statusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rs(6),
      marginTop: rs(6),
    },
    statusDot: {
      width: rs(7),
      height: rs(7),
      borderRadius: radii.full,
      backgroundColor: colors.success,
    },
    statusText: {
      fontSize: typography.caption,
      fontWeight: '600',
      color: colors.text,
    },
    statusDate: {
      fontSize: typography.caption,
      color: colors.muted,
    },
  });
