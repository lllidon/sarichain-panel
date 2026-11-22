import { useEffect, useRef, useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import { ApiError, saveMember } from '../../api';
import { type Member, type MemberGroup, memberSections } from './members';

export default function MemberEditor({ group, member, token, onClose, onSave, onExpired }: {
  group: MemberGroup; member?: Member; token: string; onClose: () => void; onSave: () => void; onExpired: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const section = memberSections[group];

  useEffect(() => { dialog.current?.showModal(); }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const fields: Record<string, string | boolean> = Object.fromEntries(
      [...values].filter(([key, value]) => key !== 'isActive' && (key !== 'password' || value))
        .map(([key, value]) => [key, key === 'password' ? String(value) : String(value).trim()]),
    );
    fields.isActive = values.has('isActive');
    setBusy(true);
    setError('');
    try {
      await saveMember(group, token, fields, member?._id);
      dialog.current?.close();
      onSave();
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 401) onExpired();
      else setError(failure instanceof ApiError && failure.message ? failure.message : 'ذخیره عضو انجام نشد.');
    } finally { setBusy(false); }
  }

  return (
    <dialog ref={dialog} className="catalog-editor" aria-labelledby="member-editor-title"
      onCancel={event => { if (busy) event.preventDefault(); }} onClose={onClose}>
      <div className="editor-heading">
        <h2 id="member-editor-title">{member ? 'ویرایش عضو' : 'افزودن عضو'} · {section.label}</h2>
        <button className="icon-button" type="button" aria-label="بستن فرم" disabled={busy} onClick={() => dialog.current?.close()}><X size={18} /></button>
      </div>
      <form onSubmit={submit}>
        <fieldset className="editor-fields" disabled={busy}>
          <label>نام و نام خانوادگی / نام مجموعه<input name="fullName" defaultValue={member?.fullName ?? member?.username} maxLength={160} required autoFocus /></label>
          <label>شماره موبایل<input name="phone" type="tel" dir="ltr" defaultValue={member?.phone} maxLength={20} placeholder="09123456789" required /></label>
          <label>{section.typeLabel}<select aria-label={section.typeLabel} name="type" defaultValue={member?.type ?? (member?.role === 'admin' ? 'management' : '')} required>
            <option value="">انتخاب کنید</option>
            {Object.entries(section.types).map(([code, label]) => <option key={code} value={code}>{label}</option>)}
          </select></label>
          <label className="editor-checkbox"><input name="isActive" type="checkbox" defaultChecked={member?.isActive !== false} /> فعال</label>
          <label>ایمیل<input name="email" type="email" dir="ltr" defaultValue={member?.email} maxLength={254} /></label>
          <label>سازمان / نام کسب‌وکار<input name="organization" defaultValue={member?.organization} maxLength={160} /></label>
          <label>استان<input name="province" defaultValue={member?.province} maxLength={100} /></label>
          <label>شهر<input name="city" defaultValue={member?.city} maxLength={100} /></label>
          {group === 'producers' && <label className="editor-wide">محصولات یا فعالیت تولیدی<input name="productionActivity" defaultValue={member?.productionActivity} maxLength={180} /></label>}
          {group === 'service-providers' && <label className="editor-wide">محدوده خدمت<input name="serviceArea" defaultValue={member?.serviceArea} maxLength={180} /></label>}
          {group === 'users' && (
            <label className="editor-wide">{member ? 'رمز جدید (اختیاری)' : 'رمز ورود'}
              <input name="password" type="password" dir="ltr" autoComplete="new-password" minLength={8} maxLength={128} required={!member} />
            </label>
          )}
          <label className="editor-wide">نشانی<textarea name="address" defaultValue={member?.address} maxLength={500} rows={2} /></label>
          <label className="editor-wide">یادداشت<textarea name="notes" defaultValue={member?.notes} maxLength={1000} rows={2} /></label>
        </fieldset>
        {error && <p role="alert" className="editor-error">{error}</p>}
        <div className="editor-actions">
          <button type="button" disabled={busy} onClick={() => dialog.current?.close()}>انصراف</button>
          <button type="submit" className="save-button" disabled={busy}>{busy ? 'در حال ثبت…' : 'ذخیره عضو'}</button>
        </div>
      </form>
    </dialog>
  );
}
