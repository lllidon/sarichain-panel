import { type CatalogItem, type CatalogPage, type Section, pageSize } from './catalog';

const make = (id: string, name: string, extra: Partial<CatalogItem> = {}): CatalogItem => ({
  _id: id, name, slug: id, isActive: true, ...extra,
});

const categories = [
  make('farm-inputs', 'نهاده‌های کشاورزی', { level: 1 }),
  make('plant-nutrition', 'تغذیه گیاه', { level: 2, parentId: { _id: 'farm-inputs', name: 'نهاده‌های کشاورزی' } }),
  make('biostimulants', 'محرک رشد', { level: 3, parentId: { _id: 'plant-nutrition', name: 'تغذیه گیاه' } }),
  make('biofertilizers', 'کود زیستی', { level: 3, parentId: { _id: 'plant-nutrition', name: 'تغذیه گیاه' } }),
  make('soil', 'بهبوددهنده خاک', { level: 2, parentId: { _id: 'farm-inputs', name: 'نهاده‌های کشاورزی' } }),
];

const brands = [make('sarv', 'سرو سبز'), make('baran', 'کشت باران'), make('rooyesh', 'رویش مازندران')];

const samples = [
  ['bio-boost', 'بیو بوست پلاس', 250000, 2, 0],
  ['root-max', 'روت مکس', 320000, 2, 0],
  ['fruit-pro', 'فرایت پرو', 280000, 2, 1],
  ['soil-life', 'سویل لایف', 350000, 4, 2],
  ['nitro-fix', 'نیتروفیکس', 290000, 3, 1],
  ['amino-grow', 'آمینو گرو', 380000, 1, 0],
  ['humic-acid', 'هیومیک اسید', 180000, 4, 2],
  ['sea-wind', 'سی ویند', 420000, 1, 1],
] as const;

const products = samples.map(([id, name, price, category, brand], index) => make(id, name, {
  sku: `SC-${1001 + index}`,
  itemId: `00${501 + index}`,
  thumbnailUrl: `/img/${id}.webp`,
  kind: 'master',
  categoryId: categories[category],
  brandId: brands[brand],
  basePrice: { amount: price * 10, currency: 'IRR' },
  isActive: index !== 4,
}));

products.push(make('bio-boost-carton', 'بیو بوست پلاس · بسته کارتن', {
  sku: 'SC-1009', itemId: '00509', thumbnailUrl: '/img/bio-boost.webp', kind: 'variant',
  masterId: products[0], categoryId: categories[2], brandId: brands[0], priceAdjustment: 350000,
}));

export function demoPage(section: Section, search: string, page: number): CatalogPage {
  const collections = { products, categories, brands };
  const query = search.trim().toLowerCase();
  const items = collections[section].filter(item =>
    [item.name, item.slug, item.sku, item.itemId].some(value => value?.toLowerCase().includes(query)),
  );
  return { items: items.slice((page - 1) * pageSize, page * pageSize), total: items.length, page, limit: pageSize };
}
