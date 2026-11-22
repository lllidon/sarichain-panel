import { useEffect, useState } from 'react';
import { ClipboardList } from 'lucide-react';
import { ApiError, readOrders } from '../../api';
import { number } from '../catalog/catalog';
import type { OrderPage } from './organization';

const dates = new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium' });

export default function OrdersView({ token, onExpired }: { token: string; onExpired: () => void }) {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<OrderPage>();
  const [error, setError] = useState(false);
  const pages = data ? Math.min(10000, Math.max(1, Math.ceil(data.total / data.limit))) : 1;

  useEffect(() => {
    const controller = new AbortController();
    setError(false);
    readOrders(token, page, controller.signal).then(result => {
      if (!controller.signal.aborted) setData(result);
    }).catch(failure => {
      if (controller.signal.aborted) return;
      if (failure instanceof ApiError && failure.status === 401) onExpired();
      else setError(true);
    });
    return () => controller.abort();
  }, [token, page, onExpired]);

  return (
    <main className="workspace">
      <div className="page-heading"><div className="page-icon"><ClipboardList size={23} /></div><div><h1>سفارش‌ها</h1></div></div>
      <section className="table-card" aria-label="فهرست سفارش‌ها">
        {error ? <div className="table-state" role="alert">سفارش‌ها بارگذاری نشدند.</div>
          : !data ? <div className="table-state" role="status">در حال دریافت سفارش‌ها…</div>
          : !data.items.length ? <div className="table-state">سفارشی برای نمایش وجود ندارد.</div>
          : <div className="table-scroll" tabIndex={0} aria-label="جدول سفارش‌ها">
            <table><thead><tr><th scope="col">شماره سفارش</th><th scope="col">شعبه</th><th scope="col">وضعیت</th><th scope="col">تاریخ</th></tr></thead>
              <tbody>{data.items.map(order => <tr key={order._id}>
                <th scope="row"><bdi>{order.number}</bdi></th><td>{order.branchId?.name ?? '—'}</td>
                <td>{order.status}</td><td>{order.createdAt && Number.isFinite(Date.parse(order.createdAt)) ? dates.format(Date.parse(order.createdAt)) : '—'}</td>
              </tr>)}</tbody></table>
          </div>}
        {pages > 1 && <nav className="pagination" aria-label="صفحه‌بندی سفارش‌ها">
          <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)}>قبلی</button>
          <span>{number.format(page)} از {number.format(pages)}</span>
          <button type="button" disabled={page >= pages} onClick={() => setPage(page + 1)}>بعدی</button>
        </nav>}
      </section>
    </main>
  );
}
