import React, {useState} from 'react';
import {Alert, Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import Animated, {FadeInUp} from 'react-native-reanimated';
import {
  swatchColor,
  type CatalogItem,
  type CatalogKind,
} from '@munim/core';
import {
  useCatalog,
  useCreateCatalogItem,
  useDeleteCatalogItem,
  useQueryState,
  useUpdateCatalogItem,
} from '@munim/query';
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
import {successFeedback, errorFeedback} from '../lib/haptics';
import {rs, spacing} from '../lib/responsive';

type EditorState =
  | {kind: CatalogKind; mode: 'add'; item?: undefined}
  | {kind: CatalogKind; mode: 'rename'; item: CatalogItem}
  | null;

type TabKey = 'colors' | 'sizes' | 'categories';

const TABS: {key: TabKey; label: string; kind: CatalogKind}[] = [
  {key: 'colors', label: 'Colors', kind: 'color'},
  {key: 'sizes', label: 'Sizes', kind: 'size'},
  {key: 'categories', label: 'Categories', kind: 'category'},
];

export function CatalogScreen() {
  const styles = useThemeStyles(makeStyles);
  const colorQ = useQueryState(useCatalog('color'));
  const sizeQ = useQueryState(useCatalog('size'));
  const categoryQ = useQueryState(useCatalog('category'));
  const data =
    colorQ.data && sizeQ.data && categoryQ.data
      ? {colors: colorQ.data, sizes: sizeQ.data, categories: categoryQ.data}
      : null;
  const loading = colorQ.loading || sizeQ.loading || categoryQ.loading;
  const error = colorQ.error ?? sizeQ.error ?? categoryQ.error;
  const reload = () => {
    colorQ.reload();
    sizeQ.reload();
    categoryQ.reload();
  };

  // One mutation hook set per kind (catalog writes invalidate products too).
  const createItem = {
    color: useCreateCatalogItem('color'),
    size: useCreateCatalogItem('size'),
    category: useCreateCatalogItem('category'),
  };
  const renameItem = {
    color: useUpdateCatalogItem('color'),
    size: useUpdateCatalogItem('size'),
    category: useUpdateCatalogItem('category'),
  };
  const deleteItem = {
    color: useDeleteCatalogItem('color'),
    size: useDeleteCatalogItem('size'),
    category: useDeleteCatalogItem('category'),
  };

  const [activeTab, setActiveTab] = useState<TabKey>('colors');
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
      if (editor.mode === 'rename') {
        await renameItem[editor.kind].mutateAsync({id: editor.item.id, name: trimmed});
        successFeedback(`${editor.kind} renamed to ${trimmed}`);
      } else {
        await createItem[editor.kind].mutateAsync(trimmed);
        successFeedback(`${trimmed} ${editor.kind} created`);
      }
      setEditor(null);
      setName('');
    } catch {
      errorFeedback(`Failed to ${editor.mode === 'rename' ? 'rename' : 'create'} ${editor.kind}`);
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
              await deleteItem[kind].mutateAsync(item.id);
              successFeedback();
            } catch {
              errorFeedback();
              // surfaced via the list still containing the item
            }
          },
        },
      ],
    );
  }

  const kindLabel = editor?.kind ?? 'color';

  const currentItems = data ? data[activeTab] : [];
  const currentKind = TABS.find(t => t.key === activeTab)?.kind ?? 'color';

  return (
    <Screen>
      <Header title="Catalog" subtitle="Colors, sizes & categories for products" />

      {error ? (
        <ErrorBox message={error} onRetry={reload} />
      ) : loading || !data ? (
        <Loading />
      ) : (
        <View style={{flex: 1}}>
          {/* Tab bar */}
          <View style={styles.tabBar}>
            {TABS.map(tab => (
              <Pressable
                key={tab.key}
                onPress={() => setActiveTab(tab.key)}
                style={({pressed}) => [
                  styles.tabItem,
                  activeTab === tab.key && styles.tabItemActive,
                  pressed && {opacity: 0.7},
                ]}>
                <Text
                  style={[
                    styles.tabLabel,
                    activeTab === tab.key && styles.tabLabelActive,
                  ]}>
                  {tab.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Tab content */}
          <ScrollView
            style={styles.tabContent}
            contentContainerStyle={{paddingBottom: 100}}
            showsVerticalScrollIndicator={false}>
            <Section title={TABS.find(t => t.key === activeTab)?.label ?? 'Items'} />
            <Card>
              {currentItems.length === 0 ? (
                <Text style={styles.emptyRow}>No {currentKind} yet — add one below.</Text>
              ) : (
                (data?.[activeTab] ?? []).map(item => (
                  <CatalogRow
                    key={item.id}
                    kind={currentKind}
                    item={item}
                    onRename={() => openRename(currentKind, item)}
                    onDelete={() => confirmDelete(currentKind, item)}
                  />
                ))
              )}
            </Card>
          </ScrollView>

          {/* FAB — adds to the ACTIVE tab */}
          <Animated.View entering={FadeInUp.duration(320)} style={styles.fabRow}>
            <Button
              title={`+ ${TABS.find(t => t.key === activeTab)?.label ?? 'Item'}`}
              onPress={() => openAdd(currentKind)}
              style={styles.fabFull}
            />
          </Animated.View>
        </View>
      )}

      <ModalSheet
        visible={editor !== null}
        title={editor?.mode === 'rename' ? `Rename ${kindLabel}` : `Add ${kindLabel}`}
        onClose={() => setEditor(null)}
        dismissable={!saving}
        centered
      >
        <Field
          label="Name"
          value={name}
          onChangeText={setName}
          placeholder={kindLabel === 'color' ? 'e.g. Midnight Blue' : kindLabel === 'size' ? 'e.g. 3XL' : 'e.g. Jewellery'}
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
    tabBar: {
      flexDirection: 'row',
      backgroundColor: colors.card,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      paddingVertical: rs(6),
    },
    tabItem: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: rs(6),
    },
    tabItemActive: {
      borderBottomWidth: 2,
      borderBottomColor: colors.primary,
    },
    tabLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.muted,
    },
    tabLabelActive: {
      color: colors.primary,
      fontWeight: '700',
    },
    tabContent: {
      flex: 1,
    },
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
    fabRow: {position: 'absolute', bottom: 24, left: 16, right: 16},
    fabFull: {flex: 1},
  });
