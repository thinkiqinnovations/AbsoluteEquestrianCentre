import { Checkbox, FormControlLabel, Stack, TextField, Typography } from '@mui/material';
import { weekdays, type CoachWeeklyAvailability as WeeklyAvailability } from '@absolute/shared';
import type { Dispatch, SetStateAction } from 'react';

export function CoachWeeklyAvailability({ value, onChange }: {
  value: WeeklyAvailability;
  onChange: Dispatch<SetStateAction<WeeklyAvailability>>;
}) {
  return <Stack component="fieldset" gap={1} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, m: 0, minWidth: 0 }}>
    <Typography component="legend" fontWeight={700}>Weekly availability</Typography>
    <Typography variant="body2" color="text.secondary">Select the days this coach is available. Leave every day unchecked if their schedule is unknown.</Typography>
    {weekdays.map((dayOfWeek) => {
      const day = dayOfWeek[0] + dayOfWeek.slice(1).toLowerCase();
      const window = value.find((entry) => entry.dayOfWeek === dayOfWeek);
      return <Stack key={dayOfWeek} direction={{ xs: 'column', sm: 'row' }} alignItems={{ sm: 'center' }} gap={1}>
        <FormControlLabel sx={{ minWidth: 130 }} label={day} control={<Checkbox checked={Boolean(window)}
          onChange={(_, checked) => onChange((current) => checked
            ? [...current, { dayOfWeek, startTime: '09:00', endTime: '17:00' }]
            : current.filter((entry) => entry.dayOfWeek !== dayOfWeek))} />} />
        {window && <Stack direction="row" gap={1}>
          {(['startTime', 'endTime'] as const).map((field) =>
            <TextField key={field} size="small" type="time" label={field === 'startTime' ? 'Start' : 'End'}
              value={window[field]} slotProps={{ inputLabel: { shrink: true }, htmlInput: { 'aria-label': `${day} ${field === 'startTime' ? 'start time' : 'end time'}` } }}
              error={window.startTime >= window.endTime}
              onChange={(event) => {
                const time = event.target.value;
                onChange((current) => current.map((entry) => entry.dayOfWeek === dayOfWeek ? { ...entry, [field]: time } : entry));
              }} />)}
        </Stack>}
      </Stack>;
    })}
  </Stack>;
}
