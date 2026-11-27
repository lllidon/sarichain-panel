import type { City, CityPage, Province } from './features/locations/locations';
import type { Access, OrderPage, Setting, SettingList } from './features/organization/organization';
import type { Supplier, SupplierPage } from './features/directory/suppliers';
import type { Member, MemberGroup, MemberPage } from './features/members/members';
import { type CatalogPage, type Section, type NamedRecord, pageSize } from './features/catalog/catalog';


export type TransportVehicle = {
  _id: string;
  memberId: string;
  type: string;
  className?: string;
  model: string;
  year: number;
  capacityKg: number;
  plate: string;
  license: string;
  licenseClass?: string;
  bodyType?: string;
  insuranceExpiry?: string;
  technicalInspectionExpiry?: string;
  description?: string;
  updatedAt?: string;
  member?: { _id: string; fullName?: string; phone?: string; organization?: string; city?: string; serviceTypes?: string[]; isActive?: boolean };
};
export type TransportVehiclePage = { items: TransportVehicle[]; total: number; page: number; limit: number };

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

export function readTransportVehicles(token: string, search: string, page: number, signal: AbortSignal) {
  const query = new URLSearchParams({ search, page: String(page), limit: String(pageSize) });
  return request<TransportVehiclePage>(`/organization/transport-vehicles?${query}`, {
    signal, headers: { Authorization: `Bearer ${token}` },
  });
}

export type TransportOrderCandidate = {
  memberId: string; fullName: string; phone?: string; city?: string;
  vehicleType: string; model: string; capacityKg: number; capacityM3?: number;
};
export type TransportOrder = {
  _id: string; memberId: string; customer?: { fullName?: string; phone?: string; organization?: string };
  stops: Array<{ kind: 'pickup' | 'dropoff'; label: string; province: string; city: string; address: string; latitude: number; longitude: number }>;
  goodsType: string; weightKg: number; volumeM3: number; urgency: string; deadline: string; description?: string;
  quote: { category: string; zoneId?: string; speed?: string; distanceKm: number; directDistanceKm?: number; roadDistanceKm?: number | null; distanceSource?: 'road' | 'direct_estimate'; billableWeightKg?: number; standardKar: number; specialKar: number; routingPending?: boolean };
  status: string; candidates: TransportOrderCandidate[]; specialCarrierIds?: string[]; createdAt: string;
};
export type TransportOrderPage = { items: TransportOrder[]; total: number; page: number; limit: number };
export type TransportTariffs = {
  intracityBaseKar: number; intercityBaseKar: number; interprovincialBaseKar: number;
  perKmKar: number; perKgKar: number; perCubicMeterKar: number;
  hourlyMultiplier: number; dailyMultiplier: number; multidayMultiplier: number; specialMultiplier: number;
};

export function readTransportOrders(token: string, search: string, page: number, signal: AbortSignal) {
  const query = new URLSearchParams({ search, page: String(page), limit: String(pageSize) });
  return request<TransportOrderPage>(`/organization/transport-orders?${query}`, {
    signal, headers: { Authorization: `Bearer ${token}` },
  });
}
export function reviewTransportOrder(token: string, id: string, status: 'approved' | 'rejected', specialCarrierIds: string[]) {
  return write<{ id: string; status: string; matchedCount?: number; specialCount?: number }>(
    `/organization/transport-orders/${id}`, 'PATCH', token, { status, specialCarrierIds });
}
export function readTransportTariffs(token: string, signal: AbortSignal) {
  return request<TransportTariffs>('/organization/transport-tariffs', { signal, headers: { Authorization: `Bearer ${token}` } });
}
export function saveTransportTariffs(token: string, fields: TransportTariffs) {
  return write<TransportTariffs>('/organization/transport-tariffs', 'PATCH', token, fields);
}

export type TransportSpeed = 'normal' | 'special' | 'express' | 'urgent';
export type TransportZoneTariffs = {
  baseKar:number; distanceWeight:number; billableWeightWeight:number; stopWeight:number;
  densityKgPerM3:number; minimumKar:number;
  refrigeratedBaseKar:number; refrigeratedPerKgKar:number; fragileMultiplier:number;
  hubEnabled:boolean; hubLatitude?:number|null; hubLongitude?:number|null; hubHandlingKar:number; hubPerKgKar:number;
  hubSupportsRefrigeration:boolean; hubSupportsFragile:boolean; hubMaxWeightKg:number; hubMaxVolumeM3:number;
  normalMultiplier:number; specialMultiplier:number; expressMultiplier:number; urgentMultiplier:number;
  zones:Array<{id:string;label:string;minKm:number;maxKm:number|null}>;
  speeds:Array<{id:TransportSpeed;label:string;target:string}>;
};
export function readTransportZoneTariffs(token: string, signal: AbortSignal) {
  return request<TransportZoneTariffs>('/organization/transport-zone-tariffs', { signal, headers: { Authorization: `Bearer ${token}` } });
}
export function saveTransportZoneTariffs(token: string, fields: Omit<TransportZoneTariffs, 'zones'|'speeds'>) {
  return write<TransportZoneTariffs>('/organization/transport-zone-tariffs', 'PATCH', token, fields);
}

