import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Clock3, MapPin, Package, RefreshCw, Truck, Weight } from 'lucide-react';
import { ApiError, readTransportOrders, readTransportTariffs, reviewTransportOrder, saveTransportTariffs,
  type TransportOrderPage, type TransportTariffs } from '../../api';
import { number } from '../catalog/catalog';

const initialTariffs: TransportTariffs = {
  intracityBaseKar: 2, intercityBaseKar: 2, interprovincialBaseKar: 2,
  perKmKar: 0, perKgKar: 0, perCubicMeterKar: 0,
  hourlyMultiplier: 1, dailyMultiplier: 1, multidayMultiplier: 1, specialMultiplier: 1.5,
};
const statusLabels: Record<string, string> = {
  pending_review: 'در انتظار بررسی', approved: 'تأیید و منتشر شده', rejected: 'رد شده',
  assigned: 'واگذار شده', in_transit: 'در حال حمل', delivered: 'تحویل شده', cancelled: 'لغو شده',
};
const categoryLabels: Record<string, string> = { intracity: 'درون‌شهری', intercity: 'بین‌شهری', interprovincial: 'بین‌استانی' };
const urgencyLabels: Record<string, string> = { hourly: 'ساعتی / فوری', daily: 'روزانه', multiday: 'چندروزه' };
const vehicleLabels: Record<string, string> = { motorcycle: 'موتورسیکلت', car: 'سواری', pickup: 'وانت', van: 'ون', truckette: 'کامیونت', truck: 'کامیون' };
const dateFormat = new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium', timeStyle: 'short' });

