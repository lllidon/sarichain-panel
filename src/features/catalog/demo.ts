import { type CatalogItem, type CatalogPage, type Section, pageSize } from './catalog';

const make = (id: string, name: string, extra: Partial<CatalogItem> = {}): CatalogItem => ({
  _id: id, name, slug: id, isActive: true, ...extra,
});

const rootNames = [
  ['fresh-produce', 'میوه و سبزیجات'],
  ['protein', 'گوشت، مرغ، ماهی و تخم‌مرغ'],
  ['dairy', 'لبنیات'],
  ['legumes-grains', 'حبوبات و غلات'],
  ['spices-herbs', 'ادویه‌جات و گیاهان معطر'],
  ['nuts-seeds', 'خشکبار، مغزها و دانه‌ها'],
  ['oils-natural', 'روغن‌ها، عسل و فرآورده‌های طبیعی'],
  ['processed-local', 'محصولات فرآوری‌شده، محلی و نوشیدنی‌ها'],
] as const;

const childNames = [
  ['fresh-fruit', 'میوه تازه', 'fresh-produce'],
  ['vegetables', 'سبزیجات و صیفی‌جات', 'fresh-produce'],
  ['fresh-herbs', 'سبزی خوردن و گیاهان تازه', 'fresh-produce'],
  ['mushrooms', 'قارچ و محصولات گلخانه‌ای', 'fresh-produce'],
  ['red-meat', 'گوشت قرمز', 'protein'],
  ['poultry', 'مرغ و طیور', 'protein'],
  ['fish-seafood', 'ماهی و آبزیان', 'protein'],
  ['eggs', 'تخم‌مرغ', 'protein'],
  ['milk-cream', 'شیر و خامه', 'dairy'],
  ['yogurt-doogh', 'ماست و دوغ', 'dairy'],
  ['cheese-butter', 'پنیر و کره', 'dairy'],
  ['legumes', 'حبوبات', 'legumes-grains'],
  ['rice', 'برنج', 'legumes-grains'],
  ['grains-flour', 'غلات و آرد', 'legumes-grains'],
  ['spices', 'ادویه‌جات', 'spices-herbs'],
  ['aromatic-herbs', 'گیاهان معطر و سبزی خشک', 'spices-herbs'],
  ['medicinal-herbs', 'گیاهان دارویی خوراکی', 'spices-herbs'],
  ['nuts', 'مغزها و آجیل', 'nuts-seeds'],
  ['dried-fruit', 'میوه خشک و خشکبار', 'nuts-seeds'],
  ['edible-seeds', 'دانه‌های خوراکی', 'nuts-seeds'],
  ['edible-oils', 'روغن‌های خوراکی', 'oils-natural'],
  ['honey-bee', 'عسل و فرآورده‌های زنبورداری', 'oils-natural'],
  ['natural-syrups', 'شیره‌ها و فرآورده‌های طبیعی', 'oils-natural'],
  ['pickles-preserves', 'ترشی، شور و کنسرویجات', 'processed-local'],
  ['jams-pastes', 'مربا، رب و چاشنی‌ها', 'processed-local'],
  ['dried-processed', 'محصولات خشک و فرآوری‌شده', 'processed-local'],
  ['beverages', 'نوشیدنی‌ها و عرقیات', 'processed-local'],
] as const;

const roots = rootNames.map(([id, name]) => make(id, name, { level: 1 }));
const rootById = new Map(roots.map(item => [item._id, item]));
const children = childNames.map(([id, name, parentId]) => {
  const parent = rootById.get(parentId)!;
  return make(id, name, { level: 2, parentId: { _id: parent._id, name: parent.name } });
});

const thirdLevelNames = [
  ['citrus', 'مرکبات', 'fresh-fruit', 'میوه تازه'],
  ['apples-pears', 'سیب و گلابی', 'fresh-fruit', 'میوه تازه'],
  ['leafy-vegetables', 'سبزیجات برگی', 'vegetables', 'سبزیجات و صیفی‌جات'],
  ['tomato-cucumber', 'گوجه و خیار', 'vegetables', 'سبزیجات و صیفی‌جات'],
  ['lamb-beef', 'گوشت گوسفند و گاو', 'red-meat', 'گوشت قرمز'],
  ['chicken-turkey', 'مرغ و بوقلمون', 'poultry', 'مرغ و طیور'],
  ['lentils-beans', 'عدس و انواع لوبیا', 'legumes', 'حبوبات'],
  ['chickpeas-peas', 'نخود و لپه', 'legumes', 'حبوبات'],
  ['saffron-pepper', 'زعفران و فلفل', 'spices', 'ادویه‌جات'],
  ['walnut-almond', 'گردو و بادام', 'nuts', 'مغزها و آجیل'],
] as const;
const childById = new Map(children.map(item => [item._id, item]));
const third = thirdLevelNames.map(([id, name, parentId, parentName]) => {
  const parent = childById.get(parentId)!;
  return make(id, name, { level: 3, parentId: { _id: parent._id, name: parentName } });
});
const categories = [...roots, ...children, ...third];

