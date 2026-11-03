/**
 * ParallaxScrollView — a large top block that collapses smoothly as the page
 * scrolls, leaving more room for the content below.
 *
 * Adapted from the bna-ui `parallax-scrollview` registry component (v3), with
 * two local changes: it uses the Munim theme + responsive units, and it does
 * not depend on expo-router (`useBottomTabOverflow` is unnecessary — the app's
 * screen container already accounts for the tab bar).
 */

import React from 'react';
import {
  StyleSheet,
  View,
  type RefreshControlProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedRef,
  useAnimatedStyle,
  useReducedMotion,
  useScrollViewOffset,
} from 'react-native-reanimated';
import {useTheme} from '../theme';

export function ParallaxScrollView({
  header,
  headerHeight,
  collapsedHeaderHeight = 0,
  children,
  contentContainerStyle,
  refreshControl,
  showsVerticalScrollIndicator = false,
}: {
  /** The large block shown at the top of the page. */
  header: React.ReactNode;
  headerHeight: number;
  /** Height the header block shrinks to (0 collapses it fully). */
  collapsedHeaderHeight?: number;
  children: React.ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
  refreshControl?: React.ReactElement<RefreshControlProps>;
  showsVerticalScrollIndicator?: boolean;
}) {
  const {colors} = useTheme();
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollOffset = useScrollViewOffset(scrollRef);
  const reduceMotion = useReducedMotion();
  const range = Math.max(1, headerHeight - collapsedHeaderHeight);

  const headerAnimatedStyle = useAnimatedStyle(() => {
    if (reduceMotion) {
      return {height: headerHeight};
    }
    return {
      height: interpolate(
        scrollOffset.value,
        [0, range],
        [headerHeight, collapsedHeaderHeight],
        Extrapolation.CLAMP,
      ),
    };
  });

  // The block's contents shrink and fade as the block collapses, so the
  // clipped strip at the end reads as "gone" rather than "cut off".
  const headerContentAnimatedStyle = useAnimatedStyle(() => {
    if (reduceMotion) {
      return {opacity: 1, transform: [{scale: 1}]};
    }
    const progress = interpolate(scrollOffset.value, [0, range], [0, 1], Extrapolation.CLAMP);
    return {
      opacity: interpolate(progress, [0, 0.55, 1], [1, 0.85, 0.1]),
      transform: [{scale: interpolate(progress, [0, 1], [1, 0.8])}],
    };
  });

  return (
    <Animated.ScrollView
      ref={scrollRef}
      style={styles.scroll}
      showsVerticalScrollIndicator={showsVerticalScrollIndicator}
      contentContainerStyle={contentContainerStyle}
      refreshControl={refreshControl}>
      <Animated.View
        style={[styles.header, {backgroundColor: colors.bg}, headerAnimatedStyle]}>
        <Animated.View style={[{flex: 1}, headerContentAnimatedStyle]}>
          <View style={styles.headerInner}>{header}</View>
        </Animated.View>
      </Animated.View>
      <View style={{backgroundColor: colors.bg, flex: 1}}>{children}</View>
    </Animated.ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {flex: 1},
  header: {overflow: 'hidden', justifyContent: 'flex-start'},
  headerInner: {flex: 1},
});
