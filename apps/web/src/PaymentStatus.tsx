import { Alert, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { paymentMonthSchema, recordedPaymentStatuses, type MonthlyPaymentKind, type PaymentStatusOverview, type RecordedPaymentStatus } from '@absolute/shared';
import { useState } from 'react';
import { api } from './api';
import { formatDate, formatTime } from './scheduling';
import { errorMessage } from './save-errors';

const statusLabels: Record<RecordedPaymentStatus, string> = { UNRECORDED: 'Not recorded', UNPAID: 'Unpaid', PAID: 'Paid' };

export function usePaymentStatus(month: string, riderId?: string, enabled = true) {
  return useQuery({
    queryKey: ['payment-status', month, riderId],
    queryFn: () => api<PaymentStatusOverview>(`/api/payment-status?${new URLSearchParams({ month, ...(riderId ? { riderId } : {}) })}`),
    enabled: enabled && paymentMonthSchema.safeParse(month).success,
  });
}

function lessonStatus(data: PaymentStatusOverview | undefined, lessonId: string) {
  return data?.lessonStatuses?.find((entry) => entry.lessonId === lessonId)?.status ?? 'UNRECORDED';
}

function monthlyStatus(data: PaymentStatusOverview | undefined, riderId: string, kind: MonthlyPaymentKind) {
  return data?.monthlyStatuses?.find((entry) => entry.riderId === riderId && entry.kind === kind)?.status ?? 'UNRECORDED';
}

export function PaymentIndicators({ data, riderId, lessonId, onEdit }: {
  data: PaymentStatusOverview | undefined; riderId: string; lessonId?: string; onEdit: () => void;
}) {
  const entries: { label: string; status: RecordedPaymentStatus }[] = [
    ...(lessonId ? [{ label: 'Lesson', status: lessonStatus(data, lessonId) }] : []),
    { label: 'Month', status: monthlyStatus(data, riderId, 'MONTHLY') },
    { label: 'Part board', status: monthlyStatus(data, riderId, 'PART_BOARD') },
  ];
  return <Stack direction="row" gap={0.75} flexWrap="wrap" alignItems="center">
    {data && entries.map(({ label, status }) => <Chip key={label} size="small" variant="outlined"
      color={status === 'PAID' ? 'success' : status === 'UNPAID' ? 'warning' : 'default'} label={`${label}: ${statusLabels[status]}`} />)}
    <Button size="small" onClick={onEdit}>Edit payment status</Button>
  </Stack>;
}

export type PaymentSelection = { riderId: string; riderName: string; month: string; lessonId?: string };

export function PaymentStatusDialog({ selection, onClose }: { selection: PaymentSelection; onClose: () => void }) {
  const { riderId, riderName, lessonId } = selection;
  const [month, setMonth] = useState(selection.month);
  const query = usePaymentStatus(month, riderId);
  const client = useQueryClient();
  const validMonth = paymentMonthSchema.safeParse(month).success;
  const mutation = useMutation({
    mutationFn: ({ path, status }: { path: string; status: RecordedPaymentStatus }) =>
      api(`/api/payment-status/${path}`, { method: 'PUT', body: JSON.stringify({ status }) }),
    onSuccess: async () => { await client.invalidateQueries({ queryKey: ['payment-status', month] }); },
  });
  const field = (label: string, path: string, status: RecordedPaymentStatus) =>
    <TextField select size="small" key={path} label={label} value={status} disabled={mutation.isPending || !query.isSuccess}
      onChange={(event) => mutation.mutate({ path, status: event.target.value as RecordedPaymentStatus })}>
      {recordedPaymentStatuses.map((status) => <MenuItem key={status} value={status}>{statusLabels[status]}</MenuItem>)}
    </TextField>;
  const monthlyPath = `riders/${encodeURIComponent(riderId)}/${month}`;
  const lessonField = (id: string, label: string) =>
    field(label, `lessons/${encodeURIComponent(id)}`, lessonStatus(query.data, id));
  return <Dialog open onClose={mutation.isPending ? undefined : onClose} fullWidth maxWidth="sm">
    <DialogTitle>Payment status · {riderName}</DialogTitle>
    <DialogContent dividers><Stack gap={2}>
      <Typography variant="body2" color="text.secondary">Status changes save automatically. Use these fields to record payments handled outside the scheduler.</Typography>
      {lessonId
        ? <Typography fontWeight={700}>{formatDate(`${month}-01`, { month: 'long', year: 'numeric' })}</Typography>
        : <TextField type="month" label="Month" value={month} disabled={mutation.isPending}
          slotProps={{ inputLabel: { shrink: true } }} onChange={(event) => { setMonth(event.target.value); mutation.reset(); }} />}
      {!validMonth && <Alert severity="warning">Select a valid month.</Alert>}
      {validMonth && query.isPending && <Typography>Loading payment status…</Typography>}
      {query.isError && <Alert severity="error">Unable to load payment status. Refresh the page and try again.</Alert>}
      {mutation.isError && <Alert severity="error">{errorMessage(mutation.error)}</Alert>}
      {mutation.isSuccess && <Alert severity="success">Payment status saved.</Alert>}
      {query.isSuccess && <>
        {field('Monthly payment', `${monthlyPath}/MONTHLY`, monthlyStatus(query.data, riderId, 'MONTHLY'))}
        {field('Part-board payment', `${monthlyPath}/PART_BOARD`, monthlyStatus(query.data, riderId, 'PART_BOARD'))}
        {lessonId ? lessonField(lessonId, 'Lesson payment') : <>
          <Typography variant="subtitle1" fontWeight={700}>Lessons in this month</Typography>
          {!(query.data.lessons?.length) && <Typography variant="body2">No lessons scheduled in this month.</Typography>}
          {query.data.lessons?.map((lesson) => lessonField(lesson.id,
            `${formatDate(lesson.date, { month: 'short', day: 'numeric' })} · ${formatTime(lesson.startTime)} · ${lesson.lessonType.toLowerCase().replaceAll('_', ' ')}`))}
        </>}
      </>}
    </Stack></DialogContent>
    <DialogActions><Button disabled={mutation.isPending} onClick={onClose}>Close</Button></DialogActions>
  </Dialog>;
}
