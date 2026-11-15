import Add from '@mui/icons-material/Add';
import ArrowBack from '@mui/icons-material/ArrowBack';
import ArrowForward from '@mui/icons-material/ArrowForward';
import CalendarMonth from '@mui/icons-material/CalendarMonth';
import Edit from '@mui/icons-material/Edit';
import Groups from '@mui/icons-material/Groups';
import Agriculture from '@mui/icons-material/Agriculture';
import WarningAmber from '@mui/icons-material/WarningAmber';
import { Alert, AppBar, Box, Button, Card, CardContent, Checkbox, Chip, CircularProgress, Container, Dialog, DialogActions, DialogContent, DialogTitle, Divider, FormControl, FormControlLabel, Grid2 as Grid, IconButton, InputLabel, LinearProgress, MenuItem, Select, Stack, TextField, Toolbar, Typography } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { disciplines, lessonSchema, lessonStatuses, lessonTypes, riderLevels, WORKLOAD_THRESHOLDS } from '@absolute/shared';
import { NavLink, Route, Routes, useLocation, useSearchParams } from 'react-router-dom';
import { useState } from 'react';
import { api } from './api';
import { errorMessage, validationMessage } from './save-errors';
import { addDays, barnToday, dateSchema, intervalSchema, monday, ordered, shiftMonth, type AvailabilityResult, type Resource } from '@absolute/shared';
import { formatDate, formatTime as time, scheduleKeys, scheduleKeysForDate, useBarnTimeZone } from './scheduling';
import { WeeklyCalendar } from './WeeklyCalendar';
import { MonthlyCalendar } from './MonthlyCalendar';
import { emptyFilters, matchesFilters, ScheduleFilters, type CalendarLesson } from './ScheduleFilters';
import { AvailabilityEditor } from './AvailabilityEditor';
import { AgreementTerms, PartBoard, ProfileAgreements, useAgreements } from './PartBoard';
import { CoachWeeklyAvailability } from './CoachWeeklyAvailability';
import { coachWeeklyAvailabilitySchema, type CoachWeeklyAvailability as WeeklyAvailability } from '@absolute/shared';

