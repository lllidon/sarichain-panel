import { Fragment, useEffect, useRef, useState, type FormEvent } from 'react';
import { ChevronLeft, ChevronRight, Pencil, Plus, Search, X, Download, Upload } from 'lucide-react';
import { ApiError, readMembers, saveMember } from '../../api';
import { csvValue, downloadCsv, readCsv } from '../../lib/csv';
import { roleLabels, type Access } from '../organization/organization';
import { number } from '../catalog/catalog';
import MemberEditor from './MemberEditor';
import { type Member, type MemberGroup, type MemberPage, memberSections } from './members';

export default function MembersView({ group, token, access, onExpired }: { group: MemberGroup; token: string | null; access?: Access; onExpired: () => void }) {
  const [draft, setDraft] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<MemberPage>();
  const [error, setError] = useState('');
  const [revision, refresh] = useState(0);
  const [editor, setEditor] = useState<{ member?: Member }>();
  const [notice, setNotice] = useState('');
  const [excelBusy, setExcelBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const section = memberSections[group];
  const users = group === 'users';
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
        ? 'دسترسی مشاهده اعضا در این محدوده مجاز نیست.'
        : 'دریافت فهرست اعضا انجام نشد.');
    });
    return () => controller.abort();
  }, [group, token, search, page, revision, onExpired]);

  const excelColumns = users
    ? ['_id','fullName','username','phone','role','branchId','profileId','type','city','isActive']
    : ['_id','fullName','phone','type','organization','province','city','provinceCode','cityCode','address','email','notes','isActive','productionActivity','serviceArea'];

  async function exportExcel() {
    if (!token) return;
    setExcelBusy(true); setNotice('');
    try {
      const rows: Member[] = [];
      for (let current = 1; current <= 10000; current++) {
        const response = await readMembers(group, token, '', current, new AbortController().signal);
        rows.push(...response.items);
        if (rows.length >= response.total || !response.items.length) break;
      }
      const plain = rows.map(member => Object.fromEntries(excelColumns.map(key => {
        const value = (member as unknown as Record<string, unknown>)[key];
        return [key, value && typeof value === 'object' && '_id' in value ? (value as { _id: string })._id : value];
      })));
      downloadCsv('sarichain-' + group, plain, excelColumns);
      setNotice('خروجی اعضا آماده شد.');
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) onExpired();
      else setNotice('دریافت خروجی انجام نشد.');
    } finally { setExcelBusy(false); }
  }

  async function importExcel(file?: File) {
    if (!file || !token) return;
    setExcelBusy(true); setNotice('');
    try {
      const rows = await readCsv(file);
      if (!rows.length) throw new Error('فایل ردیفی برای ورود ندارد.');
      let success = 0; const failures: string[] = [];
      for (const [index, row] of rows.entries()) {
        try {
          if (!row._id) throw new Error('شناسه عضو برای به‌روزرسانی الزامی است.');
          const body = Object.fromEntries(Object.entries(row).filter(([key]) => excelColumns.includes(key) && key !== '_id')
            .map(([key, value]) => [key, csvValue(value)]));
          for (const key of ['branchId','profileId']) {
            const value = body[key];
            if (value && typeof value === 'object' && '_id' in value) body[key] = (value as { _id: string })._id;
          }
          await saveMember(group, token, body, row._id);
          success++;
        } catch (error) { failures.push('ردیف ' + (index + 2) + ': ' + (error instanceof ApiError ? error.message : error instanceof Error ? error.message : 'نامعتبر')); }
      }
      setNotice(success + ' عضو به‌روزرسانی شد.' + (failures.length ? ' ' + failures.slice(0, 5).join('؛ ') : ''));
      refresh(value => value + 1);
    } catch (error) { setNotice(error instanceof Error ? error.message : 'ورود فایل انجام نشد.'); }
    finally { setExcelBusy(false); if (fileInput.current) fileInput.current.value = ''; }
  }

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
        <div><h1>{users ? section.label : 'همکاران'}</h1><p>اعضای ساری چین</p></div>
        <div className="page-heading-actions">
          <button type="button" className="data-action-button" disabled={excelBusy} onClick={exportExcel}><Download size={17} /> دریافت خروجی</button>
          <button type="button" className="data-action-button data-action-secondary" disabled={excelBusy} onClick={() => fileInput.current?.click()}><Upload size={17} /> ورود اطلاعات</button>
          <input ref={fileInput} hidden type="file" accept=".csv,text/csv" onChange={event => void importExcel(event.target.files?.[0])} />
          <button type="button" className="add-record" onClick={() => { setNotice(''); setEditor({}); }}><Plus size={17} /> افزودن عضو</button>
        </div>
      </div>
      {notice && <p className="catalog-notice" role="status">{notice}</p>}
      <section className="table-card" aria-label={`فهرست ${section.label}`}>
        {token && (
          <div className="table-toolbar">
            {!users && <label className="member-role-filter">نوع همکار
              <select value={group} onChange={event => { location.hash = event.target.value; }}>
                <option value="customers">مشتریان</option>
                <option value="producers">تولیدکنندگان</option>
                <option value="service-providers">ارائه‌دهندگان خدمات و ناظران</option>
              </select>
            </label>}
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
              <table className="compact-table">
                <thead><tr><th scope="col">نام</th><th scope="col" className="compact-summary">موبایل</th><th scope="col" className="desktop-only">{section.typeLabel}</th>{users && <th scope="col" className="desktop-only">نقش دسترسی</th>}
                  <th scope="col" className="desktop-only">شعبه</th>{users && <th scope="col" className="desktop-only">پروفایل</th>}<th scope="col" className="desktop-only">شهر</th><th scope="col" className="desktop-only">وضعیت</th><th scope="col" className="compact-actions">عملیات</th></tr></thead>
                <tbody>{data.items.map((member, index) => {
                  const name = member.fullName || member.username || member.phone || 'عضو';
                  const externalRoles = users ? '' : [
                    member.customerType && 'خریدار',
                    member.producerType && 'تولیدکننده',
                    member.serviceTypes?.length && 'ارائه‌دهنده خدمات',
                  ].filter(Boolean).join(' · ');
                  const branchHeader = users && access?.role === 'management' &&
                    (index === 0 || data.items[index - 1].branchId?._id !== member.branchId?._id);
                  const canEdit = access?.role === 'management' || !users || member.role === 'client';
                  return <Fragment key={member._id}>
                    {branchHeader && <tr className="member-branch-row"><th scope="rowgroup" colSpan={9}>{member.branchId?.name || 'مدیریت مرکزی / بدون شعبه'}</th></tr>}
                    <tr>
                    <th scope="row"><span className="compact-name" title={name}>{name}</span>
                      <span className="mobile-only compact-details">
                        <small>{users ? roleLabels[member.role ?? 'client'] : (section.types as Record<string, string>)[member.type ?? '']}</small>
                        {(member.branchId?.name || member.city) && <small>{member.branchId?.name || member.city}</small>}
                      </span>
                      {externalRoles && <small className="member-organization desktop-only">{externalRoles}</small>}
                      {member.organization && <small className="member-organization desktop-only">{member.organization}</small>}</th>
                    <td className="compact-summary"><bdi>{member.phone || '—'}</bdi>
                      <span className="mobile-only"><span className={member.isActive === false ? 'status' : 'status active'}>{member.isActive === false ? 'غیرفعال' : 'فعال'}</span></span>
                    </td>
                    <td className="desktop-only">{(section.types as Record<string, string>)[member.type ?? ''] || '—'}</td>
                    {users && <td className="desktop-only">{roleLabels[member.role ?? 'client']}</td>}
                    <td className="desktop-only">{member.branchId?.name || '—'}</td>
                    {users && <td className="desktop-only">{member.profileId?.name || '—'}</td>}
                    <td className="desktop-only">{member.city || '—'}</td>
                    <td className="desktop-only"><span className={member.isActive === false ? 'status' : 'status active'}>{member.isActive === false ? 'غیرفعال' : 'فعال'}</span></td>
                    <td className="compact-actions">{canEdit && <div className="row-actions member-row-actions"><button type="button" title="ویرایش" aria-label={`ویرایش ${name}`}
                      onClick={() => { setNotice(''); setEditor({ member }); }}><Pencil size={15} /></button></div>}</td>
                  </tr></Fragment>;
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
      {token && editor && access && <MemberEditor access={access} group={group} token={token} member={editor.member}
        onClose={() => setEditor(undefined)} onSave={saved} onExpired={onExpired} />}
    </main>
  );
}
