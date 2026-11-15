// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { expect, it, vi } from 'vitest';
import { useHorseRecommendations } from './LessonHorseRecommendations';

it('requests fresh recommendations when lesson details change', async () => {
  const changes: Record<string, unknown>[] = [];
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('fetch', async (_path: string, options?: RequestInit) => {
    changes.push(JSON.parse(String(options?.body)));
    return { ok: true, json: async () => ({ recommendations: [], ineligible: [] }) };
  });
  const target = document.createElement('div');
  const root = createRoot(target);
  const client = new QueryClient();
  function Preview({ fields }: { fields: unknown }) {
    const query = useHorseRecommendations(fields);
    return <output>{query.fetchStatus}</output>;
  }
  async function render(fields: Record<string, unknown>) {
    await act(async () => {
      root.render(<QueryClientProvider client={client}><Preview fields={fields} /></QueryClientProvider>);
    });
  }
  try {
    const fields = { date: '2026-11-18', startTime: '09:00', endTime: '10:00', lessonType: 'PRIVATE', discipline: 'FLAT', rideUnits: 1 };
    await render(fields);
    expect(changes).toHaveLength(0);
    let count = 0;
    for (const update of [{}, { riderId: 'noah' }, { date: '2026-11-19' }, { startTime: '09:30' },
      { discipline: 'JUMP' }, { rideUnits: 0.5 }, { lessonType: 'PART_BOARD_RIDE', consumeEntitlement: false },
      { excludeLessonId: 'edit-me' }]) {
      const request = { ...fields, riderId: 'emma', ...update };
      await render(request);
      expect(changes).toHaveLength(++count);
      expect(changes.at(-1)).toMatchObject(request);
    }
  } finally {
    await act(async () => { root.unmount(); });
    client.clear();
    vi.unstubAllGlobals();
  }
});
