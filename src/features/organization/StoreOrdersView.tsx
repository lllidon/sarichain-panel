import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ClipboardList, Eye, RefreshCw, Search, Save, X, Package, Truck, Wallet, Settings2, Plus, Trash2, Printer, GripVertical, Check, Ban } from 'lucide-react';
import { ApiError, readAllStoreOrders, readStoreOrder, updateStoreOrder, readStoreOrderBoardConfig, saveStoreOrderBoardConfig, type StoreOrder, type StoreOrderBoardConfig, type StoreOrderBoardColumn, type StoreOrderBoardAction } from '../../api';

const money = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 2 });
const dates = new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium', timeStyle: 'short' });
const statusLabels: Record<string, string> = {
  pending: 'در انتظار بررسی', confirmed: 'تأیید شده', processing: 'در حال آماده‌سازی',
  shipped: 'ارسال شده', completed: 'تحویل شده', cancelled: 'لغو شده', returned: 'مرجوعی',
};
const availableStatuses = Object.entries(statusLabels);
const colors: Record<string, string> = { slate: 'slate', blue: 'blue', amber: 'amber', violet: 'violet', green: 'green', rose: 'rose' };
const fallbackConfig: StoreOrderBoardConfig = { columns: [
  { id: 'pending', title: 'سفارش جدید', statuses: ['pending'], color: 'slate', actions: [{ id: 'confirm', label: 'تأیید سفارش', type: 'status', targetStatus: 'confirmed' }, { id: 'reject', label: 'رد سفارش', type: 'status', targetStatus: 'cancelled' }, { id: 'print', label: 'چاپ سفارش', type: 'print' }] },
  { id: 'confirmed', title: 'تأیید شده', statuses: ['confirmed'], color: 'blue', actions: [{ id: 'prepare', label: 'شروع آماده‌سازی', type: 'status', targetStatus: 'processing' }, { id: 'print', label: 'چاپ سفارش', type: 'print' }] },
  { id: 'processing', title: 'در حال آماده‌سازی', statuses: ['processing'], color: 'amber', actions: [{ id: 'ship', label: 'ثبت ارسال', type: 'status', targetStatus: 'shipped' }, { id: 'print', label: 'چاپ سفارش', type: 'print' }] },
  { id: 'shipped', title: 'ارسال شده', statuses: ['shipped'], color: 'violet', actions: [{ id: 'complete', label: 'تأیید تحویل', type: 'status', targetStatus: 'completed' }, { id: 'print', label: 'چاپ سفارش', type: 'print' }] },
  { id: 'completed', title: 'تحویل شده', statuses: ['completed'], color: 'green', actions: [{ id: 'print', label: 'چاپ سفارش', type: 'print' }] },
  { id: 'exceptions', title: 'لغو و مرجوعی', statuses: ['cancelled', 'returned'], color: 'rose', actions: [{ id: 'print', label: 'چاپ سفارش', type: 'print' }] },
] };

function deliveryDate(order: StoreOrder) {
  const value = order.delivery?.expectedAt || order.delivery?.estimatedDeliveryAt || order.delivery?.deliveryDate;
  if (!value) return 'تعیین نشده';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'تعیین نشده' : new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium' }).format(date);
}
function orderColumn(config: StoreOrderBoardConfig, status: string) {
  return config.columns.find(column => column.statuses.includes(status));
}