type Any = Record<string, any>;
const label = (value: string) => value.replaceAll('_', ' ').replace(/\b\w/g, (x) => x.toUpperCase());
const fullName = (person: Any) => `${person.firstName} ${person.lastName}`;
function Shell({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const links = [['/', 'Schedule'], ['/horses', 'Horses'], ['/riders', 'Riders'], ['/coaches', 'Coaches'], ['/part-board', 'Part Board']];
  return <><AppBar position="sticky" elevation={0} sx={{ background: '#374936', borderBottom: '4px solid #B99C73' }}><Toolbar sx={{ minHeight: 82, columnGap: 5, rowGap: 1, py: 1, flexWrap: 'wrap' }}><Box sx={{ flexGrow: 1 }}><Typography variant="h5" color="white">Absolute Equestrian</Typography><Typography variant="body2" sx={{ color: '#E7E1D5' }}>ThinkIQ Innvovations Inc.</Typography><Typography variant="body2" sx={{ color: '#E7E1D5' }}>Stable & Lesson Management</Typography></Box><Stack direction="row" sx={{ gap: 0.5, maxWidth: '100%', flexWrap: 'wrap' }}>{links.map(([to, text]) => <Button key={to} component={NavLink} to={to} color="inherit" sx={{ color: location.pathname === to ? '#FFFDF8' : '#D3DDCE', borderBottom: location.pathname === to ? '2px solid #B99C73' : '2px solid transparent', borderRadius: 0 }}>{text}</Button>)}</Stack></Toolbar></AppBar><Container maxWidth="xl" sx={{ py: { xs: 3, md: 5 } }}>{children}</Container></>;
}

function Schedule() {
  const zone = useBarnTimeZone();
  const [params, setParams] = useSearchParams();
  const requestedView = params.get('view');
  const view = requestedView === 'week' || requestedView === 'month' ? requestedView : 'day';
  const [filters, setFilters] = useState(emptyFilters);
  const parsedDate = dateSchema.safeParse(params.get('date'));
  const date = parsedDate.success ? parsedDate.data : barnToday(zone);
  const navigate = (mode: 'day' | 'week' | 'month', selection: string) => setParams({ view: mode, date: selection });
  const [draft, setDraft] = useState<Any>();
  const [warnings, setWarnings] = useState<string[]>([]);
  const start = monday(date);
  const query = useQuery({ queryKey: scheduleKeys.day(date), queryFn: () => api<Any>(`/api/schedule?date=${date}`), enabled: view === 'day' });
  const shift = (days: number) => navigate(view, view === 'month' ? shiftMonth(date, days) : addDays(date, view === 'week' ? days * 7 : days));
  const toolbar = <Stack direction="row" gap={1} flexWrap="wrap" alignItems="center">
    <Stack direction="row" role="group" aria-label="Schedule view">
      {(['day', 'week', 'month'] as const).map((mode) =>
        <Button key={mode} aria-pressed={view === mode} variant={view === mode ? 'contained' : 'outlined'} onClick={() => navigate(mode, date)}>
          {mode[0].toUpperCase() + mode.slice(1)}
        </Button>)}
    </Stack>
    <Button startIcon={<ArrowBack />} onClick={() => shift(-1)}>Previous {view}</Button>
    <Button onClick={() => navigate(view, barnToday(zone))}>Today</Button>
    <Button endIcon={<ArrowForward />} onClick={() => shift(1)}>Next {view}</Button>
    <Button variant="contained" startIcon={<Add />} onClick={() => setDraft({ date })}>Add Lesson</Button>
  </Stack>;
  const dialog = draft && <LessonDialog initial={draft} onClose={() => setDraft(undefined)} onSaved={setWarnings} />;
  const notices = warnings.length > 0 && <Alert severity="warning" onClose={() => setWarnings([])}>{warnings.join(' ')}</Alert>;
  if (view === 'month') return <Stack gap={2}>
    <Box><Typography variant="h4">{formatDate(date, { month: 'long', year: 'numeric' })}</Typography>
      <Typography color="text.secondary">{zone}</Typography></Box>
    {toolbar}{notices}
    <MonthlyCalendar date={date} filters={filters} onFilter={setFilters} onDay={(selected) => navigate('day', selected)} onEdit={setDraft} />
    {dialog}
  </Stack>;
  if (view === 'week') return <Stack gap={2}>
    <Typography variant="h4">Weekly Schedule</Typography>
    <Typography>{formatDate(start, { month: 'short', day: 'numeric' })} – {formatDate(addDays(start, 6), { month: 'short', day: 'numeric', year: 'numeric' })} · {zone}</Typography>
    {toolbar}{notices}
    <WeeklyCalendar filters={filters} onFilter={setFilters} start={start} onAdd={(date, startTime, endTime) => setDraft({ date, startTime, endTime })} onEdit={setDraft} />
    {dialog}
  </Stack>;
  if (query.isPending) return <Stack gap={2}>{toolbar}<CircularProgress />{dialog}</Stack>;
  if (query.isError) return <Stack gap={2}>{toolbar}<Alert severity="error">Unable to load the schedule.</Alert>{dialog}</Stack>;
  const data = query.data;
  const visibleLessons = (data.lessons as CalendarLesson[]).filter((lesson) => matchesFilters(lesson, filters));
  const visibleIds = new Set(visibleLessons.map(({ id }) => id));
  const visibleConflicts = (data.conflicts as Any[]).filter((entry) => visibleIds.has(entry.lessonId));
  const formattedDate = formatDate(date, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  return <Stack gap={3.5}><Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 2, flexWrap: 'wrap' }}><Box><Typography variant="h4">Daily Schedule</Typography><Typography color="text.secondary">{formattedDate} · {zone}</Typography></Box>{toolbar}</Box>{notices}<ScheduleFilters lessons={data.lessons} filters={filters} onChange={setFilters} /><Grid container spacing={2}>{[['Lessons', visibleLessons.length, <CalendarMonth />], ['Active Horses', data.summary.activeHorses, <Agriculture />], ['Active Coaches', data.summary.activeCoaches, <Groups />], ['Near Workload Limit', data.summary.nearWorkloadLimit, <WarningAmber />], ['Scheduling Conflicts', visibleConflicts.length, <WarningAmber />]].map(([name, value, icon]) => <Grid key={String(name)} size={{ xs: 12, sm: 6, lg: 2.4 }}><Card><CardContent sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><Box><Typography variant="body2" color="text.secondary">{name}</Typography><Typography variant="h4">{value as number}</Typography></Box><Box sx={{ color: 'secondary.main' }}>{icon}</Box></CardContent></Card></Grid>)}</Grid><Grid container spacing={3}><Grid size={{ xs: 12, md: 7 }}><Card><CardContent><Typography variant="h5" gutterBottom>Lessons</Typography><Stack divider={<Divider flexItem />} gap={0}>{visibleLessons.length ? visibleLessons.map((lesson: Any) => <LessonCard lesson={lesson} key={lesson.id} onEdit={() => setDraft(lesson)} />) : <Typography color="text.secondary" sx={{ py: 5, textAlign: 'center' }}>No lessons scheduled for this date.</Typography>}</Stack></CardContent></Card></Grid><Grid size={{ xs: 12, md: 5 }}><Card><CardContent><Typography variant="h5" gutterBottom>Horse Workload</Typography><Stack gap={2.5}>{data.workloads.length ? data.workloads.map((entry: Any) => <Workload entry={entry} key={entry.horse.id} />) : <Typography color="text.secondary" sx={{ py: 5, textAlign: 'center' }}>No horses scheduled for this date.</Typography>}</Stack></CardContent></Card></Grid></Grid>{visibleConflicts.length > 0 && <Card><CardContent><Typography variant="h5" gutterBottom>Scheduling Attention</Typography><Stack gap={1}>{visibleConflicts.map((conflict: Any, index: number) => <Alert key={`${conflict.code}-${index}`} severity={conflict.severity === 'ERROR' ? 'error' : 'warning'}><b>{conflict.severity}</b> · {conflict.message}</Alert>)}</Stack></CardContent></Card>}{dialog}</Stack>;
}

