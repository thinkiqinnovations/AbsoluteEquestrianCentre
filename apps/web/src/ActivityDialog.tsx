import { Alert, Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, Stack, TextField, Typography } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { activityDuration, activityLabels, activitySchema, activityTypes, money, type ActivityInput, type EnrollmentDetails } from '@absolute/shared';
import { api } from './api';
import { ChoiceField, usePlanningResources } from './planning-controls';
import { useEnrollments, usePlans } from './PlansPricing';
import { errorMessage, validationMessage } from './save-errors';
import { LessonHorseRecommendations, useHorseRecommendations } from './LessonHorseRecommendations';
import { FormSection } from './FormSection';

export type ActivityRecord = ActivityInput & { id: string; version: number; participants: (ActivityInput['participants'][number] & { id: string; lessonId: string | null; publishedPriceCents: number; amountCents: number; paymentInstructions: string })[] };
export const mountedActivity = (type: string) => ['ASSESSMENT', 'PRIVATE_LESSON', 'SEMI_PRIVATE_LESSON', 'GROUP_LESSON', 'PRACTICE_RIDE'].includes(type);
const endAt = (start: string, duration: number) => {
  const value = Number(start.slice(0, 2)) * 60 + Number(start.slice(3)) + duration;
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
};
export function ActivityDialog({ activityId, date, startTime = '09:00', onClose, onSaved }: { activityId?: string; date: string; startTime?: string; onClose: () => void; onSaved: () => void }) {
  const query = useQuery({ queryKey: ['activities'], queryFn: () => api<ActivityRecord[]>('/api/activities') });
  if (activityId && query.isPending) return <Dialog open><DialogTitle>Loading activity…</DialogTitle></Dialog>;
  if (activityId && (query.isError || !query.data?.some(({ id }) => id === activityId))) return <Dialog open onClose={onClose}><DialogTitle>Unable to load activity</DialogTitle><DialogActions><Button onClick={onClose}>Close</Button></DialogActions></Dialog>;
  return <ActivityForm initial={query.data?.find(({ id }) => id === activityId)} date={date} startTime={startTime} onClose={onClose} onSaved={onSaved} />;
}
function ActivityForm({ initial, date, startTime, onClose, onSaved }: { initial?: ActivityRecord; date: string; startTime: string; onClose: () => void; onSaved: () => void }) {
  const client = useQueryClient();
  const resources = usePlanningResources(!initial);
  const [form, setForm] = useState<ActivityInput>(initial ?? { activityType: 'PRIVATE_LESSON', date, startTime, endTime: endAt(startTime, 30), status: 'CONFIRMED', discipline: 'FLAT', rideUnits: 0.5, location: '', notes: '', cancellationAction: 'RETAIN', participants: [{ riderId: '', overrideReason: '', relationshipOverrideReason: '' }] });
  const [error, setError] = useState('');
  const plans = usePlans();
  const enrollments = useEnrollments(form.date);
  const mounted = mountedActivity(form.activityType);
  const offering = plans.data?.find((plan) => plan.activityTypes.includes(form.activityType) && !plan.entitlements.length && plan.active && plan.effectiveFrom <= form.date && (!plan.effectiveTo || plan.effectiveTo >= form.date));
  const quote = useQuery({ queryKey: ['price-quote', offering?.id, form.participants.length], queryFn: () => api<{ amountCents: number; paymentInstructions: string; hstIncluded: boolean }>(`/api/plans/${offering!.id}/quote?quantity=${form.activityType === 'BIRTHDAY_PARTY' ? form.participants.length : 1}`), enabled: Boolean(offering) });
  const mutation = useMutation({
    mutationFn: () => api(`/api/activities${initial ? `/${initial.id}` : ''}`, { method: initial ? 'PUT' : 'POST', body: JSON.stringify(form) }),
    onSuccess: () => { for (const key of ['activities', 'schedule', 'lessons', 'enrollments', 'part-board']) void client.invalidateQueries({ queryKey: [key] }); onSaved(); onClose(); },
    onError: (response) => setError(errorMessage(response)),
  });
  const set = (fields: Partial<ActivityInput>) => setForm((current) => ({ ...current, ...fields }));
  const changeType = (activityType: ActivityInput['activityType']) => set({ activityType, endDate: activityType === 'SEASONAL_CAMP' ? form.endDate ?? form.date : null, capacity: activityType === 'SEASONAL_CAMP' ? form.capacity : null, endTime: endAt(form.startTime, activityDuration[activityType]), rideUnits: activityType === 'GROUP_LESSON' || activityType === 'PRACTICE_RIDE' ? 1 : 0.5, participants: form.participants.map((p) => ({ ...p, enrollmentId: undefined, entitlementId: undefined })) });
  const lessonActivity = ['PRIVATE_LESSON', 'SEMI_PRIVATE_LESSON', 'GROUP_LESSON'].includes(form.activityType);
  return <Dialog open onClose={onClose} fullWidth maxWidth="md"><DialogTitle>{initial ? 'Edit activity' : 'Add Lesson / Activity'}</DialogTitle><DialogContent dividers><Stack gap={2}>
    <FormSection title="Activity">
      <ChoiceField label="Activity type" value={lessonActivity ? 'LESSON' : form.activityType} options={[{ id: 'LESSON', label: 'Lesson' }, ...activityTypes.filter((id) => !['PRIVATE_LESSON', 'SEMI_PRIVATE_LESSON', 'GROUP_LESSON'].includes(id)).map((id) => ({ id, label: activityLabels[id] }))]} onChange={(value) => changeType(value === 'LESSON' ? 'PRIVATE_LESSON' : value as ActivityInput['activityType'])} />
      {!lessonActivity && <Typography variant="body2" color="text.secondary">{activityDuration[form.activityType]} minutes</Typography>}
    </FormSection>
    {lessonActivity && <FormSection title="Lesson format">
      <ChoiceField label="Lesson format" value={form.activityType} options={(['GROUP_LESSON', 'SEMI_PRIVATE_LESSON', 'PRIVATE_LESSON'] as const).map((id) => ({ id, label: activityLabels[id] }))} onChange={(value) => changeType(value as ActivityInput['activityType'])} />
      <Typography variant="body2" color="text.secondary">{form.activityType === 'GROUP_LESSON' ? '3–6 riders · 60 minutes' : form.activityType === 'SEMI_PRIVATE_LESSON' ? 'Exactly 2 riders · 30 minutes' : '1 rider · 30 minutes'}</Typography>
    </FormSection>}
    <FormSection title="Schedule">
    <Stack direction={{ xs: 'column', sm: 'row' }} gap={1}>
      <TextField label="Date" type="date" value={form.date} onChange={(event) => set({ date: event.target.value })} slotProps={{ inputLabel: { shrink: true } }} />
      {form.activityType === 'SEASONAL_CAMP' && <TextField label="End date" type="date" value={form.endDate ?? form.date} onChange={(event) => set({ endDate: event.target.value })} slotProps={{ inputLabel: { shrink: true } }} />}
      <TextField label="Start" type="time" value={form.startTime} onChange={(event) => set({ startTime: event.target.value, endTime: endAt(event.target.value, activityDuration[form.activityType]) })} slotProps={{ inputLabel: { shrink: true } }} />
      <TextField label="End" type="time" value={form.endTime} onChange={(event) => set({ endTime: event.target.value })} slotProps={{ inputLabel: { shrink: true } }} />
    </Stack>
    <ChoiceField label={form.activityType === 'PRACTICE_RIDE' ? 'Coach (optional)' : 'Coach'} value={form.coachId ?? ''} options={resources.coaches} emptyLabel="No coach" onChange={(coachId) => set({ coachId: coachId || null })} />
    <TextField label="Arena / location" value={form.location} onChange={(event) => set({ location: event.target.value })} />
    {mounted && <Stack direction={{ xs: 'column', sm: 'row' }} gap={1}><ChoiceField label="Discipline" value={form.discipline} options={['FLAT', 'JUMP'].map((id) => ({ id, label: id }))} onChange={(value) => set({ discipline: value as ActivityInput['discipline'] })} /><TextField label="Ride units per horse" type="number" value={form.rideUnits} onChange={(event) => set({ rideUnits: Number(event.target.value) })} /></Stack>}
    </FormSection>
    <FormSection title="Riders">
    {form.participants.map((participant, index) => <ParticipantEditor key={index} form={form} participant={participant} enrollments={enrollments.data ?? []} existingLessonId={initial?.participants[index]?.lessonId ?? undefined} resources={resources}
      individualPrice={quote.data?.amountCents} update={(value) => set({ participants: form.participants.map((entry, row) => row === index ? value : entry) })}
      onRemove={form.participants.length > 1 && !initial ? () => set({ participants: form.participants.filter((_, row) => row !== index) }) : undefined} />)}
    {!initial && <Button onClick={() => set({ participants: [...form.participants, { riderId: '', overrideReason: '', relationshipOverrideReason: '' }] })}>Add rider</Button>}
    </FormSection>
    {quote.data && <Typography>Published {form.activityType === 'BIRTHDAY_PARTY' ? 'party total' : 'individual price'} {money(quote.data.amountCents)} · {quote.data.hstIncluded ? 'HST included' : 'HST excluded'}</Typography>}
    {quote.data?.paymentInstructions && <Alert severity="info">{quote.data.paymentInstructions}</Alert>}
    {form.activityType === 'BIRTHDAY_PARTY' && <Typography variant="body2">1 hour lesson + 1 hour barn/party room. Select all attending riders. The reservation covers the full two hours.</Typography>}
    {form.activityType === 'SEASONAL_CAMP' && <TextField label="Capacity" type="number" value={form.capacity ?? ''} onChange={(event) => set({ capacity: Number(event.target.value) || null })} />}
    <FormSection title="Activity details">
    <ChoiceField label="Status" value={form.status} options={['DRAFT', 'CONFIRMED', 'COMPLETED', 'CANCELLED'].map((id) => ({ id, label: id }))} onChange={(value) => set({ status: value as ActivityInput['status'] })} />
    {form.status === 'CANCELLED' && <FormControlLabel label="Restore package entitlements for this cancellation" control={<Checkbox checked={form.cancellationAction === 'RESTORE'} onChange={(_, checked) => set({ cancellationAction: checked ? 'RESTORE' : 'RETAIN' })} />} />}
    <TextField label="Notes" value={form.notes} multiline onChange={(event) => set({ notes: event.target.value })} />
    </FormSection>
    {error && <Alert severity="error" sx={{ whiteSpace: 'pre-line' }}>{error}</Alert>}
  </Stack></DialogContent><DialogActions><Button onClick={onClose}>Cancel</Button><Button variant="contained" disabled={mutation.isPending} onClick={() => { const parsed = activitySchema.safeParse(form); if (!parsed.success) setError(validationMessage(parsed.error.issues)); else { setError(''); mutation.mutate(); } }}>Save activity</Button></DialogActions></Dialog>;
}
function ParticipantEditor({ form, participant, update, onRemove, resources, enrollments, existingLessonId, individualPrice }: {
  form: ActivityInput; participant: ActivityInput['participants'][number]; update: (value: ActivityInput['participants'][number]) => void;
  onRemove?: () => void; resources: ReturnType<typeof usePlanningResources>; enrollments: EnrollmentDetails[]; existingLessonId?: string; individualPrice?: number;
}) {
  const mounted = mountedActivity(form.activityType);
  const eligible = enrollments.filter((entry) => entry.riderId === participant.riderId && entry.effective).flatMap((entry) =>
    entry.entitlements.filter((entitlement) => entitlement.activityTypes.includes(form.activityType)).map((entitlement) => ({ entry, entitlement })));
  const firstEnrollment = eligible.find(({ entitlement }) => entitlement.remaining > 0) ?? eligible[0];
  useEffect(() => {
    if (participant.riderId && participant.enrollmentId === undefined && firstEnrollment) update({ ...participant, enrollmentId: firstEnrollment.entry.id, entitlementId: firstEnrollment.entitlement.id });
  }, [participant, firstEnrollment, update]);
  const selected = eligible.find(({ entry, entitlement }) => entry.id === participant.enrollmentId && entitlement.id === participant.entitlementId);
  const recommendation = useHorseRecommendations(mounted ? { riderId: participant.riderId, horseId: participant.horseId, date: form.date, startTime: form.startTime, endTime: form.endTime,
    lessonType: form.activityType === 'PRACTICE_RIDE' ? 'PART_BOARD_RIDE' : form.activityType === 'GROUP_LESSON' ? 'GROUP' : form.activityType === 'SEMI_PRIVATE_LESSON' ? 'SEMI_PRIVATE' : 'PRIVATE',
    discipline: form.discipline, rideUnits: form.rideUnits, coachId: form.coachId, excludeLessonId: existingLessonId, consumeEntitlement: false } : {});
  return <Box sx={{ minWidth: 0 }}><Stack gap={2}>
    <ChoiceField label="Rider" value={participant.riderId} options={resources.riders} onChange={(riderId) => update({ ...participant, riderId, enrollmentId: undefined, entitlementId: undefined })} />
    {mounted && <FormSection title="Horse"><LessonHorseRecommendations query={recommendation} value={participant.horseId ?? ''} current={participant.horseId ?? undefined} horseName={resources.horses.find(({ id }) => id === participant.horseId)?.label} partBoard={form.activityType === 'PRACTICE_RIDE'} onSelect={(horseId) => update({ ...participant, horseId })} /></FormSection>}
    <FormSection title="Package / Entitlement">
    <ChoiceField label="Covered by" value={participant.enrollmentId ? `${participant.enrollmentId}|${participant.entitlementId}` : ''} emptyLabel={`Individual purchase${individualPrice === undefined ? '' : ` · ${money(individualPrice)}`}`} options={eligible.map(({ entry, entitlement }) => ({ id: `${entry.id}|${entitlement.id}`, label: `${entry.plan.name} · ${entitlement.name}` }))}
      onChange={(value) => { const [enrollmentId, entitlementId] = value.split('|'); update({ ...participant, enrollmentId: enrollmentId || null, entitlementId: entitlementId || null }); }} />
    {selected && <>
      <Typography variant="body2">{selected.entitlement.used} / {selected.entitlement.allocated} used · {selected.entitlement.remaining} remaining before booking · {Math.max(0, selected.entitlement.remaining - 1)} after booking</Typography>
      <Typography variant="caption">{selected.entitlement.periodStart} to {selected.entitlement.periodEnd}</Typography>
      <TextField label="Exhausted entitlement override reason" value={participant.overrideReason} onChange={(event) => update({ ...participant, overrideReason: event.target.value })} />
    </>}
    {form.activityType === 'PRACTICE_RIDE' && <TextField label="Horse relationship override reason (if required)" value={participant.relationshipOverrideReason} onChange={(event) => update({ ...participant, relationshipOverrideReason: event.target.value })} />}
    </FormSection>
    {onRemove && <Button color="error" onClick={onRemove}>Remove rider</Button>}
  </Stack></Box>;
}
