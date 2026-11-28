import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowDownRight, ChevronLeft, ChevronRight, Pencil, Plus, Search, Trash2, X, Zap, Download, Upload } from 'lucide-react';
import { ApiError, readCatalog, readCatalogChoices, saveCatalog } from '../../api';
import { csvValue, downloadCsv, readCsv } from '../../lib/csv';
import { type CatalogItem, type CatalogPage, type Section, number, sections } from './catalog';
import CatalogEditor, { type EditorMode } from './CatalogEditor';
import { demoPage } from './demo';

type PaginationItem = number | 'ellipsis-start' | 'ellipsis-end';

function paginationItems(current: number, total: number): PaginationItem[] {
  if (total <= 15) return Array.from({ length: total }, (_, index) => index + 1);
  if (current <= 5) return [...Array.from({ length: 7 }, (_, index) => index + 1), 'ellipsis-end', total];
  if (current >= total - 4) return [1, 'ellipsis-start', ...Array.from({ length: 7 }, (_, index) => total - 6 + index)];
  return [1, 'ellipsis-start', current - 1, current, current + 1, 'ellipsis-end', total];
}

const headings = {
  products: ['محصول', 'SKU / شناسه حسابداری', 'دسته‌بندی / برند', 'نوع', 'بازه قیمت (کارسا)', 'وضعیت'],
  categories: ['دسته‌بندی', 'نشانی', 'والد', 'سطح', 'وضعیت'],
  brands: ['برند', 'نشانی', 'توضیح کوتاه', 'وضعیت'],
};

function price(item: CatalogItem) {
  if (!item.price) return 'قیمت توسط فروشنده اعلام می‌شود';
  const { min, max } = item.price;
  const format = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 6 });
  return (min === max ? format.format(min) : `${format.format(min)} تا ${format.format(max)}`) + ' کارسا';
}

function CatalogRow({ item, section, demo, canEdit, onEdit }: {
  item: CatalogItem; section: Section; demo: boolean; canEdit: boolean; onEdit: (mode: EditorMode, item: CatalogItem) => void;
}) {
  const Icon = sections[section].icon;
  const [failed, setFailed] = useState(false);
  const image = item.thumbnailUrl || item.imageUrl;
  const source = !demo && image?.startsWith('/') && !image.startsWith('//') ? '/api' + image : image;
  return (
    <tr>
      <th scope="row">
        <div className="item-name">
          <span className="item-image">{source && !failed ? <img src={source} alt="" loading="lazy" onError={() => setFailed(true)} /> : <Icon size={18} />}</span>
          <span className="compact-item-text"><span className="compact-name" title={item.name}>{item.name}</span>
            {section === 'products' && <span className="mobile-only compact-details">
              <small>{item.categoryId?.name || '—'}</small>
              <small><bdi>{item.sku || '—'}</bdi></small>
            </span>}
            {section === 'categories' && <span className="mobile-only compact-details">
              <small>{item.parentId?.name || 'دسته اصلی'}{item.level ? ` · سطح ${number.format(item.level)}` : ''}</small>
              <small><bdi>{item.slug}</bdi></small>
            </span>}
            {section === 'brands' && <span className="mobile-only compact-details"><small><bdi>{item.slug}</bdi></small></span>}
            {!!item.tagIds?.length && <small className="row-tags desktop-only">{item.tagIds.map(tag => tag.name).join('، ')}</small>}
          </span>
        </div>
      </th>
      {section === 'products' && (
        <>
          <td className="desktop-only"><bdi className="code">{item.sku || '—'}</bdi>{item.itemId && <small><bdi>{item.itemId}</bdi></small>}</td>
          <td className="desktop-only">{item.categoryId?.name || '—'}{item.brandId && <small>{item.brandId.name}</small>}</td>
          <td className="desktop-only">{item.kind === 'variant' ? 'گزینه محصول' : 'اصلی'}{item.masterId && <small>{item.masterId.name}</small>}</td>
          <td className="desktop-only">{price(item)}</td>
        </>
      )}
      {section !== 'products' && <td className="desktop-only"><bdi className="code">{item.slug}</bdi></td>}
      {section === 'categories' && (
        <>
          <td className="desktop-only">{item.parentId ? <><ArrowDownRight size={14} /> {item.parentId.name}</> : '—'}</td>
          <td className="desktop-only">{item.level ? number.format(item.level) : '—'}</td>
        </>
      )}
      {section === 'brands' && <td className="desktop-only">{item.shortDescription || '—'}</td>}
      <td className="compact-summary">{section === 'products' && <span className="mobile-only compact-price">{price(item)}</span>}
        <span className={item.isActive ? 'status active' : 'status'}>{item.isActive ? 'فعال' : 'غیرفعال'}</span></td>
      {canEdit && <td className="compact-actions catalog-actions">
        <div className="row-actions">
          <button type="button" title="ویرایش سریع" aria-label={`ویرایش سریع ${item.name}`} onClick={() => onEdit('quick', item)}><Zap size={15} /></button>
          <button type="button" title="ویرایش کامل" aria-label={`ویرایش کامل ${item.name}`} onClick={() => onEdit('edit', item)}><Pencil size={15} /></button>
          <button type="button" title="حذف" aria-label={`حذف ${item.name}`} onClick={() => onEdit('delete', item)}><Trash2 size={15} /></button>
        </div>
      </td>}
    </tr>
  );
}

