import { Alert, Button, Card, CardContent, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, Typography } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { agreementSchema, agreementStatuses, barnToday, entitlementPeriods, weekdays, type AgreementDetails, type AgreementInput } from '@absolute/shared';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from './api';
import { formatTime, useBarnTimeZone } from './scheduling';
import { RecurringLessons } from './RecurringLessons';
import { ChoiceField, readable, usePlanningResources } from './planning-controls';
import { errorMessage, validationMessage } from './save-errors';
import { PlanTerms, usePlans, useEnrollments } from './PlansPricing';

export function useAgreements(date?: string, riderId?: string, enabled = true) {
  const query = new URLSearchParams();
  if (date) query.set('date', date);
  if (riderId) query.set('riderId', riderId);
  return useQuery({ queryKey: ['part-board', date, riderId], queryFn: () => api<AgreementDetails[]>(`/api/part-board?${query}`), enabled });
}

export function AgreementTerms({ agreement, showPrice = true }: { agreement: AgreementDetails; showPrice?: boolean }) {
  const { entitlement, preferredRideTimes } = agreement;
  const plans = usePlans();
  const plan = plans.data?.find(({ id }) => id === agreement.planId);
  const packageBalances = useEnrollments(barnToday(useBarnTimeZone()), agreement.riderId);
  const enrollment = packageBalances.data?.find((entry) => entry.agreementId === agreement.id && entry.planId === agreement.planId && entry.status !== 'ENDED');
  return <Stack gap={0.5}>
    {plan && <PlanTerms plan={plan} showPrice={showPrice} />}
    <Typography variant="body2">{readable(agreement.status)} · {agreement.startDate} to {agreement.endDate ?? 'ongoing'}</Typography>
    {plan ? enrollment?.entitlements.map((entry) => <Typography variant="body2" key={entry.id}>{entry.name} · {entry.used} / {entry.allocated} used · {entry.remaining} remaining · {entry.periodStart} to {entry.periodEnd}</Typography>) : <>
      <Typography variant="body2">{entitlement.allowed} rides per {entitlement.period.toLowerCase()} · {entitlement.used} used · {entitlement.remaining} remaining</Typography>
      <Typography variant="caption">{entitlement.periodStart} to {entitlement.periodEnd}</Typography>
    </>}
    {preferredRideTimes.length > 0 && <Typography variant="body2">Preferred times</Typography>}
    {[...preferredRideTimes].sort((a, b) => a.preferenceRank - b.preferenceRank).map((window) =>
      <Typography key={window.preferenceRank} variant="caption">{window.preferenceRank}. {readable(window.dayOfWeek)} {formatTime(window.startTime)}–{formatTime(window.endTime)}</Typography>)}
  </Stack>;
}

export function ProfileAgreements({ agreements, type }: { agreements: AgreementDetails[]; type: 'horses' | 'riders' }) {
  return <Stack gap={1} sx={{ mt: 1 }}>
    <Typography variant="subtitle2">{type === 'horses' ? 'Part Boarders' : 'Part Board Horses'}</Typography>
    {!agreements.length && <Typography variant="body2" color="text.secondary">No agreements.</Typography>}
    {agreements.map((agreement) => <Stack key={agreement.id} alignItems="flex-start">
      <Typography fontWeight={700}>{type === 'horses' ? agreement.riderName : agreement.horseName}</Typography>
      <AgreementTerms agreement={agreement} showPrice={type === 'riders'} />
      <Button size="small" component={Link} to={`/part-board?agreement=${agreement.id}`}>View agreement</Button>
    </Stack>)}
  </Stack>;
}

