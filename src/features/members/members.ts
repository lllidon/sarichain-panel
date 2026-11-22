import type { AccessRole } from '../organization/organization';
import { Handshake, ShoppingBag, Sprout, Users } from 'lucide-react';

export const memberSections = {
  users: { label: 'کاربران پنل', icon: Users, typeLabel: 'واحد', types: { sales: 'فروش', finance: 'مالی', management: 'مدیریت', commerce: 'بازرگانی', operations: 'عملیات', other: 'سایر' } },
  customers: { label: 'مشتریان', icon: ShoppingBag, typeLabel: 'نوع مشتری', types: { consumer: 'مشتری نهایی', retailer: 'مغازه‌دار', wholesaler: 'خریدار عمده', other: 'سایر' } },
  producers: { label: 'تولیدکنندگان', icon: Sprout, typeLabel: 'نوع تولیدکننده', types: { orchard: 'باغدار', farm: 'کشاورز', dairy: 'گاوداری', greenhouse: 'گلخانه', other: 'سایر' } },
  'service-providers': { label: 'ارائه‌دهندگان خدمات', icon: Handshake, typeLabel: 'نوع خدمت', types: { driver: 'راننده', warehouse: 'انباردار', harvest: 'برداشت و میوه‌چینی', labor: 'نیروی کار', supervisor: 'ناظر', quality: 'کنترل کیفیت', other: 'سایر' } },
};

export type MemberGroup = keyof typeof memberSections;
export type Member = {
  _id: string;
  username?: string;
  role?: AccessRole;
  branchId?: { _id: string; name: string };
  profileId?: { _id: string; name: string };
  fullName?: string;
  phone?: string;
  type?: string;
  email?: string;
  organization?: string;
  province?: string;
  provinceCode?: string;
  cityCode?: string;
  city?: string;
  address?: string;
  notes?: string;
  productionActivity?: string;
  serviceArea?: string;
  isActive?: boolean;
};
export type MemberPage = { items: Member[]; total: number; page: number; limit: number };
