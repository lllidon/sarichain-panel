import { useEffect, useState, type FormEvent } from 'react';
import { AlertCircle, Boxes, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Package, RefreshCw, Search, Store, Warehouse } from 'lucide-react';
import { ApiError, readInventoryProducts, type InventoryProductPage } from '../../api';
import { number } from '../catalog/catalog';

const quantity = (value: number) => number.format(value ?? 0);

export default function InventoryView({ token, onExpired }: { token: string; onExpired: () => void }) {
  const [draft, setDraft] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<InventoryProductPage | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    setError('');
    readInventoryProducts(token, search, page, controller.signal).then(result => {
      if (!controller.signal.aborted) setData(result);
    }).catch(reason => {
      if (controller.signal.aborted) return;
      if (reason instanceof ApiError && reason.status === 401) onExpired();
      else setError(reason instanceof Error ? reason.message : 'دریافت موجودی ناموفق بود.');
    });
    return () => controller.abort();
  }, [token, search, page, retry, onExpired]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setSearch(draft.trim());
    setExpanded(null);
  }

  const pages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;
  const summary = data?.summary;

  return (
    <main className="workspace inventory-workspace">
      <div className="page-heading">
        <div className="page-icon"><Warehouse size={25} /></div>
        <div><h1>مدیریت موجودی</h1><p>موجودی محصولات به تفکیک فروشنده و مجموع کل موجودی قابل عرضه</p></div>
        <div className="page-heading-actions">
          <button type="button" className="data-action-button" onClick={() => setRetry(value => value + 1)}><RefreshCw size={16} /> به‌روزرسانی</button>
        </div>
      </div>

      <section className="inventory-summary" aria-label="خلاصه موجودی">
        <article><span className="inventory-summary-icon"><Package size={19} /></span><small>محصولات دارای عرضه</small><strong>{summary ? quantity(summary.products) : '—'}</strong></article>
        <article><span className="inventory-summary-icon"><Boxes size={19} /></span><small>کل موجودی ثبت‌شده فروشندگان</small><strong>{summary ? quantity(summary.totalStock) : '—'}</strong></article>
        <article><span className="inventory-summary-icon"><Warehouse size={19} /></span><small>موجودی قابل سفارش</small><strong>{summary ? quantity(summary.availableStock) : '—'}</strong></article>
        <article><span className="inventory-summary-icon"><Store size={19} /></span><small>تعداد عرضه‌های فروشندگان</small><strong>{summary ? quantity(summary.sellerOffers) : '—'}</strong></article>
      </section>

      <section className="table-card inventory-table-card">
        <div className="table-toolbar">
          <form className="search" onSubmit={submit}>
            <Search size={18} />
            <input type="search" maxLength={100} aria-label="جستجوی محصول یا فروشنده" placeholder="جستجو با نام محصول، SKU یا فروشنده"
              value={draft} onChange={event => setDraft(event.target.value)} />
            {draft && <button type="button" aria-label="پاک کردن جستجو" onClick={() => { setDraft(''); setSearch(''); setPage(1); }}><ChevronUp size={15} /></button>}
            <button type="submit">جستجو</button>
          </form>
          <span className="record-count" role="status">{data ? `${number.format(data.total)} محصول` : 'در حال دریافت…'}</span>
        </div>

        {error ? <div className="table-state" role="alert"><AlertCircle size={24} /><p>{error}</p><button type="button" onClick={() => setRetry(value => value + 1)}>تلاش دوباره</button></div>
          : !data ? <div className="table-state" role="status">در حال دریافت اطلاعات موجودی…</div>
          : !data.items.length ? <div className="table-state"><Package size={24} /><p>{search ? 'محصول یا فروشنده‌ای با این مشخصات پیدا نشد.' : 'هنوز موجودی برای محصولات ثبت نشده است.'}</p></div>
          : <div className="inventory-product-list">
            {data.items.map(product => {
              const isOpen = expanded === product._id;
              return <article className={isOpen ? 'inventory-product expanded' : 'inventory-product'} key={product._id}>
                <button type="button" className="inventory-product-main" aria-expanded={isOpen}
                  onClick={() => setExpanded(isOpen ? null : product._id)}>
                  <span className="inventory-product-name"><strong>{product.name}</strong><small><bdi>{product.sku || 'بدون SKU'}</bdi> · {quantity(product.sellerCount)} فروشنده</small></span>
                  <span className="inventory-stock-cell"><small>موجودی کل</small><b>{quantity(product.totalStock)} <em>{product.unit || 'واحد'}</em></b></span>
                  <span className="inventory-stock-cell"><small>قابل سفارش</small><b className="inventory-available">{quantity(product.availableStock)} <em>{product.unit || 'واحد'}</em></b></span>
                  <span className="inventory-expand">{isOpen ? <ChevronUp size={19} /> : <ChevronDown size={19} />}</span>
                </button>
                {isOpen && <div className="inventory-seller-panel">
                  <div className="inventory-seller-heading"><div><strong>موجودی به تفکیک فروشنده</strong><small>موجودی ثبت‌شده توسط هر فروشنده؛ رزروها از موجودی قابل سفارش کم می‌شوند.</small></div><span>{quantity(product.sellerCount)} عرضه</span></div>
                  <div className="inventory-seller-table-wrap"><table className="inventory-seller-table">
                    <thead><tr><th>فروشنده</th><th>قیمت واحد</th><th>موجودی ثبت‌شده</th><th>رزروشده</th><th>قابل سفارش</th></tr></thead>
                    <tbody>{product.sellers.map(seller => <tr key={seller.offerId}>
                      <th scope="row"><strong>{seller.name}</strong><small>{seller.city || 'موقعیت ثبت نشده'}</small></th>
                      <td>{quantity(seller.price)} کارسا</td><td>{quantity(seller.stock)} {seller.unit || product.unit || 'واحد'}</td>
                      <td>{quantity(seller.reservedStock)}</td><td className="inventory-available">{quantity(seller.availableStock)}</td>
                    </tr>)}</tbody>
                  </table></div>
                </div>}
              </article>;
            })}
          </div>}
        {data && pages > 1 && <nav className="pagination" aria-label="صفحه‌بندی موجودی">
          <button type="button" disabled={page <= 1} onClick={() => setPage(value => value - 1)}><ChevronRight size={15} /> قبلی</button>
          <span>صفحه {number.format(page)} از {number.format(pages)}</span>
          <button type="button" disabled={page >= pages} onClick={() => setPage(value => value + 1)}>بعدی <ChevronLeft size={15} /></button>
        </nav>}
      </section>
      <p className="inventory-footnote">موجودی کل از مجموع عرضه‌های فعال فروشندگان محاسبه می‌شود. ثبت سفارش به‌تنهایی موجودی فروشنده را کاهش نمی‌دهد؛ کسر قطعی پس از تأیید سند حسابداری انجام خواهد شد.</p>
    </main>
  );
}
