import { Alert, Button, Stack, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { activityLabels } from '@absolute/shared';
import { ActivityDialog, mountedActivity, type ActivityRecord } from './ActivityDialog';
import { api } from './api';
import { formatTime } from './scheduling';
import type { Filters } from './ScheduleFilters';

export function ServiceActivities({ start, end, date, hour, filters }: { start: string; end: string; date: string; hour?: number; filters: Filters }) {
  const [editing, setEditing] = useState<string>();
  const query = useQuery({ queryKey: ['activities', start, end], queryFn: () => api<ActivityRecord[]>(`/api/activities?start=${start}&end=${end}`) });
  const entries = query.data?.filter((entry) => !mountedActivity(entry.activityType) && entry.date <= date && (entry.endDate ?? entry.date) >= date &&
    (hour === undefined || Number(entry.startTime.slice(0, 2)) === hour) && (!filters.coachId || entry.coachId === filters.coachId) &&
    (!filters.riderId || entry.participants.some(({ riderId }) => riderId === filters.riderId)) && !filters.horseId && !filters.lessonType && !filters.discipline) ?? [];
  return <Stack gap={0.5} minWidth={0}>
    {query.isError && <Alert severity="error">Unable to load service activities.</Alert>}
    {entries.map((entry) => <Button key={entry.id} size="small" variant="outlined" onClick={() => setEditing(entry.id)} sx={{ minWidth: 0, textAlign: 'left', display: 'block', overflowWrap: 'anywhere' }}>
      <Typography variant="caption" component="span" display="block">{activityLabels[entry.activityType]} · {entry.status}</Typography>
      <Typography variant="caption" component="span" display="block">{formatTime(entry.startTime)}–{formatTime(entry.endTime)} · {entry.participants.length} riders{entry.location ? ` · ${entry.location}` : ''}</Typography>
    </Button>)}
    {editing && <ActivityDialog activityId={editing} date={date} onClose={() => setEditing(undefined)} onSaved={() => {}} />}
  </Stack>;
}
