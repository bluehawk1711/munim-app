import React, {useState} from 'react';
import {FlatList, Share, Text, View} from 'react-native';
import * as Print from 'expo-print';
import {
  saveJobLetter,
  listJobLetters,
  deleteJobLetter,
  getSettings,
  jobLetterFromStored,
  renderJobLetterHtml,
  formatDate,
  type JobLetter,
} from '@munim/core';
import {getCore} from '../lib/core';
import {useAsync} from '../lib/use-async';
import {money} from '../lib/format';
import {successFeedback, errorFeedback} from '../lib/haptics';
import {
  Button,
  Card,
  Empty,
  ErrorBox,
  Field,
  Header,
  Loading,
  ModalSheet,
  Screen,
  colors,
} from '../components/ui';

export function JobLettersScreen() {
  const {data, loading, error, reload} = useAsync(async () => listJobLetters(await getCore(), 100), []);
  const {data: settings} = useAsync(async () => getSettings(await getCore()), []);

  const [open, setOpen] = useState(false);
  const [employeeName, setEmployeeName] = useState('');
  const [position, setPosition] = useState('');
  const [salary, setSalary] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!employeeName.trim()) {
      return;
    }
    setSaving(true);
    try {
      await saveJobLetter(await getCore(), {
        title: 'Job Letter',
        employeeName: employeeName.trim(),
        position: position.trim() || undefined,
        monthlySalary: Number(salary) || 0,
        data: {},
      });
      successFeedback();
      setOpen(false);
      setEmployeeName('');
      setPosition('');
      setSalary('');
      reload();
    } catch {
      errorFeedback();
      // keep modal open
    } finally {
      setSaving(false);
    }
  }

  async function handleSharePdf(letter: JobLetter) {
    try {
      const company = settings
        ? {name: settings.shopName, address: settings.shopAddress ?? '', email: settings.shopEmail ?? ''}
        : undefined;
      const data = jobLetterFromStored(letter.data, letter, company);
      const {uri} = await Print.printToFileAsync({
        html: renderJobLetterHtml(data),
        base64: false,
      });
      await Share.share({url: uri, message: `Job letter — ${letter.employeeName ?? letter.title}`});
    } catch {
      // user cancelled share or print failed
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteJobLetter(await getCore(), id);
      successFeedback();
      reload();
    } catch {
      errorFeedback();
      // ignore
    }
  }

  return (
    <Screen>
      <Header title="Job Letters" subtitle="Offer letters for staff — shared database" />
      {error ? (
        <ErrorBox message={error} onRetry={reload} />
      ) : loading || !data ? (
        <Loading />
      ) : (
        <FlatList
          data={data}
          keyExtractor={item => item.id}
          ListHeaderComponent={
            <Button title="+ New letter" onPress={() => setOpen(true)} style={{marginHorizontal: 16, marginBottom: 10}} />
          }
          ListEmptyComponent={<Empty text="No job letters yet" />}
          contentContainerStyle={{paddingBottom: 90}}
          renderItem={({item}) => (
            <Card>
              <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'}}>
                <View style={{flex: 1}}>
                  <Text style={{fontSize: 15, fontWeight: '600', color: colors.text}}>{item.title}</Text>
                  <Text style={{fontSize: 12, color: colors.muted, marginTop: 2}}>
                    {item.employeeName ?? '—'}
                    {item.position ? ` · ${item.position}` : ''} · {formatDate(item.createdAt)}
                  </Text>
                  {item.monthlySalary > 0 ? (
                    <Text style={{fontSize: 13, fontWeight: '600', color: colors.text, marginTop: 4}}>
                      {money(item.monthlySalary)}/month
                    </Text>
                  ) : null}
                </View>
                <View style={{flexDirection: 'row', gap: 8}}>
                  <Button title="Share PDF" variant="outline" onPress={() => handleSharePdf(item)} />
                  <Button title="Delete" variant="danger" onPress={() => handleDelete(item.id)} />
                </View>
              </View>
            </Card>
          )}
        />
      )}

      <ModalSheet visible={open} title="New job letter" onClose={() => setOpen(false)} dismissable={!saving}>
        <Field label="Employee name" value={employeeName} onChangeText={setEmployeeName} />
        <Field label="Position" value={position} onChangeText={setPosition} />
        <Field label="Monthly salary" value={salary} onChangeText={setSalary} keyboardType="numeric" />
        <Button title={saving ? 'Saving…' : 'Save'} onPress={handleSave} loading={saving} />
      </ModalSheet>
    </Screen>
  );
}