export default function TransportOrdersView({ token, onExpired }: { token: string; onExpired: () => void }) {
  const [data, setData] = useState<TransportOrderPage>();
  const [tariffs, setTariffs] = useState<TransportTariffs>(initialTariffs);
  const [selected, setSelected] = useState<Record<string, string[]>>({});
  const [searchText, setSearchText] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyId, setBusyId] = useState('');
  const [savingTariffs, setSavingTariffs] = useState(false);
  const [revision, setRevision] = useState(0);
  const pages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;
  const refresh = useCallback(() => setRevision(value => value + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    setError('');
    Promise.all([
      readTransportOrders(token, search, page, controller.signal),
      readTransportTariffs(token, controller.signal),
    ]).then(([orders, rates]) => {
      if (controller.signal.aborted) return;
      setData(orders);
      setSelected(current => ({ ...current, ...Object.fromEntries(orders.items.map(order => [order._id, order.specialCarrierIds ?? []])) }));
      setTariffs(rates);
    }).catch(failure => {
      if (controller.signal.aborted) return;
      if (failure instanceof ApiError && failure.status === 401) onExpired();
      else setError(failure instanceof ApiError && failure.status === 403
        ? 'دسترسی مدیریت حمل‌ونقل مجاز نیست.' : 'دریافت سفارش‌ها یا تعرفه‌ها ناموفق بود.');
    });
    return () => controller.abort();
  }, [token, search, page, revision, onExpired]);

  function updateTariff(key: keyof TransportTariffs, value: string) {
    setTariffs(current => ({ ...current, [key]: value === '' ? 0 : Number(value) }));
  }
  async function saveRates(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingTariffs(true); setNotice(''); setError('');
    try {
      const saved = await saveTransportTariffs(token, tariffs);
      setTariffs(saved); setNotice('تعرفه‌های حمل ذخیره شد.');
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 401) onExpired();
      else setError('ذخیره تعرفه‌ها انجام نشد. مقادیر را بررسی کنید.');
    } finally { setSavingTariffs(false); }
  }
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

    <section className="tariff-card">
      <div className="transport-admin-section-heading"><div><h2>تعرفه ترکیبی کارسا</h2><p>مبلغ پایه دسته مسیر + مسافت + وزن + حجم، سپس ضریب فوریت</p></div></div>
      <form onSubmit={saveRates}>
        <div className="tariff-grid">
          <label>پایه درون‌شهری<input type="number" min="0" step="0.0001" value={tariffs.intracityBaseKar} onChange={e => updateTariff('intracityBaseKar', e.target.value)} /></label>
          <label>پایه بین‌شهری<input type="number" min="0" step="0.0001" value={tariffs.intercityBaseKar} onChange={e => updateTariff('intercityBaseKar', e.target.value)} /></label>
          <label>پایه بین‌استانی<input type="number" min="0" step="0.0001" value={tariffs.interprovincialBaseKar} onChange={e => updateTariff('interprovincialBaseKar', e.target.value)} /></label>
          <label>به‌ازای هر کیلومتر<input type="number" min="0" step="0.0001" value={tariffs.perKmKar} onChange={e => updateTariff('perKmKar', e.target.value)} /></label>
          <label>به‌ازای هر کیلوگرم<input type="number" min="0" step="0.000001" value={tariffs.perKgKar} onChange={e => updateTariff('perKgKar', e.target.value)} /></label>
          <label>به‌ازای هر مترمکعب<input type="number" min="0" step="0.0001" value={tariffs.perCubicMeterKar} onChange={e => updateTariff('perCubicMeterKar', e.target.value)} /></label>
          <label>ضریب تحویل ساعتی<input type="number" min="0.1" max="10" step="0.1" value={tariffs.hourlyMultiplier} onChange={e => updateTariff('hourlyMultiplier', e.target.value)} /></label>
          <label>ضریب تحویل روزانه<input type="number" min="0.1" max="10" step="0.1" value={tariffs.dailyMultiplier} onChange={e => updateTariff('dailyMultiplier', e.target.value)} /></label>
          <label>ضریب تحویل چندروزه<input type="number" min="0.1" max="10" step="0.1" value={tariffs.multidayMultiplier} onChange={e => updateTariff('multidayMultiplier', e.target.value)} /></label>
          <label>ضریب پیشنهاد ویژه<input type="number" min="1" max="5" step="0.1" value={tariffs.specialMultiplier} onChange={e => updateTariff('specialMultiplier', e.target.value)} /></label>
        </div>
        <div className="tariff-actions"><small>مثال: تعرفه عادی ۲ کارسا با ضریب ویژه ۱٫۵ برابر، ۳ کارسا می‌شود.</small><button className="primary-button" type="submit" disabled={savingTariffs}>{savingTariffs ? 'در حال ذخیره…' : 'ذخیره تعرفه‌ها'}</button></div>
      </form>
    </section>

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
              <span>{categoryLabels[order.quote?.category] || '—'} · {number.format(order.quote?.distanceKm || 0)} کیلومتر</span>
            </div>
            <div className="transport-admin-route">{order.stops.map((stop, index) => <div key={index}>
              <MapPin size={15} /><span><b>{stop.kind === 'pickup' ? 'مبدأ' : 'مقصد'}: {stop.label}</b><small>{stop.province}، {stop.city} · {stop.address}</small></span>
              <a href={'https://www.openstreetmap.org/?mlat=' + stop.latitude + '&mlon=' + stop.longitude + '#map=14/' + stop.latitude + '/' + stop.longitude} target="_blank" rel="noreferrer">نقشه</a>
            </div>)}</div>
            <div className="transport-admin-quote"><span>پیشنهاد عادی: <b>{number.format(order.quote?.standardKar || 0)} کارسا</b></span><span>پیشنهاد ویژه: <b>{number.format(order.quote?.specialKar || 0)} کارسا</b></span></div>
            {order.description && <p className="transport-admin-description">{order.description}</p>}
            {reviewable && <div className="transport-candidates">
              <h3>همکاران واجد شرایط ({number.format(order.candidates?.length || 0)})</h3>
              {!order.candidates?.length ? <p>راننده تأییدشده با ظرفیت کافی برای این بار پیدا نشد.</p> :
                <div className="candidate-grid">{order.candidates.map(candidate => <label key={candidate.memberId}>
                  <input type="checkbox" checked={special.includes(candidate.memberId)} disabled={!special.includes(candidate.memberId) && special.length >= 2}
                    onChange={event => toggleSpecial(order._id, candidate.memberId, event.target.checked)} />
                  <span><b>{candidate.fullName}</b><small>{vehicleLabels[candidate.vehicleType] || candidate.vehicleType} · {candidate.model} · ظرفیت {number.format(candidate.capacityKg)} کیلوگرم</small><small>{candidate.city || 'شهر ثبت نشده'} · {candidate.phone || '—'}</small></span>
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
