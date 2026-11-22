import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Building2, Pencil, Plus, UserRound, X } from 'lucide-react';
import { ApiError, readSettings, writeSetting } from '../../api';
import type { Setting, SettingList } from './organization';

export default function SettingsDrawer({ token, onClose, onExpired }: { token: string; onClose: () => void; onExpired: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [list, setList] = useState<SettingList>('branches');
  const [rows, setRows] = useState<Setting[]>();
  const [editor, setEditor] = useState<{ item?: Setting }>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [revision, refresh] = useState(0);
  const branches = list === 'branches';

  useEffect(() => { dialog.current?.showModal(); }, []);
  useEffect(() => {
    const controller = new AbortController();
    setRows(undefined);
    setError('');
    readSettings(list, token, controller.signal).then(body => {
      if (!controller.signal.aborted) setRows(body);
    }).catch(failure => {
      if (controller.signal.aborted) return;
      if (failure instanceof ApiError && failure.status === 401) onExpired();
      else setError('فهرست تنظیمات بارگذاری نشد.');
    });
    return () => controller.abort();
  }, [list, token, revision, onExpired]);

  function select(next: SettingList) {
    setList(next);
    setEditor(undefined);
    setError('');
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = Object.fromEntries([...new FormData(event.currentTarget)].map(([key, value]) => [key, String(value).trim()]));
    setError('');
    setBusy(true);
    try {
      await writeSetting(list, token, data, editor?.item?._id);
      setEditor(undefined);
      refresh(value => value + 1);
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 401) onExpired();
      else setError(failure instanceof ApiError && failure.message ? failure.message : 'ذخیره انجام نشد.');
    } finally { setBusy(false); }
  }

  return (
    <dialog ref={dialog} className="settings-drawer" aria-labelledby="settings-drawer-title" onClose={onClose}
      onCancel={event => { if (busy) event.preventDefault(); }}>
      <div className="editor-heading"><h2 id="settings-drawer-title">تنظیمات سازمانی</h2>
        <button type="button" className="icon-button" aria-label="بستن تنظیمات" onClick={() => dialog.current?.close()} disabled={busy}><X size={18} /></button>
      </div>
      <nav className="settings-tabs" aria-label="بخش‌های تنظیمات">
        <button type="button" aria-pressed={branches} disabled={busy} onClick={() => select('branches')}><Building2 size={16} /> شعبه‌ها</button>
        <button type="button" aria-pressed={!branches} disabled={busy} onClick={() => select('profiles')}><UserRound size={16} /> پروفایل‌ها</button>
      </nav>
      {editor ? (
        <form className="settings-editor" key={editor.item?._id ?? 'new'} onSubmit={save}>
          <h3>{editor.item ? 'ویرایش' : 'افزودن'} {branches ? 'شعبه' : 'پروفایل'}</h3>
          <fieldset className="editor-fields" disabled={busy}>
            <label>نام<input name="name" defaultValue={editor.item?.name} maxLength={140} required autoFocus /></label>
            <label>کد<input name="code" dir="ltr" defaultValue={editor.item?.code} maxLength={40} pattern="[a-zA-Z0-9][a-zA-Z0-9\-]*" required /></label>
            {branches && <label>شهر<input name="city" defaultValue={editor.item?.city} maxLength={100} /></label>}
            <label className="editor-wide">توضیح<textarea name="description" rows={3} defaultValue={editor.item?.description} maxLength={600} /></label>
          </fieldset>
          {error && <p role="alert" className="editor-error">{error}</p>}
          <div className="editor-actions"><button type="button" disabled={busy} onClick={() => { setEditor(undefined); setError(''); }}>انصراف</button>
            <button type="submit" className="save-button" disabled={busy}>ذخیره</button></div>
        </form>
      ) : (
        <>
          <button className="add-record" type="button" disabled={!rows} onClick={() => setEditor({})}><Plus size={16} /> {branches ? 'افزودن شعبه' : 'افزودن پروفایل'}</button>
          {error ? <p role="alert" className="editor-error">{error}</p> : !rows ? <p role="status">در حال بارگذاری…</p>
            : !rows.length ? <p>رکوردی وجود ندارد.</p> : (
              <ul className="settings-list">{rows.map(row => (
                <li key={row._id}><div><strong>{row.name}</strong><small><bdi>{row.code}</bdi>{row.city && ' · ' + row.city}</small>
                  {row.description && <small>{row.description}</small>}</div>
                  <button className="icon-button" type="button" aria-label={`ویرایش ${row.name}`} onClick={() => setEditor({ item: row })}><Pencil size={15} /></button>
                </li>
              ))}</ul>
            )}
        </>
      )}
    </dialog>
  );
}
