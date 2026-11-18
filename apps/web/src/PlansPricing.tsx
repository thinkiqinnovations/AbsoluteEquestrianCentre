import { Alert, Box, Button, Card, CardContent, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, Typography } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { barnToday, enrollmentSchema, planPrice, type EnrollmentDetails, type EnrollmentInput, type Plan } from '@absolute/shared';
import { api } from './api';
import { ChoiceField, readable } from './planning-controls';
import { errorMessage } from './save-errors';
import { useBarnTimeZone } from './scheduling';

export const usePlans = () => useQuery({ queryKey: ['plans'], queryFn: () => api<Plan[]>('/api/plans') });
export function useEnrollments(date: string, riderId?: string) {
  return useQuery({ queryKey: ['enrollments', date, riderId], queryFn: () => api<EnrollmentDetails[]>(`/api/enrollments?${new URLSearchParams({ date, ...(riderId ? { riderId } : {}) })}`) });
}
export function PlanTerms({ plan, showPrice = true, showEntitlements = true }: { plan: Plan; showPrice?: boolean; showEntitlements?: boolean }) {
  return <Stack gap={0.5}>
    <Typography variant="h6">{plan.name}</Typography>
    {showPrice && <><Typography sx={{ color: 'primary.main', fontSize: '1.5rem', fontWeight: 700 }}>{planPrice(plan)}</Typography><Typography variant="caption" color="text.secondary">{plan.hstIncluded ? 'HST included' : 'HST excluded'}</Typography></>}
    {showEntitlements && plan.entitlements.map((entry) => <Typography variant="body2" key={entry.id}>{entry.quantity} {entry.name} / {entry.period.toLowerCase()}</Typography>)}
    {plan.durationMinutes && <Typography variant="body2">{plan.durationMinutes} minutes</Typography>}
    {plan.daysPerWeek && <Typography variant="body2">{plan.daysPerWeek} {plan.daysPerWeek === 1 ? 'day' : 'days'} / week</Typography>}
    {plan.description && <Typography variant="body2">{plan.description}</Typography>}
    {plan.paymentMethodRule === 'CASH_ONLY' && <Alert severity="info">{plan.paymentInstructions}</Alert>}
  </Stack>;
}
export function PlansPricing() {
  const plans = usePlans();
  return <Stack gap={2}>
    <Typography variant="h4">Plans & Pricing</Typography>
    {plans.isError && <Alert severity="error">Unable to load plans.</Alert>}
    {plans.isPending && <Typography>Loading plans…</Typography>}
    {['LESSON_PACKAGE', 'PART_BOARD', 'ASSESSMENT', 'SINGLE_PURCHASE', 'SERVICE', 'CAMP'].map((category) => <Box key={category}>
      <Typography variant="h5" sx={{ mb: 1 }}>{readable(category)}</Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))', xl: 'repeat(3, minmax(0, 1fr))' }, gap: 2 }}>{plans.data?.filter((plan) => plan.category === category).map((plan) => <Card key={plan.id} sx={{ borderTop: '3px solid', borderTopColor: 'secondary.main' }}><CardContent>
        <PlanTerms plan={plan} />
        <Chip size="small" label={plan.active ? 'ACTIVE' : 'INACTIVE'} color={plan.active ? 'success' : 'default'} sx={{ mt: 1 }} />
        <Typography variant="caption" display="block">Effective {plan.effectiveFrom} to {plan.effectiveTo ?? 'ongoing'}</Typography>
      </CardContent></Card>)}</Box>
    </Box>)}
  </Stack>;
}
export function RiderPlans({ riderId }: { riderId: string }) {
  const today = barnToday(useBarnTimeZone());
  const query = useEnrollments(today, riderId);
  const plans = usePlans();
  const client = useQueryClient();
  const [draft, setDraft] = useState<EnrollmentInput & { id?: string }>();
  const recurring = useQuery({ queryKey: ['recurring-lessons'], queryFn: () => api<{ id: string; status: string; startDate: string; endDate: string | null; dayOfWeek: string; lesson: { riderId: string; startTime: string; endTime: string } }[]>('/api/recurring-lessons') });
  const mutation = useMutation({
    mutationFn: (input: EnrollmentInput & { id?: string }) => api(`/api/enrollments${input.id ? `/${input.id}` : ''}`, { method: input.id ? 'PUT' : 'POST', body: JSON.stringify(input) }),
    onSuccess: () => { setDraft(undefined); void client.invalidateQueries({ queryKey: ['enrollments'] }); },
  });
  return <Stack gap={1} sx={{ mt: 2 }}>
    <Typography variant="subtitle2">Plans & Entitlements</Typography>
    {query.isError && <Alert severity="error">Unable to load enrollments.</Alert>}
    {query.data?.map((entry) => <Box key={entry.id}>
      <PlanTerms plan={entry.plan} />
      <Typography variant="body2">{entry.effective ? 'ACTIVE' : entry.status === 'ACTIVE' ? 'EXPIRED' : entry.status} · {entry.startDate} to {entry.endDate ?? 'ongoing'}</Typography>
      {entry.entitlements.map((balance) => <Typography key={balance.id} variant="body2">{balance.name} · {balance.used} / {balance.allocated} used · {balance.remaining} remaining · {balance.periodStart} to {balance.periodEnd}</Typography>)}
      <Button size="small" onClick={() => { mutation.reset(); setDraft(entry); }}>Edit enrollment</Button>
    </Box>)}
    <Button size="small" sx={{ alignSelf: 'flex-start' }} onClick={() => { mutation.reset(); setDraft({ riderId, planId: '', startDate: today, endDate: null, status: 'ACTIVE', notes: '' }); }}>Enroll in a plan</Button>
    {recurring.data?.filter((template) => template.lesson.riderId === riderId && template.status === 'ACTIVE' && (!template.endDate || template.endDate >= today)).map((template) => <Typography variant="body2" key={template.id}>Upcoming recurring ride · {readable(template.dayOfWeek)} {template.lesson.startTime}–{template.lesson.endTime} · from {template.startDate}</Typography>)}
    {draft && <Dialog open onClose={() => setDraft(undefined)} fullWidth maxWidth="sm"><DialogTitle>Rider plan enrollment</DialogTitle><DialogContent><Stack gap={2} sx={{ pt: 1 }}>
      <ChoiceField label="Plan" value={draft.planId} options={plans.data?.filter((plan) => plan.category === 'LESSON_PACKAGE' || plan.id === draft.planId).map((plan) => ({ id: plan.id, label: `${plan.name} · ${planPrice(plan)}` })) ?? []} onChange={(planId) => setDraft({ ...draft, planId })} />
      <TextField label="Start date" type="date" value={draft.startDate} onChange={(event) => setDraft({ ...draft, startDate: event.target.value })} slotProps={{ inputLabel: { shrink: true } }} />
      <TextField label="End date" type="date" value={draft.endDate ?? ''} onChange={(event) => setDraft({ ...draft, endDate: event.target.value || null })} slotProps={{ inputLabel: { shrink: true } }} />
      <ChoiceField label="Status" value={draft.status} options={['ACTIVE', 'PAUSED', 'ENDED'].map((id) => ({ id, label: id }))} onChange={(status) => setDraft({ ...draft, status: status as EnrollmentInput['status'] })} />
      <TextField label="Notes" value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} />
      {mutation.isError && <Alert severity="error">{errorMessage(mutation.error)}</Alert>}
    </Stack></DialogContent><DialogActions><Button onClick={() => setDraft(undefined)}>Cancel</Button><Button variant="contained" disabled={mutation.isPending || !enrollmentSchema.safeParse(draft).success} onClick={() => mutation.mutate(draft)}>Save enrollment</Button></DialogActions></Dialog>}
  </Stack>;
}
