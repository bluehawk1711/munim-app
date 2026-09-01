import React, {useState} from 'react';
import {FlatList, Share, Text, View} from 'react-native';
import * as Print from 'expo-print';
import {jobLetterFromStored, renderJobLetterHtml, formatDate, type JobLetterDto} from '@munim/core';
import {useDeleteJobLetter, useJobLetters, useQueryState, useSaveJobLetter, useSettings} from '@munim/query';
import {money} from '../lib/format';
import {successFeedback, errorFeedback} from '../lib/haptics';
import {rs, typography, spacing, CARD_MARGIN} from '../lib/responsive';
import {Button, Card, Empty, ErrorBox, Field, Header, Loading, ModalSheet, Screen} from '../components/ui';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export function JobLettersScreen() {
  const {data, loading, error, reload} = useQueryState(useJobLetters());
  const {data: settings} = useQueryState(useSettings());
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [empName, setEmpName] = useState('');
  const [empAddr, setEmpAddr] = useState('');
  const [position, setPosition] = useState('');
  const [joinDate, setJoinDate] = useState('');
  const [salary, setSalary] = useState('');
  const [hoursDesc, setHoursDesc] = useState('9 hours per day');
  const [hoursFrom, setHoursFrom] = useState('09:00 AM');
  const [hoursTo, setHoursTo] = useState('06:00 PM');
  const [off1, setOff1] = useState('Sunday');
  const [off2, setOff2] = useState('');
  const [probation, setProbation] = useState('3');
  const [tasks, setTasks] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const saveLetter = useSaveJobLetter();
  const deleteLetter = useDeleteJobLetter();

  function reset() {
    setTitle(''); setEmpName(''); setEmpAddr(''); setPosition(''); setJoinDate('');
    setSalary(''); setHoursDesc('9 hours per day'); setHoursFrom('09:00 AM'); setHoursTo('06:00 PM');
    setOff1('Sunday'); setOff2(''); setProbation('3'); setTasks(''); setNotes('');
  }

  async function handleSave() {
    if (!empName.trim()) return;
    setSaving(true);
    try {
      await saveLetter.mutateAsync({
        title: title.trim() || 'Job Letter',
        employeeName: empName.trim(),
        position: position.trim() || undefined,
        monthlySalary: Number(salary) || 0,
        data: {
          employeeAddress: empAddr.trim() || undefined,
          joiningDate: joinDate.trim() || undefined,
          workingHoursDescription: hoursDesc.trim() || undefined,
          workingHoursFrom: hoursFrom.trim() || undefined,
          workingHoursTo: hoursTo.trim() || undefined,
          weeklyOff1: off1 || undefined,
          weeklyOff2: off2 || undefined,
          probationMonths: Number(probation) || 0,
          additionalTasks: tasks.trim() || undefined,
        },
      });
      successFeedback();
      setOpen(false);
      reset();
    } catch { errorFeedback(); } finally { setSaving(false); }
  }

  async function handleSharePdf(letter: JobLetterDto) {
    try {
      const company = settings ? {name: settings.shopName, address: settings.shopAddress ?? '', email: settings.shopEmail ?? ''} : undefined;
      const d = jobLetterFromStored(letter.data, letter, company);
      const {uri} = await Print.printToFileAsync({html: renderJobLetterHtml(d), base64: false});
      await Share.share({url: uri, message: `Job letter — ${letter.employeeName ?? letter.title}`});
    } catch { /* cancelled */ }
  }

  return (
    <Screen>
      <Header title="Job Letters" subtitle="Staff offer letters" />
      {error ? <ErrorBox message={error} onRetry={reload} /> : loading || !data ? <Loading /> : (
        <FlatList
          data={data}
          keyExtractor={item => item.id}
          ListHeaderComponent={<Button title="+ New letter" onPress={() => { reset(); setOpen(true); }} style={{marginHorizontal: CARD_MARGIN, marginBottom: spacing.sm}} />}
          ListEmptyComponent={<Empty text="No job letters yet" />}
          contentContainerStyle={{paddingBottom: spacing.xxxl}}
          renderItem={({item}) => (
            <Card style={{marginHorizontal: CARD_MARGIN}}>
              <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'}}>
                <View style={{flex: 1}}>
                  <Text style={{fontSize: typography.body, fontWeight: '600', color: '#0c0b09'}}>{item.title}</Text>
                  <Text style={{fontSize: typography.caption, color: '#7f7971', marginTop: rs(2)}}>
                    {item.employeeName ?? '—'}{item.position ? ` · ${item.position}` : ''} · {formatDate(item.createdAt)}
                  </Text>
                  {item.monthlySalary > 0 ? <Text style={{fontSize: typography.secondary, fontWeight: '600', marginTop: rs(4)}}>{money(item.monthlySalary)}/month</Text> : null}
                </View>
                <View style={{flexDirection: 'row', gap: spacing.sm}}>
                  <Button title="Share" variant="outline" size="small" onPress={() => handleSharePdf(item)} />
                  <Button title="Delete" variant="danger" size="small" onPress={() => deleteLetter.mutateAsync(item.id).then(() => successFeedback()).catch(() => errorFeedback())} />
                </View>
              </View>
            </Card>
          )}
        />
      )}

      <ModalSheet visible={open} title="New job letter" onClose={() => setOpen(false)} dismissable={!saving}>
        <Field label="Title" value={title} onChangeText={setTitle} placeholder="Job Letter" />
        <Field label="Employee name *" value={empName} onChangeText={setEmpName} />
        <Field label="Employee address" value={empAddr} onChangeText={setEmpAddr} placeholder="Full address" />
        <Field label="Position" value={position} onChangeText={setPosition} />
        <Field label="Joining date" value={joinDate} onChangeText={setJoinDate} placeholder="e.g. 2025-01-15" />
        <Field label="Monthly salary" value={salary} onChangeText={setSalary} keyboardType="numeric" />
        <Field label="Working hours" value={hoursDesc} onChangeText={setHoursDesc} placeholder="e.g. 9 hours per day" />
        <Field label="Hours from" value={hoursFrom} onChangeText={setHoursFrom} placeholder="e.g. 09:00 AM" />
        <Field label="Hours to" value={hoursTo} onChangeText={setHoursTo} placeholder="e.g. 06:00 PM" />
        <Field label="Weekly off 1" value={off1} onChangeText={setOff1} placeholder="e.g. Sunday" />
        <Field label="Weekly off 2" value={off2} onChangeText={setOff2} placeholder="e.g. Saturday (optional)" />
        <Field label="Probation months" value={probation} onChangeText={setProbation} keyboardType="numeric" />
        <Field label="Additional tasks" value={tasks} onChangeText={setTasks} multiline placeholder="Any additional tasks…" />
        <Field label="Notes" value={notes} onChangeText={setNotes} multiline placeholder="Internal notes…" />
        <Button title={saving ? 'Saving…' : 'Save'} onPress={handleSave} loading={saving} />
      </ModalSheet>
    </Screen>
  );
}