function LessonCard({ lesson, onEdit }: { lesson: Any; onEdit: () => void }) { const preference = lesson.rider.preferences.find((item: Any) => item.horseId === lesson.horseId); return <Box sx={{ py: 2.25 }}><Grid container spacing={1.5}><Grid size={{ xs: 12, sm: 3 }}><Typography fontWeight={700}>{time(lesson.startTime)} – {time(lesson.endTime)}</Typography><Chip size="small" label={label(lesson.status)} color={lesson.status === 'CONFIRMED' ? 'success' : 'default'} sx={{ mt: 1 }} /></Grid><Grid size={{ xs: 12, sm: 3 }}><Typography fontWeight={700}>{fullName(lesson.rider)}</Typography><Typography variant="body2" color="text.secondary">{label(lesson.rider[lesson.discipline === 'JUMP' ? 'jumpLevel' : 'flatLevel'])} · {label(lesson.discipline)} · {lesson.lessonType === 'SEMI_PRIVATE' ? 'Semi-private' : label(lesson.lessonType)}</Typography></Grid><Grid size={{ xs: 12, sm: 3 }}><Typography fontWeight={700}>Horse: {lesson.horse.name}</Typography><Typography variant="body2" color="text.secondary">{preference ? `${preference.preferenceOrder}${preference.preferenceOrder === 1 ? 'st' : preference.preferenceOrder === 2 ? 'nd' : 'th'} horse preference` : 'Not a stated preference'}</Typography></Grid><Grid size={{ xs: 12, sm: 3 }}><Typography fontWeight={700}>Coach: {lesson.coach ? fullName(lesson.coach) : 'Self ride'}</Typography><Typography variant="body2" color="text.secondary">{lesson.rideUnits} ride unit{lesson.rideUnits === 1 ? '' : 's'}</Typography><Button size="small" onClick={onEdit}>Edit lesson</Button></Grid></Grid></Box>; }
function Workload({ entry }: { entry: Any }) { const ratio = entry.usedUnits / entry.horse.maximumDailyRideUnits; const color = ratio > WORKLOAD_THRESHOLDS.warning ? 'error' : ratio >= WORKLOAD_THRESHOLDS.normal ? 'warning' : 'success'; return <Box><Box sx={{ display: 'flex', justifyContent: 'space-between' }}><Typography fontWeight={700}>{entry.horse.name}</Typography><Typography color="text.secondary">{entry.usedUnits} / {entry.horse.maximumDailyRideUnits} units</Typography></Box><LinearProgress variant="determinate" color={color} value={Math.min(ratio * 100, 100)} sx={{ height: 9, borderRadius: 5, mt: 0.75 }} /></Box>; }

