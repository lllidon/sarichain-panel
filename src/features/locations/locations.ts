export type Province = { code: string; name: string };
export type City = Province & { provinceCode: string };
export type CityPage = { items: City[]; total: number; page: number; limit: number };
export type Placement = { province?: string; city?: string; provinceCode?: string; cityCode?: string };

export const locationLabel = (name: string) => name.trim().replace(/ي/g, 'ی').replace(/ك/g, 'ک')
  .replace(/[\s\u200c]+/g, '');
