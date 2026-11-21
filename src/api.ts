import { type CatalogPage, type Section, pageSize } from './features/catalog/catalog';

export class ApiError extends Error {
  constructor(readonly status: number) {
    super('API request failed');
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch('/api' + path, options);
  if (!response.ok) throw new ApiError(response.status);
  return response.json();
}

export function login(identifier: string, password: string) {
  const identity = /^[a-z]/i.test(identifier) ? { username: identifier } : { phone: identifier };
  return request<{ accessToken: string }>('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...identity, password }),
  });
}

export function readCatalog(section: Section, search: string, page: number, token: string, signal: AbortSignal) {
  const query = new URLSearchParams({ search, page: String(page), limit: String(pageSize) });
  return request<CatalogPage>(`/catalog/${section}?${query}`, {
    signal,
    headers: { Authorization: `Bearer ${token}` },
  });
}