function LessonDialog({ initial, onClose, onSaved }: { initial: Any; onClose: () => void; onSaved: (messages: string[]) => void }) {
  const client = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<Any>({
    date: initial.date, startTime: initial.startTime ?? '09:00', endTime: initial.endTime ?? '10:00',
    riderId: initial.riderId ?? '', horseId: initial.horseId ?? '', coachId: initial.coachId ?? '',
    lessonType: initial.lessonType ?? 'PRIVATE', discipline: initial.discipline ?? 'FLAT',
    consumeEntitlement: initial.consumeEntitlement ?? (initial.lessonType === 'PART_BOARD_RIDE'),
    rideUnits: initial.rideUnits ?? 1, status: initial.status ?? 'DRAFT', notes: initial.notes ?? '',
  });
  const riders = useQuery({ queryKey: ['riders'], queryFn: () => api<Any[]>('/api/riders') });
  const horses = useQuery({ queryKey: ['horses'], queryFn: () => api<Any[]>('/api/horses') });
  const coaches = useQuery({ queryKey: ['coaches'], queryFn: () => api<Any[]>('/api/coaches') });
  const partBoard = form.lessonType === 'PART_BOARD_RIDE';
  const agreements = useAgreements(form.date, form.riderId, partBoard && Boolean(form.riderId) && dateSchema.safeParse(form.date).success);
  const linked = partBoard ? agreements.data?.filter((entry) => entry.effective) ?? [] : [];
  const selectedAgreement = linked.find((entry) => entry.horseId === form.horseId);
  const workload = useQuery({
    queryKey: scheduleKeys.day(form.date), queryFn: () => api<Any>(`/api/schedule?date=${form.date}`),
    enabled: partBoard && Boolean(form.horseId) && dateSchema.safeParse(form.date).success,
  });
  const selectedHorse = horses.data?.find((horse) => horse.id === form.horseId);
  const usedUnits = workload.data?.workloads.find((entry: Any) => entry.horse.id === form.horseId)?.usedUnits ?? 0;
  const interval = intervalSchema.safeParse(form);
  const validTime = dateSchema.safeParse(form.date).success && interval.success && ordered(interval.data);
  const availability = useQuery({
    queryKey: ['availability', 'check', form.date, form.startTime, form.endTime],
    queryFn: () => api<Record<Resource['resourceType'], Record<string, AvailabilityResult>>>(
      `/api/availability/check?date=${form.date}&startTime=${form.startTime}&endTime=${form.endTime}`),
    enabled: validTime,
  });
  const choices = (items: Any[] | undefined, type: Resource['resourceType'], selected: string) =>
    items?.filter((item) => item.active || item.id === selected).map((item) => {
      const result = availability.data?.[type][item.id];
      const status = result?.status === 'UNSPECIFIED' ? 'Availability not configured' : result && label(result.status);
      const reason = result?.reason ? ` (${label(result.reason)})` : '';
      return [item.id, `${type === 'HORSE' ? item.name : fullName(item)}${status ? ` · ${status}${reason}` : ''}`];
    }) ?? [];
  const mutation = useMutation({
    mutationFn: () => api<{ conflicts: { severity: string; message: string }[] }>(
      initial.id ? `/api/lessons/${initial.id}` : '/api/lessons',
      { method: initial.id ? 'PATCH' : 'POST', body: JSON.stringify({ ...form, coachId: form.coachId || null }) }),
    onSuccess: ({ conflicts }) => {
      for (const date of new Set<string>([initial.date, form.date])) {
        for (const queryKey of scheduleKeysForDate(date)) void client.invalidateQueries({ queryKey, exact: true });
      }
      void client.invalidateQueries({ queryKey: ['lessons'] });
      void client.invalidateQueries({ queryKey: ['part-board'] });
      onSaved(conflicts.filter(({ severity }) => severity === 'WARNING').map(({ message }) => message));
      onClose();
    },
    onError: (body: unknown) => setError(errorMessage(body)),
  });
  const field = (name: string, value: unknown) => setForm((current: Any) => ({ ...current, [name]: value }));
  return <Dialog open onClose={onClose} fullWidth maxWidth="sm"><DialogTitle>{initial.id ? "Edit Lesson" : "Add Lesson"}</DialogTitle><DialogContent><Stack gap={2.2} sx={{ mt: 1 }}><Grid container spacing={2}><Grid size={6}><TextField type="date" label="Date" value={form.date} onChange={(e) => field('date', e.target.value)} fullWidth InputLabelProps={{ shrink: true }} /></Grid><Grid size={3}><TextField type="time" label="Start" value={form.startTime} onChange={(e) => field('startTime', e.target.value)} fullWidth InputLabelProps={{ shrink: true }} /></Grid><Grid size={3}><TextField type="time" label="End" value={form.endTime} onChange={(e) => field('endTime', e.target.value)} fullWidth InputLabelProps={{ shrink: true }} /></Grid></Grid>{validTime && availability.isFetching && <Typography variant="caption">Checking availability…</Typography>}{validTime && availability.isError && <Alert severity="warning">The availability preview could not load. Availability will be checked when you save.</Alert>}<SelectField label="Rider" value={form.riderId} items={choices(riders.data, "RIDER", form.riderId)} onChange={(value) => field('riderId', value)} /><Grid container spacing={2}><Grid size={6}><SelectField label="Lesson type" value={form.lessonType} items={lessonTypes.map((item) => [item, item === "SEMI_PRIVATE" ? "Semi-private" : label(item)])} onChange={(value) => setForm((current: Any) => ({ ...current, lessonType: value, consumeEntitlement: value === 'PART_BOARD_RIDE' }))} /></Grid><Grid size={6}><SelectField label="Discipline" value={form.discipline} items={disciplines.map((item) => [item, label(item)])} onChange={(value) => field('discipline', value)} /></Grid></Grid>{(form.lessonType === "SEMI_PRIVATE" || form.lessonType === "GROUP") && <Typography variant="body2" color="text.secondary">Add one booking per rider and horse. Keep the coach, date, times, discipline, and lesson type the same for each booking.</Typography>}<SelectField label="Horse" value={form.horseId} items={choices(horses.data, "HORSE", form.horseId).map(([id, text]) => [id, linked.some((entry) => entry.horseId === id) ? `${text} · Part-board horse` : text]).sort(([a], [b]) => Number(linked.some((entry) => entry.horseId === b)) - Number(linked.some((entry) => entry.horseId === a)))} onChange={(value) => field('horseId', value)} /><SelectField label={partBoard ? "Coach (optional)" : "Coach"} value={form.coachId} items={[...(partBoard ? [["", "No coach"]] : []), ...choices(coaches.data, "COACH", form.coachId)]} onChange={(value) => field('coachId', value)} />{partBoard && <Stack gap={1}>
    {selectedAgreement && <AgreementTerms agreement={selectedAgreement} />}
    {form.riderId && form.horseId && agreements.isSuccess && !selectedAgreement && <Alert severity="warning">No active agreement matches this rider and horse on the selected date.</Alert>}
    {selectedHorse && workload.isSuccess && <Typography variant="body2">Horse workload: {usedUnits} / {selectedHorse.maximumDailyRideUnits} ride units</Typography>}
    <FormControlLabel label="Use a free-ride entitlement" control={<Checkbox checked={Boolean(form.consumeEntitlement)} onChange={(_, checked) => field('consumeEntitlement', checked)} />} />
    {selectedAgreement?.entitlement.remaining === 0 && form.consumeEntitlement && <Alert severity="warning">All free rides for this period have been used. An existing booking can retain its own entitlement.</Alert>}
  </Stack>}<Grid container spacing={2}><Grid size={6}><TextField type="number" inputProps={{ min: 0.25, step: 0.25 }} label="Ride units" value={form.rideUnits} onChange={(e) => field('rideUnits', Number(e.target.value))} fullWidth /></Grid><Grid size={6}><SelectField label="Status" value={form.status} items={lessonStatuses.map((item) => [item, label(item)])} onChange={(value) => field('status', value)} /></Grid></Grid><TextField label="Notes" value={form.notes} onChange={(e) => field('notes', e.target.value)} fullWidth multiline minRows={2} /></Stack></DialogContent>{error && <Alert severity="error" sx={{ whiteSpace: "pre-line", mx: 2 }}>{error}</Alert>}<DialogActions><Button onClick={onClose}>Cancel</Button><Button variant="contained" disabled={mutation.isPending} onClick={() => { const result = lessonSchema.safeParse({ ...form, coachId: form.coachId || null }); if (!result.success) { setError(validationMessage(result.error.issues)); return; } setError(null); mutation.mutate(); }}>Save lesson</Button></DialogActions></Dialog>;
}
function SelectField({ label, value, items, onChange }: { label: string; value: string; items: string[][]; onChange: (value: string) => void }) { return <FormControl fullWidth><InputLabel>{label}</InputLabel><Select label={label} value={items.some(([id]) => id === value) ? value : ""} onChange={(e) => onChange(e.target.value)}>{items.map(([value, text]) => <MenuItem key={value} value={value}>{text}</MenuItem>)}</Select></FormControl>; }

