import { Building2, Layers3, Package } from 'lucide-react';

export const sections = {
  products: { label: 'محصولات', icon: Package, placeholder: 'جستجو با نام، SKU یا شناسه حسابداری' },
  categories: { label: 'دسته‌بندی‌ها', icon: Layers3, placeholder: 'جستجو با نام یا نشانی دسته' },
  brands: { label: 'برندها', icon: Building2, placeholder: 'جستجو با نام یا نشانی برند' },
};

export type Section = keyof typeof sections;
type Reference = { _id: string; name: string } | null;

export type CatalogItem = {
  _id: string;
  name: string;
  slug: string;
  isActive: boolean;
  thumbnailUrl?: string;
  imageUrl?: string;
  shortDescription?: string;
  sku?: string;
  itemId?: string;
  kind?: 'master' | 'variant';
  categoryId?: Reference;
  brandId?: Reference;
  masterId?: Reference;
  parentId?: Reference;
  level?: number;
  basePrice?: { amount: number; currency: string };
  priceAdjustment?: number;
};

export type CatalogPage = { items: CatalogItem[]; total: number; page: number; limit: number };
export const pageSize = 12;
export const number = new Intl.NumberFormat('fa-IR');
