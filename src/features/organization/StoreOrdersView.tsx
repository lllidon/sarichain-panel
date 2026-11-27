import { useCallback, useEffect, useState } from 'react';
import { ClipboardList, Eye, RefreshCw, Search, Save, X, Package, Truck, Wallet } from 'lucide-react';
import { ApiError, readStoreOrder, readStoreOrders, updateStoreOrder, type StoreOrder, type StoreOrderPage, type StoreOrderStatus } from '../../api';

const money = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 2 });
const dates = new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium', timeStyle: 'short' });
const statusLabels: Record<string, string> = {
  pending: 'در انتظار بررسی', confirmed: 'تأیید شده', processing: 'در حال آماده‌سازی',
  shipped: 'ارسال شده', completed: 'تحویل شده', cancelled: 'لغو شده', returned: 'مرجوعی',
};
const tabs: Array<{ id: StoreOrderStatus; label: string; count: (data: StoreOrderPage) => number }> = [
  { id: 'current', label: 'جاری', count: data => data.counts.current },
  { id: 'completed', label: 'تحویل‌شده', count: data => data.counts.completed },
  { id: 'returned', label: 'مرجوعی', count: data => data.counts.returned },
  { id: 'cancelled', label: 'لغوشده', count: data => data.counts.cancelled },
  { id: 'all', label: 'همه', count: data => data.counts.total },
];