export default function CatalogView({ section, token, canEdit, onExpired }: { section: Section; token: string | null; canEdit: boolean; onExpired: () => void }) {
  const [draft, setDraft] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<CatalogPage | null>(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [editor, setEditor] = useState<{ mode: EditorMode; item?: CatalogItem } | null>(null);
  const [notice, setNotice] = useState('');
  const [excelBusy, setExcelBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const demo = token === null;
  const result = demo ? demoPage(section, search, page) : data;
  const pages = result ? Math.min(10000, Math.max(1, Math.ceil(result.total / result.limit))) : 1;
  const Icon = sections[section].icon;

  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    setError(false);
    setData(null);
    readCatalog(section, search, page, token, controller.signal).then(response => {
      if (!controller.signal.aborted) setData(response);
    }).catch(error => {
      if (controller.signal.aborted) return;
      if (error instanceof ApiError && error.status === 401) onExpired();
      else setError(true);
    });
    return () => controller.abort();
  }, [section, search, page, token, retry, onExpired]);

  function edit(mode: EditorMode, item?: CatalogItem) {
    setNotice('');
    setEditor({ mode, item });
  }

  function saved() {
    if (editor?.mode === 'delete' && result?.items.length === 1 && page > 1) setPage(page - 1);
    if (editor?.mode === 'create') {
      setDraft('');
      setSearch('');
    }
    setNotice(editor?.mode === 'delete' ? 'رکورد حذف شد.' : 'تغییرات ذخیره شد.');
    setEditor(null);
    setRetry(value => value + 1);
  }

  const excelColumns = section === 'products'
    ? ['_id','name','slug','sku','itemId','kind','categoryId','brandId','masterId','basePrice','price','saleUnit','saleUnits','gallery','maxOrderQuantity','priceAdjustment','physical','options','shortDescription','description','imageUrl','thumbnailUrl','isActive','tagIds']
    : section === 'categories'
      ? ['_id','name','slug','parentId','shortDescription','description','imageUrl','thumbnailUrl','isActive','tagIds']
      : ['_id','name','slug','shortDescription','description','imageUrl','thumbnailUrl','isActive','tagIds'];

  async function exportExcel() {
    if (!token) return;
    setExcelBusy(true); setNotice('');
    try {
      const rows = await readCatalogChoices(section, token, new AbortController().signal);
      const plain = rows.map(item => Object.fromEntries(excelColumns.map(key => {
        const value = (item as unknown as Record<string, unknown>)[key];
        return [key, Array.isArray(value) ? value.map(entry => entry && typeof entry === 'object' && '_id' in entry
          ? (entry as { _id: string })._id : entry) : value && typeof value === 'object' && '_id' in value
          ? (value as { _id: string })._id : value];
      })));
      downloadCsv('sarichain-' + section, plain, excelColumns);
      setNotice('فایل اکسل‌خوان با موفقیت آماده شد.');
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) onExpired();
      else setNotice(error instanceof Error ? error.message : 'خروجی دریافت نشد.');
    } finally { setExcelBusy(false); }
  }

  async function importExcel(file?: File) {
    if (!file || !token) return;
    setExcelBusy(true); setNotice('');
    try {
      const rows = await readCsv(file);
      if (!rows.length) throw new Error('فایل ردیفی برای ورود ندارد.');
      let success = 0; const failures: string[] = [];
      for (const [index, row] of rows.entries()) {
        try {
          const body = Object.fromEntries(Object.entries(row).filter(([key]) => excelColumns.includes(key) && key !== '_id')
            .map(([key, value]) => [key, csvValue(value)]));
          for (const key of ['categoryId','brandId','masterId','parentId']) {
            const value = body[key];
            if (value && typeof value === 'object' && '_id' in value) body[key] = (value as { _id: string })._id;
          }
          await saveCatalog(section, token, body, row._id || undefined);
          success++;
        } catch (error) { failures.push('ردیف ' + (index + 2) + ': ' + (error instanceof ApiError ? error.message : 'اطلاعات نامعتبر')); }
      }
      setNotice(success + ' ردیف ثبت شد.' + (failures.length ? ' ' + failures.slice(0, 5).join('؛ ') : ''));
      setRetry(value => value + 1);
    } catch (error) { setNotice(error instanceof Error ? error.message : 'ورود فایل انجام نشد.'); }
    finally { setExcelBusy(false); if (fileInput.current) fileInput.current.value = ''; }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearch(draft.trim());
    setPage(1);
  }

  return (
    <main className="workspace">
      <div className="page-heading">
        <div className="page-icon"><Icon size={25} /></div>
        <div><h1>{sections[section].label}</h1><p>کاتالوگ ساری چین</p></div>
        <div className="page-heading-actions">
          <button type="button" className="data-action-button" disabled={excelBusy} onClick={exportExcel}><Download size={17} /> دریافت خروجی</button>
          <button type="button" className="data-action-button data-action-secondary" disabled={excelBusy} onClick={() => fileInput.current?.click()}><Upload size={17} /> ورود اطلاعات</button>
          <input ref={fileInput} hidden type="file" accept=".csv,text/csv" onChange={event => void importExcel(event.target.files?.[0])} />
          <button type="button" className="add-record" onClick={() => edit('create')}><Plus size={17} /> افزودن</button>
        </div>
      </div>
      {notice && <p className="catalog-notice" role="status">{notice}</p>}
      <section className="table-card" aria-label={`فهرست ${sections[section].label}`}>
        <div className="table-toolbar">
          <form className="search" onSubmit={submit}>
            <Search size={18} />
            <input type="search" maxLength={100} aria-label="جستجو در فهرست" value={draft}
              placeholder={sections[section].placeholder} onChange={event => setDraft(event.target.value)} />
            {(draft || search) && (
              <button type="button" aria-label="پاک کردن جستجو" onClick={() => { setDraft(''); setSearch(''); setPage(1); }}><X size={16} /></button>
            )}
            <button type="submit">جستجو</button>
          </form>
          <span className="record-count" role="status">{result && `${number.format(result.total)} رکورد`}</span>
        </div>
        {error ? (
          <div className="table-state" role="alert"><p>دریافت فهرست از بک‌اند انجام نشد.</p><button onClick={() => setRetry(value => value + 1)}>تلاش دوباره</button></div>
        ) : !result ? (
          <div className="table-state" role="status">در حال دریافت فهرست…</div>
        ) : !result.items.length ? (
          <div className="table-state">
            <Icon size={24} />
            <p>{search ? 'موردی برای این جستجو پیدا نشد.' : 'رکوردی برای نمایش وجود ندارد.'}</p>
            {page > 1 && <button type="button" onClick={() => setPage(1)}>بازگشت به صفحه اول</button>}
          </div>
        ) : (
          <div className="table-scroll" tabIndex={0} aria-label="جدول کاتالوگ">
            <table className="compact-table">
              <thead><tr>{headings[section].map((heading, index, columns) => (
                <th scope="col" key={heading} className={index === 0 ? '' : index === columns.length - 1 ? 'compact-summary' : 'desktop-only'}>
                  {section === 'products' && index === columns.length - 1 ? <><span className="desktop-only">وضعیت</span><span className="mobile-only">قیمت / وضعیت</span></> : heading}
                </th>
              ))}{canEdit && <th scope="col" className="compact-actions catalog-actions">عملیات</th>}</tr></thead>
              <tbody>{result.items.map(item => <CatalogRow key={item._id} item={item} section={section} demo={demo} canEdit={canEdit} onEdit={edit} />)}</tbody>
            </table>
          </div>
        )}
        {result && pages > 1 && (
          <nav className="pagination" aria-label="صفحه‌بندی">
            <button className="pagination-step" type="button" disabled={page <= 1}
              aria-label="رفتن به صفحه قبلی" onClick={() => setPage(current => Math.max(1, current - 1))}>
              <ChevronRight size={16} /> قبلی
            </button>
            <div className="pagination-pages" aria-label="شماره صفحات">
              {paginationItems(page, pages).map(item => typeof item === 'number' ? (
                <button key={item} className="pagination-page" type="button"
                  aria-label={`رفتن به صفحه ${number.format(item)}`}
                  aria-current={page === item ? 'page' : undefined}
                  onClick={() => setPage(item)}>
                  {number.format(item)}
                </button>
              ) : (
                <span key={item} className="pagination-ellipsis" aria-hidden="true">…</span>
              ))}
            </div>
            <button className="pagination-step" type="button" disabled={page >= pages}
              aria-label="رفتن به صفحه بعدی" onClick={() => setPage(current => Math.min(pages, current + 1))}>
              بعدی <ChevronLeft size={16} />
            </button>
          </nav>
        )}
      </section>
      {token && editor && (
        <CatalogEditor section={section} mode={editor.mode} item={editor.item} token={token}
          onClose={() => setEditor(null)} onSaved={saved} onExpired={onExpired} />
      )}
    </main>
  );
}
