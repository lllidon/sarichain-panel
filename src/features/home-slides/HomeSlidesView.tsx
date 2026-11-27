import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { ArrowDown, ArrowUp, ImagePlus, LoaderCircle, Pencil, Plus, Save, Trash2, Upload, X } from 'lucide-react';
import { ApiError, deleteHomeSlide, readHomeSlides, saveHomeSlide, uploadCatalogImage, type HomeSlide, type HomeSlideInput } from '../../api';

function panelImage(url: string) { return url.startsWith('/web/') ? '/api' + url : url; }

const blank: HomeSlideInput = {
  eyebrow: '', title: '', description: '', imageUrl: '', imageAlt: '', cta: '', href: '/categories', order: 0, isActive: true,
};

export default function HomeSlidesView({ token, onExpired }: { token: string; onExpired: () => void }) {
  const [slides, setSlides] = useState<HomeSlide[]>([]);
  const [form, setForm] = useState<HomeSlideInput>(blank);
  const [editing, setEditing] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true); setError('');
    try {
      const rows = await readHomeSlides(token, signal || new AbortController().signal);
      setSlides(rows);
    } catch (reason) {
      if (signal?.aborted) return;
      if (reason instanceof ApiError && reason.status === 401) onExpired();
      else setError(reason instanceof Error ? reason.message : 'دریافت اسلایدرها انجام نشد.');
    } finally { if (!signal?.aborted) setLoading(false); }
  }, [token, onExpired]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  function start(item?: HomeSlide) {
    setEditing(item?._id ?? '');
    setForm(item ? {
      eyebrow: item.eyebrow, title: item.title, description: item.description, imageUrl: item.imageUrl,
      imageAlt: item.imageAlt, cta: item.cta, href: item.href, order: item.order, isActive: item.isActive,
    } : { ...blank, order: slides.length });
    setNotice(''); setError('');
  }

  async function upload(file?: File) {
    if (!file) return;
    setUploading(true); setError('');
    try {
      const result = await uploadCatalogImage(file, token);
      setForm(current => ({ ...current, imageUrl: result.url }));
      setNotice('تصویر بارگذاری شد؛ برای ثبت نهایی، ذخیره اسلاید را بزنید.');
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 401) onExpired();
      else setError(reason instanceof Error ? reason.message : 'بارگذاری تصویر ناموفق بود.');
    } finally { setUploading(false); }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setError(''); setNotice('');
    try {
      await saveHomeSlide(token, form, editing || undefined);
      setNotice(editing ? 'اسلاید ویرایش شد.' : 'اسلاید جدید اضافه شد.');
      setEditing(null);
      await load();
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 401) onExpired();
      else setError(reason instanceof Error ? reason.message : 'ذخیره اسلاید انجام نشد.');
    } finally { setBusy(false); }
  }

  async function remove(item: HomeSlide) {
    if (!window.confirm('این اسلاید حذف شود؟')) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await deleteHomeSlide(token, item._id);
      setNotice('اسلاید حذف شد.');
      if (editing === item._id) setEditing(null);
      await load();
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 401) onExpired();
      else setError(reason instanceof Error ? reason.message : 'حذف اسلاید انجام نشد.');
    } finally { setBusy(false); }
  }

  async function toggle(item: HomeSlide) {
    setBusy(true); setError('');
    try {
      const { _id, ...fields } = item;
      await saveHomeSlide(token, { ...fields, isActive: !item.isActive }, _id);
      await load();
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 401) onExpired();
      else setError(reason instanceof Error ? reason.message : 'تغییر وضعیت انجام نشد.');
    } finally { setBusy(false); }
  }

  async function shift(item: HomeSlide, direction: -1 | 1) {
    const index = slides.findIndex(row => row._id === item._id);
    const other = slides[index + direction];
    if (!other) return;
    setBusy(true); setError('');
    try {
      const save = (row: HomeSlide, order: number) => {
        const { _id, ...fields } = row;
        return saveHomeSlide(token, { ...fields, order }, _id);
      };
      await Promise.all([save(item, other.order), save(other, item.order)]);
      await load();
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 401) onExpired();
      else setError(reason instanceof Error ? reason.message : 'مرتب‌سازی انجام نشد.');
    } finally { setBusy(false); }
  }

  return <main className="workspace home-slides-workspace" dir="rtl">
    <div className="page-heading">
      <span className="page-icon"><ImagePlus size={23}/></span>
      <div><h1>مدیریت اسلایدر صفحه اصلی</h1><p>تصاویر، متن، مقصد دکمه‌ها و ترتیب نمایش بنرهای صفحه اول را مدیریت کنید.</p></div>
      <button type="button" className="add-record" onClick={() => start()}><Plus size={17}/> افزودن اسلاید</button>
    </div>
    {notice && <p className="catalog-notice" role="status">{notice}</p>}
    {error && <p className="home-slides-error" role="alert">{error}</p>}
    {editing !== null && <form className="home-slide-editor" onSubmit={submit}>
      <div className="home-slide-editor-heading"><div><strong>{editing ? 'ویرایش اسلاید' : 'اسلاید جدید'}</strong><small>برای نمایش در صفحه اصلی، وضعیت فعال را روشن نگه دارید.</small></div>
        <button type="button" className="icon-button" aria-label="بستن فرم" onClick={() => setEditing(null)}><X size={18}/></button></div>
      <div className="home-slide-form-grid">
        <label>برچسب بالای عنوان<input required maxLength={120} value={form.eyebrow} onChange={e=>setForm(v=>({...v,eyebrow:e.target.value}))} placeholder="مثلاً از ریشه تا سفره"/></label>
        <label>عنوان اصلی<input required maxLength={180} value={form.title} onChange={e=>setForm(v=>({...v,title:e.target.value}))} placeholder="عنوان بنر"/></label>
        <label className="wide">توضیحات<textarea required maxLength={500} rows={3} value={form.description} onChange={e=>setForm(v=>({...v,description:e.target.value}))} placeholder="توضیح کوتاه و جذاب برای اسلاید"/></label>
        <label>متن دکمه<input required maxLength={60} value={form.cta} onChange={e=>setForm(v=>({...v,cta:e.target.value}))} placeholder="مشاهده محصولات"/></label>
        <label>لینک مقصد دکمه<input required maxLength={2048} value={form.href} onChange={e=>setForm(v=>({...v,href:e.target.value}))} placeholder="/categories"/></label>
        <label className="wide">متن جایگزین تصویر<input required maxLength={180} value={form.imageAlt} onChange={e=>setForm(v=>({...v,imageAlt:e.target.value}))} placeholder="توضیح تصویر برای دسترس‌پذیری"/></label>
        <div className="home-slide-upload wide">
          <div className="home-slide-preview">{form.imageUrl ? <img src={panelImage(form.imageUrl)} alt="پیش‌نمایش اسلاید"/> : <span><ImagePlus size={25}/>تصویر اسلاید</span>}</div>
          <div><strong>تصویر بنر</strong><small>تصویر افقی با کیفیت مناسب انتخاب کنید. ویدئو پشتیبانی نمی‌شود.</small>
            <label className="home-slide-upload-button"><Upload size={16}/>{uploading ? 'در حال بارگذاری…' : 'انتخاب و بارگذاری تصویر'}
              <input type="file" accept="image/jpeg,image/png,image/webp,image/avif" disabled={uploading} onChange={e=>{void upload(e.target.files?.[0]);e.currentTarget.value='';}}/>
            </label>
            <input type="text" value={form.imageUrl} onChange={e=>setForm(v=>({...v,imageUrl:e.target.value}))} placeholder="یا نشانی تصویر را وارد کنید" aria-label="نشانی تصویر"/>
          </div>
        </div>
        <label>ترتیب نمایش<input type="number" min={0} max={10000} value={form.order} onChange={e=>setForm(v=>({...v,order:Number(e.target.value)}))}/></label>
        <label className="home-slide-active"><input type="checkbox" checked={form.isActive} onChange={e=>setForm(v=>({...v,isActive:e.target.checked}))}/> نمایش در صفحه اصلی</label>
      </div>
      <div className="home-slide-form-actions"><button className="save-button" type="submit" disabled={busy||uploading||!form.imageUrl}><Save size={16}/>{busy ? 'در حال ذخیره…' : 'ذخیره اسلاید'}</button><button type="button" className="home-slide-cancel" onClick={()=>setEditing(null)}>انصراف</button></div>
    </form>}
    <section className="home-slide-list">
      <div className="home-slide-list-heading"><div><h2>اسلایدهای ثبت‌شده</h2><p>{slides.length} اسلاید · ترتیب نمایش از بالا به پایین</p></div><button type="button" className="icon-button" title="بارگذاری مجدد" onClick={()=>void load()}><LoaderCircle size={17}/></button></div>
      {loading ? <div className="table-state"><LoaderCircle className="spin" size={22}/>در حال دریافت اسلایدها…</div>
      : !slides.length ? <div className="table-state"><ImagePlus size={26}/>هنوز اسلایدی ثبت نشده است. اولین اسلاید را اضافه کنید.</div>
      : <div className="home-slide-items">{slides.map((item,index)=><article className="home-slide-item" key={item._id}>
        <img src={panelImage(item.imageUrl)} alt={item.imageAlt} onError={event=>{event.currentTarget.style.visibility="hidden";}}/>
        <div className="home-slide-item-copy"><div className="home-slide-item-top"><span className={item.isActive?'status active':'status'}>{item.isActive?'فعال':'غیرفعال'}</span><small>اسلاید {index+1} · ترتیب {item.order}</small></div>
          <strong>{item.title}</strong><p>{item.description}</p><small>{item.href}</small></div>
        <div className="home-slide-item-actions">
          <button type="button" className="icon-button" title="انتقال به بالا" disabled={busy||index===0} onClick={()=>void shift(item,-1)}><ArrowUp size={17}/></button>
          <button type="button" className="icon-button" title="انتقال به پایین" disabled={busy||index===slides.length-1} onClick={()=>void shift(item,1)}><ArrowDown size={17}/></button>
          <button type="button" className="icon-button" title={item.isActive?'غیرفعال کردن':'فعال کردن'} disabled={busy} onClick={()=>void toggle(item)}>{item.isActive?'●':'○'}</button>
          <button type="button" className="icon-button" title="ویرایش" disabled={busy} onClick={()=>start(item)}><Pencil size={17}/></button>
          <button type="button" className="icon-button home-slide-delete" title="حذف" disabled={busy} onClick={()=>void remove(item)}><Trash2 size={17}/></button>
        </div>
      </article>)}</div>}
    </section>
  </main>;
}
