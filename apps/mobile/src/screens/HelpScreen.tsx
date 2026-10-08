import React from 'react';
import {Platform, ScrollView, StyleSheet, Text, View} from 'react-native';
import {BadgeIndianRupee, Calculator, IndianRupee, Percent, RefreshCw, ScanLine, Scale, Tag} from 'lucide-react-native';
import {
  PRICING_GUIDE,
  type GuideBlock,
  type GuideSpan,
  type PricingGuideSectionKey,
} from '@munim/core';
import {Card, Screen, colors} from '../components/ui';
import {HomeHeader, headerScrollHandlers} from '../components/home-header';
import {useThemeStyles} from '../theme';

/**
 * HelpScreen — mobile's PricingHelp page (docs/features.md gap #4).
 *
 * Renders the SHARED `PRICING_GUIDE` from @munim/core — the exact wording
 * web/desktop show through @munim/ui's PricingGuide — so the three apps can
 * never drift (AGENTS §2/§4b). Apps own only the icons/styling.
 */

const SECTION_ICONS: Record<
  PricingGuideSectionKey,
  React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>
> = {
  formula: Calculator,
  rates: BadgeIndianRupee,
  auto: Tag,
  recalc: RefreshCw,
  counter: ScanLine,
};

const LABOUR_ICONS: Record<string, React.ComponentType<{size?: number; color?: string; strokeWidth?: number}>> = {
  Percent: Percent,
  Fixed: IndianRupee,
  'Per gram': Scale,
};

/** Rich-text run → nested Text (bold/italic spans). All guide body copy is
 * muted (matching web's `text-muted-foreground`); weight/italic carry the
 * emphasis. */
function Spans({spans}: {spans: GuideSpan[]}) {
  const s = useThemeStyles(spanStyles);
  return (
    <Text style={s.base}>
      {spans.map((x, i) => (
        <Text key={i} style={x.b ? s.bold : x.i ? s.italic : undefined}>
          {x.t}
        </Text>
      ))}
    </Text>
  );
}

function Block({block, styles}: {block: GuideBlock; styles: ReturnType<typeof makeStyles>}) {
  if (block.kind === 'para') {
    return <Spans spans={block.spans} />;
  }

  if (block.kind === 'formula') {
    return (
      <View style={styles.formulaBox}>
        {block.lines.map(line => (
          <Text key={line.label} style={styles.formulaLine}>
            <Text
              style={[
                styles.formulaLabel,
                {color: line.tone === 'primary' ? colors.primary : colors.muted},
              ]}>
              {line.label}
            </Text>
            {' ' + line.rest}
          </Text>
        ))}
      </View>
    );
  }

  if (block.kind === 'list') {
    if (block.marker === 'step') {
      return (
        <View style={{gap: 8}}>
          {block.items.map((item, i) => (
            <View key={i} style={styles.stepRow}>
              <View style={styles.stepBadge}>
                <Text style={styles.stepNum}>{i + 1}</Text>
              </View>
              <View style={{flex: 1}}>
                <Spans spans={item} />
              </View>
            </View>
          ))}
        </View>
      );
    }
    return (
      <View style={{gap: 7}}>
        {block.items.map((item, i) => (
          <View key={i} style={styles.listRow}>
            <Text style={styles.marker}>
              {block.marker === 'arrow' ? '▸ ' : '• '}
            </Text>
            <View style={{flex: 1}}>
              <Spans spans={item} />
            </View>
          </View>
        ))}
      </View>
    );
  }

  return (
    <View style={{gap: 8}}>
      {block.cards.map(card => {
        const Icon = LABOUR_ICONS[card.name];
        return (
          <View key={card.name} style={styles.cardTile}>
            <View style={styles.cardTileHead}>
              {Icon ? <Icon size={14} color={colors.primary} strokeWidth={2.2} /> : null}
              <Text style={styles.cardTileName}>{card.name}</Text>
            </View>
            <Text style={styles.cardTileBlurb}>{card.blurb}</Text>
          </View>
        );
      })}
    </View>
  );
}

export function HelpScreen() {
  const styles = useThemeStyles(makeStyles);
  return (
    <Screen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{paddingBottom: 90}}
        {...headerScrollHandlers}>
        <HomeHeader title="Help" />
        <View style={{gap: 12, paddingHorizontal: 16, marginTop: 4}}>
          {PRICING_GUIDE.map(section => {
            const Icon = SECTION_ICONS[section.key];
            return (
              <Card key={section.key}>
                <View style={styles.headRow}>
                  <Icon size={16} color={colors.primary} strokeWidth={2.2} />
                  <Text style={styles.headTitle}>{section.title}</Text>
                </View>
                <View style={{gap: 12}}>
                  {section.blocks.map((block, i) => (
                    <Block key={i} block={block} styles={styles} />
                  ))}
                </View>
              </Card>
            );
          })}
        </View>
      </ScrollView>
    </Screen>
  );
}

const spanStyles = (c: typeof colors) =>
  StyleSheet.create({
    base: {fontSize: 14, lineHeight: 21, color: c.muted},
    bold: {fontWeight: '700'},
    italic: {fontStyle: 'italic'},
  });

const makeStyles = (c: typeof colors) =>
  StyleSheet.create({
    headRow: {flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10},
    headTitle: {fontSize: 14, fontWeight: '700', color: c.text},
    formulaBox: {
      backgroundColor: c.accent,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: c.border,
      padding: 10,
      gap: 6,
    },
    formulaLine: {
      fontSize: 12,
      lineHeight: 18,
      color: c.text,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    formulaLabel: {fontWeight: '700'},
    listRow: {flexDirection: 'row', gap: 2},
    marker: {fontSize: 13, lineHeight: 20, color: c.muted},
    stepRow: {flexDirection: 'row', gap: 8},
    stepBadge: {
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: c.accent,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 1,
    },
    stepNum: {fontSize: 11, fontWeight: '700', color: c.primary},
    cardTile: {
      backgroundColor: c.accent,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: c.border,
      padding: 10,
    },
    cardTileHead: {flexDirection: 'row', alignItems: 'center', gap: 5},
    cardTileName: {fontSize: 12, fontWeight: '700', color: c.text},
    cardTileBlurb: {fontSize: 12, color: c.muted, marginTop: 3, lineHeight: 17},
  });
