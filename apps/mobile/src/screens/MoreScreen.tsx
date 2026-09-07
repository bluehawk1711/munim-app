import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {
  ArrowLeftRight,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Palette,
  Receipt,
  ScrollText,
  Settings as SettingsIcon,
} from 'lucide-react-native';
import {colors, Screen} from '../components/ui';
import {HomeHeader} from '../components/home-header';
import {useThemeStyles} from '../theme';
import {sectionPress} from '../lib/haptics';
import {AdvancesScreen} from './AdvancesScreen';
import {CatalogScreen} from './CatalogScreen';
import {InvoicesScreen} from './InvoicesScreen';
import {JobLettersScreen} from './JobLettersScreen';
import {ReportsScreen} from './ReportsScreen';
import {SettingsScreen} from './SettingsScreen';
import {useNavStore, type MoreSection as Section} from '../lib/nav-store';

const SECTIONS: {
  key: Section;
  label: string;
  subtitle: string;
  icon: React.ComponentType<{size?: number; color?: string; strokeWidth?: number}>;
}[] = [
  {key: 'invoices', label: 'Invoices', subtitle: 'All bills & statuses', icon: Receipt},
  {key: 'advances', label: 'Advances', subtitle: 'Whom I gave money, whom I owe', icon: ArrowLeftRight},
  {key: 'letters', label: 'Job Letters', subtitle: 'Offer letters for staff', icon: ScrollText},
  {key: 'reports', label: 'Reports', subtitle: 'Sales, stock & profit', icon: BarChart3},
  {key: 'catalog', label: 'Catalog', subtitle: 'Colors & sizes for products', icon: Palette},
  {key: 'settings', label: 'Settings', subtitle: 'Database & shop profile', icon: SettingsIcon},
];

/** Back bar shown above a sub-screen opened from the More list. */
function SectionView({children, onBack}: {children: React.ReactNode; onBack: () => void}) {
  const styles = useThemeStyles(makeStyles);
  return (
    <View style={{flex: 1}}>
      <View style={styles.backBar}>
        <Pressable onPress={onBack} hitSlop={8} style={({pressed}) => [styles.backButton, pressed && {opacity: 0.5}]}>
          <ChevronLeft size={20} color={colors.primary} />
          <Text style={styles.backText}>More</Text>
        </Pressable>
      </View>
      {children}
    </View>
  );
}

export function MoreScreen() {
  const styles = useThemeStyles(makeStyles);
  // Sub-section lives in the nav store so Home (e.g. the invoice-status
  // chart) can deep-link into a specific More screen.
  const section = useNavStore(s => s.moreSection) as Section;
  const closeMore = useNavStore(s => s.closeMore);

  if (section === 'letters') {
    return (
      <SectionView onBack={closeMore}>
        <JobLettersScreen />
      </SectionView>
    );
  }
  if (section === 'reports') {
    return (
      <SectionView onBack={closeMore}>
        <ReportsScreen />
      </SectionView>
    );
  }
  if (section === 'catalog') {
    return (
      <SectionView onBack={closeMore}>
        <CatalogScreen />
      </SectionView>
    );
  }
  if (section === 'invoices') {
    return (
      <SectionView onBack={closeMore}>
        <InvoicesScreen />
      </SectionView>
    );
  }
  if (section === 'advances') {
    return (
      <SectionView onBack={closeMore}>
        <AdvancesScreen />
      </SectionView>
    );
  }
  if (section === 'settings') {
    return (
      <SectionView onBack={closeMore}>
        <SettingsScreen />
      </SectionView>
    );
  }

  return (
    <Screen>
      <HomeHeader title="More" />
      <View style={styles.group}>
        {SECTIONS.map((item, index) => {
          const Icon = item.icon;
          return (
            <Pressable
              key={item.key}
              onPress={() => {
                sectionPress();
                useNavStore.getState().openMore(item.key);
              }}
              style={({pressed}) => [
                styles.row,
                index < SECTIONS.length - 1 && styles.rowBorder,
                // `mutedBg` (not `muted`): `muted` is a foreground text color —
                // using it as a pressed background makes text unreadable in
                // dark mode.
                pressed && {backgroundColor: colors.mutedBg},
              ]}>
              <View style={styles.iconWrap}>
                <Icon size={18} color={colors.primary} strokeWidth={2.2} />
              </View>
              <View style={{flex: 1, marginLeft: 12}}>
                <Text style={styles.rowLabel}>{item.label}</Text>
                <Text style={styles.rowSubtitle}>{item.subtitle}</Text>
              </View>
              <ChevronRight size={18} color={colors.muted} />
            </Pressable>
          );
        })}
      </View>
    </Screen>
  );
}

const makeStyles = () =>
  StyleSheet.create({
    group: {
      backgroundColor: colors.card,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      marginHorizontal: 16,
      overflow: 'hidden',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    rowBorder: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    iconWrap: {
      width: 32,
      height: 32,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.accent,
    },
    rowLabel: {fontSize: 15, fontWeight: '600', color: colors.text},
    rowSubtitle: {fontSize: 12, color: colors.muted, marginTop: 1},
    backBar: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 8,
      paddingTop: 4,
    },
    backButton: {flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 8, gap: 1},
    backText: {fontSize: 16, fontWeight: '600', color: colors.primary},
  });
