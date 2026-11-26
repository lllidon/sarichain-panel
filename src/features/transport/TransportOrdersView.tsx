import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Clock3, MapPin, Package, RefreshCw, Truck, Weight } from 'lucide-react';
import { ApiError, readTransportOrders, reviewTransportOrder, type TransportOrderPage } from '../../api';
import { number } from '../catalog/catalog';

const statusLabels: Record<string, string> = {
  pending_review: 'در انتظار بررسی', approved: 'تأیید و منتشر شده', rejected: 'رد شده',
  assigned: 'واگذار شده', in_transit: 'در حال حمل', delivered: 'تحویل شده', cancelled: 'لغو شده',
};
const categoryLabels: Record<string, string> = { intracity: 'درون‌شهری', intercity: 'بین‌شهری', interprovincial: 'بین‌استانی' };
const urgencyLabels: Record<string, string> = { normal: 'عادی', special: 'ویژه', express: 'اکسپرس', urgent: 'فوری', hourly: 'ساعتی / فوری', daily: 'روزانه', multiday: 'چندروزه' };
const vehicleLabels: Record<string, string> = { motorcycle: 'موتورسیکلت', car: 'سواری', pickup: 'وانت', van: 'ون', truckette: 'کامیونت', truck: 'کامیون' };
const dateFormat = new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium', timeStyle: 'short' });

