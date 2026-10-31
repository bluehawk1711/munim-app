import React, {useMemo, useState} from 'react';
import {Alert, Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import Animated, {FadeInDown} from 'react-native-reanimated';
import {Pencil, Trash2} from 'lucide-react-native';
import {
  ARTICLE_ANALYTICS_PRESETS,
  ARTICLE_ANALYTICS_PRESET_LABELS,
  formatDate,
  formatNumber,
  formatWeight,
  type ArticleAnalyticsPreset,
  type ArticleDto,
} from '@munim/core';
import {
  useArticles,
  useArticlesAnalytics,
  useCreateArticle,
  useDeleteArticle,
  useQueryState,
  useUpdateArticle,
} from '@munim/query';
import {money} from '../lib/format';
import {
  Button,
  Card,
  ErrorBox,
  Field,
  Loading,
  ModalSheet,
  Screen,
  colors,
} from '../components/ui';
import {HomeHeader} from '../components/home-header';
import {AnalyticsSheet} from '../components/analytics-sheet';
import {useThemeStyles} from '../theme';
import {errorFeedback, selectionTick, successFeedback} from '../lib/haptics';
import {rs, spacing, CARD_MARGIN} from '../lib/responsive';

type SortKey = 'revenue' | 'weight' | 'stockValue';

const SORTS: {key: SortKey; label: string}[] = [
  {key: 'revenue', label: 'Revenue'},
  {key: 'weight', label: 'Weight sold'},
  {key: 'stockValue', label: 'Stock value'},
];

type EditorState = {mode: 'add'} | {mode: 'edit'; article: ArticleDto} | null;

/**
 * ArticlesScreen — More → Articles. One card per article carrying its
 * analytics (stock, sold, revenue, last sale, bucketed trend) plus the CRUD
 * sheet. The period chips scope the sold/revenue/trend stats; sort pills pick
 * the order (revenue / weight / value).
 */
export function ArticlesScreen() {
  const styles = useThemeStyles(makeStyles);
  const listQ = useQueryState(useArticles());
  const [period, setPeriod] = useState<ArticleAnalyticsPreset>('6m');
  const analyticsQ = useQueryState(useArticlesAnalytics(period));
  const createArticle = useCreateArticle();
  const updateArticle = useUpdateArticle();
  const deleteArticle = useDeleteArticle();

  const [sort, setSort] = useState<SortKey>('revenue');
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [editor, setEditor] = useState<EditorState>(null);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const rows = useMemo(() => {
    const list = [...(analyticsQ.data?.rows ?? [])];
    if (sort === 'revenue') list.sort((a, b) => b.revenue - a.revenue);
    if (sort === 'weight') list.sort((a, b) => b.soldWeightGm - a.soldWeightGm);
    if (sort === 'stockValue') list.sort((a, b) => b.stockValue - a.stockValue);
    return list;
  }, [analyticsQ.data, sort]);

  const totals = useMemo(() => {
    const list = analyticsQ.data?.rows ?? [];
    return {
      count: list.length,
      stockValue: list.reduce((s, r) => s + r.stockValue, 0),
      revenue: list.reduce((s, r) => s + r.revenue, 0),
      soldWeightGm: list.reduce((s, r) => s + r.soldWeightGm, 0),
    };
  }, [analyticsQ.data]);

  const loading = listQ.loading || analyticsQ.loading;
  const error = listQ.error ?? analyticsQ.error;
  const topArticles = useMemo(
    () => [...(analyticsQ.data?.rows ?? [])].sort((a, b) => b.revenue - a.revenue).slice(0, 3),
    [analyticsQ.data],
  );
  const periodMeta = ARTICLE_ANALYTICS_PRESET_LABELS[period];
  const bucketLabel = analyticsQ.data?.period.bucket === 'week' ? 'weekly' : 'monthly';
  const reload = () => {
    listQ.reload();
    analyticsQ.reload();
  };

  function openAdd() {
    selectionTick();
    setName('');
    setCode('');
    setDescription('');
    setEditor({mode: 'add'});
  }

  function openEdit(a: ArticleDto) {
    selectionTick();
    setName(a.name);
    setCode(a.code ?? '');
    setDescription(a.description ?? '');
    setEditor({mode: 'edit', article: a});
  }

  async function handleSubmit() {
    if (!editor) return;
    const trimmed = name.trim();
    if (!trimmed) {
      errorFeedback('Name is required');
      return;
    }
    setSaving(true);
    try {
      const input = {name: trimmed, code: code.trim(), description: description.trim()};
      if (editor.mode === 'edit') {
        await updateArticle.mutateAsync({id: editor.article.id, input});
        successFeedback('Article updated');
      } else {
        await createArticle.mutateAsync(input);
        successFeedback(`Article ${trimmed} created`);
      }
      setEditor(null);
    } catch (err) {
      errorFeedback(err instanceof Error ? err.message : 'Failed to save article');
      // keep the sheet open so the user can retry
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete(a: ArticleDto) {
    Alert.alert('Delete article?', `“${a.name}” will be permanently removed. Products are kept.`, [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteArticle.mutateAsync(a.id);
            successFeedback('Article deleted');
          } catch (err) {
            errorFeedback(err instanceof Error ? err.message : 'Failed to delete');
          }
        },
      },
    ]);
  }

  if (loading) {
    return (
      <Screen>
        <HomeHeader title="Articles" />
        <Loading />
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen>
        <HomeHeader title="Articles" />
        <ErrorBox message={error} onRetry={reload} />
      </Screen>
    );
  }

  return (
    <Screen>
      <HomeHeader
        title="Articles"
        onAnalyticsPress={() => setAnalyticsOpen(true)}
        analyticsLabel="Article analytics"
      />

      <ScrollView contentContainerStyle={{paddingBottom: 40}} showsVerticalScrollIndicator={false}>
        {/* Period filter — scopes sold/revenue/trend below */}
        <View style={styles.periodRow}>
          {ARTICLE_ANALYTICS_PRESETS.map(p => (
            <Pressable
              key={p}
              onPress={() => {
                selectionTick();
                setPeriod(p);
              }}
              style={({pressed}) => [
                styles.sortChip,
                period === p && styles.sortChipActive,
                pressed && {opacity: 0.75},
              ]}>
              <Text style={[styles.sortText, period === p && styles.sortTextActive]}>
                {ARTICLE_ANALYTICS_PRESET_LABELS[p].label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Sort pills */}
        <View style={styles.sortRow}>
          {SORTS.map(s => (
            <Pressable
              key={s.key}
              onPress={() => {
                selectionTick();
                setSort(s.key);
              }}
              style={({pressed}) => [
                styles.sortChip,
                sort === s.key && styles.sortChipActive,
                pressed && {opacity: 0.75},
              ]}>
              <Text style={[styles.sortText, sort === s.key && styles.sortTextActive]}>
                {s.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Article cards */}
        {rows.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyText}>
              No articles yet. Articles classify products like categories — with a code and
              description.
            </Text>
          </Card>
        ) : (
          rows.map((r, index) => {
            const max = Math.max(...r.trend, 1);
            return (
              <Animated.View key={r.articleId} entering={FadeInDown.delay(index * 40).duration(260)}>
                <Card style={styles.card}>
                  <View style={styles.cardHeader}>
                    <View style={{flex: 1}}>
                      <View style={styles.titleRow}>
                        <Text style={styles.title}>{r.name}</Text>
                        {r.code ? (
                          <View style={styles.codeChip}>
                            <Text style={styles.codeChipText}>{r.code}</Text>
                          </View>
                        ) : null}
                      </View>
                      {r.description ? (
                        <Text style={styles.desc} numberOfLines={2}>
                          {r.description}
                        </Text>
                      ) : null}
                    </View>
                    <View style={styles.actions}>
                      <Pressable
                        onPress={() => openEdit({
                          id: r.articleId,
                          name: r.name,
                          code: r.code,
                          description: r.description,
                          createdAt: '',
                          updatedAt: '',
                          productCount: r.productCount,
                        })}
                        hitSlop={6}
                        style={({pressed}) => pressed && {opacity: 0.6}}>
                        <Pencil size={16} color={colors.muted} />
                      </Pressable>
                      <Pressable
                        onPress={() =>
                          confirmDelete({
                            id: r.articleId,
                            name: r.name,
                            code: r.code,
                            description: r.description,
                            createdAt: '',
                            updatedAt: '',
                            productCount: r.productCount,
                          })
                        }
                        hitSlop={6}
                        style={({pressed}) => pressed && {opacity: 0.6}}>
                        <Trash2 size={16} color={colors.danger} />
                      </Pressable>
                    </View>
                  </View>

                  {/* Stats grid */}
                  <View style={styles.statRow}>
                    <View style={styles.stat}>
                      <Text style={styles.statLabel}>Products</Text>
                      <Text style={styles.statValue}>{formatNumber(r.productCount)}</Text>
                    </View>
                    <View style={styles.stat}>
                      <Text style={styles.statLabel}>Stock</Text>
                      <Text style={styles.statValue}>
                        {formatNumber(r.stockUnits)}
                        {r.stockWeightGm > 0 ? ` · ${formatWeight(r.stockWeightGm)}` : ''}
                      </Text>
                    </View>
                    <View style={styles.stat}>
                      <Text style={styles.statLabel}>Sold · {periodMeta.short}</Text>
                      <Text style={styles.statValue}>{formatNumber(r.soldUnits)}</Text>
                    </View>
                    <View style={styles.stat}>
                      <Text style={styles.statLabel}>Revenue · {periodMeta.short}</Text>
                      <Text style={[styles.statValue, {color: colors.primary}]}>
                        {money(r.revenue)}
                      </Text>
                    </View>
                  </View>

                  {/* Trend bars */}
                  <View style={styles.trendRow}>
                    {r.trend.map((v, i) => (
                      <View key={i} style={styles.trendCol}>
                        <View
                          style={[
                            styles.trendBar,
                            {
                              height: Math.max(3, Math.round((v / max) * 34)),
                              opacity: 0.45 + (0.55 * (i + 1)) / r.trend.length,
                            },
                          ]}
                        />
                        <Text style={styles.trendLabel}>
                          {analyticsQ.data?.trendLabels[i] ?? ''}
                        </Text>
                      </View>
                    ))}
                  </View>

                  <Text style={styles.lastSale}>
                    Last sale: {r.lastSaleAt ? formatDate(r.lastSaleAt) : 'never'}
                  </Text>
                </Card>
              </Animated.View>
            );
          })
        )}
      </ScrollView>

      {/* New article CTA */}
      <View style={styles.cta}>
        <Button title="+ New Article" onPress={openAdd} />
      </View>

      {/* Add / edit sheet */}
      <ModalSheet
        visible={editor !== null}
        title={editor?.mode === 'edit' ? 'Edit article' : 'New article'}
        onClose={() => setEditor(null)}
        dismissable={!saving}
        centered
      >
        <Field
          label="Name *"
          value={name}
          onChangeText={setName}
          placeholder="e.g. Bridal Choker"
          style={{marginBottom: 12}}
        />
        <Field
          label="Code (optional)"
          value={code}
          onChangeText={setCode}
          placeholder="e.g. BGL-01"
          style={{marginBottom: 12}}
        />
        <Field
          label="Description (optional)"
          value={description}
          onChangeText={setDescription}
          placeholder="Design notes…"
          style={{marginBottom: 16}}
        />
        <Button
          title={saving ? 'Saving…' : editor?.mode === 'edit' ? 'Save' : 'Create article'}
          onPress={handleSubmit}
          loading={saving}
        />
      </ModalSheet>

      <AnalyticsSheet
        visible={analyticsOpen}
        title="Article analytics"
        onClose={() => setAnalyticsOpen(false)}
        note={`${periodMeta.label} · ${bucketLabel} buckets across every article.`}
        stats={[
          {label: 'Articles', value: formatNumber(totals.count)},
          {label: 'Stock value', value: money(totals.stockValue), tone: 'primary'},
          {label: `Revenue · ${periodMeta.short}`, value: money(totals.revenue), tone: 'success'},
          {
            label: `Weight · ${periodMeta.short}`,
            value: totals.soldWeightGm > 0 ? formatWeight(totals.soldWeightGm) : '—',
          },
        ]}>
        {topArticles.length > 0 ? (
          <>
            <Text style={styles.sheetHeading}>Top articles by revenue</Text>
            {topArticles.map((r, i) => (
              <View key={r.articleId} style={styles.topRow}>
                <Text style={styles.topRank}>{i + 1}</Text>
                <Text style={styles.topName} numberOfLines={1}>
                  {r.name}
                </Text>
                <Text style={styles.topValue}>{money(r.revenue)}</Text>
              </View>
            ))}
          </>
        ) : null}
      </AnalyticsSheet>
    </Screen>
  );
}

const makeStyles = () =>
  StyleSheet.create({
    periodRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: rs(6),
      marginHorizontal: CARD_MARGIN,
      marginTop: spacing.md,
    },
    sortRow: {
      flexDirection: 'row',
      gap: rs(6),
      marginHorizontal: CARD_MARGIN,
      marginTop: spacing.sm,
      marginBottom: spacing.sm,
    },
    sortChip: {
      paddingHorizontal: rs(12),
      paddingVertical: rs(6),
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    sortChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    sortText: {fontSize: 12, fontWeight: '700', color: colors.muted},
    sortTextActive: {color: colors.onPrimary},
    card: {marginHorizontal: CARD_MARGIN, marginBottom: spacing.sm, padding: rs(12)},
    cardHeader: {flexDirection: 'row', alignItems: 'flex-start', gap: rs(8)},
    titleRow: {flexDirection: 'row', alignItems: 'center', gap: rs(6), flexWrap: 'wrap'},
    title: {fontSize: 15, fontWeight: '700', color: colors.text},
    codeChip: {
      backgroundColor: colors.accent,
      borderRadius: 6,
      paddingHorizontal: 6,
      paddingVertical: 1,
    },
    codeChipText: {fontSize: 10, fontWeight: '700', color: colors.muted},
    desc: {fontSize: 12, color: colors.muted, marginTop: 2},
    actions: {flexDirection: 'row', gap: rs(12), paddingTop: rs(2)},
    statRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: rs(8),
      marginTop: rs(10),
    },
    stat: {
      flexBasis: '45%',
      flexGrow: 1,
      backgroundColor: colors.mutedBg,
      borderRadius: 8,
      paddingVertical: rs(6),
      paddingHorizontal: rs(8),
    },
    statLabel: {fontSize: 10, fontWeight: '600', color: colors.muted},
    statValue: {fontSize: 13, fontWeight: '700', color: colors.text},
    trendRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: rs(4),
      marginTop: rs(10),
      height: rs(52),
    },
    trendCol: {flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%'},
    trendBar: {
      width: '70%',
      borderRadius: 3,
      backgroundColor: colors.primary,
    },
    trendLabel: {fontSize: 8, color: colors.muted, marginTop: 2},
    lastSale: {fontSize: 11, color: colors.muted, marginTop: rs(8)},
    emptyCard: {
      marginHorizontal: CARD_MARGIN,
      marginTop: spacing.sm,
      padding: rs(16),
      alignItems: 'center',
    },
    emptyText: {fontSize: 13, color: colors.muted, textAlign: 'center', lineHeight: 19},
    sheetHeading: {
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 0.6,
      color: colors.muted,
    },
    topRow: {flexDirection: 'row', alignItems: 'center', gap: rs(10)},
    topRank: {
      width: rs(18),
      fontSize: 12,
      fontWeight: '800',
      color: colors.muted,
      textAlign: 'center',
    },
    topName: {flex: 1, fontSize: 14, fontWeight: '600', color: colors.text},
    topValue: {fontSize: 13, fontWeight: '700', color: colors.text},
    cta: {marginHorizontal: CARD_MARGIN, marginTop: spacing.sm},
  });
