import { Alert, Button, Card, CardContent, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, Stack, TextField, Typography } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { disciplines, lessonSchema, lessonTypes, recurringStatuses, weekdays, type AgreementDetails, type LessonInput } from '@absolute/shared';
import { useState } from 'react';
import { api } from './api';
import { ChoiceField, readable, type usePlanningResources } from './planning-controls';
import { errorMessage, validationMessage } from './save-errors';
import { formatTime } from './scheduling';

type Template = {
  id?: string; lesson: LessonInput; startDate: string; endDate: string | null;
  dayOfWeek: typeof weekdays[number]; status: typeof recurringStatuses[number];
  schedulingPriority?: number; partBoardAgreementId?: string | null;
};
type Generation = { generated: { id: string }[]; failures: { date: string; conflicts: { severity: string; message: string }[] }[]; skipped: number };
type Resources = ReturnType<typeof usePlanningResources>;

export function RecurringLessons({ agreements, resources, date }: { agreements: AgreementDetails[]; resources: Resources; date: string }) {
  const client = useQueryClient();
  const [draft, setDraft] = useState<Template>();
  const [report, setReport] = useState<Generation>();
  const query = useQuery({ queryKey: ['recurring-lessons'], queryFn: () => api<Template[]>('/api/recurring-lessons') });
  const save = useMutation({
    mutationFn: (template: Template) => api(`/api/recurring-lessons${template.id ? `/${template.id}` : ''}`, {
      method: template.id ? 'PUT' : 'POST', body: JSON.stringify(template),
    }),
    onSuccess: () => { setDraft(undefined); void client.invalidateQueries({ queryKey: ['recurring-lessons'] }); },
  });
  const generate = useMutation({
    mutationFn: (id: string) => api<Generation>(`/api/recurring-lessons/${id}/generate`, { method: 'POST' }),
    onMutate: () => setReport(undefined),
    onSuccess: (result) => {
      setReport(result);
      for (const key of ['schedule', 'lessons', 'part-board']) void client.invalidateQueries({ queryKey: [key] });
    },
  });
  const edit = (template: Template) => { save.reset(); setDraft(template); };
  const lookup = (options: Resources['riders'], id: string | null | undefined) => options.find((item) => item.id === id)?.label;
  return <Stack gap={2}>
    <Stack direction="row" flexWrap="wrap" justifyContent="space-between" gap={1}>
      <Typography variant="h5">Recurring lessons and rides</Typography>
      <Button variant="outlined" onClick={() => edit({ startDate: date, endDate: null, dayOfWeek: 'MONDAY', status: 'ACTIVE',
        lesson: { date, startTime: '16:00', endTime: '17:00', lessonType: 'PRIVATE', discipline: 'FLAT', rideUnits: 1,
          riderId: '', horseId: '', coachId: null, status: 'CONFIRMED' },
      })}>New recurring template</Button>
    </Stack>
    {query.isPending && <Typography>Loading templates…</Typography>}
    {query.isError && <Alert severity="error">Unable to load recurring templates.</Alert>}
    {query.isSuccess && !query.data.length && <Typography>No recurring templates.</Typography>}
    {save.isError && !draft && <Alert severity="error">{errorMessage(save.error)}</Alert>}
    {generate.isError && <Alert severity="error">{errorMessage(generate.error)}</Alert>}
    {report && <Alert severity={report.failures.length ? 'warning' : 'success'} onClose={() => setReport(undefined)}>
      {report.generated.length} generated · {report.skipped} already scheduled · {report.failures.length} failed
      {report.failures.map(({ date, conflicts }) => <Typography key={date} variant="body2">{date} · {conflicts.filter(({ severity }) => severity === 'ERROR').map(({ message }) => message).join(' ')}</Typography>)}
    </Alert>}
    {query.data?.map((template) => <Card key={template.id}><CardContent>
      <Typography variant="h6">{lookup(resources.riders, template.lesson.riderId)} · {lookup(resources.horses, template.lesson.horseId)}</Typography>
      <Typography variant="body2">{readable(template.lesson.lessonType)} · {readable(template.status)} · Priority {template.schedulingPriority}</Typography>
      <Typography variant="body2">{readable(template.dayOfWeek)} {formatTime(template.lesson.startTime)}–{formatTime(template.lesson.endTime)} · {template.startDate} to {template.endDate ?? 'ongoing'}</Typography>
      <Stack direction="row" gap={1} flexWrap="wrap">
        <Button onClick={() => edit(template)}>Edit template</Button>
        {template.status === 'ACTIVE' && <Button disabled={save.isPending} onClick={() => save.mutate({ ...template, status: 'PAUSED' })}>Pause template</Button>}
        {template.status !== 'ENDED' && <Button disabled={save.isPending} onClick={() => save.mutate({ ...template, status: 'ENDED' })}>End template</Button>}
        {template.status === 'ACTIVE' && template.id && <Button disabled={generate.isPending} onClick={() => generate.mutate(template.id!)}>Generate lessons</Button>}
      </Stack>
    </CardContent></Card>)}
    {draft && <TemplateDialog template={draft} resources={resources} agreements={agreements} onClose={() => setDraft(undefined)}
      saving={save.isPending} error={save.isError ? errorMessage(save.error) : ''} onSave={(template) => save.mutate(template)} />}
  </Stack>;
}