export type AccountUpgradeRequest = {
  _id: string; memberId: string; kind: 'transport' | 'producer'; status: 'pending' | 'approved' | 'rejected';
  producerType?: string; requestedCategoryIds?: string[]; requestedCategoryLabels?: string[];
  vehicle?: { type: string; model: string; year: number; capacityKg: number; capacityM3?: number; plate: string; license: string };
  memberSnapshot?: { fullName?: string; phone?: string; organization?: string };
  documents: Array<{ type: string; fileName: string; mimeType: string; dataUrl: string }>;
  reviewNote?: string; createdAt: string;
};
export function readAccountUpgradeRequests(token: string, signal: AbortSignal) {
  return request<{ items: AccountUpgradeRequest[] }>('/members/account-upgrades/requests', {
    signal, headers: { Authorization: `Bearer ${token}` },
  });
}
export function reviewAccountUpgradeRequest(token: string, id: string, status: 'approved' | 'rejected', note: string) {
  return write<{ id: string; status: string }>(`/members/account-upgrades/${id}/review`, 'PATCH', token, { status, note });
}


export type SellerStock = {
  sellerId: string; name: string; city?: string; offerId: string;
  price: number; stock: number; reservedStock: number; availableStock: number;
  unit?: string; updatedAt?: string;
};
export type InventoryProduct = {
  _id: string; name: string; sku?: string; unit?: string; isActive: boolean;
  totalStock: number; reservedStock: number; availableStock: number;
  sellerCount: number; sellers: SellerStock[];
};
export type InventoryProductPage = {
  items: InventoryProduct[]; total: number; page: number; limit: number;
  summary: { products: number; totalStock: number; availableStock: number; sellerOffers: number };
};
export function readInventoryProducts(token: string, search: string, page: number, signal: AbortSignal) {
  const query = new URLSearchParams({ search, page: String(page), limit: '20' });
  return request<InventoryProductPage>(`/inventory/products?${query}`, {
    signal, headers: { Authorization: `Bearer ${token}` },
  });
}

export type StoreOrderLine = { _id?: string; name: string; quantity: number; unitName?: string; unitPrice?: { min: number; max: number }; lineSubtotal?: { min: number; max: number }; image?: string | null; sellerName?: string; sku?: string };
export type StoreOrder = { _id: string; orderNumber: string; status: string; total: number; subtotal?: { min: number; max: number }; price?: { min: number; max: number }; createdAt?: string; updatedAt?: string; customer?: { fullName?: string; phone?: string; organization?: string }; items: StoreOrderLine[]; delivery?: { method?: string; trackingCode?: string; expectedAt?: string; estimatedDeliveryAt?: string; deliveryDate?: string; addressSnapshot?: { title?: string; address?: string; city?: string; province?: string } }; adminNote?: string; meta?: { shipping?: { fee?: number; status?: string }; payment?: { status?: string } }; events?: Array<{ fromStatus?: string; toStatus?: string; occurredAt?: string }> };
export type StoreOrderStatus = 'all' | 'current' | 'pending' | 'confirmed' | 'processing' | 'shipped' | 'completed' | 'cancelled' | 'returned';
export type StoreOrderPage = { items: StoreOrder[]; total: number; page: number; limit: number; counts: { current: number; completed: number; returned: number; cancelled: number; total: number } };
export function readStoreOrders(token: string, page: number, status: StoreOrderStatus, search: string, signal: AbortSignal) {
  const query = new URLSearchParams({ page: String(page), limit: '100', status, search });
  return request<StoreOrderPage>(`/organization/store-orders?${query}`, { signal, headers: { Authorization: `Bearer ${token}` } });
}
export function readStoreOrder(token: string, id: string, signal: AbortSignal) {
  return request<StoreOrder>(`/organization/store-orders/${encodeURIComponent(id)}`, { signal, headers: { Authorization: `Bearer ${token}` } });
}
export function updateStoreOrder(token: string, id: string, fields: { status?: string; total?: number; shippingFee?: number; trackingCode?: string; adminNote?: string }) {
  return write<StoreOrder>(`/organization/store-orders/${encodeURIComponent(id)}`, 'PATCH', token, fields);
}

export type StoreOrderBoardAction = { id: string; label: string; type: 'status' | 'print'; targetStatus?: string };
export type StoreOrderBoardColumn = { id: string; title: string; statuses: string[]; color: string; actions: StoreOrderBoardAction[] };
export type StoreOrderBoardConfig = { columns: StoreOrderBoardColumn[] };
export function readStoreOrderBoardConfig(token: string, signal: AbortSignal) {
  return request<StoreOrderBoardConfig>('/organization/store-orders/board-config', { signal, headers: { Authorization: `Bearer ${token}` } });
}
export function saveStoreOrderBoardConfig(token: string, config: StoreOrderBoardConfig) {
  return write<StoreOrderBoardConfig>('/organization/store-orders/board-config', 'PUT', token, config);
}
export async function readAllStoreOrders(token: string, search: string, signal: AbortSignal) {
  const all: StoreOrder[] = [];
  let page = 1;
  let total = 0;
  do {
    const result = await readStoreOrders(token, page, 'all', search, signal);
    all.push(...result.items);
    total = result.total;
    page += 1;
    if (!result.items.length) break;
  } while (all.length < total && page <= 1000);
  return all;
}
