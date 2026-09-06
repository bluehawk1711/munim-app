/**
 * Munim mobile SVG charts — built on `react-native-svg` (already a
 * project dependency, used by the barcode renderer).
 *
 * Components:
 *   - `BarChart`   — vertical bars with compact value labels (monthly revenue).
 *   - `DonutChart` — segmented donut with center total + legend (sales by
 *                    category, invoice status, stock distribution, …).
 *
 * Color discipline: chart colors come from the ACTIVE theme's `chart1..chart5`
 * tokens (mode-appropriate, so they stay legible in dark mode). The dashboard
 * API returns CSS-variable strings ("var(--chart-1)") which React Native can
 * NOT render — always map segments by index with `chartColors(palette)`, never
 * consume `segment.color` from the server.
 */

import React, {useState} from 'react';
import {LayoutChangeEvent, Pressable, StyleSheet, Text, View} from 'react-native';
import Svg, {Circle, G, Line, Rect, Text as SvgText} from 'react-native-svg';
import type {MobileColors} from '@munim/theme';
import {useTheme, useThemeStyles} from '../theme';
import {rs, rw, typography, spacing, radii} from '../lib/responsive';

/** The chart palette, in token order — cycle past the end for extra segments. */
export function chartColors(palette: MobileColors): readonly string[] {
  return [palette.chart1, palette.chart2, palette.chart3, palette.chart4, palette.chart5];
}

/** Compact "₹12k / ₹1.5L" formatting for axis/value labels. */
export function compactMoney(value: number): string {
  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(value);
  if (abs >= 100000) return `${sign}₹${(abs / 100000).toFixed(abs >= 1000000 ? 0 : 1)}L`;
  if (abs >= 1000) return `${sign}₹${(abs / 1000).toFixed(0)}k`;
  return `${sign}₹${abs.toFixed(0)}`;
}

/* ─── BarChart ─────────────────────────────────────────────────────── */

export type BarDatum = {label: string; value: number};

type BarChartProps = {
  data: BarDatum[];
  /** Bar fill for all but the highlighted bar. */
  color?: string;
  /** Bar fill for the highlighted bar (defaults to `color`). */
  highlightColor?: string;
  /** Index treated as "current" (last bar by default). */
  highlightIndex?: number;
  /** Value-label formatter on top of the bars (money by default). */
  formatValue?: (v: number) => string;
  height?: number;
};

export function BarChart({
  data,
  color,
  highlightColor,
  highlightIndex,
  formatValue = compactMoney,
  height = rs(130),
}: BarChartProps) {
  const {colors: palette} = useTheme();
  const styles = useThemeStyles(makeStyles);
  const base = color ?? palette.chart1;
  const highlight = highlightColor ?? palette.primary;
  const hi = highlightIndex ?? Math.max(0, data.length - 1);
  const [width, setWidth] = useState(0);

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0 && w !== width) setWidth(w);
  };

  if (data.length === 0) {
    return (
      <View style={styles.emptyWrap} onLayout={onLayout}>
        <Text style={styles.emptyText}>No data yet</Text>
      </View>
    );
  }

  const max = Math.max(...data.map((d) => d.value), 1);
  const n = data.length;
  const slot = width / n;
  const barW = Math.min(slot * 0.55, rs(26));
  const labelH = rs(16);
  const plotH = height - labelH;
  const baseline = plotH;

  return (
    <View onLayout={onLayout}>
      {width > 0 ? (
        <Svg width={width} height={height}>
          {data.map((d, i) => {
            const h = d.value > 0 ? Math.max((d.value / max) * (plotH - rs(8)), rs(3)) : 0;
            const x = i * slot + (slot - barW) / 2;
            const y = baseline - h;
            const fill = i === hi ? highlight : base;
            return (
              <G key={`${d.label}-${i}`}>
                {h > 0 ? (
                  <Rect
                    x={x}
                    y={y}
                    width={barW}
                    height={h}
                    rx={Math.min(barW / 2, rs(5))}
                    fill={fill}
                  />
                ) : null}
                {h > rs(12) ? (
                  <SvgText
                    x={x + barW / 2}
                    y={y - rs(4)}
                    fontSize={rs(9.5)}
                    fill={palette.muted}
                    textAnchor="middle">
                    {formatValue(d.value)}
                  </SvgText>
                ) : null}
              </G>
            );
          })}
          <Line
            x1={0}
            y1={baseline + 0.5}
            x2={width}
            y2={baseline + 0.5}
            stroke={palette.border}
            strokeWidth={1}
          />
        </Svg>
      ) : null}
      {/* Month labels — RN Text below the SVG for crisp rendering */}
      <View style={styles.barLabels}>
        {data.map((d, i) => (
          <Text
            key={`${d.label}-${i}`}
            style={[styles.barLabel, i === hi ? styles.barLabelActive : null]}
            numberOfLines={1}>
            {d.label}
          </Text>
        ))}
      </View>
    </View>
  );
}

