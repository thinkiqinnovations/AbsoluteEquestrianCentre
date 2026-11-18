import { Alert, Box, Button, Chip, ListSubheader, MenuItem, Paper, Stack, TextField, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { horseRecommendationSchema, type HorseRecommendationResult } from '@absolute/shared';
import { api } from './api';
import { errorMessage } from './save-errors';

export function useHorseRecommendations(fields: unknown) {
  const request = horseRecommendationSchema.safeParse(fields);
  return useQuery({
    queryKey: ['horse-recommendations', request.success ? request.data : null],
    enabled: request.success,
    queryFn: ({ signal }) => api<HorseRecommendationResult>('/api/recommendations/horses', {
      method: 'POST', body: JSON.stringify(request.data), signal,
    }),
    retry: false,
    staleTime: 0,
    gcTime: 0,
  });
}

export function LessonHorseRecommendations({ query, value, current, horseName, partBoard, onSelect }: {
  query: ReturnType<typeof useHorseRecommendations>;
  value: string;
  current?: string;
  horseName?: string;
  partBoard: boolean;
  onSelect: (horseId: string) => void;
}) {
  const result = query.data;
  const eligible = result?.recommendations ?? [];
  const ineligible = result?.ineligible ?? [];
  const selected = eligible.some(({ horseId }) => horseId === value);
  const unavailable = ineligible.find(({ horseId }) => horseId === value);
  const apiError = (query.error as { error?: { code?: string; message?: string } } | null)?.error;
  const outdatedApi = apiError?.code === 'NOT_FOUND' && !apiError.message;
  return <Stack gap={1.5}>
    <TextField select label="Horse" value={value} fullWidth disabled={!result || !(eligible.length || ineligible.length)}
      slotProps={{ inputLabel: { shrink: true }, select: { displayEmpty: true } }}
      onChange={(event) => onSelect(event.target.value)}>
      <MenuItem value="" disabled>Select a horse</MenuItem>
      {value && !selected && !unavailable && <MenuItem value={value} disabled>{horseName ?? 'Selected horse'}</MenuItem>}
      {eligible.slice(0, 1).map((horse) => <MenuItem key={horse.horseId} value={horse.horseId}>
        Recommended · {horse.horseName} · {horse.score} points{horse.horseId === current ? ' · Current horse' : ''}
      </MenuItem>)}
      {eligible.length > 1 && <ListSubheader>Other horses without booking concerns</ListSubheader>}
      {eligible.slice(1).map((horse) => <MenuItem key={horse.horseId} value={horse.horseId}>
        {horse.horseName} · {horse.score} points{horse.horseId === current ? ' · Current horse' : ''}
      </MenuItem>)}
      {ineligible.length > 0 && <ListSubheader>Horses to review</ListSubheader>}
      {ineligible.map((horse) => <MenuItem key={horse.horseId} value={horse.horseId}>
        {horse.horseName} · {horse.score == null ? '' : `${horse.score} points · `}Review{horse.horseId === current ? ' · Current horse' : ''}
      </MenuItem>)}
    </TextField>
    {current && horseName && value === current && <Typography variant="body2">Current horse: {horseName}</Typography>}
    {!result && !query.isFetching && !query.isError && <Typography variant="body2" color="text.secondary">Select a rider and enter valid lesson times and ride units to see horse scores.</Typography>}
    {query.isFetching && !result && <Typography variant="body2" role="status">Checking horse eligibility…</Typography>}
    {query.isError && <Alert severity="error">{outdatedApi
      ? 'This server is running an older API without horse recommendations. Restart the app with the updated API and retry.'
      : errorMessage(query.error, 'Unable to load horse recommendations.')}</Alert>}
    {unavailable && <Alert severity="warning">Review the booking concerns for {unavailable.horseName} before saving. {unavailable.reasons[0]?.description}</Alert>}
    {result && <>
      <Typography variant="subtitle1" fontWeight={700}>Recommended Horses</Typography>
      {!eligible.length && <Alert severity="warning">{partBoard ? 'Review the agreement and scheduling concerns below for this part-board ride.' : 'Every horse has booking concerns for these lesson details. Review the scores and reasons below.'}</Alert>}
      {eligible.map((horse) => <Paper key={horse.horseId} variant="outlined" sx={{ p: 1.5, bgcolor: 'background.paper' }}>
        <Stack gap={0.75}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1}>
            <Typography fontWeight={700}>#{horse.rank} {horse.horseName}</Typography>
            <Chip size="small" label={`${horse.score} points`} color={horse.rank === 1 ? 'success' : 'default'} />
          </Stack>
          <Typography variant="body2">Projected workload: {Number(horse.workload.projected.toFixed(2))} / {horse.workload.maximum} ride units</Typography>
          <Box component="ul" sx={{ my: 0, pl: 2.5 }}>
            <Typography component="li" variant="body2">Base score: {horse.baseScore}</Typography>
            {horse.reasons.map(({ code, impact, description }) => <Typography component="li" key={code} variant="body2">
              {impact > 0 ? '+' : ''}{impact} · {description}
            </Typography>)}
          </Box>
          {horse.warnings.map(({ code, description }) => <Typography key={code} variant="caption" color="text.secondary">{description}</Typography>)}
          <Button size="small" sx={{ alignSelf: 'flex-start' }} disabled={value === horse.horseId} onClick={() => onSelect(horse.horseId)}>
            {value === horse.horseId ? `${horse.horseName} selected` : `Select ${horse.horseName}`}
          </Button>
        </Stack>
      </Paper>)}
      {ineligible.length > 0 && <Box component="details" open={!eligible.length || undefined}>
        <Typography component="summary" sx={{ cursor: 'pointer', fontWeight: 700 }}>Horses to review ({ineligible.length})</Typography>
        {ineligible.map(({ horseId, horseName, reasons, score, scoreReasons, baseScore, workload }) => <Paper key={horseId} variant="outlined" sx={{ mt: 1, p: 1.5 }}>
          <Stack gap={0.75}>
            <Typography fontWeight={700}>{horseName}{score == null ? '' : ` · ${score} points`}</Typography>
            {reasons.map(({ code, description }) => <Typography key={code} variant="body2" color="warning.dark">{description}</Typography>)}
            {workload && <Typography variant="body2">Projected workload: {Number(workload.projected.toFixed(2))} / {workload.maximum} ride units</Typography>}
            {scoreReasons && <Box component="ul" sx={{ my: 0, pl: 2.5 }}>
              <Typography component="li" variant="body2">Base score: {baseScore}</Typography>
              {scoreReasons.map(({ code, impact, description }) => <Typography component="li" key={code} variant="body2">
                {impact > 0 ? '+' : ''}{impact} · {description}
              </Typography>)}
            </Box>}
            <Button size="small" sx={{ alignSelf: 'flex-start' }} disabled={value === horseId} onClick={() => onSelect(horseId)}>
              {value === horseId ? `${horseName} selected` : `Select ${horseName}`}
            </Button>
          </Stack>
        </Paper>)}
      </Box>}
    </>}
  </Stack>;
}
