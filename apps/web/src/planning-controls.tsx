import { MenuItem, TextField } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { api } from './api';

export type Choice = { id: string; label: string };
export const readable = (value: string) => value.toLowerCase().replaceAll('_', ' ').replace(/^./, (character) => character.toUpperCase());

export function ChoiceField({ label, value, options, onChange, emptyLabel }: {
  label: string; value: string; options: Choice[]; onChange: (value: string) => void; emptyLabel?: string;
}) {
  return <TextField select size="small" label={label} value={options.some(({ id }) => id === value) ? value : ''}
    onChange={(event) => onChange(event.target.value)} sx={{ minWidth: 130 }}
    slotProps={{ inputLabel: { shrink: true }, select: { displayEmpty: true } }}>
    <MenuItem value="" disabled={!emptyLabel}>{emptyLabel ?? 'Select'}</MenuItem>
    {options.map(({ id, label }) => <MenuItem key={id} value={id}>{label}</MenuItem>)}
  </TextField>;
}

export function usePlanningResources() {
  const riders = useQuery({ queryKey: ['riders'], queryFn: () => api<{ id: string; firstName: string; lastName: string }[]>('/api/riders') });
  const horses = useQuery({ queryKey: ['horses'], queryFn: () => api<{ id: string; name: string }[]>('/api/horses') });
  const coaches = useQuery({ queryKey: ['coaches'], queryFn: () => api<{ id: string; firstName: string; lastName: string }[]>('/api/coaches') });
  const people = (items: typeof riders.data) => items?.map(({ id, firstName, lastName }) => ({ id, label: `${firstName} ${lastName}` })) ?? [];
  return { riders: people(riders.data), coaches: people(coaches.data), horses: horses.data?.map(({ id, name }) => ({ id, label: name })) ?? [] };
}
