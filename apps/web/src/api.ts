export const api = async <T,>(path: string, options?: RequestInit): Promise<T> => {
  const baseUrl = import.meta.env.VITE_API_URL?.replace(/\/$/, '') ?? '';
  const response = await fetch(`${baseUrl}${path}`, { headers: { 'Content-Type': 'application/json' }, ...options }).catch(() => {
    throw { error: { code: 'NETWORK_ERROR', message: 'Could not reach the server. Check your connection and try again.' } };
  });
  if (response.status === 204) return undefined as T;
  const body: unknown = await response.json().catch(() => {
    throw { error: { code: 'INVALID_RESPONSE', message: `The server returned an unexpected response (HTTP ${response.status}). Refresh the page and try again.` } };
  });
  if (!response.ok) throw body;
  return body as T;
};
