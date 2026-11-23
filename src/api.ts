import type { City, CityPage, Province } from './features/locations/locations';
import type { Access, OrderPage, Setting, SettingList } from './features/organization/organization';
import type { Supplier, SupplierPage } from './features/directory/suppliers';
import type { Member, MemberGroup, MemberPage } from './features/members/members';
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

export function uploadCatalogImage(file: File, token: string) {
  const body = new FormData();
  body.append('image', file);
  return request<{ url: string }>('/web/catalog-images', {
    method: 'POST', headers: { Authorization: `Bearer ${token}` }, body,
  });
}

export function saveCatalog(section: Section, token: string, data: object, id?: string) {
  return write<CatalogPage['items'][number]>(`/catalog/${section}${id ? '/' + id : ''}`, id ? 'PATCH' : 'POST', token, data);
}

export function deleteCatalog(section: Section, token: string, id: string) {
  return write<void>(`/catalog/${section}/${id}`, 'DELETE', token);
}

export function readMembers(group: MemberGroup, token: string, search: string, page: number, signal: AbortSignal) {
  const query = new URLSearchParams({ search, page: String(page), limit: String(pageSize) });
  return request<MemberPage>(`/members/${group}?${query}`, {
    signal, headers: { Authorization: `Bearer ${token}` },
  });
}

export function saveMember(group: MemberGroup, token: string, fields: object, id?: string) {
  return write<Member>(`/members/${group}${id ? '/' + id : ''}`, id ? 'PATCH' : 'POST', token, fields);
}

export function listSuppliers(token: string, filters: Record<string, string>, page: number, manage: boolean, signal: AbortSignal) {
  const params = new URLSearchParams({ ...filters, page: String(page), limit: String(pageSize) });
  return request<SupplierPage>(`/directory/material-suppliers${manage ? '/manage' : ''}?${params}`, {
    signal, headers: { Authorization: `Bearer ${token}` },
  });
}

export function saveSupplier(token: string, fields: object, id?: string) {
  return write<Supplier>(`/directory/material-suppliers${id ? '/' + id : ''}`, id ? 'PATCH' : 'POST', token, fields);
}

export function readAccess(token: string, signal: AbortSignal) {
  return request<Access>('/auth/me', { signal, headers: { Authorization: `Bearer ${token}` } });
}

export function readSettings(list: SettingList, token: string, signal: AbortSignal) {
  return request<Setting[]>(`/organization/${list}`, { signal, headers: { Authorization: `Bearer ${token}` } });
}

export function writeSetting(list: SettingList, token: string, fields: object, id?: string) {
  return write<Setting>(`/organization/${list}${id ? '/' + id : ''}`, id ? 'PATCH' : 'POST', token, fields);
}

export function readOrders(token: string, page: number, signal: AbortSignal) {
  return request<OrderPage>(`/organization/orders?page=${page}&limit=${pageSize}`, {
    signal, headers: { Authorization: `Bearer ${token}` },
  });
}

export function readProvinces(signal: AbortSignal) {
  return request<Province[]>('/locations/provinces', { signal });
}

export async function readProvinceCities(code: string, signal: AbortSignal) {
  const items: City[] = [];
  for (let page = 1; page <= 10000; page++) {
    const query = new URLSearchParams({ provinceCode: code, page: String(page), limit: '100' });
    const response = await request<CityPage>(`/locations/cities?${query}`, { signal });
    items.push(...response.items);
    if (items.length >= response.total || !response.items.length) break;
  }
  return items;
}
