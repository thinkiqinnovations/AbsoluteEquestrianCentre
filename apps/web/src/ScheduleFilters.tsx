import { Button, MenuItem, Stack, TextField } from '@mui/material';
import { disciplines, lessonTypes, type LessonInput } from '@absolute/shared';

type Person = { id: string; firstName: string; lastName: string };
export type CalendarLesson = LessonInput & {
  id: string;
  rider: Person;
  coach?: Person | null;
  horse: { id: string; name: string };
};
export const emptyFilters = { coachId: '', horseId: '', riderId: '', discipline: '', lessonType: '' };
export type Filters = typeof emptyFilters;
export const personName = (person: Person) => `${person.firstName} ${person.lastName}`;

export function matchesFilters(lesson: CalendarLesson, filters: Filters) {
  return (Object.keys(filters) as (keyof Filters)[]).every((key) => !filters[key] || lesson[key] === filters[key]);
}

export function ScheduleFilters({ lessons, filters, onChange }: {
  lessons: CalendarLesson[];
  filters: Filters;
  onChange: (filters: Filters) => void;
}) {
  const options = [
    { field: 'coachId', label: 'Coach', values: lessons.flatMap(({ coach }) => coach ? [[coach.id, personName(coach)]] : []) },
    { field: 'horseId', label: 'Horse', values: lessons.map(({ horse }) => [horse.id, horse.name]) },
    { field: 'riderId', label: 'Rider', values: lessons.map(({ rider }) => [rider.id, personName(rider)]) },
    { field: 'discipline', label: 'Discipline', values: disciplines.map((value) => [value, value === 'FLAT' ? 'Flat' : 'Jump']) },
    { field: 'lessonType', label: 'Lesson type', values: lessonTypes.map((value) => [value, ({
      PRIVATE: 'Private', SEMI_PRIVATE: 'Semi-private', GROUP: 'Group', PART_BOARD_RIDE: 'Part-board ride',
    })[value]]) },
  ] as const;
  return <Stack direction="row" gap={1} flexWrap="wrap" alignItems="center">
    {options.map(({ field, label, values }) => {
      const choices = new Map(values.map(([id, text]) => [id, text]));
      const selected = filters[field];
      return <TextField key={field} select size="small" label={label} value={selected}
        onChange={(event) => onChange({ ...filters, [field]: event.target.value })} sx={{ minWidth: 130 }}
        slotProps={{ inputLabel: { shrink: true }, select: { displayEmpty: true } }}>
        <MenuItem value="">All</MenuItem>
        {selected && !choices.has(selected) && <MenuItem value={selected}>No matching bookings</MenuItem>}
        {[...choices].map(([id, text]) => <MenuItem key={id} value={id}>{text}</MenuItem>)}
      </TextField>;
    })}
    <Button onClick={() => onChange(emptyFilters)}>Clear filters</Button>
  </Stack>;
}
