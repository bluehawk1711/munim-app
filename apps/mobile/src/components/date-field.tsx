/**
 * DateField — native date picker for mobile.
 *
 * Replaces hand-typed YYYY-MM-DD inputs with the platform picker while keeping
 * the rest of the app's date contract unchanged (value in/out is a YYYY-MM-DD
 * string, same as before):
 * - Android: opens the native date dialog on tap (DateTimePickerAndroid)
 * - iOS: bottom-sheet modal with the inline calendar + a Done button
 *   (reuses the shared ModalSheet)
 *
 * Display shows a friendly "12 Aug 2026" while the stored value stays ISO.
 * Requires @react-native-community/datetimepicker — a NATIVE module, so the
 * dev build must be rebuilt after installing it.
 */
import React, {useState} from 'react';
import {Platform, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle} from 'react-native';
import DateTimePicker, {DateTimePickerAndroid} from '@react-native-community/datetimepicker';
import {CalendarDays} from 'lucide-react-native';
import {Button, ModalSheet, colors} from './ui';
import {useThemeStyles} from '../theme';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

/** Parse a YYYY-MM-DD string into a local Date (avoid UTC off-by-one). */
function parseYmd(ymd: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** Format a local Date as YYYY-MM-DD. Exported so screens can default to
 * today in the correct local timezone (avoiding UTC off-by-one days). */
export function toYmd(d: Date): string {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${day}`;
}

function formatDisplay(d: Date): string {
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

const makeStyles = () =>
  StyleSheet.create({
    field: {marginBottom: 12},
    label: {fontSize: 12, fontWeight: '600', color: colors.muted, marginBottom: 5},
    input: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      backgroundColor: colors.card,
      minHeight: 42,
    },
    value: {fontSize: 15, color: colors.text},
    placeholder: {fontSize: 15, color: colors.inputPlaceholder},
  });

export function DateField({
  label,
  value,
  onChange,
  placeholder,
  maximumDate,
  minimumDate,
  style,
  accessibilityLabel,
}: {
  label: string;
  /** YYYY-MM-DD (empty = no date chosen yet). */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maximumDate?: Date;
  minimumDate?: Date;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  const styles = useThemeStyles(makeStyles);
  const [iosOpen, setIosOpen] = useState(false);
  const [draft, setDraft] = useState<Date>(() => parseYmd(value) ?? new Date());

  const selected = parseYmd(value);

  function openPicker() {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: selected ?? new Date(),
        mode: 'date',
        maximumDate,
        minimumDate,
        onChange: (event, date) => {
          if (event.type === 'set' && date) {
            onChange(toYmd(date));
          }
        },
      });
    } else {
      setDraft(selected ?? new Date());
      setIosOpen(true);
    }
  }

  return (
    <View style={[styles.field, style]}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        onPress={openPicker}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
        style={({pressed}) => [styles.input, pressed && {opacity: 0.7}]}>
        <Text style={selected ? styles.value : styles.placeholder}>
          {selected ? formatDisplay(selected) : placeholder ?? 'Select a date'}
        </Text>
        <CalendarDays size={16} color={colors.muted} />
      </Pressable>
      {Platform.OS === 'ios' ? (
        <ModalSheet visible={iosOpen} title={label} onClose={() => setIosOpen(false)}>
          <DateTimePicker
            value={draft}
            mode="date"
            display="inline"
            maximumDate={maximumDate}
            minimumDate={minimumDate}
            onChange={(_event, date) => {
              if (date) {
                setDraft(date);
              }
            }}
          />
          <Button
            title="Done"
            onPress={() => {
              onChange(toYmd(draft));
              setIosOpen(false);
            }}
            style={{marginTop: 12}}
          />
        </ModalSheet>
      ) : null}
    </View>
  );
}
