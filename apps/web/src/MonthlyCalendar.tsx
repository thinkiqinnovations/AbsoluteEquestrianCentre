import { Alert, Box, Button, Card, Chip, CircularProgress, Stack, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { addDays, monday, weekdays } from '@absolute/shared';
import { api } from './api';
import { formatDate, formatTime, scheduleKeys } from './scheduling';
import { matchesFilters, ScheduleFilters, type CalendarLesson, type Filters } from './ScheduleFilters';
import { ServiceActivities } from './ServiceActivities';

const lessonPreviewLimit = 3;
const gridColumns = 'repeat(7, minmax(0, 1fr))';
type MonthDay = {
  date: string;
  lessons: CalendarLesson[];
  conflicts: { lessonId: string; severity: 'ERROR' | 'WARNING'; code: string }[];
  horsesNearCapacity: string[];
};
type Month = { month: { start: string; end: string }; days: MonthDay[] };

export function MonthlyCalendar({ date, filters, onFilter, onDay, onEdit }: {
  date: string;
  filters: Filters;
  onFilter: (filters: Filters) => void;
  onDay: (date: string) => void;
  onEdit: (lesson: CalendarLesson) => void;
}) {
  const year = date.slice(0, 4);
  const month = date.slice(5, 7);
  const query = useQuery({
    queryKey: scheduleKeys.month(year, month),
    queryFn: () => api<Month>(`/api/schedule/month?year=${year}&month=${month}`),
  });
  if (query.isPending) return <CircularProgress />;
  if (query.isError) return <Alert severity="error">Unable to load the monthly schedule.</Alert>;

  const allLessons = query.data.days.flatMap((day) => day.lessons);
  const days = query.data.days.map((day) => {
    const lessons = day.lessons.filter((lesson) => matchesFilters(lesson, filters));
    const notices = day.conflicts.filter(({ lessonId }) => lessons.some(({ id }) => id === lessonId));
    return {
      date: day.date,
      lessons,
      errors: notices.filter(({ severity }) => severity === 'ERROR').length,
      availability: notices.filter(({ code }) => code.includes('AVAILABILITY') || code.endsWith('_UNAVAILABLE')).length,
      workload: day.horsesNearCapacity.filter((horseId) => lessons.some((lesson) => lesson.horseId === horseId && lesson.status !== 'CANCELLED')).length,
    };
  });
  const { start, end } = query.data.month;
  const first = monday(start);
  const last = addDays(monday(end), 6);
  const grid = [];
  for (let current = first; current <= last; current = addDays(current, 1)) grid.push(current);
  const lessonCount = days.reduce((total, day) => total + day.lessons.length, 0);

  function cell(day: typeof days[number], mobile = false) {
    const heading = formatDate(day.date, mobile ? { weekday: 'short', month: 'short', day: 'numeric' } : { day: 'numeric' });
    return <Stack key={day.date} gap={0.5} sx={{ minWidth: 0, p: 1, minHeight: mobile ? 0 : 116, border: 1, borderColor: 'divider' }}>
      <Button size="small" onClick={() => onDay(day.date)} aria-label={`Open day ${day.date}`}
        sx={{ justifyContent: 'space-between', flexWrap: 'wrap', px: 0.5, minWidth: 0, gap: 0.5 }}>
        <strong>{heading}</strong><span>{day.lessons.length} {day.lessons.length === 1 ? 'lesson' : 'lessons'}</span>
      </Button>
      {day.lessons.slice(0, lessonPreviewLimit).map((lesson) => <Button key={lesson.id} size="small" onClick={() => onEdit(lesson)}
        aria-label={`Edit ${lesson.rider.firstName} ${lesson.rider.lastName} on ${day.date} at ${lesson.startTime}`}
        sx={{ justifyContent: 'flex-start', textAlign: 'left', minWidth: 0, px: 0.5, overflowWrap: 'anywhere' }}>
        {formatTime(lesson.startTime)} · {lesson.lessonType === 'PART_BOARD_RIDE' && 'PB · '}{lesson.rider.firstName} {lesson.rider.lastName[0]}. / {lesson.horse.name}
      </Button>)}
      {day.lessons.length > lessonPreviewLimit && <Button size="small" onClick={() => onDay(day.date)}>+{day.lessons.length - lessonPreviewLimit} more</Button>}
      {day.errors > 0 && <Button size="small" color="error" onClick={() => onDay(day.date)}>Conflicts · {day.errors}</Button>}
      {day.availability > 0 && <Button size="small" color="warning" onClick={() => onDay(day.date)}>Availability · {day.availability}</Button>}
      {day.workload > 0 && <Button size="small" color="warning" onClick={() => onDay(day.date)}>Near capacity · {day.workload}</Button>}
      <ServiceActivities start={start} end={end} date={day.date} filters={filters} />
      {day.lessons.length === 0 && !mobile && <Box onClick={() => onDay(day.date)} sx={{ cursor: 'pointer', flexGrow: 1 }} />}
    </Stack>;
  }

  return <Stack gap={2} minWidth={0}>
    <ScheduleFilters lessons={allLessons} filters={filters} onChange={onFilter} />
    <Stack direction="row" gap={1} flexWrap="wrap">
      <Chip label={`${lessonCount} lessons`} />
      <Chip label={`${days.filter((day) => day.lessons.length).length} days with lessons`} />
      <Chip label={`${days.reduce((sum, day) => sum + day.errors, 0)} conflicts`} />
      <Chip label={`${days.reduce((sum, day) => sum + day.workload, 0)} workload warnings`} />
    </Stack>
    {lessonCount === 0 && <Typography color="text.secondary">No lessons match this month.</Typography>}
    <Card sx={{ display: { xs: 'none', md: 'grid' }, gridTemplateColumns: gridColumns }}>
      {weekdays.map((day) => <Typography key={day} variant="body2" fontWeight={700} sx={{ p: 1 }}>{day.slice(0, 3)}</Typography>)}
      {grid.map((current) => {
        const day = days.find((entry) => entry.date === current);
        return day ? cell(day) : <Button key={current} size="small" onClick={() => onDay(current)} aria-label={`Open day ${current}`}
          sx={{ color: 'text.secondary', bgcolor: 'action.hover', alignItems: 'start', justifyContent: 'start', minWidth: 0 }}>{Number(current.slice(8))}</Button>;
      })}
    </Card>
    <Card aria-label="Monthly agenda" sx={{ display: { xs: 'block', md: 'none' }, maxHeight: '65vh', overflowY: 'auto' }}>
      {days.map((day) => cell(day, true))}
    </Card>
  </Stack>;
}
