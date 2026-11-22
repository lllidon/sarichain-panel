import { type CatalogPage, type Section, type NamedRecord, pageSize } from './features/catalog/catalog';

export class ApiError extends Error {
  constructor(readonly status: number, message?: string) {
    super(message || '');
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch('/api' + path, options);
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    const message = data?.message;
    const detail = Array.isArray(message) ? message.join('، ') : typeof message === 'string' ? message : undefined;
    throw new ApiError(response.status, response.status < 500 ? detail : undefined);
  }
  return response.status === 204 ? undefined as T : response.json();
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

export async function readCatalogChoices(section: Section, token: string, signal: AbortSignal) {
  const items: CatalogPage['items'] = [];
  for (let page = 1; page <= 10000; page++) {
    const response = await request<CatalogPage>(`/catalog/${section}?page=${page}&limit=100`, {
      signal, headers: { Authorization: `Bearer ${token}` },
    });
    items.push(...response.items);
    if (items.length >= response.total || !response.items.length) break;
  }
  return items;
}

export function searchTags(search: string, token: string, signal: AbortSignal) {
  return request<{ items: NamedRecord[] }>(`/catalog/tags?${new URLSearchParams({ search, limit: '15' })}`, {
    signal, headers: { Authorization: `Bearer ${token}` },
  });
}

function write<T>(path: string, method: string, token: string, body?: object) {
  return request<T>(path, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body && { 'Content-Type': 'application/json' }) },
    ...(body && { body: JSON.stringify(body) }),
  });
}

export function addTag(name: string, token: string) {
  return write<NamedRecord>('/catalog/tags', 'POST', token, { name });
}

export function saveCatalog(section: Section, token: string, data: object, id?: string) {
  return write<CatalogPage['items'][number]>(`/catalog/${section}${id ? '/' + id : ''}`, id ? 'PATCH' : 'POST', token, data);
}

export function deleteCatalog(section: Section, token: string, id: string) {
  return write<void>(`/catalog/${section}/${id}`, 'DELETE', token);
}
