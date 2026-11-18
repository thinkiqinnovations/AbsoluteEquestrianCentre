import { Box, Stack, Typography } from '@mui/material';
import type { ReactNode } from 'react';

export function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return <Box component="section" aria-label={title} sx={{ backgroundColor: 'background.paper', border: 1, borderColor: 'divider', borderRadius: 1.2, p: { xs: 2, sm: 2.5 }, minWidth: 0 }}>
    <Typography variant="h6" sx={{ borderLeft: '3px solid', borderColor: 'secondary.main', pl: 1.25, mb: 2 }}>{title}</Typography>
    <Stack gap={2} sx={{ minWidth: 0, '& > .MuiFormControl-root': { width: '100%' } }}>{children}</Stack>
  </Box>;
}
