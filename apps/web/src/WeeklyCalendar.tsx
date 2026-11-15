import { Alert, Box, Button, Card, Chip, CircularProgress, Stack, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { operatingHours, weekDates } from '@absolute/shared';
import { api } from './api';
import { formatDate, formatTime, scheduleKeys } from './scheduling';
import { matchesFilters, personName as name, ScheduleFilters, type CalendarLesson, type Filters } from './ScheduleFilters';

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
  if (query.isPending) return <CircularProgress />;
  if (query.isError) return <Alert severity="error">Unable to load the weekly schedule.</Alert>;
  const { lessons, summary, conflicts } = query.data;
  const visible = lessons.filter((lesson) => matchesFilters(lesson, filters));
  const dates = weekDates(start);
  const firstHour = Math.min(operatingHours.start, ...visible.map((lesson) => Math.floor(minutes(lesson.startTime) / 60)));
  const lastHour = Math.max(operatingHours.end, ...visible.map((lesson) => Math.ceil(minutes(lesson.endTime) / 60)));
  const hours = Array.from({ length: lastHour - firstHour }, (_, index) => firstHour + index);
  const columns = '84px repeat(7, minmax(132px, 1fr))';

  return <Stack gap={2}>
    <ScheduleFilters lessons={lessons} filters={filters} onChange={onFilter} />
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
                    {lesson.coach?.firstName ?? 'Self ride'} · {lesson.discipline === 'FLAT' ? 'Flat' : 'Jump'}
                    {lesson.lessonType === 'SEMI_PRIVATE' && ' · Semi-private'}
                    {lesson.lessonType === 'GROUP' && ' · Group'}
                    {lesson.lessonType === 'PART_BOARD_RIDE' && ' · Part board'}
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
