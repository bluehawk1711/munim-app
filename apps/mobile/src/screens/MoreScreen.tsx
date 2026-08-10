import React, {useState} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {
  BarChart3,
  ChevronLeft,
  ChevronRight,
  ScrollText,
  Settings as SettingsIcon,
} from 'lucide-react-native';
import {colors, Header, Screen} from '../components/ui';
import {useThemeStyles} from '../theme';
import {JobLettersScreen} from './JobLettersScreen';
import {ReportsScreen} from './ReportsScreen';
import {SettingsScreen} from './SettingsScreen';

type Section = 'letters' | 'reports' | 'settings';

const SECTIONS: {
  key: Section;
  label: string;
  subtitle: string;
  icon: React.ComponentType<{size?: number; color?: string; strokeWidth?: number}>;
}[] = [
  {key: 'letters', label: 'Job Letters', subtitle: 'Offer letters for staff', icon: ScrollText},
  {key: 'reports', label: 'Reports', subtitle: 'Sales, stock & profit', icon: BarChart3},
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
  const [section, setSection] = useState<Section | null>(null);

  if (section === 'letters') {
    return (
      <SectionView onBack={() => setSection(null)}>
        <JobLettersScreen />
      </SectionView>
    );
  }
  if (section === 'reports') {
    return (
      <SectionView onBack={() => setSection(null)}>
        <ReportsScreen />
      </SectionView>
    );
  }
  if (section === 'settings') {
    return (
      <SectionView onBack={() => setSection(null)}>
        <SettingsScreen />
      </SectionView>
    );
  }

  return (
    <Screen>
      <Header title="More" subtitle="Everything else — shared with web & desktop" />
      <View style={styles.group}>
        {SECTIONS.map((item, index) => {
          const Icon = item.icon;
          return (
            <Pressable
              key={item.key}
              onPress={() => setSection(item.key)}
              style={({pressed}) => [
                styles.row,
                index < SECTIONS.length - 1 && styles.rowBorder,
                pressed && {backgroundColor: colors.muted},
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