export default function StoreOrdersView({ token, onExpired }: { token: string; onExpired: () => void }) {
  const [orders, setOrders] = useState<StoreOrder[]>([]);
  const [config, setConfig] = useState<StoreOrderBoardConfig>(fallbackConfig);
  const [search, setSearch] = useState('');
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
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [draftConfig, setDraftConfig] = useState<StoreOrderBoardConfig>(fallbackConfig);
  const [configSaving, setConfigSaving] = useState(false);
  const [draggingId, setDraggingId] = useState<string>();
  const [movingId, setMovingId] = useState<string>();
  const statusWrites = useRef(new Map<string, Promise<void>>());

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true); setError('');
    const controller = signal ? undefined : new AbortController();
    const activeSignal = signal ?? controller!.signal;
    try {
      const [allOrders, board] = await Promise.all([
        readAllStoreOrders(token, search, activeSignal),
        readStoreOrderBoardConfig(token, activeSignal),
      ]);
      if (!activeSignal.aborted) {
        setOrders(allOrders);
        if (board?.columns?.length) setConfig(board);
      }
    } catch (failure) {
      if (activeSignal.aborted) return;
      if (failure instanceof ApiError && failure.status === 401) onExpired();
      else setError(failure instanceof Error && failure.message ? failure.message : 'دریافت سفارش‌ها ناموفق بود.');
    } finally { if (!activeSignal.aborted) setLoading(false); }
  }, [token, search, onExpired]);

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
      setSelected(order); setTotal(String(order.total ?? 0));
      setShippingFee(String(order.meta?.shipping?.fee ?? 0));
      setTrackingCode(order.delivery?.trackingCode ?? '');
      setAdminNote(order.adminNote ?? ''); setNextStatus(order.status);
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 401) onExpired();
      else setSaveError(failure instanceof Error ? failure.message : 'جزئیات سفارش دریافت نشد.');
    } finally { setDetailLoading(false); }
  }

  async function changeStatus(order: StoreOrder, status: string) {
    if (status === order.status) { setDraggingId(undefined); return; }

    // Optimistic UI: move the card immediately; persist in the background.
    setOrders(current => current.map(item => item._id === order._id ? { ...item, status } : item));
    if (selected?._id === order._id) {
      setSelected(current => current ? { ...current, status } : current);
      setNextStatus(status);
    }
    setMovingId(order._id);
    setDraggingId(undefined);
    setError('');

    try {
      const previousWrite = statusWrites.current.get(order._id) ?? Promise.resolve();
      const currentWrite = previousWrite.catch(() => undefined)
        .then(() => updateStoreOrder(token, order._id, { status }))
        .then(() => undefined);
      statusWrites.current.set(order._id, currentWrite);
      try {
        await currentWrite;
      } finally {
        if (statusWrites.current.get(order._id) === currentWrite) statusWrites.current.delete(order._id);
      }
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 401) onExpired();
      else setError(failure instanceof Error
        ? `کارت در صفحه جابه‌جا شد، اما ثبت تغییر در سرور ناموفق بود: ${failure.message}`
        : 'کارت در صفحه جابه‌جا شد، اما ثبت تغییر در سرور ناموفق بود. وضعیت نمایش‌داده‌شده در این صفحه حفظ شده است.');
    } finally {
      setMovingId(current => current === order._id ? undefined : current);
    }
  }

  async function runAction(action: StoreOrderBoardAction) {
    if (!selected) return;
    if (action.type === 'print') { window.print(); return; }
    if (action.targetStatus) await changeStatus(selected, action.targetStatus);
  }

  async function save() {
    if (!selected) return;
    setSaving(true); setSaveError('');
    try {
      const updated = await updateStoreOrder(token, selected._id, {
        status: nextStatus, total: Number(total), shippingFee: Number(shippingFee), trackingCode, adminNote,
      });
      setSelected(updated);
      setOrders(current => current.map(order => order._id === updated._id ? { ...order, ...updated } : order));
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 401) onExpired();
      else setSaveError(failure instanceof Error ? failure.message : 'ذخیره تغییرات ناموفق بود.');
    } finally { setSaving(false); }
  }

  function updateColumn(index: number, patch: Partial<StoreOrderBoardColumn>) {
    setDraftConfig(current => ({ ...current, columns: current.columns.map((column, i) => i === index ? { ...column, ...patch } : column) }));
  }
  function toggleStatus(index: number, status: string, checked: boolean) {
    setDraftConfig(current => ({ ...current, columns: current.columns.map((column, i) => {
      if (i === index) return { ...column, statuses: checked ? [...column.statuses, status] : column.statuses.filter(value => value !== status) };
      return checked ? { ...column, statuses: column.statuses.filter(value => value !== status) } : column;
    }) }));
  }
  function addColumn() {
    const id = `column-${Date.now()}`;
    setDraftConfig(current => ({ ...current, columns: [...current.columns, { id, title: 'ستون جدید', statuses: [], color: 'slate', actions: [{ id: 'print', label: 'چاپ سفارش', type: 'print' }] }] }));
  }
  function addAction(index: number, type: 'status' | 'print') {
    const id = `action-${Date.now()}`;
    setDraftConfig(current => ({ ...current, columns: current.columns.map((column, i) => i !== index ? column : {
      ...column, actions: [...column.actions, { id, label: type === 'print' ? 'چاپ سفارش' : 'تغییر وضعیت', type, ...(type === 'status' ? { targetStatus: 'confirmed' } : {}) }],
    }) }));
  }
  async function persistConfig() {
    setConfigSaving(true); setError('');
    try {
      const clean = { columns: draftConfig.columns.map(column => ({ ...column, statuses: [...new Set(column.statuses)] })) };
      const saved = await saveStoreOrderBoardConfig(token, clean);
      setConfig(saved); setSettingsOpen(false);
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 401) onExpired();
      else setError(failure instanceof Error ? failure.message : 'ذخیره تنظیمات ستون‌ها ناموفق بود.');
    } finally { setConfigSaving(false); }
  }

  const unassigned = useMemo(() => orders.filter(order => !orderColumn(config, order.status)), [orders, config]);
  const totalValue = orders.reduce((sum, order) => sum + (order.total || 0), 0);

  return <main className="workspace store-orders-workspace store-kanban-workspace">
    <div className="page-heading"><div className="page-icon"><ClipboardList size={23} /></div><div><h1>مدیریت سفارش‌ها</h1><p>گردش سفارش‌ها را با جابه‌جایی کاشی‌ها بین ستون‌ها مدیریت کنید</p></div></div>
    <section className="store-kanban-summary">
      <article><small>کل سفارش‌های بارگذاری‌شده</small><strong>{money.format(orders.length)}</strong></article>
      <article><small>ارزش سفارش‌ها</small><strong>{money.format(totalValue)} <small>کارسا</small></strong></article>
      <article><small>نیازمند تعیین ستون</small><strong>{money.format(unassigned.length)}</strong></article>
      <button type="button" className="icon-button" onClick={() => void load()} aria-label="به‌روزرسانی"><RefreshCw size={18} /></button>
    </section>
    <section className="store-kanban-toolbar">
      <label className="search"><Search size={17} /><input type="search" value={search} placeholder="جستجوی شماره سفارش، نام یا موبایل مشتری" onChange={event => setSearch(event.target.value)} /></label>
      <button type="button" className="secondary-button" onClick={() => { setDraftConfig(config); setSettingsOpen(true); }}><Settings2 size={16} /> معرفی و تنظیم ستون‌ها</button>
      <span className="record-count">{money.format(orders.length)} سفارش</span>
    </section>
    {error && <div className="table-state" role="alert">{error}<button type="button" onClick={() => void load()}>تلاش دوباره</button></div>}
    {loading && !orders.length ? <div className="table-state">در حال دریافت سفارش‌ها…</div> : null}
    <section className="store-kanban-board" aria-label="تابلوی کانبان سفارش‌ها">
      {config.columns.map(column => {
        const columnOrders = orders.filter(order => column.statuses.includes(order.status));
        return <div key={column.id} className={`store-kanban-column tone-${colors[column.color] || 'slate'}`}
          onDragOver={event => event.preventDefault()}
          onDrop={event => { event.preventDefault(); const id = event.dataTransfer.getData('text/order-id') || draggingId; const order = orders.find(item => item._id === id); const target = column.statuses[0]; if (order && target) void changeStatus(order, target); }}>
          <header><span className="store-kanban-color" /><strong>{column.title}</strong><span className="store-kanban-count">{money.format(columnOrders.length)}</span></header>
          <div className="store-kanban-cards">
            {columnOrders.map(order => <article key={order._id} className={`store-kanban-card ${draggingId === order._id ? 'is-dragging' : ''}`}
              draggable onDragStart={event => { setDraggingId(order._id); event.dataTransfer.setData('text/order-id', order._id); event.dataTransfer.effectAllowed = 'move'; }}
              onDragEnd={() => setDraggingId(undefined)}>
              <div className="store-kanban-card-top"><bdi>{order.orderNumber}</bdi><GripVertical size={15} /></div>
              <strong className="store-kanban-customer">{order.customer?.fullName || order.customer?.organization || 'مشتری نامشخص'}</strong>
              <div className="store-kanban-card-meta"><span><Wallet size={13} />{money.format(order.total ?? 0)} کارسا</span><span><Package size={13} />{money.format(order.items?.length ?? 0)} قلم</span></div>
              <div className="store-kanban-card-meta"><span><Truck size={13} />{deliveryDate(order)}</span></div>
              <div className="store-kanban-card-bottom"><span className="store-kanban-tag">{order.tags?.[0] || order.delivery?.method || statusLabels[order.status] || 'بدون برچسب'}</span><button type="button" className="icon-button" aria-label="جزئیات سفارش" onClick={() => void openOrder(order._id)}><Eye size={16} /></button></div>
              {movingId === order._id && <small className="store-kanban-moving">در حال انتقال…</small>}
            </article>)}
            {!columnOrders.length && <div className="store-kanban-empty">سفارشی در این ستون نیست</div>}
          </div>
        </div>;
      })}
      {unassigned.length > 0 && <div className="store-kanban-column tone-rose"><header><span className="store-kanban-color" /><strong>وضعیت تعریف‌نشده</strong><span className="store-kanban-count">{money.format(unassigned.length)}</span></header><div className="store-kanban-cards">{unassigned.map(order => <article key={order._id} className="store-kanban-card"><bdi>{order.orderNumber}</bdi><strong>{order.customer?.fullName || '—'}</strong><small>{statusLabels[order.status] || order.status}</small><button type="button" onClick={() => void openOrder(order._id)}>جزئیات</button></article>)}</div></div>}
    </section>

    {detailLoading && <div className="store-order-overlay"><div className="store-order-dialog">در حال دریافت جزئیات سفارش…</div></div>}
    {selected && <div className="store-order-overlay" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setSelected(undefined); }}>
      <section className="store-order-dialog store-order-kanban-dialog" role="dialog" aria-modal="true" aria-labelledby="store-order-title">
        <header className="editor-heading"><div><h2 id="store-order-title">جزئیات سفارش {selected.orderNumber}</h2><small>{selected.customer?.fullName} · {selected.customer?.phone}</small></div><button type="button" className="icon-button" aria-label="بستن" onClick={() => setSelected(undefined)}><X size={18} /></button></header>
        <div className="store-order-popup-actions">
          {(orderColumn(config, selected.status)?.actions ?? []).map(action => <button key={action.id} type="button" className={action.type === 'print' ? 'secondary-button' : 'save-button'} onClick={() => void runAction(action)} disabled={movingId === selected._id}>
            {action.type === 'print' ? <Printer size={15} /> : action.targetStatus === 'cancelled' ? <Ban size={15} /> : <Check size={15} />}{action.label}
          </button>)}
        </div>
        <div className="store-order-detail-grid">
          <div><small>وضعیت فعلی</small><b>{statusLabels[selected.status] ?? selected.status}</b></div>
          <div><small>تاریخ ثبت</small><b>{selected.createdAt ? dates.format(new Date(selected.createdAt)) : '—'}</b></div>
          <div><small>تاریخ تحویل</small><b>{deliveryDate(selected)}</b></div>
          <div><small>آدرس تحویل</small><b>{selected.delivery?.addressSnapshot ? [selected.delivery.addressSnapshot.title, selected.delivery.addressSnapshot.city, selected.delivery.addressSnapshot.province, selected.delivery.addressSnapshot.address].filter(Boolean).join('، ') : '—'}</b></div>
          <div><small>موبایل مشتری</small><b>{selected.customer?.phone || '—'}</b></div>
          <div><small>روش ارسال</small><b>{selected.delivery?.method || '—'}</b></div>
        </div>
        <h3><Package size={17} /> اقلام سفارش</h3>
        <div className="store-order-lines">{selected.items?.map((item, index) => <article key={item._id ?? index}>
          {item.image ? <img src={item.image} alt="" /> : <span className="store-order-placeholder"><Package size={18} /></span>}
          <div><b>{item.name}</b><small>{money.format(item.quantity)} {item.unitName || 'عدد'} · فروشنده: {item.sellerName || '—'}</small></div>
          <strong>{money.format(item.lineSubtotal?.max ?? 0)} کارسا</strong>
        </article>)}</div>
        <h3><Wallet size={17} /> اطلاعات مالی و ارسال</h3>
        <div className="store-order-edit-grid">
          <label>وضعیت سفارش<select value={nextStatus} onChange={event => setNextStatus(event.target.value)}>{availableStatuses.map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label>مبلغ نهایی (کارسا)<input type="number" min="0" step="0.0001" value={total} onChange={event => setTotal(event.target.value)} /></label>
          <label>هزینه ارسال (کارسا)<input type="number" min="0" step="0.0001" value={shippingFee} onChange={event => setShippingFee(event.target.value)} /></label>
          <label><Truck size={15} /> کد رهگیری<input value={trackingCode} onChange={event => setTrackingCode(event.target.value)} /></label>
          <label className="editor-wide">یادداشت مدیریت<textarea rows={3} value={adminNote} onChange={event => setAdminNote(event.target.value)} /></label>
        </div>
        {saveError && <p className="editor-error" role="alert">{saveError}</p>}
        <footer className="editor-actions"><button type="button" onClick={() => setSelected(undefined)}>بستن</button><button type="button" className="save-button" disabled={saving} onClick={() => void save()}><Save size={16} />{saving ? 'در حال ذخیره…' : 'ذخیره تغییرات'}</button></footer>
      </section>
    </div>}

    {settingsOpen && <div className="store-order-overlay" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setSettingsOpen(false); }}>
      <section className="store-order-dialog store-kanban-settings" role="dialog" aria-modal="true" aria-labelledby="kanban-settings-title">
        <header className="editor-heading"><div><h2 id="kanban-settings-title">معرفی و تنظیم ستون‌ها</h2><small>وضعیت سفارش‌ها، عنوان ستون‌ها و دکمه‌های عملیاتی هر ستون را تعیین کنید</small></div><button type="button" className="icon-button" onClick={() => setSettingsOpen(false)} aria-label="بستن"><X size={18} /></button></header>
        <p className="shipping-default-note">هر وضعیت سفارش فقط می‌تواند عضو یک ستون باشد. دکمه‌های هر ستون در بالای پنجره جزئیات سفارش‌های همان ستون نمایش داده می‌شوند.</p>
        <div className="store-kanban-config-list">
          {draftConfig.columns.map((column, index) => <article key={column.id}>
            <div className="store-kanban-config-heading"><b>ستون {money.format(index + 1)}</b><button type="button" className="icon-button danger" aria-label="حذف ستون" onClick={() => setDraftConfig(current => ({ ...current, columns: current.columns.filter((_, i) => i !== index) }))}><Trash2 size={15} /></button></div>
            <label className="store-kanban-config-label">عنوان ستون<input value={column.title} maxLength={60} onChange={event => updateColumn(index, { title: event.target.value })} /></label>
            <div className="store-kanban-status-choices"><b>وضعیت‌های این ستون</b>{availableStatuses.map(([value,label]) => <label key={value}><input type="checkbox" checked={column.statuses.includes(value)} onChange={event => toggleStatus(index, value, event.target.checked)} />{label}</label>)}</div>
            <div className="store-kanban-config-actions"><b>دکمه‌های پنجره جزئیات</b>
              {column.actions.map(action => <div className="store-kanban-action-row" key={action.id}>
                <input aria-label="عنوان دکمه" value={action.label} onChange={event => updateColumn(index, { actions: column.actions.map(item => item.id === action.id ? { ...item, label: event.target.value } : item) })} />
                {action.type === 'status' ? <select aria-label="وضعیت مقصد" value={action.targetStatus} onChange={event => updateColumn(index, { actions: column.actions.map(item => item.id === action.id ? { ...item, targetStatus: event.target.value } : item) })}>{availableStatuses.map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select> : <span className="store-kanban-print-label"><Printer size={13} /> چاپ</span>}
                <button type="button" className="icon-button danger" aria-label="حذف دکمه" onClick={() => updateColumn(index, { actions: column.actions.filter(item => item.id !== action.id) })}><Trash2 size={14} /></button>
              </div>)}
              <div className="store-kanban-add-actions"><button type="button" onClick={() => addAction(index, 'status')}><Plus size={14} /> افزودن تغییر وضعیت</button><button type="button" onClick={() => addAction(index, 'print')}><Printer size={14} /> افزودن چاپ</button></div>
            </div>
          </article>)}
        </div>
        <button type="button" className="secondary-button" onClick={addColumn}><Plus size={16} /> افزودن ستون</button>
        <footer className="editor-actions"><button type="button" onClick={() => setSettingsOpen(false)}>انصراف</button><button type="button" className="save-button" disabled={configSaving} onClick={() => void persistConfig()}><Save size={16} />{configSaving ? 'در حال ذخیره…' : 'ذخیره تنظیمات کانبان'}</button></footer>
      </section>
    </div>}
  </main>;
}