const brands = [
  make('bagh-sabz', 'باغ سبز دماوند'),
  make('sepid-dasht', 'دامداری سپیددشت'),
  make('shomal-daneh', 'دانه‌زار شمال'),
  make('koohestan', 'عسل کوهستان'),
];

const samples = [
  ['apple', 'سیب قرمز دماوند', 85000, 'apples-pears', 0],
  ['orange', 'پرتقال تامسون شمال', 62000, 'citrus', 0],
  ['cucumber', 'خیار گلخانه‌ای', 39000, 'tomato-cucumber', 0],
  ['tomato', 'گوجه‌فرنگی بوته‌ای', 48000, 'tomato-cucumber', 0],
  ['carrot', 'هویج تازه', 35000, 'vegetables', 0],
  ['mushroom', 'قارچ دکمه‌ای', 115000, 'mushrooms', 0],
  ['lamb', 'گوشت گوسفندی خورشتی', 690000, 'lamb-beef', 1],
  ['chicken', 'مرغ کامل تازه', 105000, 'chicken-turkey', 1],
  ['trout', 'ماهی قزل‌آلای پرورشی', 245000, 'fish-seafood', 1],
  ['eggs', 'تخم‌مرغ محلی', 125000, 'eggs', 1],
  ['milk', 'شیر گاو تازه', 42000, 'milk-cream', 1],
  ['yogurt', 'ماست سنتی پرچرب', 95000, 'yogurt-doogh', 1],
  ['cheese', 'پنیر محلی گوسفندی', 260000, 'cheese-butter', 1],
  ['lentils', 'عدس سبز درشت', 135000, 'lentils-beans', 2],
  ['chickpeas', 'نخود کرمانشاه', 145000, 'chickpeas-peas', 2],
  ['rice', 'برنج طارم محلی', 185000, 'rice', 2],
  ['saffron', 'زعفران نگین', 7800000, 'saffron-pepper', 3],
  ['turmeric', 'زردچوبه قلم', 210000, 'spices', 3],
  ['walnut', 'گردوی پوست‌کاغذی', 420000, 'walnut-almond', 2],
  ['pistachio', 'پسته اکبری', 950000, 'nuts', 2],
  ['raisins', 'کشمش آفتابی', 165000, 'dried-fruit', 2],
  ['olive-oil', 'روغن زیتون بکر', 680000, 'edible-oils', 3],
  ['honey', 'عسل چندگیاه کوهستان', 520000, 'honey-bee', 3],
  ['pickles', 'خیارشور خانگی', 115000, 'pickles-preserves', 0],
  ['jam', 'مربای به خانگی', 185000, 'jams-pastes', 0],
  ['juice', 'آب انار طبیعی', 95000, 'beverages', 0],
] as const;

const categoryById = new Map(categories.map(item => [item._id, item]));
const products: CatalogItem[] = samples.map(([id, name, price, categoryId, brand], index) => {
  const category = categoryById.get(categoryId)!;
  return make(id, name, {
    sku: `SC-${2001 + index}`,
    itemId: `00${601 + index}`,
    thumbnailUrl: '/img/catalog/field.webp',
    imageUrl: '/img/catalog/field.webp',
    kind: 'master',
    categoryId: { _id: category._id, name: category.name },
    brandId: { _id: brands[brand]._id, name: brands[brand].name },
    basePrice: { amount: price * 10, currency: 'IRR' },
    saleUnit: category.name.includes('شیر') ? 'لیتر' : 'کیلوگرم',
    isActive: true,
  });
});

export function demoPage(section: Section, search: string, page: number): CatalogPage {
  const collections = { products, categories, brands };
  const query = search.trim().toLowerCase();
  const items = collections[section].filter(item =>
    [item.name, item.slug, item.sku, item.itemId].some(value => value?.toLowerCase().includes(query)),
  );
  return { items: items.slice((page - 1) * pageSize, page * pageSize), total: items.length, page, limit: pageSize };
}
