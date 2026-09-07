/**
 * Munim mobile charts — built on `react-native-gifted-charts`.
 *
 * Components (exports are stable — screens don't change when the engine does):
 *   - `BarChart`   — vertical bars with value labels (monthly revenue, units).
 *   - `LineChart`  — curved area line with a tappable crosshair pointer
 *                    (6-month performance, report trajectory).
 *   - `DonutChart` — segmented donut with center total + tappable legend
 *                    (sales by category, invoice status, stock distribution…).
 *
 * Color discipline: chart colors come from the ACTIVE theme's `chart1..chart5`
 * tokens (mode-appropriate, so they stay legible in dark mode). The dashboard
 * API returns CSS-variable strings ("var(--chart-1)") which React Native can
 * NOT render — always map segments by index with `chartColors(palette)`, never
 * consume `segment.color` from the server.
 */

import React, {useState} from 'react';
import {LayoutChangeEvent, Pressable, StyleSheet, Text, View} from 'react-native';
import {
  BarChart as GiftedBarChart,
  LineChart as GiftedLineChart,
  PieChart as GiftedPieChart,
} from 'react-native-gifted-charts';
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
  /** Bar fill for the highlighted bar (defaults to primary). */
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
  height = rs(160),
}: BarChartProps) {
  const {colors: palette} = useTheme();
  const styles = useThemeStyles(makeStyles);
  const base = color ?? palette.chart1;
  const accent = highlightColor ?? palette.primary;
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

  // Fit the bars to the card: computed from the measured width so 6-month
  // series never scroll and 30-day series stay legible.
  const n = data.length;
  const usable = Math.max(0, width - rs(12));
  const slot = usable / n;
  const barW = Math.max(rs(10), Math.min(rs(30), slot * 0.55));
  const barSpacing = Math.max(rs(3), slot - barW);

  const barData = data.map((d, i) => ({
    value: d.value,
    label: d.label,
    frontColor: i === hi ? accent : base,
    topLabelComponent: d.value > 0 ? () => (
      <Text style={[styles.valueLabel, i === hi && styles.valueLabelAccent]}>
        {formatValue(d.value)}
      </Text>
    ) : undefined,
  }));

  return (
    <View onLayout={onLayout}>
      {width > 0 ? (
        <GiftedBarChart
          data={barData}
          width={width}
          height={height}
          barWidth={barW}
          spacing={barSpacing}
          initialSpacing={rs(2)}
          endSpacing={rs(2)}
          barBorderRadius={rs(4)}
          roundedTop
          isAnimated
          animationDuration={450}
          disableScroll
          noOfSections={3}
          rulesColor={palette.border}
          yAxisColor={palette.border}
          xAxisColor={palette.border}
          yAxisLabelWidth={rs(34)}
          yAxisTextStyle={styles.axisText}
          xAxisLabelTextStyle={styles.axisText}
          formatYLabel={(label: string) => formatValue(Number(label))}
        />
      ) : null}
    </View>
  );
}

/* ─── LineChart ────────────────────────────────────────────────────── */

/** Curved area line with gridlines, y-axis money labels and a tappable
 *  crosshair — used by Home's "6-month performance" card and the reports
 *  trajectory. Same token discipline as BarChart. */
