import { Alert, Box, Button, Card, Chip, CircularProgress, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { disciplines, operatingHours, weekDates, type LessonInput } from '@absolute/shared';
import { useState } from 'react';
import { api } from './api';
import { formatDate, formatTime } from './scheduling';

type Person = { id: string; firstName: string; lastName: string };
type WeekLesson = LessonInput & {
  id: string;
  rider: Person;
  coach: Person;
  horse: { id: string; name: string };
};
type Week = {
  lessons: WeekLesson[];
  summary: { lessonCount: number; conflictCount: number; horsesNearCapacity: number };
  conflicts: { lessonId: string; severity: 'ERROR' | 'WARNING'; message: string }[];
};
const empty = { coachId: '', horseId: '', riderId: '', discipline: '' };
const name = (person: Person) => `${person.firstName} ${person.lastName}`;
const clock = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));

export function WeeklyCalendar({ start, onAdd, onEdit }: {
  start: string;
  onAdd: (date: string, startTime: string, endTime: string) => void;
  onEdit: (lesson: WeekLesson) => void;
}) {
  const [filters, setFilters] = useState(empty);
  const query = useQuery({ queryKey: ['schedule', 'week', start], queryFn: () => api<Week>(`/api/schedule/week?start=${start}`) });
  if (query.isPending) return <CircularProgress />;
  if (query.isError) return <Alert severity="error">Unable to load the weekly schedule.</Alert>;
  const { lessons, summary, conflicts } = query.data;
  const options = [
    { field: 'coachId', label: 'Coach', values: lessons.map(({ coach }) => [coach.id, name(coach)]) },
    { field: 'horseId', label: 'Horse', values: lessons.map(({ horse }) => [horse.id, horse.name]) },
    { field: 'riderId', label: 'Rider', values: lessons.map(({ rider }) => [rider.id, name(rider)]) },
    { field: 'discipline', label: 'Discipline', values: disciplines.map((value) => [value, value === 'FLAT' ? 'Flat' : 'Jump']) },
  ] as const;
  const visible = lessons.filter((lesson) => options.every(({ field, values }) =>
    !filters[field] || !values.some(([id]) => id === filters[field]) || lesson[field] === filters[field]));
  const dates = weekDates(start);
  const firstHour = Math.min(operatingHours.start, ...visible.map((lesson) => Math.floor(minutes(lesson.startTime) / 60)));
  const lastHour = Math.max(operatingHours.end, ...visible.map((lesson) => Math.ceil(minutes(lesson.endTime) / 60)));
  const hours = Array.from({ length: lastHour - firstHour }, (_, index) => firstHour + index);
  const columns = '84px repeat(7, minmax(132px, 1fr))';

  return <Stack gap={2}>
    <Stack direction="row" gap={1} flexWrap="wrap" alignItems="center">
      {options.map(({ field, label, values }) => <TextField key={field} select size="small" label={label}
        value={values.some(([id]) => id === filters[field]) ? filters[field] : ''}
        onChange={(event) => setFilters({ ...filters, [field]: event.target.value })} sx={{ minWidth: 130 }}
        slotProps={{ inputLabel: { shrink: true }, select: { displayEmpty: true } }}>
        <MenuItem value="">All</MenuItem>
        {[...new Map(values.map(([id, text]) => [id, text]))].map(([id, text]) => <MenuItem key={id} value={id}>{text}</MenuItem>)}
      </TextField>)}
      <Button onClick={() => setFilters(empty)}>Clear filters</Button>
    </Stack>
    <Stack direction="row" gap={1} flexWrap="wrap">
      <Chip label={`${summary.lessonCount} lessons`} />
      <Chip label={`${summary.horsesNearCapacity} horses near workload limit`} />
      <Chip label={`${summary.conflictCount} scheduling notices`} />
    </Stack>
    <Card sx={{ overflowX: 'auto' }}>
      <Box sx={{ display: 'grid', gridTemplateColumns: columns, minWidth: 1008 }}>
        <Typography sx={{ p: 1 }}>Time</Typography>
        {dates.map((date) => <Typography key={date} fontWeight={700} sx={{ p: 1 }}>
          {formatDate(date, { weekday: 'short', month: 'short', day: 'numeric' })}
        </Typography>)}
        {hours.map((hour) => {
          const startTime = clock(hour * 60);
          return <Box key={hour} sx={{ display: 'contents' }}>
            <Typography variant="body2" sx={{ p: 1, borderTop: 1, borderColor: 'divider' }}>{formatTime(startTime)}</Typography>
            {dates.map((date) => <Stack key={date} gap={0.5} sx={{ p: 0.5, minHeight: 56, borderTop: 1, borderLeft: 1, borderColor: 'divider' }}>
              {visible.filter((lesson) => lesson.date === date && Math.floor(minutes(lesson.startTime) / 60) === hour).map((lesson) =>
                <Button key={lesson.id} size="small" variant="contained" onClick={() => onEdit(lesson)}
                  sx={{ display: 'block', textAlign: 'left', overflowWrap: 'anywhere', opacity: lesson.status === 'CANCELLED' ? 0.65 : 1 }}>
                  <Typography component="span" display="block" variant="caption">{formatTime(lesson.startTime)} – {formatTime(lesson.endTime)}</Typography>
                  <Typography component="span" display="block" variant="body2">{name(lesson.rider)} · {lesson.horse.name}</Typography>
                  <Typography component="span" display="block" variant="caption">
                    {lesson.coach.firstName} · {lesson.discipline === 'FLAT' ? 'Flat' : 'Jump'}
                    {lesson.lessonType === 'SEMI_PRIVATE' && ' · Semi-private'}
                    {lesson.lessonType === 'GROUP' && ' · Group'}
                    {lesson.status === 'CANCELLED' && ' · Cancelled'}
                  </Typography>
                </Button>)}
              {hour < 23 && <Button size="small" sx={{ mt: 'auto' }}
                aria-label={`Add lesson on ${date} at ${formatTime(startTime)}`}
                onClick={() => onAdd(date, startTime, clock((hour + 1) * 60))}>+</Button>}
            </Stack>)}
          </Box>;
        })}
      </Box>
    </Card>
    {conflicts.filter(({ lessonId }) => visible.some(({ id }) => id === lessonId)).map((conflict, index) =>
      <Alert key={`${conflict.lessonId}-${index}`} severity={conflict.severity === 'ERROR' ? 'error' : 'warning'}>{conflict.message}</Alert>)}
  </Stack>;
}
