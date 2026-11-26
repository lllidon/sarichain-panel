import { useEffect, useState, type FormEvent } from 'react';
import { ChevronLeft, ChevronRight, Search, Truck } from 'lucide-react';
import { ApiError, readTransportVehicles, type TransportVehiclePage } from '../../api';
import { number } from '../catalog/catalog';

const vehicleTypes: Record<string, string> = {
  motorcycle: 'موتورسیکلت',
  car: 'خودرو سواری',
  pickup: 'وانت',
  van: 'ون',
  truckette: 'کامیونت',
  truck: 'کامیون',
};

export default function TransportVehiclesView({ token, onExpired }: { token: string; onExpired: () => void }) {
  const [draft, setDraft] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<TransportVehiclePage>();
  const [error, setError] = useState('');
  const [revision, refresh] = useState(0);
  const pages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  useEffect(() => {
    const controller = new AbortController();
    setData(undefined);
    setError('');
    readTransportVehicles(token, search, page, controller.signal).then(result => {
      if (!controller.signal.aborted) setData(result);
    }).catch(failure => {
      if (controller.signal.aborted) return;
      if (failure instanceof ApiError && failure.status === 401) onExpired();
      else setError(failure instanceof ApiError && failure.status === 403
        ? 'دسترسی مدیریت حمل‌ونقل فقط برای مدیر مجاز است.'
        : 'دریافت فهرست وسایل نقلیه انجام نشد.');
    });
    return () => controller.abort();
  }, [token, search, page, revision, onExpired]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setSearch(draft.trim());
  }

  return (
    <main className="workspace">
      <div className="page-heading">
        <div className="page-icon"><Truck size={24} /></div>
        <div><h1>مدیریت حمل‌ونقل</h1><p>فهرست وسایل نقلیه ثبت‌شده توسط همکاران</p></div>
        <span className="record-count">{data && `${number.format(data.total)} وسیله نقلیه`}</span>
      </div>
      <section className="table-card" aria-label="فهرست وسایل نقلیه">
        <div className="table-toolbar">
          <form className="search" onSubmit={submit}>
            <Search size={18} />
            <input type="search" maxLength={100} aria-label="جستجو در وسایل نقلیه"
              placeholder="نام همکار، موبایل، مدل یا پلاک"
              value={draft} onChange={event => setDraft(event.target.value)} />
            <button type="submit">جستجو</button>
          </form>
          <button type="button" onClick={() => refresh(value => value + 1)}>بروزرسانی</button>
        </div>
        {error ? <div className="table-state" role="alert">{error}<button type="button" onClick={() => refresh(value => value + 1)}>تلاش دوباره</button></div>
          : !data ? <div className="table-state" role="status">در حال دریافت وسایل نقلیه…</div>
          : !data.items.length ? <div className="table-state">{search ? 'موردی با این جستجو پیدا نشد.' : 'هنوز وسیله نقلیه‌ای ثبت نشده است.'}</div>
          : <div className="table-scroll" tabIndex={0} aria-label="جدول وسایل نقلیه">
            <table className="compact-table">
              <thead><tr>
                <th scope="col">وسیله نقلیه</th>
                <th scope="col" className="desktop-only">نوع و ظرفیت</th>
                <th scope="col" className="compact-summary">پلاک</th>
                <th scope="col" className="desktop-only">همکار</th>
                <th scope="col" className="desktop-only">موبایل</th>
                <th scope="col" className="desktop-only">شهر</th>
                <th scope="col" className="desktop-only">وضعیت حساب</th>
              </tr></thead>
              <tbody>{data.items.map(vehicle => {
                const owner = vehicle.member?.fullName || vehicle.member?.organization || 'همکار ثبت‌کننده';
                return <tr key={vehicle._id}>
                  <th scope="row">
                    <span className="compact-name">{vehicle.model}</span>
                    <span className="mobile-only compact-details">
                      <small>{vehicleTypes[vehicle.type] || vehicle.type} · {number.format(vehicle.year)}</small>
                      <small>{owner} · {vehicle.member?.phone || 'بدون شماره'}</small>
                    </span>
                  </th>
                  <td className="desktop-only">{vehicleTypes[vehicle.type] || vehicle.type} · {number.format(vehicle.capacityKg)} کیلوگرم</td>
                  <td className="compact-summary"><bdi>{vehicle.plate}</bdi></td>
                  <td className="desktop-only">{owner}</td>
                  <td className="desktop-only"><bdi>{vehicle.member?.phone || '—'}</bdi></td>
                  <td className="desktop-only">{vehicle.member?.city || '—'}</td>
                  <td className="desktop-only"><span className={vehicle.member?.isActive === false ? 'status' : 'status active'}>{vehicle.member?.isActive === false ? 'غیرفعال' : 'فعال'}</span></td>
                </tr>;
              })}</tbody>
            </table>
          </div>}
        {data && pages > 1 && <nav className="pagination" aria-label="صفحه‌بندی وسایل نقلیه">
          <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronRight size={15} /> قبلی</button>
          <span>صفحه {number.format(page)} از {number.format(pages)}</span>
          <button type="button" disabled={page >= pages} onClick={() => setPage(page + 1)}>بعدی <ChevronLeft size={15} /></button>
        </nav>}
      </section>
    </main>
  );
}