export default function TransportOrdersView({ token, onExpired }: { token: string; onExpired: () => void }) {
  const [data, setData] = useState<TransportOrderPage>();
  const [selected, setSelected] = useState<Record<string, string[]>>({});
  const [searchText, setSearchText] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyId, setBusyId] = useState('');
  const [revision, setRevision] = useState(0);
  const pages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;
  const refresh = useCallback(() => setRevision(value => value + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    setError('');
    readTransportOrders(token, search, page, controller.signal).then(orders => {
      if (controller.signal.aborted) return;
      setData(orders);
      setSelected(current => ({ ...current, ...Object.fromEntries(orders.items.map(order => [order._id,
        (order.specialCarrierIds ?? []).filter(id => order.candidates?.some(candidate => candidate.memberId === id))])) }));
    }).catch(failure => {
      if (controller.signal.aborted) return;
      if (failure instanceof ApiError && failure.status === 401) onExpired();
      else setError(failure instanceof ApiError && failure.status === 403
        ? 'دسترسی مدیریت حمل‌ونقل مجاز نیست.' : 'دریافت سفارش‌ها ناموفق بود.');
    });
    return () => controller.abort();
  }, [token, search, page, revision, onExpired]);

  function toggleSpecial(orderId: string, carrierId: string, checked: boolean) {
    setSelected(current => {
      const existing = current[orderId] || [];
      const next = checked ? [...existing, carrierId].slice(0, 2) : existing.filter(id => id !== carrierId);
      return { ...current, [orderId]: next };
    });
  }
  async function review(orderId: string, status: 'approved' | 'rejected') {
    setBusyId(orderId); setNotice(''); setError('');
    try {
      await reviewTransportOrder(token, orderId, status, selected[orderId] || []);
      setNotice(status === 'approved' ? 'سفارش تأیید و برای همکاران واجد شرایط منتشر شد.' : 'سفارش رد شد.');
      refresh();
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 401) onExpired();
      else setError(failure instanceof ApiError ? failure.message || 'بررسی سفارش انجام نشد.' : 'بررسی سفارش انجام نشد.');
    } finally { setBusyId(''); }
  }
  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPage(1); setSearch(searchText.trim());
  }

  return <main className="workspace transport-admin">
    <div className="page-heading"><div className="page-icon"><Truck size={23} /></div><div><h1>مدیریت سفارش‌های حمل</h1><p>بررسی درخواست مشتری، تطبیق راننده و تعرفه‌گذاری کارسا</p></div>
      <button className="icon-button" type="button" title="بروزرسانی" aria-label="بروزرسانی" onClick={refresh}><RefreshCw size={17} /></button>
    </div>
    {error && <p className="catalog-notice error-message" role="alert">{error}</p>}
    {notice && <p className="catalog-notice" role="status">{notice}</p>}

    <section className="transport-admin-orders">
      <div className="transport-admin-section-heading"><div><h2>درخواست‌های ثبت‌شده</h2><p>{data ? number.format(data.total) + ' سفارش' : 'در حال دریافت…'}</p></div>
        <form className="search" onSubmit={submitSearch}><input value={searchText} onChange={e => setSearchText(e.target.value)} placeholder="جستجوی مشتری یا نوع بار" aria-label="جستجوی سفارش حمل" /><button type="submit">جستجو</button></form>
      </div>
      {!data ? <div className="table-state">در حال دریافت سفارش‌ها…</div>
        : !data.items.length ? <div className="table-state">درخواستی برای نمایش وجود ندارد.</div>
        : <div className="transport-admin-list">{data.items.map(order => {
          const special = selected[order._id] || [];
          const reviewable = order.status === 'pending_review' || order.status === 'approved';
          return <article className="transport-admin-order" key={order._id}>
            <header><div><strong>درخواست {order.goodsType}</strong><small>ثبت {order.createdAt && dateFormat.format(new Date(order.createdAt))} · مشتری: {order.customer?.fullName || order.customer?.organization || '—'} · {order.customer?.phone || '—'}</small></div>
              <span className={'status ' + (order.status === 'approved' ? 'active' : '')}>{statusLabels[order.status] || order.status}</span></header>
            <div className="transport-admin-facts">
              <span><Weight size={15} /> {number.format(order.weightKg)} کیلوگرم</span>
              <span><Package size={15} /> {number.format(order.volumeM3)} مترمکعب</span>
              <span><Clock3 size={15} /> {urgencyLabels[order.urgency] || '—'}</span>
              <span><Clock3 size={15} /> مهلت: {order.deadline ? dateFormat.format(new Date(order.deadline)) : '—'}</span>
              <span>{categoryLabels[order.quote?.category] || '—'} · زون {order.quote?.zoneId?.replace('zone-','') ?? '—'} · {number.format(order.quote?.distanceKm || 0)} کیلومتر · {order.quote?.distanceSource === 'road' ? 'مسیر جاده‌ای' : 'تخمین مستقیم'}</span>
            </div>
            <div className="transport-admin-route">{order.stops.map((stop, index) => <div key={index}>
              <MapPin size={15} /><span><b>{stop.kind === 'pickup' ? 'مبدأ' : 'مقصد'}: {stop.label}</b><small>{stop.province}، {stop.city} · {stop.address}</small></span>
              <a href={'https://www.openstreetmap.org/?mlat=' + stop.latitude + '&mlon=' + stop.longitude + '#map=14/' + stop.latitude + '/' + stop.longitude} target="_blank" rel="noreferrer">نقشه</a>
            </div>)}</div>
            <div className="transport-admin-quote"><span>پیشنهاد عادی: <b>{number.format(order.quote?.standardKar || 0)} کارسا</b></span><span>پیشنهاد ویژه: <b>{number.format(order.quote?.specialKar || 0)} کارسا</b></span></div>
            {order.quote?.routingPending && <p className="catalog-notice error-message" role="status">مسافت جاده‌ای از سرویس نقشه دریافت نشده؛ این مبلغ فقط تخمین اولیه است و پیش از تأیید نهایی باید مسیر جاده‌ای محاسبه شود.</p>}
            {order.description && <p className="transport-admin-description">{order.description}</p>}
            {reviewable && <div className="transport-candidates">
              <h3>همکاران واجد شرایط ({number.format(order.candidates?.length || 0)})</h3>
              {!order.candidates?.length ? <p>راننده تأییدشده با ظرفیت کافی برای این بار پیدا نشد.</p> :
                <div className="candidate-grid">{order.candidates.map(candidate => <label key={candidate.memberId}>
                  <input type="checkbox" checked={special.includes(candidate.memberId)} disabled={!special.includes(candidate.memberId) && special.length >= 2}
                    onChange={event => toggleSpecial(order._id, candidate.memberId, event.target.checked)} />
                  <span><b>{candidate.fullName}</b><small>{vehicleLabels[candidate.vehicleType] || candidate.vehicleType} · {candidate.model} · ظرفیت {number.format(candidate.capacityKg)} کیلوگرم{candidate.capacityM3 != null ? ' · ' + number.format(candidate.capacityM3) + ' مترمکعب' : ' · ظرفیت حجمی ثبت نشده'}</small><small>{candidate.city || 'شهر ثبت نشده'} · {candidate.phone || '—'}</small></span>
                  {special.includes(candidate.memberId) && <em>پیشنهاد ویژه</em>}
                </label>)}</div>}
              <div className="transport-review-actions">
                <small>حداکثر دو همکار را برای پیشنهاد ویژه انتخاب کنید.</small>
                <div><button type="button" className="danger-button" disabled={busyId === order._id} onClick={() => review(order._id, 'rejected')}>رد درخواست</button>
                  <button type="button" className="primary-button" disabled={busyId === order._id || !order.candidates?.length} onClick={() => review(order._id, 'approved')}>{busyId === order._id ? 'در حال ثبت…' : order.status === 'approved' ? 'به‌روزرسانی پیشنهادها' : 'تأیید و انتشار برای رانندگان'}</button></div>
              </div>
            </div>}
          </article>;
        })}</div>}
      {data && pages > 1 && <nav className="pagination"><button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)}>قبلی</button><span>{number.format(page)} از {number.format(pages)}</span><button type="button" disabled={page >= pages} onClick={() => setPage(page + 1)}>بعدی</button></nav>}
    </section>
  </main>;
}
