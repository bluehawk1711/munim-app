import React, {useState} from 'react';
import {Alert, Pressable, StyleSheet, Text, View} from 'react-native';
import Animated, {FadeInUp} from 'react-native-reanimated';
import {
  listCatalogItems,
  createCatalogItem,
  renameCatalogItem,
  deleteCatalogItem,
  swatchColor,
  type CatalogItem,
  type CatalogKind,
} from '@munim/core';
import {getCore} from '../lib/core';
import {useAsync} from '../lib/use-async';
import {
  Button,
  Card,
  ErrorBox,
  Field,
  Header,
  Loading,
  ModalSheet,
  Screen,
  Section,
  colors,
} from '../components/ui';
import {useThemeStyles} from '../theme';
import {sectionPress} from '../lib/haptics';

type EditorState =
  | {kind: CatalogKind; mode: 'add'; item?: undefined}
  | {kind: CatalogKind; mode: 'rename'; item: CatalogItem}
  | null;

export function CatalogScreen() {
  const styles = useThemeStyles(makeStyles);
  const {data, error, loading, reload} = useAsync(
    async () => {
      const db = await getCore();
      const [colorItems, sizeItems] = await Promise.all([
        listCatalogItems(db, 'color'),
        listCatalogItems(db, 'size'),
      ]);
      return {colors: colorItems, sizes: sizeItems};
    },
    [],
  );

  const [editor, setEditor] = useState<EditorState>(null);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  function openAdd(kind: CatalogKind) {
    setName('');
    setEditor({kind, mode: 'add'});
  }

  function openRename(kind: CatalogKind, item: CatalogItem) {
    setName(item.name);
    setEditor({kind, mode: 'rename', item});
  }

  async function handleSubmit() {
    if (!editor) {
      return;
    }
    const trimmed = name.trim();
    if (!trimmed) {
      return;
    }
    setSaving(true);
    try {
      const db = await getCore();
      if (editor.mode === 'rename') {
        await renameCatalogItem(db, editor.kind, editor.item.id, trimmed);
      } else {
        await createCatalogItem(db, editor.kind, trimmed);
      }
      setEditor(null);
      setName('');
      reload();
    } catch {
      // keep the sheet open so the user can retry
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete(kind: CatalogKind, item: CatalogItem) {
    Alert.alert(
      `Delete ${kind}?`,
      `"${item.name}" will be permanently removed.`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteCatalogItem(await getCore(), kind, item.id);
              reload();
            } catch {
              // surfaced via the list still containing the item
            }
          },
        },
      ],
    );
  }

  const kindLabel = editor?.kind ?? 'color';

  return (
    <Screen>
      <Header title="Catalog" subtitle="Colors & sizes available for products" />

      {error ? (
        <ErrorBox message={error} onRetry={reload} />
      ) : loading || !data ? (
        <Loading />
      ) : (
        <View style={{paddingBottom: 110}}>
          <Section title="Colors" />
          <Card>
            {data.colors.length === 0 ? (
              <Text style={styles.emptyRow}>No colors yet — add one below.</Text>
            ) : (
              data.colors.map(item => (
                <CatalogRow
                  key={item.id}
                  kind="color"
                  item={item}
                  onRename={() => openRename('color', item)}
                  onDelete={() => confirmDelete('color', item)}
                />
              ))
            )}
          </Card>

          <Section title="Sizes" index={1} />
          <Card>
            {data.sizes.length === 0 ? (
              <Text style={styles.emptyRow}>No sizes yet — add one below.</Text>
            ) : (
              data.sizes.map(item => (
                <CatalogRow
                  key={item.id}
                  kind="size"
                  item={item}
                  onRename={() => openRename('size', item)}
                  onDelete={() => confirmDelete('size', item)}
                />
              ))
            )}
          </Card>
        </View>
      )}

      <Animated.View entering={FadeInUp.duration(320)} style={styles.fabRow}>
        <Button
          title="+ Add color"
          variant="outline"
          style={styles.fabHalf}
          onPress={() => {
            sectionPress();
            openAdd('color');
          }}
        />
        <Button
          title="+ Add size"
          style={styles.fabHalf}
          onPress={() => {
            sectionPress();
            openAdd('size');
          }}
        />
      </Animated.View>

      <ModalSheet
        visible={editor !== null}
        title={editor?.mode === 'rename' ? `Rename ${kindLabel}` : `Add ${kindLabel}`}
        onClose={() => setEditor(null)}>
        <Field
          label="Name"
          value={name}
          onChangeText={setName}
          placeholder={kindLabel === 'color' ? 'e.g. Midnight Blue' : 'e.g. 3XL'}
          style={{marginBottom: 16}}
        />
        <Button
          title={saving ? 'Saving…' : editor?.mode === 'rename' ? 'Save' : 'Create'}
          onPress={handleSubmit}
          loading={saving}
        />
      </ModalSheet>
    </Screen>
  );
}

function CatalogRow({
  kind,
  item,
  onRename,
  onDelete,
}: {
  kind: CatalogKind;
  item: CatalogItem;
  onRename: () => void;
  onDelete: () => void;
}) {
  const styles = useThemeStyles(makeStyles);
  const swatch = kind === 'color';
  return (
    <View style={styles.row}>
      <View style={styles.rowMain}>
        {swatch ? (
          <View
            style={[styles.swatch, {backgroundColor: swatchColor(item.name)}]}
          />
        ) : null}
        <Text style={styles.rowName} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.count}>{item.productCount}</Text>
      </View>
      <View style={styles.rowActions}>
        <Pressable onPress={onRename} hitSlop={8} style={styles.actionButton}>
          <Text style={styles.actionText}>Rename</Text>
        </Pressable>
        <Pressable
          onPress={item.productCount > 0 ? undefined : onDelete}
          hitSlop={8}
          style={({pressed}) => [
            styles.actionButton,
            pressed && {opacity: 0.6},
          ]}
          disabled={item.productCount > 0}>
          <Text
            style={[
              styles.actionText,
              styles.deleteText,
              item.productCount > 0 && {opacity: 0.3},
            ]}>
            Delete
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const makeStyles = () =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 10,
      paddingHorizontal: 2,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    rowMain: {flexDirection: 'row', alignItems: 'center', flex: 1},
    swatch: {
      width: 14,
      height: 14,
      borderRadius: 7,
      borderWidth: 1,
      borderColor: colors.border,
      marginRight: 8,
    },
    rowName: {fontSize: 15, fontWeight: '500', color: colors.text, flexShrink: 1},
    count: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.muted,
      backgroundColor: colors.mutedBg,
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 2,
      marginLeft: 8,
      overflow: 'hidden',
    },
    rowActions: {flexDirection: 'row', gap: 14, marginLeft: 12},
    actionButton: {paddingVertical: 4},
    actionText: {fontSize: 13, fontWeight: '600', color: colors.primary},
    deleteText: {color: colors.danger},
    emptyRow: {fontSize: 13, color: colors.muted, paddingVertical: 6},
    fabRow: {position: 'absolute', bottom: 24, left: 16, right: 16, flexDirection: 'row', gap: 10},
    fabHalf: {flex: 1},
  });