function ManagementPage({ type }: { type: 'horses' | 'riders' | 'coaches' }) {
  const client = useQueryClient(); const [editing, setEditing] = useState<Any | null>(null); const data = useQuery({ queryKey: [type], queryFn: () => api<Any[]>(`/api/${type}`) }); const horses = useQuery({ queryKey: ['horses'], queryFn: () => api<Any[]>('/api/horses'), enabled: type === 'riders' });
  const [availabilityItem, setAvailabilityItem] = useState<Any>();
  const resourceType = ({ horses: 'HORSE', riders: 'RIDER', coaches: 'COACH' } as const)[type];
  const agreements = useAgreements(undefined, undefined, type !== 'coaches');
  const title = label(type); if (data.isLoading) return <CircularProgress />;
  return <Stack gap={3}><Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><Box><Typography variant="h4">{title}</Typography><Typography color="text.secondary">Manage the people and horses who make each ride possible.</Typography></Box><Button variant="contained" startIcon={<Add />} onClick={() => setEditing({})}>Add {type.slice(0, -1)}</Button></Box><Card><CardContent><Stack divider={<Divider flexItem />}>{data.data?.map((item: Any) => <Box key={item.id} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 2, gap: 2 }}><Box><Typography variant="h6">{type === 'horses' ? item.name : fullName(item)}</Typography><Stack direction="row" gap={0.75} sx={{ flexWrap: 'wrap', mt: 0.75 }}><Chip size="small" label={item.active ? 'Active' : 'Inactive'} color={item.active ? 'success' : 'default'} />{type === 'horses' && <><Chip size="small" label={`Walk ${item.walkCapable ? '✓' : '—'}`} /><Chip size="small" label={`Trot ${item.trotCapable ? '✓' : '—'}`} /><Chip size="small" label={`Canter ${item.canterCapable ? '✓' : '—'}`} /><Chip size="small" label={item.supportsFlat ? 'Flat' : 'No Flat'} /><Chip size="small" label={item.supportsJumping ? 'Jump' : 'No Jump'} /><Chip size="small" label={`${label(item.minimumRiderLevel)} – ${label(item.maximumRiderLevel)}`} /><Chip size="small" label={`${item.maximumDailyRideUnits} maximum units`} /></>}{type === 'riders' && <><Chip size="small" label={`Overall: ${label(item.overallLevel)}`} /><Chip size="small" label={`Flat: ${label(item.flatLevel)}`} /><Chip size="small" label={`Jump: ${label(item.jumpLevel)}`} /><Typography variant="body2" color="text.secondary">Preferences: {item.preferences.map((pref: Any) => `${pref.preferenceOrder}. ${horses.data?.find((horse: Any) => horse.id === pref.horseId)?.name ?? 'Unknown'}`).join(', ') || 'None'}</Typography></>}{type === 'coaches' && <CoachLessonCount coach={item} />}</Stack>{type !== 'coaches' && agreements.isSuccess && <ProfileAgreements type={type} agreements={agreements.data.filter((entry) => (type === 'horses' ? entry.horseId : entry.riderId) === item.id)} />}</Box><Stack direction="row" gap={1} flexWrap="wrap"><Button size="small" onClick={() => setAvailabilityItem(item)}>Availability</Button><IconButton aria-label={`Edit ${type.slice(0, -1)}`} onClick={() => setEditing(item)}><Edit /></IconButton></Stack></Box>)}</Stack></CardContent></Card>{availabilityItem && <AvailabilityEditor resource={{ resourceType, resourceId: availabilityItem.id }} name={type === "horses" ? availabilityItem.name : fullName(availabilityItem)} close={() => setAvailabilityItem(undefined)} />}{editing && <EntityDialog type={type} item={editing} horses={horses.data ?? []} onClose={() => setEditing(null)} onSave={async (payload) => {
    const hasWeeklyAvailability = type === 'coaches' && !editing.id && payload.weeklyAvailability?.length > 0;
    const path = hasWeeklyAvailability ? '/api/coaches/with-availability' : `/api/${type}${editing.id ? `/${editing.id}` : ''}`;
    try {
      await api(path, { method: editing.id ? 'PUT' : 'POST', body: JSON.stringify(payload) });
    } catch (response) {
      const failure = response as { error?: { code?: string } } | undefined;
      if (hasWeeklyAvailability && failure?.error?.code === 'NOT_FOUND') {
        throw { error: { message: 'This server is running an older version. Restart it with the updated API, then retry saving the coach and weekly availability.' } };
      }
      throw response;
    }
    void client.invalidateQueries({ queryKey: [type] });
    if (hasWeeklyAvailability) void client.invalidateQueries({ queryKey: ['availability'] });
    setEditing(null);
  }} />}</Stack>;
}
function CoachLessonCount({ coach }: { coach: Any }) { const date = barnToday(useBarnTimeZone()); const lessons = useQuery({ queryKey: ['lessons', date], queryFn: () => api<Any[]>(`/api/lessons?date=${date}`) }); return <Chip size="small" label={`${lessons.data?.filter((lesson: Any) => lesson.coachId === coach.id).length ?? 0} lessons today`} />; }