export function PartBoard() {
  const zone = useBarnTimeZone();
  const date = barnToday(zone);
  const [params, setParams] = useSearchParams();
  const [status, setStatus] = useState('ACTIVE');
  const [rider, setRider] = useState('');
  const [horse, setHorse] = useState('');
  const [draft, setDraft] = useState<Partial<AgreementDetails>>();
  const query = useAgreements(date);
  const resources = usePlanningResources();
  const client = useQueryClient();
  const focused = params.get('agreement');
  const mutation = useMutation({
    mutationFn: ({ id, input }: { id?: string; input: AgreementInput }) => api(`/api/part-board${id ? `/${id}` : ''}`, {
      method: id ? 'PUT' : 'POST', body: JSON.stringify(input),
    }),
    onSuccess: () => {
      setDraft(undefined);
      void client.invalidateQueries({ queryKey: ['part-board'] });
      void client.invalidateQueries({ queryKey: ['enrollments'] });
    },
  });
  const edit = (entry: Partial<AgreementDetails>) => { mutation.reset(); setDraft(entry); };
  const agreements = query.data ?? [];
  const visible = agreements.filter((agreement) => focused ? agreement.id === focused :
    (!status || agreement.status === status) && (!rider || agreement.riderId === rider) && (!horse || agreement.horseId === horse));
  return <Stack gap={3}>
    <Stack direction="row" flexWrap="wrap" gap={1} justifyContent="space-between">
      <Typography variant="h4">Part Board</Typography>
      <Button variant="contained" onClick={() => edit({})}>New agreement</Button>
    </Stack>
    {focused ? <Button onClick={() => setParams({})} sx={{ alignSelf: 'flex-start' }}>All agreements</Button> :
      <Stack direction="row" gap={1} flexWrap="wrap">
        <ChoiceField label="Status" value={status} options={agreementStatuses.map((id) => ({ id, label: readable(id) }))} onChange={setStatus} emptyLabel="All statuses" />
        <ChoiceField label="Rider" value={rider} options={resources.riders} onChange={setRider} emptyLabel="All riders" />
        <ChoiceField label="Horse" value={horse} options={resources.horses} onChange={setHorse} emptyLabel="All horses" />
      </Stack>}
    {query.isPending && <Typography>Loading agreements…</Typography>}
    {query.isError && <Alert severity="error">Unable to load agreements.</Alert>}
    {mutation.isError && !draft && <Alert severity="error">{errorMessage(mutation.error)}</Alert>}
    {query.isSuccess && !visible.length && <Typography>No agreements match.</Typography>}
    {visible.map((agreement) => <Card key={agreement.id}><CardContent><Stack gap={1}>
      <Typography variant="h6">{agreement.riderName} · {agreement.horseName}</Typography>
      <AgreementTerms agreement={agreement} />
      <Typography variant="body2">Priority {agreement.priority}</Typography>
      {agreement.nextPreferredWindow && <Typography variant="body2">Next preferred window {agreement.nextPreferredWindow.date} at {formatTime(agreement.nextPreferredWindow.startTime)}</Typography>}
      {agreement.notes && <Typography variant="body2">{agreement.notes}</Typography>}
      <Stack direction="row" gap={1} flexWrap="wrap">
        <Button onClick={() => edit(agreement)}>Edit agreement</Button>
        {agreement.status === 'ACTIVE' && <Button disabled={mutation.isPending} onClick={() => mutation.mutate({ id: agreement.id, input: { ...agreement, status: 'PAUSED' } })}>Pause</Button>}
        {(agreement.status === 'ACTIVE' || agreement.status === 'PAUSED') && <Button disabled={mutation.isPending}
          onClick={() => mutation.mutate({ id: agreement.id, input: { ...agreement, status: 'ENDED', endDate: date < agreement.startDate ? agreement.startDate : agreement.endDate && agreement.endDate < date ? agreement.endDate : date } })}>End</Button>}
      </Stack>
    </Stack></CardContent></Card>)}
    {draft && <AgreementDialog draft={draft} date={date} resources={resources} saving={mutation.isPending}
      error={mutation.isError ? errorMessage(mutation.error) : ''} onClose={() => setDraft(undefined)}
      onSave={(input) => mutation.mutate({ id: draft.id, input })} />}
    <RecurringLessons agreements={agreements} resources={resources} date={date} />
  </Stack>;
}

