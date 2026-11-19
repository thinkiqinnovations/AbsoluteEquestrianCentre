import { Alert, Box, Button, Card, Chip, CircularProgress, Stack, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { operatingHours, weekDates } from '@absolute/shared';
import { api } from './api';
import { formatDate, formatTime, scheduleKeys } from './scheduling';
import { matchesFilters, personName as name, ScheduleFilters, type CalendarLesson, type Filters } from './ScheduleFilters';
import { ServiceActivities } from './ServiceActivities';
import type { ActivityRecord } from './ActivityDialog';

type Week = {
  lessons: CalendarLesson[];
  summary: { lessonCount: number; conflictCount: number; horsesNearCapacity: number };
  conflicts: { lessonId: string; severity: 'ERROR' | 'WARNING'; message: string }[];
};
const clock = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));

export function WeeklyCalendar({ start, onAdd, onEdit, filters, onFilter }: {
  start: string;
  filters: Filters;
  onFilter: (filters: Filters) => void;
  onAdd: (date: string, startTime: string, endTime: string) => void;
  onEdit: (lesson: CalendarLesson) => void;
}) {
  const query = useQuery({ queryKey: scheduleKeys.week(start), queryFn: () => api<Week>(`/api/schedule/week?start=${start}`) });
  const dates = weekDates(start);
  const activities = useQuery({ queryKey: ['activities', dates[0], dates[6]], queryFn: () => api<ActivityRecord[]>(`/api/activities?start=${dates[0]}&end=${dates[6]}`) });
  if (query.isPending) return <CircularProgress />;
  if (query.isError) return <Alert severity="error">Unable to load the weekly schedule.</Alert>;
  const { lessons, summary, conflicts } = query.data;
  const visible = lessons.filter((lesson) => matchesFilters(lesson, filters));
  const notices = (lessonId: string) => {
    const entries = conflicts.filter((conflict) => conflict.lessonId === lessonId);
    if (!entries.length) return null;
    const error = entries.some(({ severity }) => severity === 'ERROR');
    return <Chip component="span" size="small" color={error ? 'error' : 'warning'}
      label={error ? 'Conflict' : 'Warning'} title={[...new Set(entries.map(({ message }) => message))].join('\n')} />;
  };
  const reservations = activities.data ?? [];
  const firstHour = Math.min(operatingHours.start, ...[...visible, ...reservations].map((lesson) => Math.floor(minutes(lesson.startTime) / 60)));
  const lastHour = Math.max(operatingHours.end, ...[...visible, ...reservations].map((lesson) => Math.ceil(minutes(lesson.endTime) / 60)));
  const hours = Array.from({ length: lastHour - firstHour }, (_, index) => firstHour + index);
  const columns = '84px repeat(7, minmax(132px, 1fr))';

  return <Stack gap={2}>
    <ScheduleFilters lessons={lessons} filters={filters} onChange={onFilter} />
    <Stack direction="row" gap={1} flexWrap="wrap">
      <Chip label={`${summary.lessonCount} lessons`} />
      <Chip label={`${summary.horsesNearCapacity} horses near workload limit`} />
      <Chip label={`${summary.conflictCount} scheduling notices`} />
    </Stack>
    <Card sx={{ display: { xs: 'none', md: 'block' }, overflowX: 'auto' }}>
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
                  {notices(lesson.id)}
                  <Typography component="span" display="block" variant="caption">
                    {lesson.coach?.firstName ?? 'Self ride'} · {lesson.discipline === 'FLAT' ? 'Flat' : 'Jump'}
                    {lesson.lessonType === 'SEMI_PRIVATE' && ' · Semi-private'}
                    {lesson.lessonType === 'GROUP' && ' · Group'}
                    {lesson.lessonType === 'PART_BOARD_RIDE' && ' · Part board'}
                    {lesson.status === 'CANCELLED' && ' · Cancelled'}
                  </Typography>
                </Button>)}
              <ServiceActivities start={dates[0]} end={dates[6]} date={date} hour={hour} filters={filters} />
              {hour < 23 && <Button size="small" sx={{ mt: 'auto' }}
                aria-label={`Add lesson on ${date} at ${formatTime(startTime)}`}
                onClick={() => onAdd(date, startTime, clock((hour + 1) * 60))}>+</Button>}
            </Stack>)}
          </Box>;
        })}
      </Box>
    </Card>
    <Card aria-label="Weekly agenda" sx={{ display: { xs: 'block', md: 'none' }, maxHeight: '65vh', overflowY: 'auto' }}>
      {dates.map((date) => {
        const dayLessons = visible.filter((lesson) => lesson.date === date)
          .sort((left, right) => left.startTime.localeCompare(right.startTime) || left.endTime.localeCompare(right.endTime) || name(left.rider).localeCompare(name(right.rider)));
        return <Stack component="section" key={date} gap={1} sx={{ p: 1.5, borderBottom: 1, borderColor: 'divider' }}>
          <Typography fontWeight={700}>{formatDate(date, { weekday: 'long', month: 'short', day: 'numeric' })}</Typography>
          <Typography variant="body2" color="text.secondary">{dayLessons.length} {dayLessons.length === 1 ? 'lesson' : 'lessons'}</Typography>
          {dayLessons.map((lesson) => <Button key={lesson.id} variant="outlined" onClick={() => onEdit(lesson)}
            aria-label={`Edit ${name(lesson.rider)} on ${date} at ${lesson.startTime}`}
            sx={{ display: 'block', textAlign: 'left', overflowWrap: 'anywhere', opacity: lesson.status === 'CANCELLED' ? 0.65 : 1 }}>
            <Typography component="span" display="block" variant="body2" fontWeight={700}>{formatTime(lesson.startTime)} – {formatTime(lesson.endTime)}</Typography>
            <Typography component="span" display="block" variant="body2">{name(lesson.rider)} · {lesson.horse.name}</Typography>
            {notices(lesson.id)}
            <Typography component="span" display="block" variant="caption">
              {lesson.coach ? name(lesson.coach) : 'Self ride'} · {lesson.discipline === 'FLAT' ? 'Flat' : 'Jump'}
              {lesson.lessonType === 'SEMI_PRIVATE' && ' · Semi-private'}
              {lesson.lessonType === 'GROUP' && ' · Group'}
              {lesson.lessonType === 'PART_BOARD_RIDE' && ' · Part board'}
              {lesson.status === 'CANCELLED' && ' · Cancelled'}
            </Typography>
          </Button>)}
          <ServiceActivities start={dates[0]} end={dates[6]} date={date} filters={filters} />
          {dayLessons.length === 0 && <Typography variant="body2" color="text.secondary">No lessons scheduled.</Typography>}
          <Button size="small" sx={{ alignSelf: 'flex-start' }} aria-label={`Add lesson on ${date}`}
            onClick={() => onAdd(date, clock(operatingHours.start * 60), clock((operatingHours.start + 1) * 60))}>Add lesson</Button>
        </Stack>;
      })}
    </Card>
    {conflicts.filter(({ lessonId }) => visible.some(({ id }) => id === lessonId)).map((conflict, index) =>
      <Alert key={`${conflict.lessonId}-${index}`} severity={conflict.severity === 'ERROR' ? 'error' : 'warning'}>{conflict.message}</Alert>)}
  </Stack>;
}
