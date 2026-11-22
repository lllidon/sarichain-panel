export type AccessRole = 'management' | 'admin' | 'client';
export type Access = { id: string; role: AccessRole; branchId?: string; profileId?: string; name?: string };

export const roleLabels = { management: 'مدیریت', admin: 'ادمین شعبه', client: 'کلاینت' };

export type SettingList = 'branches' | 'profiles';
export type Setting = { _id: string; code: string; name: string; city?: string; description?: string };
export type Order = { _id: string; number: string; status: string; branchId?: { name: string }; createdAt?: string };
export type OrderPage = { items: Order[]; total: number; page: number; limit: number };
