import { useEffect, useState, type FormEvent } from 'react';
import { ChevronLeft, ChevronRight, Pencil, Plus, Search, X } from 'lucide-react';
import { ApiError, readMembers } from '../../api';
import { number } from '../catalog/catalog';
import MemberEditor from './MemberEditor';
import { type Member, type MemberGroup, type MemberPage, memberSections } from './members';

export default function MembersView({ group, token, onExpired }: { group: MemberGroup; token: string | null; onExpired: () => void }) {
  const [draft, setDraft] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<MemberPage>();
  const [error, setError] = useState('');
  const [revision, refresh] = useState(0);
  const [editor, setEditor] = useState<{ member?: Member }>();
  const [notice, setNotice] = useState('');
  const section = memberSections[group];
  const Icon = section.icon;
  const pages = data ? Math.min(10000, Math.max(1, Math.ceil(data.total / data.limit))) : 1;

  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    setData(undefined);
    setError('');
    readMembers(group, token, search, page, controller.signal).then(body => {
      if (!controller.signal.aborted) setData(body);
    }).catch(error => {
      if (controller.signal.aborted) return;
      if (error instanceof ApiError && error.status === 401) onExpired();
      else setError(error instanceof ApiError && error.status === 403
        ? 'فهرست اعضا فقط برای مدیر قابل مشاهده است.'
        : 'دریافت فهرست اعضا انجام نشد.');
    });
    return () => controller.abort();
  }, [group, token, search, page, revision, onExpired]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setSearch(draft.trim());
  }

  function saved() {
    if (!editor?.member) { setSearch(''); setDraft(''); setPage(1); }
    setEditor(undefined);
    setNotice('عضو ذخیره شد.');
    refresh(value => value + 1);
  }

  return (
    <main className="workspace">
      <div className="page-heading">
        <div className="page-icon"><Icon size={25} /></div>
        <div><h1>{section.label}</h1><p>اعضای ساری چین</p></div>
        {token && data && <button type="button" className="add-record" onClick={() => { setNotice(''); setEditor({}); }}><Plus size={17} /> افزودن عضو</button>}
      </div>
      {notice && <p className="catalog-notice" role="status">{notice}</p>}
      <section className="table-card" aria-label={`فهرست ${section.label}`}>
        {token && (
          <div className="table-toolbar">
            <form className="search" onSubmit={submit}>
              <Search size={18} />
              <input type="search" maxLength={100} aria-label="جستجو در اعضا" placeholder="نام، شماره موبایل یا سازمان"
                value={draft} onChange={event => setDraft(event.target.value)} />
              {(draft || search) && <button type="button" aria-label="پاک کردن جستجو" onClick={() => { setDraft(''); setSearch(''); setPage(1); }}><X size={16} /></button>}
              <button type="submit">جستجو</button>
            </form>
            <span className="record-count" role="status">{data && `${number.format(data.total)} عضو`}</span>
          </div>
        )}
        {!token ? <div className="table-state">برای مشاهده اعضا با حساب مدیر وارد شوید.</div>
          : error ? <div className="table-state" role="alert">{error}<button type="button" onClick={() => refresh(value => value + 1)}>تلاش دوباره</button></div>
          : !data ? <div className="table-state" role="status">در حال دریافت اعضا…</div>
          : !data.items.length ? <div className="table-state">{search ? 'عضوی با این جستجو پیدا نشد.' : 'عضوی برای نمایش وجود ندارد.'}</div> : (
            <div className="table-scroll" tabIndex={0} aria-label="جدول اعضا">
              <table>
                <thead><tr><th scope="col">نام</th><th scope="col">موبایل</th><th scope="col">{section.typeLabel}</th>
                  <th scope="col">شهر</th><th scope="col">وضعیت</th><th scope="col">عملیات</th></tr></thead>
                <tbody>{data.items.map(member => {
                  const name = member.fullName || member.username || member.phone || 'عضو';
                  return <tr key={member._id}>
                    <th scope="row">{name}{member.organization && <small className="member-organization">{member.organization}</small>}</th>
                    <td><bdi>{member.phone || '—'}</bdi></td>
                    <td>{member.role === 'admin' ? 'مدیر اصلی' : (section.types as Record<string, string>)[member.type ?? ''] || '—'}</td>
                    <td>{member.city || '—'}</td>
                    <td><span className={member.isActive === false ? 'status' : 'status active'}>{member.isActive === false ? 'غیرفعال' : 'فعال'}</span></td>
                    <td><div className="row-actions member-row-actions"><button type="button" title="ویرایش" aria-label={`ویرایش ${name}`}
                      onClick={() => { setNotice(''); setEditor({ member }); }}><Pencil size={15} /></button></div></td>
                  </tr>;
                })}</tbody>
              </table>
            </div>
          )}
        {pages > 1 && <nav className="pagination" aria-label="صفحه‌بندی اعضا">
          <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronRight size={15} /> قبلی</button>
          <span>صفحه {number.format(page)} از {number.format(pages)}</span>
          <button type="button" disabled={page >= pages} onClick={() => setPage(page + 1)}>بعدی <ChevronLeft size={15} /></button>
        </nav>}
      </section>
      {token && editor && <MemberEditor group={group} token={token} member={editor.member}
        onClose={() => setEditor(undefined)} onSave={saved} onExpired={onExpired} />}
    </main>
  );
}
