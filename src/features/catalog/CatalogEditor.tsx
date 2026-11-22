import { useEffect, useRef, useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import { ApiError, deleteCatalog, readCatalogChoices, saveCatalog } from '../../api';
import { type CatalogItem, type Section } from './catalog';
import TagManager from './TagManager';

export type EditorMode = 'create' | 'edit' | 'quick' | 'delete';
const titles = { create: 'افزودن رکورد', edit: 'ویرایش کامل', quick: 'ویرایش سریع', delete: 'حذف رکورد' };

export default function CatalogEditor({ section, mode, item, token, onClose, onSaved, onExpired }: {
  section: Section; mode: EditorMode; item?: CatalogItem; token: string;
  onClose: () => void; onSaved: () => void; onExpired: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [kind, setKind] = useState(item?.kind ?? 'master');
  const [tags, setTags] = useState(item?.tagIds ?? []);
  const [categories, setCategories] = useState<CatalogItem[]>([]);
  const [brands, setBrands] = useState<CatalogItem[]>([]);
  const [masters, setMasters] = useState<CatalogItem[]>([]);
  const [choicesStatus, setChoicesStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const full = mode === 'edit' || mode === 'create';
  const masterChoice = full && section === 'products' && mode === 'create';
  const needChoices = full && section !== 'brands';

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  useEffect(() => {
    if (!needChoices) return;
    const controller = new AbortController();
    Promise.all([
      readCatalogChoices('categories', token, controller.signal),
      section === 'products' ? readCatalogChoices('brands', token, controller.signal) : [],
      masterChoice ? readCatalogChoices('products', token, controller.signal) : [],
    ]).then(([categoryRows, brandRows, productRows]) => {
      if (controller.signal.aborted) return;
      setCategories(categoryRows);
      setBrands(brandRows);
      setMasters(productRows.filter(product => product.kind === 'master'));
      setChoicesStatus('ready');
    }).catch(error => {
      if (controller.signal.aborted) return;
      if (error instanceof ApiError && error.status === 401) onExpired();
      else setChoicesStatus('error');
    });
    return () => controller.abort();
  }, [needChoices, section, masterChoice, token, onExpired]);

  function parentChoices() {
    const blocked = new Set<string>();
    if (item) {
      blocked.add(item._id);
      for (let pass = 0; pass < 2; pass++) {
        for (const category of categories) {
          if (category.parentId && blocked.has(category.parentId._id)) blocked.add(category._id);
        }
      }
    }
    return categories.filter(category => !blocked.has(category._id) && (category.level ?? 3) < 3);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const form = new FormData(event.currentTarget);
    const value = (key: string) => String(form.get(key) ?? '').trim();
    const numeric = (key: string) => value(key) ? Number(value(key)) : undefined;
    try {
      if (mode === 'delete' && item) {
        await deleteCatalog(section, token, item._id);
      } else {
        const body: Record<string, unknown> = { name: value('name'), isActive: form.get('isActive') === 'on' };
        if (full) {
          for (const field of ['slug', 'imageUrl', 'thumbnailUrl', 'shortDescription', 'description']) body[field] = value(field);
          body.tagIds = tags.map(tag => tag._id);
          if (section === 'categories') body.parentId = value('parentId') || null;
          if (section === 'products') {
            body.kind = kind;
            body.sku = value('sku');
            body.itemId = value('itemId');
            const dimensions = ['lengthMm', 'widthMm', 'heightMm'] as const;
            const hasDimensions = dimensions.some(key => value(key));
            if (hasDimensions && dimensions.some(key => !value(key))) throw new Error('هر سه بُعد بسته را وارد کنید.');
            body.physical = {
              standardDensityKgM3: numeric('standardDensityKgM3'), shippingWeightG: numeric('shippingWeightG'),
              ...(hasDimensions && { shippingDimensions: Object.fromEntries(dimensions.map(key => [key, numeric(key)])) }),
            };
            const optionRows = value('options').split('\n').filter(line => line.trim());
            body.options = optionRows.map(line => {
              const [name, ...rest] = line.split('=');
              const optionValue = rest.join('=').trim();
              if (!name.trim() || !optionValue) throw new Error('هر مشخصه باید در یک خط و به صورت «نام=مقدار» باشد.');
              return { name: name.trim(), value: optionValue };
            });
            if (kind === 'variant') {
              if (mode === 'create') body.masterId = value('masterId');
              body.priceAdjustment = numeric('priceAdjustment') ?? 0;
            } else {
              body.categoryId = value('categoryId');
              body.brandId = value('brandId') || null;
              body.basePrice = { amount: numeric('amount'), currency: value('currency') };
            }
          }
        }
        await saveCatalog(section, token, body, item?._id);
      }
      dialog.current?.close();
      onSaved();
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) onExpired();
      else setError(error instanceof Error && error.message ? error.message : 'ذخیره تغییرات ممکن نشد.');
    } finally { setBusy(false); }
  }

  const physical = item?.physical;
  return (
    <dialog ref={dialog} className="catalog-editor" aria-labelledby="editor-title"
      onCancel={event => { if (busy) event.preventDefault(); }} onClose={onClose}>
      <div className="editor-heading">
        <h2 id="editor-title">{titles[mode]}</h2>
        <button type="button" className="icon-button" aria-label="بستن فرم" disabled={busy} onClick={() => dialog.current?.close()}><X size={18} /></button>
      </div>
      <form onSubmit={submit}>
        {mode === 'delete' ? <p>«{item?.name}» حذف شود؟</p> : (!needChoices || choicesStatus === 'ready') && (
          <fieldset className="editor-fields" disabled={busy}>
            <label>نام<input name="name" defaultValue={item?.name} maxLength={160} required autoFocus /></label>
            <label className="editor-checkbox"><input name="isActive" type="checkbox" defaultChecked={item?.isActive ?? true} /> فعال</label>
            {full && (
              <>
                <label>نشانی خوانا (slug)<input name="slug" dir="ltr" defaultValue={item?.slug} maxLength={160} required /></label>
                {section === 'categories' && (
                  <label>دسته والد
                    <select aria-label="دسته والد" name="parentId" defaultValue={item?.parentId?._id ?? ''}>
                      <option value="">بدون والد (سطح اول)</option>
                      {parentChoices().map(category => <option key={category._id} value={category._id}>{category.parentId ? `${category.parentId.name} / ` : ''}{category.name}</option>)}
                    </select>
                  </label>
                )}
                {section === 'products' && (
                  <>
                    <label>SKU<input name="sku" dir="ltr" defaultValue={item?.sku} maxLength={64} required /></label>
                    <label>شناسه حسابداری<input name="itemId" dir="ltr" defaultValue={item?.itemId} maxLength={100} /></label>
                    <label>نوع محصول
                      <select value={kind} disabled={mode === 'edit'} onChange={event => setKind(event.target.value as typeof kind)}>
                        <option value="master">محصول اصلی</option><option value="variant">گزینه محصول</option>
                      </select>
                    </label>
                    {kind === 'variant' ? (
                      <>
                        {mode === 'create' ? <label>محصول اصلی<select aria-label="محصول اصلی" name="masterId" required><option value="">انتخاب محصول</option>{masters.map(master => <option key={master._id} value={master._id}>{master.name} · {master.sku}</option>)}</select></label>
                          : <label>محصول اصلی<input value={item?.masterId?.name ?? ''} readOnly /></label>}
                        <label>تعدیل قیمت<input name="priceAdjustment" type="number" step="1" defaultValue={item?.priceAdjustment ?? 0} /></label>
                      </>
                    ) : (
                      <>
                        <label>دسته‌بندی<select aria-label="دسته‌بندی" name="categoryId" defaultValue={item?.categoryId?._id ?? ''} required>
                          <option value="">انتخاب دسته سطح دوم یا سوم</option>
                          {categories.filter(category => (category.level ?? 0) >= 2).map(category => <option key={category._id} value={category._id}>{category.parentId ? `${category.parentId.name} / ` : ''}{category.name}</option>)}
                        </select></label>
                        <label>برند<select aria-label="برند" name="brandId" defaultValue={item?.brandId?._id ?? ''}>
                          <option value="">بدون برند</option>{brands.map(brand => <option key={brand._id} value={brand._id}>{brand.name}</option>)}
                        </select></label>
                        <label>مبلغ پایه<input name="amount" type="number" step="1" min="0" max={Number.MAX_SAFE_INTEGER} defaultValue={item?.basePrice?.amount} required /></label>
                        <label>کد ارز<input name="currency" dir="ltr" pattern="[A-Za-z]{3}" defaultValue={item?.basePrice?.currency ?? 'IRR'} required /></label>
                      </>
                    )}
                    <details className="editor-wide editor-details">
                      <summary>مشخصات فیزیکی و گزینه‌ها</summary>
                      <div className="editor-fields">
                        <label>چگالی استاندارد (kg/m³)<input type="number" step="any" name="standardDensityKgM3" defaultValue={physical?.standardDensityKgM3} /></label>
                        <label>وزن حمل (گرم)<input type="number" step="any" name="shippingWeightG" defaultValue={physical?.shippingWeightG} /></label>
                        <label>طول (میلی‌متر)<input type="number" step="any" name="lengthMm" defaultValue={physical?.shippingDimensions?.lengthMm} /></label>
                        <label>عرض (میلی‌متر)<input type="number" step="any" name="widthMm" defaultValue={physical?.shippingDimensions?.widthMm} /></label>
                        <label>ارتفاع (میلی‌متر)<input type="number" step="any" name="heightMm" defaultValue={physical?.shippingDimensions?.heightMm} /></label>
                        <label className="editor-wide">گزینه‌ها (هر خط: نام=مقدار)<textarea name="options" rows={3} defaultValue={item?.options?.map(option => `${option.name}=${option.value}`).join('\n')} /></label>
                      </div>
                    </details>
                  </>
                )}
                <label>آدرس تصویر اصلی<input name="imageUrl" dir="ltr" defaultValue={item?.imageUrl} maxLength={2048} /></label>
                <label>آدرس تصویر کوچک<input name="thumbnailUrl" dir="ltr" defaultValue={item?.thumbnailUrl} maxLength={2048} /></label>
                <label className="editor-wide">توضیح کوتاه<input name="shortDescription" defaultValue={item?.shortDescription} maxLength={500} /></label>
                <label className="editor-wide">توضیح کامل<textarea name="description" rows={4} defaultValue={item?.description} maxLength={20000} /></label>
                <TagManager value={tags} onChange={setTags} token={token} onExpired={onExpired} />
              </>
            )}
          </fieldset>
        )}
        {needChoices && choicesStatus === 'loading' && <p role="status">در حال دریافت گزینه‌ها…</p>}
        {needChoices && choicesStatus === 'error' && <p className="editor-error" role="alert">دریافت گزینه‌ها انجام نشد. فرم را دوباره باز کنید.</p>}
        {error && <p className="editor-error" role="alert">{error}</p>}
        <div className="editor-actions">
          <button type="button" disabled={busy} onClick={() => dialog.current?.close()}>انصراف</button>
          <button className={mode === 'delete' ? 'danger-button' : 'save-button'} type="submit"
            disabled={busy || (needChoices && choicesStatus !== 'ready')}>
            {busy ? 'در حال ثبت…' : mode === 'delete' ? 'حذف قطعی' : 'ذخیره'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
