import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { availabilityTypes, barnToday, overrideReasons, weekdays, type AvailabilityRecords, type AvailabilityRule, type AvailabilityOverride, type Resource } from '@absolute/shared';
import { useState } from 'react';
import { api } from './api';
import { formatTime, useBarnTimeZone } from './scheduling';

type Window = AvailabilityRule | AvailabilityOverride;
type Draft = {
  id?: string;
  dayOfWeek?: string;
  date?: string;
  startTime: string;
  endTime: string;
  availabilityType: string;
  notes?: string | null;
  reason?: string | null;
};
const label = (value: string) => value[0] + value.slice(1).toLowerCase().replaceAll('_', ' ');
const initial = { startTime: '09:00', endTime: '17:00', availabilityType: 'AVAILABLE' };

export function AvailabilityEditor({ resource, name, close }: { resource: Resource; name: string; close: () => void }) {
  const client = useQueryClient();
  const zone = useBarnTimeZone();
  const key = ['availability', resource.resourceType, resource.resourceId];
  const query = useQuery({ queryKey: key, queryFn: () => api<AvailabilityRecords>(`/api/availability/${resource.resourceType}/${encodeURIComponent(resource.resourceId)}`) });
  const [draft, setDraft] = useState<Draft>();
  const [error, setError] = useState('');
  const edit = (value?: Draft) => { setDraft(value); setError(''); };
  const mutation = useMutation({
    mutationFn: ({ window, remove }: { window: Draft; remove?: boolean }) => {
      const { id, dayOfWeek, date, startTime, endTime, availabilityType, reason, notes } = window;
      const fields = { startTime, endTime, availabilityType, notes: notes || null };
      const data = date !== undefined ? { ...fields, date, reason: reason || null } : { ...fields, dayOfWeek };
      return api(`/api/availability/${date !== undefined ? 'overrides' : 'rules'}${id ? `/${id}` : ''}`, {
        method: remove ? 'DELETE' : id ? 'PATCH' : 'POST',
        body: remove ? undefined : JSON.stringify(id ? data : { ...data, ...resource }),
      });
    },
    onSuccess: () => {
      edit();
      void client.invalidateQueries({ queryKey: ['availability'] });
      void client.invalidateQueries({ queryKey: ['schedule'] });
    },
    onError: (response: { error?: { message?: string } }) => setError(response.error?.message ?? 'Check the date and times and try again.'),
  });
  const row = (item: Window) => <Stack key={item.id} direction="row" alignItems="center" gap={1} flexWrap="wrap">
    <Typography variant="body2" sx={{ flexGrow: 1 }}>
      {'date' in item && `${item.date} · `}{formatTime(item.startTime)} – {formatTime(item.endTime)} · {label(item.availabilityType)}
      {'reason' in item && item.reason && ` · ${label(item.reason)}`}{item.notes && ` · ${item.notes}`}
    </Typography>
    <Button size="small" disabled={mutation.isPending} onClick={() => edit(item)}>Edit</Button>
    <Button size="small" color="error" disabled={mutation.isPending} onClick={() => mutation.mutate({ window: item, remove: true })}>Delete</Button>
  </Stack>;

  return <Dialog open onClose={close} fullWidth maxWidth="sm">
    <DialogTitle>{name} · Availability</DialogTitle>
    <DialogContent dividers>
      <Stack gap={2}>
        <Typography variant="body2" color="text.secondary">Times use {zone}. Date overrides take precedence over weekly rules.</Typography>
        {query.isPending && <Typography>Loading availability…</Typography>}
        {query.isError && <Alert severity="error">Unable to load availability.</Alert>}
        {error && <Alert severity="error">{error}</Alert>}
        {draft && <Box component="form" onSubmit={(event) => { event.preventDefault(); mutation.mutate({ window: draft }); }} sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}>
          <Stack gap={1.5}>
            <Typography variant="h6">{draft.date !== undefined ? 'Date override' : 'Weekly window'}</Typography>
            {draft.date !== undefined
              ? <TextField label="Date" type="date" required value={draft.date} slotProps={{ inputLabel: { shrink: true } }} onChange={(event) => setDraft({ ...draft, date: event.target.value })} />
              : <TextField select label="Day" value={draft.dayOfWeek} onChange={(event) => setDraft({ ...draft, dayOfWeek: event.target.value })}>
                {weekdays.map((day) => <MenuItem key={day} value={day}>{label(day)}</MenuItem>)}
              </TextField>}
            <Stack direction="row" gap={1}>
              <TextField fullWidth required label="Start" type="time" value={draft.startTime} slotProps={{ inputLabel: { shrink: true } }} onChange={(event) => setDraft({ ...draft, startTime: event.target.value })} />
              <TextField fullWidth required label="End" type="time" value={draft.endTime} slotProps={{ inputLabel: { shrink: true } }} onChange={(event) => setDraft({ ...draft, endTime: event.target.value })} />
            </Stack>
            <TextField select label="Availability" value={draft.availabilityType} onChange={(event) => setDraft({ ...draft, availabilityType: event.target.value })}>
              {availabilityTypes.map((type) => <MenuItem key={type} value={type}>{label(type)}</MenuItem>)}
            </TextField>
            {draft.date !== undefined && <TextField select label="Reason" value={draft.reason ?? ''} onChange={(event) => setDraft({ ...draft, reason: event.target.value })}>
              <MenuItem value="">None</MenuItem>
              {overrideReasons.map((reason) => <MenuItem key={reason} value={reason}>{label(reason)}</MenuItem>)}
            </TextField>}
            <TextField label="Notes" value={draft.notes ?? ''} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} />
            {draft.startTime >= draft.endTime && <Alert severity="warning">End time must be after start time.</Alert>}
            <Stack direction="row" gap={1}>
              <Button onClick={() => edit()} disabled={mutation.isPending}>Cancel</Button>
              <Button variant="contained" type="submit" disabled={mutation.isPending || draft.startTime >= draft.endTime}>Save window</Button>
            </Stack>
          </Stack>
        </Box>}
        {query.data && <>
          <Typography variant="h6">Recurring weekly availability</Typography>
          {weekdays.map((day) => {
            const windows = query.data.rules.filter(({ dayOfWeek }) => dayOfWeek === day).sort((a, b) => a.startTime.localeCompare(b.startTime));
            return <Box key={day} sx={{ borderTop: 1, borderColor: 'divider', pt: 1 }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Typography fontWeight={700}>{label(day)}</Typography>
                <Button size="small" disabled={mutation.isPending} onClick={() => edit({ ...initial, dayOfWeek: day })}>Add time</Button>
              </Stack>
              {windows.length ? windows.map(row) : <Typography variant="body2" color="text.secondary">{query.data.rules.length ? 'Unavailable outside date overrides' : 'Availability not configured'}</Typography>}
            </Box>;
          })}
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography variant="h6">Date overrides</Typography>
            <Button disabled={mutation.isPending} onClick={() => edit({ ...initial, date: barnToday(zone), availabilityType: 'UNAVAILABLE' })}>Add override</Button>
          </Stack>
          {query.data.overrides.length ? [...query.data.overrides].sort((a, b) => a.date.localeCompare(b.date)).map(row)
            : <Typography variant="body2" color="text.secondary">No date overrides.</Typography>}
        </>}
      </Stack>
    </DialogContent>
    <DialogActions><Button onClick={close}>Close</Button></DialogActions>
  </Dialog>;
}
