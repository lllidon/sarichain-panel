import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { ClipboardList, RefreshCw, Search, SlidersHorizontal, ChevronDown, ChevronUp, Package, Truck, Wallet, UserRound, CalendarDays, Phone, Hash, X, Filter, RotateCcw } from 'lucide-react';
import { ApiError, readOrders, readAllStoreOrders, readStoreOrder, type StoreOrder } from '../../api';
import { number } from '../catalog/catalog';
import type { OrderPage } from './organization';

const dates = new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium', timeStyle: 'short' });
const shortDate = new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium' });
const money = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 2 });
const statusLabels: Record<string, string> = {
  pending: 'در انتظار بررسی', confirmed: 'تأیید شده', processing: 'در حال آماده‌سازی',
  shipped: 'ارسال شده', completed: 'تحویل شده', cancelled: 'لغو شده', returned: 'مرجوعی',
};
const paymentLabels: Record<string, string> = {
  paid: 'پرداخت شده', pending: 'در انتظار پرداخت', unpaid: 'پرداخت نشده',
  failed: 'ناموفق', refunded: 'بازپرداخت شده', cash: 'نقدی', cod: 'پرداخت در محل',
};
const display = (value: unknown) => value === undefined || value === null || value === '' ? '—' :
  typeof value === 'object' ? JSON.stringify(value) : String(value);
const asDate = (value?: string) => value && Number.isFinite(Date.parse(value)) ? new Date(value) : undefined;
const deliveryDate = (order: StoreOrder) => {
  const date = asDate(order.delivery?.expectedAt || order.delivery?.estimatedDeliveryAt || order.delivery?.deliveryDate);
  return date ? shortDate.format(date) : '—';
};
const statusText = (status: string) => statusLabels[status] || status || '—';

function MetaFields({ value, prefix = '' }: { value: unknown; prefix?: string }) {
  if (!value || typeof value !== 'object') return <span>{display(value)}</span>;
  const entries = Object.entries(value as Record<string, unknown>).filter(([key]) => !['_id','orderId','createdAt','updatedAt','__v'].includes(key));
  if (!entries.length) return <span>اطلاعاتی ثبت نشده است</span>;
  return <div className="orders-meta-grid">{entries.map(([key, item]) => {
    const label = ({
      payment: 'پرداخت', shipping: 'ارسال', fee: 'هزینه', status: 'وضعیت', method: 'روش',
      provider: 'درگاه', transactionId: 'شناسه تراکنش', trackingCode: 'کد رهگیری',
      address: 'آدرس', delivery: 'تحویل', discount: 'تخفیف', coupon: 'کد تخفیف',
    } as Record<string,string>)[key] || key;
    return <div key={prefix + key}><small>{label}</small><strong>{item && typeof item === 'object' ? <MetaFields value={item} prefix={prefix + key} /> : display(item)}</strong></div>;
  })}</div>;
}

function LegacyOrdersView({ token, onExpired }: { token: string; onExpired: () => void }) {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<OrderPage>();
  const [error, setError] = useState(false);
  const pages = data ? Math.min(10000, Math.max(1, Math.ceil(data.total / data.limit))) : 1;
  useEffect(() => {
    const controller = new AbortController();
    setError(false);
    readOrders(token, page, controller.signal).then(result => { if (!controller.signal.aborted) setData(result); })
      .catch(failure => { if (controller.signal.aborted) return; if (failure instanceof ApiError && failure.status === 401) onExpired(); else setError(true); });
    return () => controller.abort();
  }, [token, page, onExpired]);
  return <main className="workspace">
    <div className="page-heading"><div className="page-icon"><ClipboardList size={23} /></div><div><h1>سفارش‌ها</h1></div></div>
    <section className="table-card" aria-label="فهرست سفارش‌ها">
      {error ? <div className="table-state" role="alert">سفارش‌ها بارگذاری نشدند.</div>
        : !data ? <div className="table-state" role="status">در حال دریافت سفارش‌ها…</div>
        : !data.items.length ? <div className="table-state">سفارشی برای نمایش وجود ندارد.</div>
        : <div className="table-scroll" tabIndex={0} aria-label="جدول سفارش‌ها">
          <table className="compact-table"><thead><tr><th>شماره سفارش</th><th className="desktop-only">شعبه</th><th>وضعیت</th><th>تاریخ</th></tr></thead>
            <tbody>{data.items.map(order => <tr key={order._id}><th scope="row"><bdi>{order.number}</bdi></th><td className="desktop-only">{order.branchId?.name ?? '—'}</td><td>{order.status}</td><td>{order.createdAt && Number.isFinite(Date.parse(order.createdAt)) ? shortDate.format(Date.parse(order.createdAt)) : '—'}</td></tr>)}</tbody></table>
        </div>}
      {pages > 1 && <nav className="pagination" aria-label="صفحه‌بندی سفارش‌ها"><button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)}>قبلی</button><span>{number.format(page)} از {number.format(pages)}</span><button type="button" disabled={page >= pages} onClick={() => setPage(page + 1)}>بعدی</button></nav>}
    </section>
  </main>;
}

