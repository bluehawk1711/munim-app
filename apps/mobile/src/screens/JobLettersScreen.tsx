import React, {useState} from 'react';
import {FlatList, Text, View} from 'react-native';
import {saveJobLetter, listJobLetters, deleteJobLetter, formatDate} from '@munim/core';
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

  const [open, setOpen] = useState(false);
  const [employeeName, setEmployeeName] = useState('');
  const [position, setPosition] = useState('');
  const [salary, setSalary] = useState('');

  async function handleSave() {
    if (!employeeName.trim()) {
      return;
    }
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
                <Button title="Delete" variant="danger" onPress={() => handleDelete(item.id)} />
              </View>
            </Card>
          )}
        />
      )}

      <ModalSheet visible={open} title="New job letter" onClose={() => setOpen(false)}>
        <Field label="Employee name" value={employeeName} onChangeText={setEmployeeName} />
        <Field label="Position" value={position} onChangeText={setPosition} />
        <Field label="Monthly salary" value={salary} onChangeText={setSalary} keyboardType="numeric" />
        <Button title="Save" onPress={handleSave} />
      </ModalSheet>
    </Screen>
  );
}
