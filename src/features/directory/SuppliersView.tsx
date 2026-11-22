import { useEffect, useRef, useState, type FormEvent } from 'react';
import { BookUser, Pencil, Plus, X } from 'lucide-react';
import { ApiError, listSuppliers, saveSupplier } from '../../api';
import TagManager from '../catalog/TagManager';
import { number } from '../catalog/catalog';
import type { Supplier, SupplierPage } from './suppliers';

const fields = [
  ['name', 'نام تأمین‌کننده', 160, true],
  ['contactName', 'نام رابط', 120],
  ['phone', 'تلفن اصلی', 20, true],
  ['alternatePhone', 'تلفن دوم', 20],
  ['province', 'استان', 100, true],
  ['city', 'شهر', 100, true],
  ['email', 'ایمیل', 254],
  ['website', 'وب‌سایت', 2048],
  ['hours', 'ساعت پاسخ‌گویی', 180],
  ['address', 'نشانی', 500],
  ['description', 'حوزه تأمین و توضیحات', 1500],
] as const;
const metrics = [
  ['priority', 'اولویت معرفی', 100],
  ['feedbackCount', 'کل بازخورد', 1000000],
  ['positiveFeedbackCount', 'بازخورد مثبت', 1000000],
] as const;

function SupplierEditor({ supplier, token, onClose, onSaved, onExpired }: {
  supplier?: Supplier; token: string; onClose: () => void; onSaved: () => void; onExpired: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [tags, setTags] = useState(supplier?.tagIds ?? []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { dialog.current?.showModal(); }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const body = {
      ...Object.fromEntries(fields.map(([key]) => [key, String(values.get(key) ?? '').trim()])),
      ...Object.fromEntries(metrics.map(([key]) => [key, Number(values.get(key))])),
      isActive: values.has('isActive'),
      tagIds: tags.map(tag => tag._id),
    };
    setBusy(true);
    setError('');
    try {
      await saveSupplier(token, body, supplier?._id);
      dialog.current?.close();
      onSaved();
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 401) onExpired();
      else setError(failure instanceof ApiError && failure.message ? failure.message : 'ذخیره انجام نشد.');
    } finally { setBusy(false); }
  }

  return (
    <dialog ref={dialog} className="catalog-editor" aria-labelledby="supplier-title"
      onClose={onClose} onCancel={event => { if (busy) event.preventDefault(); }}>
      <div className="editor-heading">
        <h2 id="supplier-title">{supplier ? 'ویرایش تأمین‌کننده' : 'افزودن تأمین‌کننده'}</h2>
        <button type="button" className="icon-button" aria-label="بستن فرم" disabled={busy} onClick={() => dialog.current?.close()}><X size={18} /></button>
      </div>
      <form onSubmit={save}>
        <fieldset className="editor-fields" disabled={busy}>
          {fields.map(([key, label, max, required]) => (
            <label key={key}>{label}<input name={key} defaultValue={supplier?.[key]} maxLength={max}
              type={key === 'email' ? 'email' : key === 'website' ? 'url' : key === 'phone' || key === 'alternatePhone' ? 'tel' : 'text'} required={required} /></label>
          ))}
          {metrics.map(([key, label, max]) => (
            <label key={key}>{label}<input name={key} type="number" min={0} max={max} step={1} defaultValue={supplier?.[key] ?? 0} required /></label>
          ))}
          <label className="editor-checkbox"><input type="checkbox" name="isActive" defaultChecked={supplier?.isActive} /> نمایش به اعضا</label>
          <TagManager value={tags} onChange={setTags} token={token} onExpired={onExpired} />
        </fieldset>
        {error && <p role="alert" className="editor-error">{error}</p>}
        <div className="editor-actions">
          <button type="button" disabled={busy} onClick={() => dialog.current?.close()}>انصراف</button>
          <button type="submit" className="save-button" disabled={busy}>ذخیره تأمین‌کننده</button>
        </div>
      </form>
    </dialog>
  );
}

