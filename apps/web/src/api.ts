export const api = async <T,>(path: string, options?: RequestInit): Promise<T> => {
  const baseUrl = import.meta.env.VITE_API_URL?.replace(/\/$/, '') ?? '';
  const response = await fetch(`${baseUrl}${path}`, { headers: { 'Content-Type': 'application/json' }, ...options });
  const body = await response.json();
  if (!response.ok) throw body;
  return body as T;
};