function AgreementDialog({ draft, date, resources, saving, error, onClose, onSave }: {
  draft: Partial<AgreementDetails>; date: string; resources: ReturnType<typeof usePlanningResources>;
  saving: boolean; error: string; onClose: () => void; onSave: (value: AgreementInput) => void;
}) {
  const [form, setForm] = useState<AgreementInput>({
    riderId: draft.riderId ?? '', horseId: draft.horseId ?? '', status: draft.status ?? 'ACTIVE', startDate: draft.startDate ?? date,
    endDate: draft.endDate ?? null, priority: draft.priority ?? 100, freeRidesPerPeriod: draft.freeRidesPerPeriod ?? 0,
    entitlementPeriod: draft.entitlementPeriod ?? 'WEEK', notes: draft.notes ?? '', preferredRideTimes: draft.preferredRideTimes ?? [],
    planId: draft.planId ?? null,
  });
  const plans = usePlans();
  const selectedPlan = plans.data?.find(({ id }) => id === form.planId);
  const set = <K extends keyof AgreementInput>(key: K, value: AgreementInput[K]) => setForm((current) => ({ ...current, [key]: value }));
  const valid = agreementSchema.safeParse(form);
  const [submitted, setSubmitted] = useState(false);
  return <Dialog open onClose={onClose} fullWidth maxWidth="sm">
    <DialogTitle>{draft.id ? 'Edit agreement' : 'New agreement'}</DialogTitle>
    <DialogContent dividers><Stack gap={2}>
      {error && <Alert severity="error" sx={{ whiteSpace: 'pre-line' }}>{error}</Alert>}
      <ChoiceField label="Rider" value={form.riderId} options={resources.riders} onChange={(value) => set('riderId', value)} />
      <ChoiceField label="Horse" value={form.horseId} options={resources.horses} onChange={(value) => set('horseId', value)} />
      <ChoiceField label="Part Board package" value={form.planId ?? ''} emptyLabel="Legacy / unassigned" options={plans.data?.filter((plan) => plan.category === 'PART_BOARD' && (plan.active || plan.id === form.planId)).map((plan) => ({ id: plan.id, label: plan.name })) ?? []} onChange={(value) => set('planId', value || null)} />
      {selectedPlan && <PlanTerms plan={selectedPlan} />}
      <ChoiceField label="Status" value={form.status} options={agreementStatuses.map((id) => ({ id, label: readable(id) }))} onChange={(value) => set('status', value as AgreementInput['status'])} />
      <TextField type="date" label="Start date" value={form.startDate} onChange={(event) => set('startDate', event.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
      <TextField type="date" label="End date" value={form.endDate ?? ''} onChange={(event) => set('endDate', event.target.value || null)} slotProps={{ inputLabel: { shrink: true } }} />
      {!form.planId && <><TextField type="number" label="Free rides per period" value={form.freeRidesPerPeriod} onChange={(event) => set('freeRidesPerPeriod', Number(event.target.value))} />
      <ChoiceField label="Entitlement period" value={form.entitlementPeriod} options={entitlementPeriods.map((id) => ({ id, label: readable(id) }))} onChange={(value) => set('entitlementPeriod', value as AgreementInput['entitlementPeriod'])} /></>}
      <TextField type="number" label="Priority" value={form.priority} onChange={(event) => set('priority', Number(event.target.value))} />
      <TextField label="Notes" value={form.notes} onChange={(event) => set('notes', event.target.value)} />
      <Typography variant="h6">Preferred ride times</Typography>
      {form.preferredRideTimes.map((window, index) => {
        const update = (fields: Partial<typeof window>) => set('preferredRideTimes', form.preferredRideTimes.map((item, row) => row === index ? { ...item, ...fields } : item));
        return <Stack key={index} direction={{ xs: 'column', sm: 'row' }} gap={1}>
          <ChoiceField label="Day" value={window.dayOfWeek} options={weekdays.map((id) => ({ id, label: readable(id) }))} onChange={(day) => update({ dayOfWeek: day as typeof window.dayOfWeek })} />
          <TextField type="time" label="Start" value={window.startTime} onChange={(event) => update({ startTime: event.target.value })} slotProps={{ inputLabel: { shrink: true } }} />
          <TextField type="time" label="End" value={window.endTime} onChange={(event) => update({ endTime: event.target.value })} slotProps={{ inputLabel: { shrink: true } }} />
          <TextField type="number" label="Rank" value={window.preferenceRank} onChange={(event) => update({ preferenceRank: Number(event.target.value) })} sx={{ width: 80 }} />
          <Button onClick={() => set('preferredRideTimes', form.preferredRideTimes.filter((_, row) => row !== index))}>Remove</Button>
        </Stack>;
      })}
      <Button onClick={() => set('preferredRideTimes', [...form.preferredRideTimes, { dayOfWeek: 'TUESDAY', startTime: '17:00', endTime: '19:00', preferenceRank: Math.max(0, ...form.preferredRideTimes.map(({ preferenceRank }) => preferenceRank)) + 1 }])}>Add preferred time</Button>
      {!valid.success && submitted && <Alert severity="warning" sx={{ whiteSpace: 'pre-line' }}>{validationMessage(valid.error.issues)}</Alert>}
    </Stack></DialogContent>
    <DialogActions><Button onClick={onClose}>Cancel</Button><Button variant="contained" disabled={saving} onClick={() => { setSubmitted(true); if (valid.success) onSave(valid.data); }}>Save agreement</Button></DialogActions>
  </Dialog>;
}