export default function SuppliersView({ token, onExpired }: { token: string | null; onExpired: () => void }) {
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const [data, setData] = useState<SupplierPage>();
  const [manage, setManage] = useState(false);
  const [editor, setEditor] = useState<{ supplier?: Supplier }>();
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState('');
  const pages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    setError('');
    setData(undefined);
    void (async () => {
      try {
        let body;
        let canManage = true;
        try { body = await listSuppliers(token, filters, page, true, controller.signal); }
        catch (error) {
          if (!(error instanceof ApiError && error.status === 403)) throw error;
          canManage = false;
          body = await listSuppliers(token, filters, page, false, controller.signal);
        }
        if (!controller.signal.aborted) { setManage(canManage); setData(body); }
      } catch (error) {
        if (controller.signal.aborted) return;
        if (error instanceof ApiError && error.status === 401) onExpired();
        else setError('فهرست تأمین‌کنندگان دریافت نشد.');
      }
    })();
    return () => controller.abort();
  }, [token, filters, page, revision, onExpired]);

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setFilters(Object.fromEntries([...new FormData(event.currentTarget)].map(([key, value]) => [key, String(value).trim()])));
  }

  return (
    <main className="workspace">
      <div className="page-heading">
        <div className="page-icon"><BookUser size={23} /></div>
        <div><h1>تأمین‌کنندگان مواد اولیه</h1><p>دفترچه تماس و معرفی تأمین‌کننده</p></div>
        {token && manage && <button className="add-record" type="button" onClick={() => setEditor({})}><Plus size={17} /> افزودن تأمین‌کننده</button>}
      </div>
      <section className="table-card" aria-label="فهرست تأمین‌کنندگان">
        {token && <div className="table-toolbar">
          <form className="directory-filters" onSubmit={search}>
            <input name="search" type="search" aria-label="نام یا حوزه تأمین" placeholder="نام یا حوزه تأمین" maxLength={100} />
            <input name="province" aria-label="استان" placeholder="استان" maxLength={100} />
            <input name="city" aria-label="شهر" placeholder="شهر" maxLength={100} />
            <button type="submit">جستجو</button>
          </form>
          <span className="record-count">{data && `${number.format(data.total)} تأمین‌کننده`}</span>
        </div>}
        {!token ? <div className="table-state">برای مشاهده روابط تماس وارد حساب شوید.</div>
          : error ? <div className="table-state" role="alert">{error}<button onClick={() => setRevision(value => value + 1)}>تلاش مجدد</button></div>
          : !data ? <div className="table-state" role="status">در حال دریافت…</div>
          : !data.items.length ? <div className="table-state">تأمین‌کننده‌ای پیدا نشد.</div>
          : <div className="table-scroll" tabIndex={0} aria-label="جدول تأمین‌کنندگان">
            <table className="compact-table">
              <thead><tr><th scope="col">تأمین‌کننده</th><th scope="col" className="desktop-only">محدوده</th><th scope="col" className="compact-summary">تماس</th><th scope="col" className="desktop-only">تگ‌ها</th>
                {manage && <><th scope="col" className="desktop-only">اولویت / بازخورد</th><th scope="col" className="desktop-only">انتشار</th><th scope="col" className="compact-actions">عملیات</th></>}</tr></thead>
              <tbody>{data.items.map(supplier => <tr key={supplier._id}>
                <th scope="row"><span className="compact-name" title={supplier.name}>{supplier.name}</span>
                  <small className="member-organization desktop-only">{supplier.contactName}</small>
                  <span className="mobile-only compact-details"><small>{supplier.city}، {supplier.province}</small>
                    {manage && <small>{supplier.isActive ? 'منتشرشده' : 'پیش‌نویس'}</small>}</span>
                </th>
                <td className="desktop-only">{supplier.city}، {supplier.province}<small>{supplier.address}</small></td>
                <td className="compact-summary"><a href={`tel:${supplier.phone}`}><bdi>{supplier.phone}</bdi></a>
                  {supplier.alternatePhone && <small className="desktop-only"><a href={`tel:${supplier.alternatePhone}`}><bdi>{supplier.alternatePhone}</bdi></a></small>}
                  {supplier.email && <small className="desktop-only"><a href={`mailto:${supplier.email}`}>{supplier.email}</a></small>}
                  {supplier.website && <small className="desktop-only"><a href={supplier.website} target="_blank" rel="noreferrer">وب‌سایت</a></small>}</td>
                <td className="desktop-only">{supplier.tagIds?.map(tag => tag.name).join('، ') || '—'}</td>
                {manage && <>
                  <td className="desktop-only">{number.format(supplier.priority ?? 0)} <small>{number.format(supplier.positiveFeedbackCount ?? 0)} مثبت از {number.format(supplier.feedbackCount ?? 0)}</small></td>
                  <td className="desktop-only">{supplier.isActive ? 'منتشرشده' : 'پیش‌نویس'}</td>
                  <td className="compact-actions"><button type="button" className="icon-button" aria-label={`ویرایش ${supplier.name}`} onClick={() => setEditor({ supplier })}><Pencil size={16} /></button></td>
                </>}
              </tr>)}</tbody>
            </table>
          </div>}
        {pages > 1 && <nav className="pagination" aria-label="صفحه‌بندی">
          <button type="button" onClick={() => setPage(page - 1)} disabled={page === 1}>قبلی</button>
          <span>{number.format(page)} از {number.format(pages)}</span>
          <button type="button" onClick={() => setPage(page + 1)} disabled={page >= pages}>بعدی</button>
        </nav>}
      </section>
      {token && editor && <SupplierEditor token={token} supplier={editor.supplier} onClose={() => setEditor(undefined)}
        onSaved={() => { setEditor(undefined); setRevision(value => value + 1); }} onExpired={onExpired} />}
    </main>
  );
}