export function LineChart({
  data,
  color,
  highlightColor,
  formatValue = compactMoney,
  height = rs(170),
}: {
  data: BarDatum[];
  color?: string;
  highlightColor?: string;
  formatValue?: (v: number) => string;
  height?: number;
}) {
  const {colors: palette} = useTheme();
  const styles = useThemeStyles(makeStyles);
  const stroke = color ?? palette.chart1;
  const accent = highlightColor ?? palette.primary;
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

  const last = data.length - 1;
  const lineData = data.map((d, i) => ({
    value: d.value,
    label: d.label,
    dataPointColor: i === last ? accent : stroke,
    dataPointRadius: i === last ? rs(4) : rs(2.5),
    // Static callout on the highlighted (last) point only.
    dataPointText: i === last ? formatValue(d.value) : '',
    textShiftX: rs(-4),
    textShiftY: rs(-6),
  }));

  return (
    <View onLayout={onLayout}>
      {width > 0 ? (
        <GiftedLineChart
          data={lineData}
          width={width}
          height={height}
          curved
          areaChart
          color={stroke}
          thickness={rs(2.2)}
          startFillColor={stroke}
          startOpacity={0.18}
          endFillColor={stroke}
          endOpacity={0.01}
          isAnimated
          animationDuration={500}
          disableScroll
          noOfSections={3}
          rulesColor={palette.border}
          yAxisColor={palette.border}
          xAxisColor={palette.border}
          yAxisLabelWidth={rs(38)}
          yAxisTextStyle={styles.axisText}
          xAxisLabelTextStyle={styles.axisText}
          formatYLabel={(label: string) => formatValue(Number(label))}
          pointerConfig={{
            pointer1Color: accent,
            pointerLabelComponent: (items: Array<{value: number}>) => (
              <View style={styles.pointerLabel}>
                <Text style={styles.pointerText}>
                  {formatValue(items[0]?.value ?? 0)}
                </Text>
              </View>
            ),
          }}
        />
      ) : null}
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
  const paletteColors = chartColors(palette);
  const active = segments.filter((s) => s.value > 0);
  const total = active.reduce((sum, s) => sum + s.value, 0);

  // Server colors are CSS vars RN can't render — those fall back to the
  // palette by index. Callers may pass real palette hexes for semantics.
  const colorFor = (s: DonutSegment, i: number) =>
    s.color && !s.color.startsWith('var(') ? s.color : paletteColors[i % paletteColors.length];
  const pieData = active.map((s, i) => ({
    value: s.value,
    name: s.name,
    color: colorFor(s, i),
  }));
  const legendRows = segments.map((s, i) => ({
    ...s,
    color: colorFor(s, i),
  }));

  const center = (
    <View style={{alignItems: 'center'}}>
      <Text style={styles.donutCenterValue}>
        {total > 0 ? (centerValue ?? formatValue(total)) : '0'}
      </Text>
      <Text style={styles.donutCenterSub}>
        {total > 0 ? (centerSub ?? '') : 'No data'}
      </Text>
    </View>
  );

  return (
    <View style={styles.donutWrap}>
      {active.length > 0 ? (
        <GiftedPieChart
          data={pieData}
          radius={size / 2}
          innerRadius={size / 2 - thickness}
          donut
          focusOnPress={!!onSegmentPress}
          showText={false}
          centerLabelComponent={() => center}
        />
      ) : (
        <View style={{width: size, height: size, alignItems: 'center', justifyContent: 'center'}}>
          <View
            style={{
              position: 'absolute',
              width: size,
              height: size,
              borderRadius: radii.full,
              borderWidth: thickness,
              borderColor: palette.mutedBg,
            }}
          />
          {center}
        </View>
      )}

      {/* Legend — rows are tappable when `onSegmentPress` is provided */}
      <View style={styles.legend}>
        {segments.length === 0 ? (
          <Text style={styles.emptyText}>Nothing to show yet</Text>
        ) : (
          legendRows.map((s) => {
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
    axisText: {
      fontSize: rs(8.5),
      color: c.muted,
    },
    valueLabel: {
      fontSize: rs(9),
      fontWeight: '700',
      color: c.muted,
      marginBottom: rs(2),
    },
    valueLabelAccent: {
      color: c.primary,
    },
    pointerLabel: {
      backgroundColor: c.inverseSurface,
      borderRadius: radii.sm,
      paddingHorizontal: rs(8),
      paddingVertical: rs(4),
      alignSelf: 'flex-start',
    },
    pointerText: {
      fontSize: typography.caption,
      fontWeight: '700',
      color: c.inverseOnSurface,
    },
    donutWrap: {
      alignItems: 'center',
    },
    donutCenterValue: {
      fontSize: rs(19),
      fontWeight: '700',
      color: c.text,
    },
    donutCenterSub: {
      fontSize: rs(10),
      color: c.muted,
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