function ManagementOrdersView({ token, onExpired }: { token: string; onExpired: () => void }) {
  const [orders, setOrders] = useState<StoreOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [orderNumber, setOrderNumber] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerFilter, setCustomerFilter] = useState('all');
  const [status, setStatus] = useState('all');
  const [advanced, setAdvanced] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('all');
  const [deliveryMethod, setDeliveryMethod] = useState('all');
  const [productSearch, setProductSearch] = useState('');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<string>();
  const [detailCache, setDetailCache] = useState<Record<string, StoreOrder>>({});
  const [detailLoading, setDetailLoading] = useState<string>();
  const pageSize = 20;

  const load = useCallback(async (signal?: AbortSignal) => {
    const controller = signal ? undefined : new AbortController();
    const activeSignal = signal ?? controller!.signal;
    setLoading(true); setError('');
    try {
      const result = await readAllStoreOrders(token, '', activeSignal);
      if (!activeSignal.aborted) setOrders(result);
    } catch (failure) {
      if (activeSignal.aborted) return;
      if (failure instanceof ApiError && failure.status === 401) onExpired();
      else setError(failure instanceof Error ? failure.message : 'دریافت سفارش‌ها ناموفق بود.');
    } finally { if (!activeSignal.aborted) setLoading(false); }
  }, [token, onExpired]);
  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const filtered = useMemo(() => orders.filter(order => {
    const created = asDate(order.createdAt);
    const normalizedOrder = orderNumber.trim().toLocaleLowerCase();
    const normalizedCustomer = customerSearch.trim().toLocaleLowerCase();
    if (normalizedOrder && !order.orderNumber.toLocaleLowerCase().includes(normalizedOrder)) return false;
    if (normalizedCustomer && ![order.customer?.fullName, order.customer?.organization, order.customer?.phone].some(value => value?.toLocaleLowerCase().includes(normalizedCustomer))) return false;
    if (status !== 'all' && order.status !== status) return false;
    if (customerFilter !== 'all' && (order.customer?.fullName || order.customer?.organization || 'مشتری نامشخص') !== customerFilter) return false;
    if (dateFrom && (!created || created < new Date(dateFrom + 'T00:00:00'))) return false;
    if (dateTo && (!created || created > new Date(dateTo + 'T23:59:59'))) return false;
    const pay = order.meta?.payment?.status || '';
    if (paymentStatus !== 'all' && pay !== paymentStatus) return false;
    if (deliveryMethod !== 'all' && order.delivery?.method !== deliveryMethod) return false;
    if (productSearch && !order.items?.some(item => item.name?.toLocaleLowerCase().includes(productSearch.toLocaleLowerCase()))) return false;
    if (minAmount !== '' && (order.total ?? 0) < Number(minAmount)) return false;
    if (maxAmount !== '' && (order.total ?? 0) > Number(maxAmount)) return false;
    return true;
  }), [orders, orderNumber, customerSearch, customerFilter, status, dateFrom, dateTo, paymentStatus, deliveryMethod, productSearch, minAmount, maxAmount]);

  useEffect(() => setPage(1), [orderNumber, customerSearch, customerFilter, status, dateFrom, dateTo, paymentStatus, deliveryMethod, productSearch, minAmount, maxAmount]);
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize);
  const deliveryMethods = useMemo(() => [...new Set(orders.map(order => order.delivery?.method).filter((v): v is string => Boolean(v)))], [orders]);
  const customers = useMemo(() => [...new Set(orders.map(order => order.customer?.fullName || order.customer?.organization || 'مشتری نامشخص'))].sort((a,b) => a.localeCompare(b, 'fa')), [orders]);

  async function toggleDetails(order: StoreOrder) {
    if (expanded === order._id) { setExpanded(undefined); return; }
    setExpanded(order._id);
    if (detailCache[order._id]) return;
    setDetailLoading(order._id);
    const controller = new AbortController();
    try {
      const detail = await readStoreOrder(token, order._id, controller.signal);
      setDetailCache(current => ({ ...current, [order._id]: detail }));
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 401) onExpired();
      else setError(failure instanceof Error ? failure.message : 'جزئیات سفارش دریافت نشد.');
    } finally { setDetailLoading(undefined); }
  }

  function resetFilters() {
    setOrderNumber(''); setCustomerSearch(''); setCustomerFilter('all'); setStatus('all'); setDateFrom(''); setDateTo('');
    setPaymentStatus('all'); setDeliveryMethod('all'); setProductSearch(''); setMinAmount(''); setMaxAmount('');
  }

  const paymentText = (order: StoreOrder) => paymentLabels[order.meta?.payment?.status || ''] || display(order.meta?.payment?.status || 'ثبت نشده');
  const orderTotal = filtered.reduce((sum, order) => sum + (order.total || 0), 0);

  return <main className="workspace management-orders-page">
    <div className="page-heading"><div className="page-icon"><ClipboardList size={23} /></div><div><h1>سفارش‌ها</h1><p>جستجو، فیلتر و بررسی جزئیات سفارش‌های ثبت‌شده</p></div></div>
    <section className="orders-overview">
      <div><small>تعداد سفارش‌های منطبق</small><strong>{number.format(filtered.length)}</strong></div>
      <div><small>مجموع مبلغ سفارش‌ها</small><strong>{money.format(orderTotal)} <small>کارسا</small></strong></div>
      <div><small>نمایش در صفحه</small><strong>{number.format(visible.length)}</strong></div>
      <button type="button" className="icon-button" onClick={() => void load()} aria-label="به‌روزرسانی"><RefreshCw size={17} /></button>
    </section>
    <section className="orders-filter-card">
      <div className="orders-simple-filters">
        <label><Hash size={16}/><input value={orderNumber} onChange={e => setOrderNumber(e.target.value)} placeholder="شماره سفارش" /></label>
        <label><UserRound size={16}/><input value={customerSearch} onChange={e => setCustomerSearch(e.target.value)} placeholder="نام/تلفن" /></label>
        <label><Filter size={16}/><select value={status} onChange={e => setStatus(e.target.value)}><option value="all">همه وضعیت‌ها</option>{Object.entries(statusLabels).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <button type="button" className="secondary-button" aria-expanded={advanced} onClick={() => setAdvanced(value => !value)}><SlidersHorizontal size={16}/>{advanced ? 'بستن فیلتر پیشرفته' : 'فیلتر پیشرفته'}{advanced ? <ChevronUp size={15}/> : <ChevronDown size={15}/>}</button>
      </div>
      {advanced && <div className="orders-advanced-filters">
        <label><UserRound size={15}/>کاربران<select value={customerFilter} onChange={e => setCustomerFilter(e.target.value)}><option value="all">همه کاربران</option>{customers.map(customer => <option key={customer} value={customer}>{customer}</option>)}</select></label>
        <label><CalendarDays size={15}/>از تاریخ<input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} /></label>
        <label><CalendarDays size={15}/>تا تاریخ<input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} /></label>
        <label><Wallet size={15}/>وضعیت پرداخت<select value={paymentStatus} onChange={e => setPaymentStatus(e.target.value)}><option value="all">همه</option>{Object.entries(paymentLabels).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <label><Truck size={15}/>روش ارسال<select value={deliveryMethod} onChange={e => setDeliveryMethod(e.target.value)}><option value="all">همه روش‌ها</option>{deliveryMethods.map(method => <option key={method} value={method}>{method}</option>)}</select></label>
        <label><Package size={15}/>نام کالا<input value={productSearch} onChange={e => setProductSearch(e.target.value)} placeholder="جستجو در اقلام سفارش" /></label>
        <label>حداقل مبلغ<input type="number" min="0" value={minAmount} onChange={e => setMinAmount(e.target.value)} placeholder="از" /></label>
        <label>حداکثر مبلغ<input type="number" min="0" value={maxAmount} onChange={e => setMaxAmount(e.target.value)} placeholder="تا" /></label>
        <button type="button" className="text-button" onClick={resetFilters}><RotateCcw size={14}/> پاک کردن فیلترها</button>
      </div>}
      <div className="orders-filter-footer"><span>{number.format(filtered.length)} سفارش پیدا شد</span><button type="button" className="text-button" onClick={resetFilters}><X size={14}/> حذف همه فیلترها</button></div>
    </section>
    <section className="table-card orders-full-table" aria-label="فهرست کامل سفارش‌ها">
      {error && <div className="table-state" role="alert">{error}<button type="button" onClick={() => void load()}>تلاش دوباره</button></div>}
      {loading && !orders.length ? <div className="table-state" role="status">در حال دریافت سفارش‌ها…</div>
        : !filtered.length ? <div className="table-state">سفارشی با این فیلترها پیدا نشد.</div>
        : <div className="table-scroll orders-table-scroll">
          <table className="orders-data-table"><thead><tr><th>ردیف</th><th>شماره سفارش</th><th>اطلاعات مشتری</th><th>شماره تماس</th><th>وضعیت سفارش</th><th>وضعیت پرداخت</th><th>تاریخ ثبت</th><th>تاریخ تحویل</th><th>تعداد اقلام</th><th>وزن خریداری‌شده</th><th>قیمت کل</th><th>جزئیات</th></tr></thead>
            <tbody>{visible.map((order,index) => {
              const detail = detailCache[order._id];
              const weight = order.items?.reduce((sum,item) => sum + (Number(item.quantity) || 0),0) ?? 0;
              return <Fragment key={order._id}><tr className={expanded === order._id ? 'is-expanded' : ''}>
                <td>{number.format((page - 1) * pageSize + index + 1)}</td>
                <th scope="row"><bdi>{order.orderNumber}</bdi></th>
                <td><div className="orders-customer-cell"><span className="orders-avatar">{(order.customer?.fullName || order.customer?.organization || 'م').slice(0,1)}</span><span><strong>{order.customer?.fullName || order.customer?.organization || 'مشتری نامشخص'}</strong><small>{order.customer?.organization || '—'}</small></span></div></td>
                <td><bdi>{order.customer?.phone || '—'}</bdi></td>
                <td><span className={`orders-status-pill status-${order.status}`}>{statusText(order.status)}</span></td>
                <td>{paymentText(order)}</td>
                <td>{asDate(order.createdAt) ? dates.format(asDate(order.createdAt)!) : '—'}</td>
                <td>{deliveryDate(order)}</td>
                <td>{number.format(order.items?.length ?? 0)}</td>
                <td>{number.format(weight)}</td>
                <td className="orders-amount">{money.format(order.total ?? 0)} <small>کارسا</small></td>
                <td><button type="button" className="orders-expand-button" aria-expanded={expanded === order._id} onClick={() => void toggleDetails(order)}>{expanded === order._id ? 'بستن' : 'مشاهده'}{expanded === order._id ? <ChevronUp size={15}/> : <ChevronDown size={15}/>}</button></td>
              </tr>
              {expanded === order._id && <tr key={order._id + '-details'} className="orders-accordion-row"><td colSpan={12}>
                {detailLoading === order._id ? <div className="orders-detail-loading">در حال دریافت جزئیات سفارش…</div>
                  : detail ? <div className="orders-accordion-content">
                    <section><h3><Package size={16}/>اقلام سفارش</h3><div className="orders-line-list">{detail.items?.map((item,i)=><article key={item._id || i}>
                      {item.image ? <img src={item.image} alt="" /> : <span className="orders-line-placeholder"><Package size={17}/></span>}
                      <div><strong>{item.name}</strong><small>کد کالا: {item.sku || item.productId || '—'} · فروشنده: {item.sellerName || '—'}</small><small>تعداد: {number.format(item.quantity)} {item.unitName || 'عدد'}</small></div>
                      <div className="orders-line-price"><strong>{money.format(item.unitPrice?.max ?? 0)} کارسا</strong><small>جمع: {money.format(item.lineSubtotal?.max ?? 0)} کارسا</small></div>
                    </article>)}</div></section>
                    <section><h3><Wallet size={16}/>Order Meta و اطلاعات مالی/ارسال</h3><MetaFields value={detail.meta || {}} /></section>
                    <section className="orders-extra-grid"><div><small>جمع کالاها</small><strong>{money.format(detail.subtotal?.max ?? 0)} کارسا</strong></div><div><small>هزینه ارسال</small><strong>{money.format(detail.meta?.shipping?.fee ?? 0)} کارسا</strong></div><div><small>مبلغ نهایی</small><strong>{money.format(detail.total ?? 0)} کارسا</strong></div><div><small>کد رهگیری</small><strong>{detail.delivery?.trackingCode || '—'}</strong></div><div><small>آدرس تحویل</small><strong>{[detail.delivery?.addressSnapshot?.title,detail.delivery?.addressSnapshot?.province,detail.delivery?.addressSnapshot?.city,detail.delivery?.addressSnapshot?.address].filter(Boolean).join('، ') || '—'}</strong></div><div><small>یادداشت مدیریت</small><strong>{detail.adminNote || '—'}</strong></div></section>
                  </div> : <div className="orders-detail-loading">جزئیات سفارش در دسترس نیست.</div>}
              </td></tr>}
              </Fragment>;
            })}</tbody>
          </table>
        </div>}
      {filtered.length > pageSize && <nav className="pagination" aria-label="صفحه‌بندی فهرست سفارش‌ها"><button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)}>قبلی</button><span>{number.format(page)} از {number.format(pages)}</span><button type="button" disabled={page >= pages} onClick={() => setPage(page + 1)}>بعدی</button></nav>}
    </section>
  </main>;
}

export default function OrdersView({ token, onExpired, management = false }: { token: string; onExpired: () => void; management?: boolean }) {
  return management ? <ManagementOrdersView token={token} onExpired={onExpired} /> : <LegacyOrdersView token={token} onExpired={onExpired} />;
}
