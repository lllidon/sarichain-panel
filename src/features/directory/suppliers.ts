import type { NamedRecord } from '../catalog/catalog';

export type Supplier = {
  _id: string; name: string; phone: string; city: string; province: string;
  contactName?: string; alternatePhone?: string; email?: string; website?: string;
  address?: string; hours?: string; description?: string; tagIds?: NamedRecord[];
  isActive?: boolean; priority?: number; feedbackCount?: number; positiveFeedbackCount?: number;
};
export type SupplierPage = { items: Supplier[]; total: number; page: number; limit: number };
