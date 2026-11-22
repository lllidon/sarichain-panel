import { useEffect, useState, type FormEvent } from 'react';
import { ArrowDownRight, ChevronLeft, ChevronRight, Pencil, Plus, Search, Trash2, X, Zap } from 'lucide-react';
import { ApiError, readCatalog } from '../../api';
import { type CatalogItem, type CatalogPage, type Section, number, sections } from './catalog';
import CatalogEditor, { type EditorMode } from './CatalogEditor';
import { demoPage } from './demo';

const headings = {
  products: ['محصول', 'SKU / شناسه حسابداری', 'دسته‌بندی / برند', 'نوع', 'قیمت پایه', 'وضعیت'],
  categories: ['دسته‌بندی', 'نشانی', 'والد', 'سطح', 'وضعیت'],
  brands: ['برند', 'نشانی', 'توضیح کوتاه', 'وضعیت'],
};

function price(item: CatalogItem) {
  if (item.basePrice) return `${number.format(item.basePrice.amount)} ${item.basePrice.currency === 'IRR' ? 'ریال' : item.basePrice.currency}`;
  if (item.kind === 'variant') {
    const change = item.priceAdjustment ?? 0;
    return change === 0 ? 'برابر پایه' : `تعدیل ${new Intl.NumberFormat('fa-IR', { signDisplay: 'exceptZero' }).format(change)}`;
  }
  return '—';
}

function CatalogRow({ item, section, demo, onEdit }: {
  item: CatalogItem; section: Section; demo: boolean; onEdit: (mode: EditorMode, item: CatalogItem) => void;
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
          <span>{item.name}
            {!!item.tagIds?.length && <small className="row-tags">{item.tagIds.map(tag => tag.name).join('، ')}</small>}
          </span>
        </div>
      </th>
      {section === 'products' && (
        <>
          <td><bdi className="code">{item.sku || '—'}</bdi>{item.itemId && <small><bdi>{item.itemId}</bdi></small>}</td>
          <td>{item.categoryId?.name || '—'}{item.brandId && <small>{item.brandId.name}</small>}</td>
          <td>{item.kind === 'variant' ? 'گزینه محصول' : 'اصلی'}{item.masterId && <small>{item.masterId.name}</small>}</td>
          <td>{price(item)}</td>
        </>
      )}
      {section !== 'products' && <td><bdi className="code">{item.slug}</bdi></td>}
      {section === 'categories' && (
        <>
          <td>{item.parentId ? <><ArrowDownRight size={14} /> {item.parentId.name}</> : '—'}</td>
          <td>{item.level ? number.format(item.level) : '—'}</td>
        </>
      )}
      {section === 'brands' && <td>{item.shortDescription || '—'}</td>}
      <td><span className={item.isActive ? 'status active' : 'status'}>{item.isActive ? 'فعال' : 'غیرفعال'}</span></td>
      {!demo && <td>
        <div className="row-actions">
          <button type="button" title="ویرایش سریع" aria-label={`ویرایش سریع ${item.name}`} onClick={() => onEdit('quick', item)}><Zap size={15} /></button>
          <button type="button" title="ویرایش کامل" aria-label={`ویرایش کامل ${item.name}`} onClick={() => onEdit('edit', item)}><Pencil size={15} /></button>
          <button type="button" title="حذف" aria-label={`حذف ${item.name}`} onClick={() => onEdit('delete', item)}><Trash2 size={15} /></button>
        </div>
      </td>}
    </tr>
  );
}

export default function CatalogView({ section, token, onExpired }: { section: Section; token: string | null; onExpired: () => void }) {
  const [draft, setDraft] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<CatalogPage | null>(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [editor, setEditor] = useState<{ mode: EditorMode; item?: CatalogItem } | null>(null);
  const [notice, setNotice] = useState('');
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
        {token && <button type="button" className="add-record" onClick={() => edit('create')}><Plus size={17} /> افزودن</button>}
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
            <table>
              <thead><tr>{headings[section].map(heading => <th scope="col" key={heading}>{heading}</th>)}{!demo && <th scope="col">عملیات</th>}</tr></thead>
              <tbody>{result.items.map(item => <CatalogRow key={item._id} item={item} section={section} demo={demo} onEdit={edit} />)}</tbody>
            </table>
          </div>
        )}
        {result && pages > 1 && (
          <nav className="pagination" aria-label="صفحه‌بندی">
            <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronRight size={15} /> قبلی</button>
            <span>صفحه {number.format(page)} از {number.format(pages)}</span>
            <button type="button" disabled={page >= pages} onClick={() => setPage(page + 1)}>بعدی <ChevronLeft size={15} /></button>
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
