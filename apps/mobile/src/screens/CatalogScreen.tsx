import React, {useState} from 'react';
import {Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View} from 'react-native';
import Animated, {FadeInDown, FadeInUp} from 'react-native-reanimated';
import {
  Ruler,
  Search,
  Tag as TagIcon,
} from 'lucide-react-native';
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
  Loading,
  ModalSheet,
  Screen,
  ThreeDotMenu,
  colors,
} from '../components/ui';
import {HomeHeader} from '../components/home-header';
import {useThemeStyles} from '../theme';
import {successFeedback, errorFeedback, selectionTick} from '../lib/haptics';
import {rs, spacing, radii, CARD_MARGIN} from '../lib/responsive';

type EditorState =
  | {kind: CatalogKind; mode: 'add'; item?: undefined}
  | {kind: CatalogKind; mode: 'rename'; item: CatalogItem}
  | null;

type TabKey = 'colors' | 'sizes' | 'categories';

const TABS: {key: TabKey; label: string; kind: CatalogKind; countLabel: string}[] = [
  {key: 'colors', label: 'Colors', kind: 'color', countLabel: 'COLORS'},
  {key: 'sizes', label: 'Sizes', kind: 'size', countLabel: 'SIZES'},
  {key: 'categories', label: 'Categories', kind: 'category', countLabel: 'CATEGORIES'},
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
  const [search, setSearch] = useState('');
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
  const activeMeta = TABS.find(t => t.key === activeTab) ?? TABS[0];
  const currentKind = activeMeta?.kind ?? 'color';
  const allItems = data ? data[activeTab] : [];
  const q = search.trim().toLowerCase();
  const currentItems = q
    ? allItems.filter(i => i.name.toLowerCase().includes(q))
    : allItems;

  return (
    <Screen>
      <HomeHeader title="Catalog" />

      {error ? (
        <ErrorBox message={error} onRetry={reload} />
      ) : loading || !data ? (
        <Loading />
      ) : (
        <View style={{flex: 1}}>
          {/* Search + swatch count row */}
          <View style={styles.searchRow}>
            <View style={styles.searchBox}>
              <Search size={rs(15)} color={colors.muted} strokeWidth={2.2} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder={
                  currentKind === 'color'
                    ? 'Search colors by name or hex…'
                    : `Search ${currentKind}s…`
                }
                placeholderTextColor={colors.inputPlaceholder}
                style={styles.searchInput}
                autoCapitalize="none"
              />
            </View>
            <Text style={styles.countChip}>
              {allItems.length} {activeMeta?.countLabel ?? 'ITEMS'}
            </Text>
          </View>

          {/* Segmented pill tab bar */}
          <View style={styles.tabBar}>
            {TABS.map(tab => {
              const active = tab.key === activeTab;
              return (
                <Pressable
                  key={tab.key}
                  onPress={() => {
                    selectionTick();
                    setActiveTab(tab.key);
                  }}
                  style={({pressed}) => [
                    styles.tabPill,
                    active && styles.tabPillActive,
                    pressed && {opacity: 0.8},
                  ]}>
                  <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
                    {tab.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <ScrollView
            style={styles.tabContent}
            contentContainerStyle={{paddingBottom: 110}}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled">
            {currentItems.length === 0 ? (
              <Card>
                <Text style={styles.emptyRow}>
                  {q
                    ? `No ${currentKind}s match "${search.trim()}".`
                    : `No ${currentKind}s yet — add one below.`}
                </Text>
              </Card>
            ) : (
              currentItems.map((item, i) => (
                <Card key={item.id} index={i} style={styles.rowCard}>
                  <CatalogRow
                    kind={currentKind}
                    item={item}
                    onRename={() => openRename(currentKind, item)}
                    onDelete={() => confirmDelete(currentKind, item)}
                  />
                </Card>
              ))
            )}
          </ScrollView>

          {/* CTA — adds to the ACTIVE tab */}
          <Animated.View entering={FadeInUp.duration(320)} style={styles.fabRow}>
            <Button
              title={`+ Add New ${currentKind === 'color' ? 'Color' : currentKind === 'size' ? 'Size' : 'Category'}`}
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
  const inUse = item.productCount > 0;

  return (
    <View style={styles.row}>
      {/* Swatch / icon tile */}
      {kind === 'color' ? (
        <View
          style={[styles.swatch, {backgroundColor: swatchColor(item.name)}]}
        />
      ) : (
        <View style={styles.iconTile}>
          {kind === 'size' ? (
            <Ruler size={rs(16)} color={colors.primary} strokeWidth={2.2} />
          ) : (
            <TagIcon size={rs(16)} color={colors.primary} strokeWidth={2.2} />
          )}
        </View>
      )}

      {/* Name + hex chip + linked-count subtitle */}
      <View style={styles.rowMain}>
        <View style={styles.nameRow}>
          <Text style={styles.rowName} numberOfLines={1}>
            {item.name}
          </Text>
          {kind === 'color' ? (
            <Text style={styles.hexChip}>
              {swatchColor(item.name).toUpperCase()}
            </Text>
          ) : null}
        </View>
        <Text style={styles.rowSubtitle} numberOfLines={1}>
          {item.productCount === 0
            ? 'No products linked'
            : `${item.productCount} product${item.productCount === 1 ? '' : 's'} linked`}
        </Text>
      </View>

      {/* In-use badge + 3-dot menu */}
      <View style={styles.rowEnd}>
        <View style={[styles.badge, inUse ? styles.badgeInUse : styles.badgeUnused]}>
          {inUse ? <View style={styles.badgeDot} /> : null}
          <Text style={[styles.badgeText, inUse && styles.badgeTextInUse]}>
            {inUse ? `In Use (${item.productCount})` : 'Unused'}
          </Text>
        </View>
        <ThreeDotMenu
          actions={
            inUse
              ? [{label: 'Rename', onPress: onRename}]
              : [
                  {label: 'Rename', onPress: onRename},
                  {label: 'Delete', onPress: onDelete, destructive: true},
                ]
          }
        />
      </View>
    </View>
  );
}

const makeStyles = () =>
  StyleSheet.create({
    searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rs(8),
      marginTop: spacing.xs,
      marginBottom: spacing.sm,
      paddingHorizontal: CARD_MARGIN,
    },
    searchBox: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: rs(7),
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.full,
      paddingHorizontal: rs(13),
      height: rs(38),
    },
    searchInput: {
      flex: 1,
      fontSize: rs(13.5),
      color: colors.text,
      padding: 0,
    },
    countChip: {
      fontSize: rs(10.5),
      fontWeight: '800',
      letterSpacing: 0.6,
      color: colors.muted,
    },
    tabBar: {
      flexDirection: 'row',
      backgroundColor: colors.mutedSoft,
      borderRadius: radii.full,
      padding: rs(3),
      marginBottom: spacing.md,
      marginHorizontal: CARD_MARGIN,
    },
    tabPill: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: rs(8),
      borderRadius: radii.full,
    },
    tabPillActive: {
      backgroundColor: colors.primary,
    },
    tabLabel: {
      fontSize: rs(12.5),
      fontWeight: '600',
      color: colors.muted,
    },
    tabLabelActive: {
      color: colors.onPrimary,
      fontWeight: '700',
    },
    tabContent: {
      flex: 1,
    },
    rowCard: {
      paddingVertical: 0,
      paddingHorizontal: 0,
      marginBottom: spacing.sm,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: rs(12),
      gap: rs(10),
    },
    swatch: {
      width: rs(30),
      height: rs(30),
      borderRadius: rs(9),
      borderWidth: 1,
      borderColor: colors.border,
    },
    iconTile: {
      width: rs(30),
      height: rs(30),
      borderRadius: rs(9),
      backgroundColor: colors.accent,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rowMain: {
      flex: 1,
      minWidth: 0,
    },
    nameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rs(6),
    },
    rowName: {
      fontSize: rs(14),
      fontWeight: '700',
      color: colors.text,
      flexShrink: 1,
    },
    hexChip: {
      fontSize: rs(9.5),
      fontWeight: '700',
      letterSpacing: 0.4,
      color: colors.muted,
      backgroundColor: colors.mutedSoft,
      borderRadius: radii.sm,
      paddingHorizontal: rs(5),
      paddingVertical: rs(1.5),
      overflow: 'hidden',
    },
    rowSubtitle: {
      fontSize: rs(11.5),
      color: colors.muted,
      marginTop: rs(2),
    },
    rowEnd: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rs(2),
    },
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rs(4),
      borderRadius: radii.full,
      paddingHorizontal: rs(8),
      paddingVertical: rs(3.5),
    },
    badgeUnused: {
      backgroundColor: colors.mutedSoft,
    },
    badgeInUse: {
      backgroundColor: colors.warningSoft,
    },
    badgeDot: {
      width: rs(5),
      height: rs(5),
      borderRadius: radii.full,
      backgroundColor: colors.warning,
    },
    badgeText: {
      fontSize: rs(10),
      fontWeight: '700',
      color: colors.muted,
    },
    badgeTextInUse: {
      color: colors.warning,
    },
    emptyRow: {
      fontSize: rs(13),
      color: colors.muted,
      paddingVertical: rs(8),
      textAlign: 'center',
    },
    fabRow: {position: 'absolute', bottom: 24, left: 16, right: 16},
    fabFull: {flex: 1},
  });