function TemplateDialog({ template, resources, agreements, onClose, onSave, saving, error }: {
  template: Template; resources: Resources; agreements: AgreementDetails[]; onClose: () => void;
  onSave: (template: Template) => void; saving: boolean; error: string;
}) {
  const [form, set] = useState(template);
  const [submitted, setSubmitted] = useState(false);
  const lesson = form.lesson;
  const partBoard = lesson.lessonType === 'PART_BOARD_RIDE';
  const update = (fields: Partial<Template>) => set((current) => ({ ...current, ...fields }));
  const updateLesson = (fields: Partial<LessonInput>) => update({ lesson: { ...lesson, ...fields } });
  const options = (values: readonly string[]) => values.map((id) => ({ id, label: id === 'SEMI_PRIVATE' ? 'Semi-private' : readable(id) }));
  const payload = { ...form, lesson: { ...lesson, date: form.startDate } };
  const parsed = lessonSchema.safeParse(payload.lesson);
  const issues = [
    ...(parsed.success ? [] : parsed.error.issues),
    ...((form.endDate && form.startDate > form.endDate) ? [{ path: ['endDate'], message: 'End date must be on or after the start date.' }] : []),
    ...((partBoard && !form.partBoardAgreementId) ? [{ path: ['partBoardAgreementId'], message: 'Select an agreement.' }] : []),
  ];
  return <Dialog open onClose={onClose} fullWidth maxWidth="sm">
    <DialogTitle>{template.id ? 'Edit recurring template' : 'New recurring template'}</DialogTitle>
    <DialogContent dividers><Stack gap={2}>
      {error && <Alert severity="error" sx={{ whiteSpace: 'pre-line' }}>{error}</Alert>}
      <Typography variant="body2">Weekly recurrence. Changes apply to future generation.</Typography>
      <ChoiceField label="Lesson type" value={lesson.lessonType} options={options(lessonTypes)} onChange={(value) => update({
        lesson: { ...lesson, lessonType: value as LessonInput['lessonType'], consumeEntitlement: value === 'PART_BOARD_RIDE' },
        partBoardAgreementId: null, schedulingPriority: undefined,
      })} />
      {partBoard ? <ChoiceField label="Agreement" value={form.partBoardAgreementId ?? ''}
        options={agreements.map((entry) => ({ id: entry.id, label: `${entry.riderName} · ${entry.horseName} (${readable(entry.status)})` }))}
        onChange={(id) => {
          const agreement = agreements.find((entry) => entry.id === id);
          if (agreement) update({ partBoardAgreementId: id, lesson: { ...lesson, riderId: agreement.riderId, horseId: agreement.horseId } });
        }} /> : <>
        <ChoiceField label="Rider" value={lesson.riderId} options={resources.riders} onChange={(riderId) => updateLesson({ riderId })} />
        <ChoiceField label="Horse" value={lesson.horseId} options={resources.horses} onChange={(horseId) => updateLesson({ horseId })} />
      </>}
      <ChoiceField label="Coach" value={lesson.coachId ?? ''} options={resources.coaches} emptyLabel={partBoard ? 'No coach' : undefined} onChange={(coachId) => updateLesson({ coachId: coachId || null })} />
      {partBoard && <FormControlLabel label="Use a free-ride entitlement" control={<Checkbox checked={lesson.consumeEntitlement ?? true} onChange={(_, checked) => updateLesson({ consumeEntitlement: checked })} />} />}
      <ChoiceField label="Discipline" value={lesson.discipline} options={options(disciplines)} onChange={(value) => updateLesson({ discipline: value as LessonInput['discipline'] })} />
      <ChoiceField label="Weekday" value={form.dayOfWeek} options={options(weekdays)} onChange={(value) => update({ dayOfWeek: value as Template['dayOfWeek'] })} />
      <Stack direction={{ xs: 'column', sm: 'row' }} gap={1}>
        <TextField type="time" label="Start" value={lesson.startTime} onChange={(event) => updateLesson({ startTime: event.target.value })} slotProps={{ inputLabel: { shrink: true } }} />
        <TextField type="time" label="End" value={lesson.endTime} onChange={(event) => updateLesson({ endTime: event.target.value })} slotProps={{ inputLabel: { shrink: true } }} />
      </Stack>
      <TextField type="date" label="First date" value={form.startDate} onChange={(event) => update({ startDate: event.target.value })} slotProps={{ inputLabel: { shrink: true } }} />
      <TextField type="date" label="Last date" value={form.endDate ?? ''} onChange={(event) => update({ endDate: event.target.value || null })} slotProps={{ inputLabel: { shrink: true } }} />
      <ChoiceField label="Status" value={form.status} options={options(recurringStatuses)} onChange={(value) => update({ status: value as Template['status'] })} />
      <TextField type="number" label="Ride units" value={lesson.rideUnits} onChange={(event) => updateLesson({ rideUnits: Number(event.target.value) })} />
      <TextField type="number" label="Priority" value={form.schedulingPriority ?? ''} placeholder="Use default" onChange={(event) => update({ schedulingPriority: event.target.value ? Number(event.target.value) : undefined })} slotProps={{ inputLabel: { shrink: true } }} />
      <TextField label="Notes" value={lesson.notes ?? ''} onChange={(event) => updateLesson({ notes: event.target.value })} />
      {submitted && issues.length > 0 && <Alert severity="warning" sx={{ whiteSpace: 'pre-line' }}>{validationMessage(issues)}</Alert>}
    </Stack></DialogContent>
    <DialogActions><Button onClick={onClose}>Cancel</Button><Button variant="contained" disabled={saving} onClick={() => { setSubmitted(true); if (!issues.length) onSave(payload); }}>Save template</Button></DialogActions>
  </Dialog>;
}
