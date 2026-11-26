import { useEffect, useState } from 'react';
import { Check, FileText, RefreshCw, X } from 'lucide-react';
import { ApiError, readAccountUpgradeRequests, reviewAccountUpgradeRequest, type AccountUpgradeRequest } from '../../api';

const kindLabels = { transport: 'ارتقای حساب به حمل‌کننده', producer: 'ارتقای حساب به تولیدکننده' };
const docLabels: Record<string, string> = {
  nationalId: 'کارت ملی', driverLicense: 'گواهینامه', vehicleCard: 'کارت خودرو', productionProof: 'مدرک فعالیت تولیدی',
};
const vehicleLabels: Record<string, string> = {
  motorcycle: 'موتورسیکلت', car: 'خودروی شخصی', pickup: 'وانت', van: 'ون', truckette: 'کامیونت', truck: 'کامیون',
};

export default function AccountUpgradeRequestsView({ token, onExpired }: { token: string; onExpired: () => void }) {
  const [items, setItems] = useState<AccountUpgradeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    readAccountUpgradeRequests(token, controller.signal).then(data => {
      if (!controller.signal.aborted) setItems(data.items);
    }).catch(failure => {
      if (controller.signal.aborted) return;
      if (failure instanceof ApiError && failure.status === 401) onExpired();
      else setError(failure instanceof ApiError && failure.message ? failure.message : 'دریافت درخواست‌ها انجام نشد.');
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [token, onExpired, revision]);

  async function decide(item: AccountUpgradeRequest, status: 'approved' | 'rejected') {
    setBusy(item._id); setError('');
    try {
      await reviewAccountUpgradeRequest(token, item._id, status, notes[item._id] || '');
      setItems(current => current.filter(row => row._id !== item._id));
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 401) onExpired();
      else setError(failure instanceof Error ? failure.message : 'ثبت تصمیم انجام نشد.');
    } finally { setBusy(''); }
  }

  return <main className="workspace">
    <div className="page-heading">
      <div className="page-icon"><FileText size={25}/></div>
      <div><h1>درخواست ارتقای حساب</h1><p>بررسی مدارک مشتریان و اعطای صلاحیت‌های فعالیت در ساری‌چین</p></div>
      <button className="add-record" type="button" onClick={() => setRevision(value => value + 1)}><RefreshCw size={16}/> تازه‌سازی</button>
    </div>
    {error && <p className="catalog-error" role="alert">{error}</p>}
    {loading ? <div className="table-state">در حال دریافت درخواست‌ها…</div>
      : !items.length ? <div className="table-state">درخواست در انتظار بررسی وجود ندارد.</div>
      : <div className="account-upgrade-admin-list">{items.map(item => <article className="table-card account-upgrade-admin-card" key={item._id}>
        <header><div><h2>{kindLabels[item.kind]}</h2><strong>{item.memberSnapshot?.fullName || 'کاربر'}</strong>
          <p><bdi>{item.memberSnapshot?.phone || '—'}</bdi>{item.memberSnapshot?.organization ? ' · ' + item.memberSnapshot.organization : ''}</p></div>
          <span className="status">در انتظار بررسی</span></header>
        {item.vehicle && <dl className="account-upgrade-admin-details">
          <div><dt>وسیله</dt><dd>{vehicleLabels[item.vehicle.type] || item.vehicle.type} · {item.vehicle.model}</dd></div>
          <div><dt>سال ساخت</dt><dd>{item.vehicle.year}</dd></div>
          <div><dt>ظرفیت</dt><dd>{item.vehicle.capacityKg.toLocaleString('fa-IR')} کیلوگرم{item.vehicle.capacityM3 ? ' · ' + item.vehicle.capacityM3 + ' مترمکعب' : ''}</dd></div>
          <div><dt>پلاک</dt><dd>{item.vehicle.plate}</dd></div>
          <div><dt>گواهینامه</dt><dd>{item.vehicle.license}</dd></div>
        </dl>}
        {item.producerType && <p>نوع تولیدکننده: <b>{item.producerType}</b></p>}
        {item.requestedCategoryIds?.length ? <p>دسته‌بندی‌های درخواستی: <bdi>{item.requestedCategoryIds.join('، ')}</bdi></p> : null}
        <h3>مدارک ارسالی</h3>
        <div className="account-upgrade-admin-docs">{item.documents.map(doc => <a key={doc.type} href={doc.dataUrl} target="_blank" rel="noreferrer">
          {doc.mimeType.startsWith('image/') ? <img src={doc.dataUrl} alt={docLabels[doc.type] || doc.type}/> : <FileText size={28}/>}
          <span>{docLabels[doc.type] || doc.type}<small>{doc.fileName}</small></span>
        </a>)}</div>
        <label className="account-upgrade-admin-note">یادداشت بررسی / دلیل رد یا تکمیل مدارک
          <textarea rows={2} maxLength={500} value={notes[item._id] || ''} onChange={event => setNotes(current => ({ ...current, [item._id]: event.target.value }))}/>
        </label>
        <footer>
          <button type="button" className="add-record" disabled={busy === item._id} onClick={() => decide(item, 'approved')}><Check size={16}/> تأیید و فعال‌سازی</button>
          <button type="button" className="icon-button" disabled={busy === item._id} onClick={() => decide(item, 'rejected')}><X size={16}/> رد درخواست</button>
        </footer>
      </article>)}</div>}
  </main>;
}