/* ─── DonutChart ───────────────────────────────────────────────────── */

export type DonutSegment = {name: string; value: number; color: string};

type DonutChartProps = {
  segments: DonutSegment[];
  /** Center big value (defaults to the formatted total). */
  centerValue?: string;
  /** Small center sub-label. */
  centerSub?: string;
  /** Legend + center value formatter (money by default; use `String` for counts). */
  formatValue?: (v: number) => string;
  /** When provided, legend rows become tappable (e.g. navigate to a filtered list). */
  onSegmentPress?: (name: string) => void;
  size?: number;
  thickness?: number;
};

export function DonutChart({
  segments,
  centerValue,
  centerSub,
  formatValue = compactMoney,
  onSegmentPress,
  size = rw(148),
  thickness = rs(18),
}: DonutChartProps) {
  const {colors: palette} = useTheme();
  const styles = useThemeStyles(makeStyles);
  const active = segments.filter((s) => s.value > 0);
  const total = active.reduce((sum, s) => sum + s.value, 0);
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const cx = size / 2;
  const cy = size / 2;

  let offset = 0;
  const arcs = active.map((s) => {
    const len = (s.value / total) * c;
    const arc = {color: s.color, len, offset};
    offset += len;
    return arc;
  });

  return (
    <View style={styles.donutWrap}>
      <Svg width={size} height={size}>
        {/* Track */}
        <Circle
          cx={cx}
          cy={cy}
          r={r}
          stroke={palette.mutedBg}
          strokeWidth={thickness}
          fill="none"
        />
        {/* Segments */}
        {total > 0
          ? arcs.map((arc, i) => (
              <Circle
                key={`${i}`}
                cx={cx}
                cy={cy}
                r={r}
                stroke={arc.color}
                strokeWidth={thickness}
                fill="none"
                strokeDasharray={`${arc.len} ${c - arc.len}`}
                strokeDashoffset={-arc.offset}
                rotation={-90}
                origin={`${cx}, ${cy}`}
              />
            ))
          : null}
        <SvgText
          x={cx}
          y={cy - rs(2)}
          fontSize={rs(19)}
          fontWeight="700"
          fill={palette.text}
          textAnchor="middle">
          {total > 0 ? (centerValue ?? formatValue(total)) : '0'}
        </SvgText>
        <SvgText
          x={cx}
          y={cy + rs(15)}
          fontSize={rs(10)}
          fill={palette.muted}
          textAnchor="middle">
          {total > 0 ? (centerSub ?? '') : 'No data'}
        </SvgText>
      </Svg>

      {/* Legend — rows are tappable when `onSegmentPress` is provided */}
      <View style={styles.legend}>
        {segments.length === 0 ? (
          <Text style={styles.emptyText}>Nothing to show yet</Text>
        ) : (
          segments.map((s) => {
            const row = (
              <View style={styles.legendRow}>
                <View style={[styles.legendDot, {backgroundColor: s.color}]} />
                <Text style={styles.legendName} numberOfLines={1}>
                  {s.name}
                </Text>
                <View style={styles.legendValues}>
                  <Text style={styles.legendValue}>{formatValue(s.value)}</Text>
                  <Text style={styles.legendPct}>
                    {total > 0 ? `${Math.round((s.value / total) * 100)}%` : '0%'}
                  </Text>
                </View>
              </View>
            );
            return onSegmentPress ? (
              <Pressable
                key={s.name}
                onPress={() => onSegmentPress(s.name)}
                style={({pressed}) => pressed && {opacity: 0.55}}
                hitSlop={4}>
                {row}
              </Pressable>
            ) : (
              <View key={s.name}>{row}</View>
            );
          })
        )}
      </View>
    </View>
  );
}

/* ─── Styles ───────────────────────────────────────────────────────── */

const makeStyles = (c: MobileColors) =>
  StyleSheet.create({
    emptyWrap: {
      height: rs(60),
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyText: {
      fontSize: typography.secondary,
      color: c.muted,
    },
    barLabels: {
      flexDirection: 'row',
      marginTop: rs(4),
    },
    barLabel: {
      flex: 1,
      textAlign: 'center',
      fontSize: typography.caption,
      color: c.muted,
    },
    barLabelActive: {
      fontWeight: '700',
      color: c.text,
    },
    donutWrap: {
      alignItems: 'center',
    },
    legend: {
      alignSelf: 'stretch',
      marginTop: spacing.md,
      gap: spacing.sm,
    },
    legendRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rs(8),
    },
    legendDot: {
      width: rs(9),
      height: rs(9),
      borderRadius: radii.full,
    },
    legendName: {
      flex: 1,
      fontSize: typography.secondary,
      fontWeight: '600',
      color: c.text,
    },
    legendValues: {
      alignItems: 'flex-end',
      gap: rs(1),
    },
    legendValue: {
      fontSize: typography.secondary,
      fontWeight: '700',
      color: c.text,
    },
    legendPct: {
      fontSize: typography.caption,
      color: c.muted,
    },
  });