function EntityDialog({ type, item, horses, onClose, onSave }: { type: 'horses' | 'riders' | 'coaches'; item: Any; horses: Any[]; onClose: () => void; onSave: (payload: Any) => Promise<unknown> }) {
  const [weeklyAvailability, setWeeklyAvailability] = useState<WeeklyAvailability>([]);
  const addingCoach = type === 'coaches' && !item.id;
  const availabilityValidation = coachWeeklyAvailabilitySchema.safeParse(weeklyAvailability);
  const [form, setForm] = useState<Any>(() => ({ active: true, walkCapable: true, trotCapable: true, canterCapable: false, supportsFlat: true, supportsJumping: false, maximumDailyRideUnits: 1.5, minimumRiderLevel: 'BEGINNER', maximumRiderLevel: 'INTERMEDIATE', overallLevel: 'BEGINNER', flatLevel: 'BEGINNER', jumpLevel: 'BEGINNER', preferences: [], notes: '', description: '', ...item })); const [error, setError] = useState<string | null>(null); const [saving, setSaving] = useState(false);
  const set = (key: string, value: unknown) => setForm((current: Any) => ({ ...current, [key]: value })); const name = type.slice(0, -1);
  const submit = async () => { setSaving(true); setError(null); try { const payload: Any = { ...form, ...(addingCoach && { weeklyAvailability }) }; delete payload.id; delete payload.createdAt; delete payload.updatedAt; await onSave(payload); } catch (response: unknown) { setError(errorMessage(response)); setSaving(false); } };
  const choices = (key: string) => <SelectField label={label(key)} value={form[key]} items={riderLevels.map((value) => [value, label(value)])} onChange={(value) => set(key, value)} />;
  return <Dialog open onClose={onClose} fullWidth maxWidth="sm"><DialogTitle>{item.id ? `Edit ${name}` : `Add ${name}`}</DialogTitle><DialogContent><Stack gap={2} sx={{ mt: 1 }}>{type === 'horses' ? <><TextField label="Horse name" value={form.name ?? ''} onChange={(e) => set('name', e.target.value)} fullWidth /><TextField label="Description" value={form.description ?? ''} onChange={(e) => set('description', e.target.value)} fullWidth /><Grid container spacing={2}><Grid size={6}>{choices('minimumRiderLevel')}</Grid><Grid size={6}>{choices('maximumRiderLevel')}</Grid></Grid><TextField type="number" label="Maximum daily ride units" inputProps={{ min: 0.25, step: 0.25 }} value={form.maximumDailyRideUnits} onChange={(e) => set('maximumDailyRideUnits', Number(e.target.value))} fullWidth /><Stack direction="row" gap={1} flexWrap="wrap">{['active', 'walkCapable', 'trotCapable', 'canterCapable', 'supportsFlat', 'supportsJumping'].map((key) => <Button key={key} variant={form[key] ? 'contained' : 'outlined'} onClick={() => set(key, !form[key])}>{label(key).replace('Capable', '')}: {form[key] ? 'Yes' : 'No'}</Button>)}</Stack></> : <>{<Grid container spacing={2}><Grid size={6}><TextField label="First name" value={form.firstName ?? ''} onChange={(e) => set('firstName', e.target.value)} fullWidth /></Grid><Grid size={6}><TextField label="Last name" value={form.lastName ?? ''} onChange={(e) => set('lastName', e.target.value)} fullWidth /></Grid></Grid>}{type === 'riders' && <><Grid container spacing={2}><Grid size={4}>{choices('overallLevel')}</Grid><Grid size={4}>{choices('flatLevel')}</Grid><Grid size={4}>{choices('jumpLevel')}</Grid></Grid><FormControl fullWidth><InputLabel>Preferred horses</InputLabel><Select multiple label="Preferred horses" value={form.preferences.map((preference: Any) => preference.horseId)} onChange={(e) => set('preferences', (e.target.value as string[]).map((horseId: string, index: number) => ({ horseId, preferenceOrder: index + 1, notes: '' })))}>{horses.map((horse: Any) => <MenuItem key={horse.id} value={horse.id}>{horse.name}</MenuItem>)}</Select></FormControl><Typography variant="caption" color="text.secondary">Preference order follows the selection order. Re-select in the desired order to adjust ranking.</Typography></>}<Button variant={form.active ? 'contained' : 'outlined'} onClick={() => set('active', !form.active)}>Active: {form.active ? 'Yes' : 'No'}</Button><TextField label="Notes" value={form.notes ?? ''} onChange={(e) => set('notes', e.target.value)} fullWidth multiline minRows={2} /></>}{addingCoach && <CoachWeeklyAvailability value={weeklyAvailability} onChange={setWeeklyAvailability} />}{addingCoach && !availabilityValidation.success && <Alert severity="warning" sx={{ whiteSpace: "pre-line" }}>{validationMessage(availabilityValidation.error.issues.map((issue) => ({ ...issue, path: issue.path.map((part) => typeof part === "number" ? label(weeklyAvailability[part].dayOfWeek) : part) })))}</Alert>}</Stack></DialogContent>{error && <Alert severity="error" sx={{ whiteSpace: "pre-line", mx: 2 }}>{error}</Alert>}<DialogActions><Button onClick={onClose}>Cancel</Button><Button variant="contained" disabled={saving || (addingCoach && !availabilityValidation.success)} onClick={submit}>Save {name}</Button></DialogActions></Dialog>;
}

export function App() { return <Shell><Routes><Route path="/" element={<Schedule />} /><Route path="/schedule" element={<Schedule />} /><Route path="/horses" element={<ManagementPage type="horses" />} /><Route path="/riders" element={<ManagementPage type="riders" />} /><Route path="/coaches" element={<ManagementPage type="coaches" />} /><Route path="/part-board" element={<PartBoard />} /><Route path="*" element={<Schedule />} /></Routes></Shell>; }