export default function StoreOrdersView({ token, onExpired }: { token: string; onExpired: () => void }) {
  const [status, setStatus] = useState<StoreOrderStatus>('current');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<StoreOrderPage>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<StoreOrder>();
  const [detailLoading, setDetailLoading] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);
  const [total, setTotal] = useState('');
  const [shippingFee, setShippingFee] = useState('');
  const [trackingCode, setTrackingCode] = useState('');
  const [adminNote, setAdminNote] = useState('');
  const [nextStatus, setNextStatus] = useState('pending');

  const load = useCallback((signal?: AbortSignal) => {
    setLoading(true); setError('');
    const controller = signal ? undefined : new AbortController();
    return readStoreOrders(token, page, status, search, signal ?? controller!.signal)
      .then(result => { if (!signal?.aborted) setData(result); })
      .catch(failure => {
        if (signal?.aborted) return;
        if (failure instanceof ApiError && failure.status === 401) onExpired();
        else setError(failure instanceof Error && failure.message ? failure.message : 'دریافت سفارش‌ها ناموفق بود.');
      }).finally(() => { if (!signal?.aborted) setLoading(false); });
  }, [token, page, status, search, onExpired]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  async function openOrder(id: string) {
    setSelected(undefined); setDetailLoading(true); setSaveError('');
    const controller = new AbortController();
    try {
      const order = await readStoreOrder(token, id, controller.signal);
      setSelected(order);
      setTotal(String(order.total ?? 0));
      setShippingFee(String(order.meta?.shipping?.fee ?? 0));
      setTrackingCode(order.delivery?.trackingCode ?? '');
      setAdminNote(order.adminNote ?? '');
      setNextStatus(order.status);
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 401) onExpired();
      else setSaveError(failure instanceof Error ? failure.message : 'جزئیات سفارش دریافت نشد.');
    } finally { setDetailLoading(false); }
  }

  async function save() {
    if (!selected) return;
    setSaving(true); setSaveError('');
    try {
      const updated = await updateStoreOrder(token, selected._id, {
        status: nextStatus,
        total: Number(total),
        shippingFee: Number(shippingFee),
        trackingCode,
        adminNote,
      });
      setSelected(updated);
      await load();
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 401) onExpired();
      else setSaveError(failure instanceof Error ? failure.message : 'ذخیره تغییرات ناموفق بود.');
    } finally { setSaving(false); }
  }

  const pages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;
  return <main className="workspace store-orders-workspace">
    <div className="page-heading"><div className="page-icon"><ClipboardList size={23} /></div><div><h1>سفارش‌های فروشگاه</h1><p>مشاهده، پیگیری و مدیریت سفارش‌های مشتریان</p></div></div>
    <section className="table-card">
      <div className="store-order-tabs" role="tablist" aria-label="فیلتر وضعیت سفارش">
        {tabs.map(tab => <button key={tab.id} type="button" role="tab" aria-selected={status === tab.id}
          onClick={() => { setStatus(tab.id); setPage(1); }}>
          {tab.label}<span>{data ? money.format(tab.count(data)) : '—'}</span>
        </button>)}
      </div>
      <div className="table-toolbar">
        <label className="search"><Search size={17} /><input type="search" value={search} placeholder="جستجوی شماره سفارش، نام یا موبایل مشتری"
          onChange={event => { setSearch(event.target.value); setPage(1); }} /></label>
        <button type="button" className="icon-button" aria-label="به‌روزرسانی سفارش‌ها" onClick={() => void load()}><RefreshCw size={17} /></button>
        <span className="record-count">{data ? `${money.format(data.total)} سفارش` : ''}</span>
      </div>
      {error ? <div className="table-state" role="alert">{error}<button type="button" onClick={() => void load()}>تلاش دوباره</button></div>
      : loading && !data ? <div className="table-state" role="status">در حال دریافت سفارش‌ها…</div>
      : data && !data.items.length ? <div className="table-state">سفارشی در این فیلتر پیدا نشد.</div>
      : <div className="table-scroll"><table className="compact-table"><thead><tr><th>شماره سفارش</th><th>مشتری</th><th>وضعیت</th><th>مبلغ (کارسا)</th><th>تاریخ</th><th>جزئیات</th></tr></thead>
        <tbody>{data?.items.map(order => <tr key={order._id}>
          <th scope="row"><bdi>{order.orderNumber}</bdi></th>
          <td>{order.customer?.fullName || '—'}<small>{order.customer?.phone || ''}</small></td>
          <td><span className={['completed','shipped'].includes(order.status) ? 'status active' : 'status'}>{statusLabels[order.status] ?? order.status}</span></td>
          <td>{money.format(order.total ?? 0)}</td>
          <td>{order.createdAt && Number.isFinite(Date.parse(order.createdAt)) ? dates.format(new Date(order.createdAt)) : '—'}</td>
          <td><button className="icon-button" type="button" aria-label={`جزئیات سفارش ${order.orderNumber}`} onClick={() => void openOrder(order._id)}><Eye size={17} /></button></td>
        </tr>)}</tbody></table></div>}
      {pages > 1 && <nav className="pagination" aria-label="صفحه‌بندی سفارش‌ها"><button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>قبلی</button><span>{money.format(page)} از {money.format(pages)}</span><button disabled={page >= pages} onClick={() => setPage(p => p + 1)}>بعدی</button></nav>}
    </section>
    {detailLoading && <div className="store-order-overlay"><div className="store-order-dialog">در حال دریافت جزئیات سفارش…</div></div>}
    {selected && <div className="store-order-overlay" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setSelected(undefined); }}>
      <section className="store-order-dialog" role="dialog" aria-modal="true" aria-labelledby="store-order-title">
        <header className="editor-heading"><div><h2 id="store-order-title">جزئیات سفارش {selected.orderNumber}</h2><small>{selected.customer?.fullName} · {selected.customer?.phone}</small></div><button type="button" className="icon-button" aria-label="بستن" onClick={() => setSelected(undefined)}><X size={18} /></button></header>
        <div className="store-order-detail-grid">
          <div><small>وضعیت فعلی</small><b>{statusLabels[selected.status] ?? selected.status}</b></div>
          <div><small>تاریخ ثبت</small><b>{selected.createdAt ? dates.format(new Date(selected.createdAt)) : '—'}</b></div>
          <div><small>آدرس تحویل</small><b>{selected.delivery?.addressSnapshot ? [selected.delivery.addressSnapshot.title, selected.delivery.addressSnapshot.city, selected.delivery.addressSnapshot.province, selected.delivery.addressSnapshot.address].filter(Boolean).join('، ') : '—'}</b></div>
        </div>
        <h3><Package size={17} /> اقلام سفارش</h3>
        <div className="store-order-lines">{selected.items?.map((item, index) => <article key={item._id ?? index}>
          {item.image ? <img src={item.image} alt="" /> : <span className="store-order-placeholder"><Package size={18} /></span>}
          <div><b>{item.name}</b><small>{money.format(item.quantity)} {item.unitName || 'عدد'} · فروشنده: {item.sellerName || '—'}</small></div>
          <strong>{money.format(item.lineSubtotal?.max ?? 0)} کارسا</strong>
        </article>)}</div>
        <h3><Wallet size={17} /> اطلاعات مالی و ارسال</h3>
        <div className="store-order-edit-grid">
          <label>وضعیت سفارش<select value={nextStatus} onChange={event => setNextStatus(event.target.value)}>{Object.entries(statusLabels).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label>مبلغ نهایی (کارسا)<input type="number" min="0" step="0.0001" value={total} onChange={event => setTotal(event.target.value)} /></label>
          <label>هزینه ارسال (کارسا)<input type="number" min="0" step="0.0001" value={shippingFee} onChange={event => setShippingFee(event.target.value)} /></label>
          <label><Truck size={15} /> کد رهگیری<input value={trackingCode} onChange={event => setTrackingCode(event.target.value)} /></label>
          <label className="editor-wide">یادداشت مدیریت<textarea rows={3} value={adminNote} onChange={event => setAdminNote(event.target.value)} /></label>
        </div>
        {saveError && <p className="editor-error" role="alert">{saveError}</p>}
        <footer className="editor-actions"><button type="button" onClick={() => setSelected(undefined)}>بستن</button><button type="button" className="save-button" disabled={saving} onClick={() => void save()}><Save size={16} />{saving ? 'در حال ذخیره…' : 'ذخیره تغییرات'}</button></footer>
      </section>
    </div>}
  </main>;
}
