/**
 * AnalyticsSheet — one shared bottom sheet for every list screen's summary
 * figures. The stat strips used to sit above each list and eat a third of the
 * viewport; now the data lives here and the header's BarChart3 button opens it.
 */

import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import type {MobileColors} from '@munim/theme';
import {ModalSheet} from './ui';
import {useThemeStyles} from '../theme';
import {rs, typography, spacing, radii} from '../lib/responsive';

export type AnalyticsStatTone = 'default' | 'primary' | 'success' | 'warning' | 'danger';

export type AnalyticsStat = {
  label: string;
  value: string;
  tone?: AnalyticsStatTone;
  /** Small line under the value (e.g. "2 bills"). */
  hint?: string;
};

export function AnalyticsSheet({
  visible,
  title,
  onClose,
  note,
  stats,
  children,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  /** Scope line, e.g. "Current page — filters apply." */
  note?: string;
  stats: AnalyticsStat[];
  children?: React.ReactNode;
}) {
  const styles = useThemeStyles(makeStyles);

  return (
    <ModalSheet visible={visible} title={title} onClose={onClose} dismissable scrollable>
      {note ? <Text style={styles.note}>{note}</Text> : null}
      <View style={styles.grid}>
        {stats.map(stat => (
          <View key={stat.label} style={styles.tile}>
            <Text style={styles.label} numberOfLines={1}>
              {stat.label.toUpperCase()}
            </Text>
            <Text
              style={[styles.value, stat.tone ? styles[stat.tone] : null]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.65}>
              {stat.value}
            </Text>
            {stat.hint ? (
              <Text style={styles.hint} numberOfLines={1}>
                {stat.hint}
              </Text>
            ) : null}
          </View>
        ))}
      </View>
      {children ? <View style={styles.children}>{children}</View> : null}
    </ModalSheet>
  );
}

const makeStyles = (c: MobileColors) =>
  StyleSheet.create({
    note: {
      fontSize: typography.caption,
      color: c.muted,
      marginBottom: spacing.sm,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: rs(8),
    },
    tile: {
      flexGrow: 1,
      flexBasis: '46%',
      minWidth: rs(120),
      backgroundColor: c.mutedBg,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: c.border,
      paddingVertical: rs(10),
      paddingHorizontal: rs(12),
    },
    label: {
      fontSize: typography.badge,
      fontWeight: '700',
      letterSpacing: 0.6,
      color: c.muted,
    },
    value: {
      fontSize: rs(18),
      fontWeight: '800',
      color: c.text,
      marginTop: rs(2),
    },
    primary: {color: c.primary},
    success: {color: c.success},
    warning: {color: c.warning},
    danger: {color: c.danger},
    default: {},
    hint: {
      fontSize: typography.caption,
      color: c.muted,
      marginTop: rs(1),
    },
    children: {
      marginTop: spacing.lg,
      gap: spacing.sm,
    },
  });
