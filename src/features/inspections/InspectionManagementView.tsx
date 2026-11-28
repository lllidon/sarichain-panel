import { useCallback, useEffect, useState, type FormEvent } from 'react';
import './InspectionManagementView.css';
import { BadgeCheck, ClipboardCheck, Coins, MapPinned, RefreshCw, Save, ShieldCheck, Users } from 'lucide-react';
import {
  ApiError, readInspectionManagement, readInspectionPolicy, reviewInspectorApplication,
  reviewInspectionReport, saveInspectionPolicy, type InspectionManagementData, type InspectionPolicy,
} from '../../api';

const number = new Intl.NumberFormat('fa-IR');
const dates = new Intl.DateTimeFormat('fa-IR',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Tehran'});
const statusLabels:Record<string,string> = {
  awaiting_inspector:'در انتظار ناظر',offered:'پیشنهاد مأموریت',scheduled:'زمان‌بندی‌شده',
  pending_review:'در انتظار بررسی گزارش',completed:'تکمیل‌شده',revision_required:'نیازمند اصلاح',
};
const specialtyLabels:Record<string,string> = {
  'all-crops':'همه محصولات کشاورزی',orchard:'باغداری',farmland:'کشت زراعی',
  greenhouse:'گلخانه',nursery:'نهالستان',crop_quality:'کنترل کیفیت محصول',
};
const defaults:InspectionPolicy = {
  baseKarsha:3,perHectareKarsha:1.5,perThousandKgKarsha:.25,
  typeMultipliers:{orchard:1.15,farmland:1,greenhouse:1.3,nursery:1.1},historyMultiplier:1.05,varietyMultiplier:.02,
  maxActiveAssignments:4,nearestPoolSize:5,offerMinutes:90,
};

export default function InspectionManagementView({token,onExpired}:{token:string;onExpired:()=>void}) {
  const [data,setData]=useState<InspectionManagementData>();
  const [policy,setPolicy]=useState<InspectionPolicy>(defaults);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState('');
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [notes,setNotes]=useState<Record<string,string>>({});
  const [revision,setRevision]=useState(0);
  const refresh=useCallback(()=>setRevision(value=>value+1),[]);
  useEffect(()=>{
    const controller=new AbortController();setLoading(true);setError('');
    Promise.all([readInspectionManagement(token,controller.signal),readInspectionPolicy(token,controller.signal)]).then(([rows,settings])=>{
      if(controller.signal.aborted)return;
      setData(rows);setPolicy(settings);
    }).catch(failure=>{
      if(controller.signal.aborted)return;
      if(failure instanceof ApiError&&failure.status===401)onExpired();
      else setError(failure instanceof Error?failure.message:'دریافت اطلاعات نظارت ناموفق بود.');
    }).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return ()=>controller.abort();
  },[token,onExpired,revision]);
  async function decideApplication(memberId:string,status:'approved'|'rejected') {
    setBusy(memberId);setError('');setNotice('');
    try {
      await reviewInspectorApplication(token,memberId,status,notes[memberId]||'');
      setNotice(status==='approved'?'صلاحیت ناظر فعال شد.':'درخواست ناظر رد شد.');refresh();
    } catch(failure) {
      if(failure instanceof ApiError&&failure.status===401)onExpired();
      else setError(failure instanceof Error?failure.message:'ثبت تصمیم انجام نشد.');
    } finally {setBusy('');}
  }
  async function decideReport(requestId:string,status:'approved'|'rejected') {
    setBusy(requestId);setError('');setNotice('');
    try {
      await reviewInspectionReport(token,requestId,status,notes[requestId]||'');
      setNotice(status==='approved'?'گزارش تأیید و پاداش کارسایی ناظر ثبت شد.':'گزارش برای اصلاح به ناظر برگشت داده شد.');refresh();
    } catch(failure) {
      if(failure instanceof ApiError&&failure.status===401)onExpired();
      else setError(failure instanceof Error?failure.message:'ثبت نتیجه بررسی گزارش انجام نشد.');
    } finally {setBusy('');}
  }
  async function savePolicy(event:FormEvent) {
    event.preventDefault();setBusy('policy');setError('');setNotice('');
    try {setPolicy(await saveInspectionPolicy(token,policy));setNotice('سیاست تخصیص و پاداش ذخیره شد.');}
    catch(failure) {
      if(failure instanceof ApiError&&failure.status===401)onExpired();
      else setError(failure instanceof Error?failure.message:'ذخیره سیاست انجام نشد.');
    } finally {setBusy('');}
  }
  return <main className="workspace inspection-admin-workspace">
    <div className="page-heading">
      <div className="page-icon"><ClipboardCheck size={24}/></div>
      <div><h1>مدیریت نظارت</h1><p>درخواست ناظران، تخصیص مأموریت، بررسی گزارش و پاداش کارسایی</p></div>
      <button className="icon-button" type="button" aria-label="تازه‌سازی" onClick={refresh}><RefreshCw size={17}/></button>
    </div>
    {error&&<p className="catalog-notice error-message" role="alert">{error}</p>}
    {notice&&<p className="catalog-notice" role="status">{notice}</p>}
    {loading?<div className="table-state">در حال دریافت اطلاعات نظارت…</div>:<>
      <div className="inspection-admin-stats">
        <article><Users/><strong>{number.format(data?.applications.length||0)}</strong><span>درخواست ناظر جدید</span></article>
        <article><MapPinned/><strong>{number.format(data?.requests.length||0)}</strong><span>کل درخواست‌های نظارت</span></article>
        <article><ClipboardCheck/><strong>{number.format(data?.reports.length||0)}</strong><span>گزارش در انتظار بررسی</span></article>
      </div>
      <section className="tariff-card">
        <div className="transport-admin-section-heading"><div><h2><Coins size={18}/> سیاست تخصیص و پاداش</h2><p>انتخاب ناظر از نزدیک‌ترین افراد واجد شرایط با توزیع وزن‌دار مأموریت‌ها انجام می‌شود.</p></div></div>
        <form className="inspection-policy-form" onSubmit={savePolicy}>
          <label>پاداش پایه (کارسا)<input type="number" min="0" step="0.01" value={policy.baseKarsha} onChange={e=>setPolicy({...policy,baseKarsha:Number(e.target.value)})}/></label>
          <label>پاداش هر هکتار<input type="number" min="0" step="0.01" value={policy.perHectareKarsha} onChange={e=>setPolicy({...policy,perHectareKarsha:Number(e.target.value)})}/></label>
          <label>پاداش هر ۱۰۰۰ کیلوگرم<input type="number" min="0" step="0.01" value={policy.perThousandKgKarsha} onChange={e=>setPolicy({...policy,perThousandKgKarsha:Number(e.target.value)})}/></label>
          <label>ضریب سابقه تولید قبلی<input type="number" min="1" max="3" step="0.01" value={policy.historyMultiplier} onChange={e=>setPolicy({...policy,historyMultiplier:Number(e.target.value)})}/></label>
          <label>ضریب هر رقم محصول<input type="number" min="0" max="0.5" step="0.01" value={policy.varietyMultiplier} onChange={e=>setPolicy({...policy,varietyMultiplier:Number(e.target.value)})}/></label>
          <label>ضریب باغ<input type="number" min="0.5" max="3" step="0.01" value={policy.typeMultipliers.orchard} onChange={e=>setPolicy({...policy,typeMultipliers:{...policy.typeMultipliers,orchard:Number(e.target.value)}})}/></label>
          <label>ضریب زمین زراعی<input type="number" min="0.5" max="3" step="0.01" value={policy.typeMultipliers.farmland} onChange={e=>setPolicy({...policy,typeMultipliers:{...policy.typeMultipliers,farmland:Number(e.target.value)}})}/></label>
          <label>ضریب گلخانه<input type="number" min="0.5" max="3" step="0.01" value={policy.typeMultipliers.greenhouse} onChange={e=>setPolicy({...policy,typeMultipliers:{...policy.typeMultipliers,greenhouse:Number(e.target.value)}})}/></label>
          <label>ضریب نهالستان<input type="number" min="0.5" max="3" step="0.01" value={policy.typeMultipliers.nursery} onChange={e=>setPolicy({...policy,typeMultipliers:{...policy.typeMultipliers,nursery:Number(e.target.value)}})}/></label>
          <label>حداکثر مأموریت فعال هر ناظر<input type="number" min="1" max="50" value={policy.maxActiveAssignments} onChange={e=>setPolicy({...policy,maxActiveAssignments:Number(e.target.value)})}/></label>
          <label>تعداد ناظران نزدیک در قرعه‌کشی<input type="number" min="1" max="10" value={policy.nearestPoolSize} onChange={e=>setPolicy({...policy,nearestPoolSize:Number(e.target.value)})}/></label>
          <label>مهلت پاسخ ناظر (دقیقه)<input type="number" min="5" max="1440" value={policy.offerMinutes} onChange={e=>setPolicy({...policy,offerMinutes:Number(e.target.value)})}/></label>
          <button className="primary-button" disabled={busy==='policy'}><Save size={15}/> ذخیره سیاست</button>
        </form>
      </section>
      <section className="tariff-card">
        <div className="transport-admin-section-heading"><div><h2><ShieldCheck size={18}/> درخواست‌های ناظر شدن</h2><p>نظارت عادی کشاورزی و باغداری نیاز به مجوز تخصصی ندارد؛ ثبت‌نام رایگان است.</p></div></div>
        {!data?.applications.length?<div className="table-state">درخواست ناظر جدیدی در انتظار بررسی نیست.</div>:
          <div className="inspection-admin-list">{data.applications.map(item=><article className="table-card" key={item.memberId}>
            <header><div><h3>{item.member?.fullName||'کاربر ساری‌چین'}</h3><p>{item.member?.phone||'—'} · {[item.member?.city,item.member?.province].filter(Boolean).join('، ')}</p></div><span className="status">در انتظار بررسی</span></header>
            <div className="inspection-admin-facts">
              <span>تخصص‌ها: <b>{item.specialties.map(value=>specialtyLabels[value]||value).join('، ')}</b></span>
              <span>شعاع فعالیت: <b>{number.format(item.serviceRadiusKm)} کیلومتر</b></span>
              <span>مختصات: <bdi dir="ltr">{item.baseLocation.latitude.toFixed(5)}, {item.baseLocation.longitude.toFixed(5)}</bdi></span>
            </div>
            {item.biography&&<p>{item.biography}</p>}
            <label className="inspection-admin-note">یادداشت بررسی<textarea rows={2} maxLength={500} value={notes[item.memberId]||''} onChange={e=>setNotes({...notes,[item.memberId]:e.target.value})}/></label>
            <footer><button className="add-record" disabled={busy===item.memberId} onClick={()=>decideApplication(item.memberId,'approved')}><BadgeCheck size={16}/> تأیید ناظر</button>
              <button className="icon-button" disabled={busy===item.memberId} onClick={()=>decideApplication(item.memberId,'rejected')}>رد درخواست</button></footer>
          </article>)}</div>}
      </section>
      <section className="tariff-card">
        <div className="transport-admin-section-heading"><div><h2><ClipboardCheck size={18}/> گزارش‌های نیازمند بررسی</h2><p>پس از تأیید گزارش، پاداش در دفتر کل کارسای ناظر ثبت می‌شود.</p></div></div>
        {!data?.reports.length?<div className="table-state">گزارشی برای بررسی وجود ندارد.</div>:
          <div className="inspection-admin-list">{data.reports.map(report=><article className="table-card" key={report.id}>
            <header><div><h3>{report.request?.locationTitle||'گزارش نظارت'} · {report.inspector?.fullName||'ناظر'}</h3><p>{report.request?.cropType||'محصول کشاورزی'} · {report.request?.acreage ? number.format(report.request.acreage)+' هکتار · ' : ''}امتیاز کیفیت: {number.format(report.qualityScore)} از ۵ · درجه {report.qualityGrade}</p></div><span className="status">در انتظار بررسی</span></header>
            <div className="inspection-report-copy"><p><b>مشاهدات:</b> {report.observations||'—'}</p><p><b>ارزیابی سم:</b> {report.pesticideAssessment||'—'}</p><p><b>ارزیابی کود:</b> {report.fertilizerAssessment||'—'}</p><p><b>پیشنهادها:</b> {report.recommendations||'—'}</p></div>
            {report.photos?.length>0&&<div className="inspection-admin-photos">{report.photos.map(photo=><a key={photo.id} href={photo.dataUrl} target="_blank" rel="noreferrer"><img src={photo.dataUrl} alt="تصویر مستند بازدید"/></a>)}</div>}
            <label className="inspection-admin-note">یادداشت بررسی / دلیل اصلاح<textarea rows={2} maxLength={500} value={notes[report.requestId]||''} onChange={e=>setNotes({...notes,[report.requestId]:e.target.value})}/></label>
            <footer><button className="add-record" disabled={busy===report.requestId} onClick={()=>decideReport(report.requestId,'approved')}><BadgeCheck size={16}/> تأیید گزارش و پرداخت پاداش</button>
              <button className="icon-button" disabled={busy===report.requestId} onClick={()=>decideReport(report.requestId,'rejected')}>بازگشت برای اصلاح</button></footer>
          </article>)}</div>}
      </section>
      <section className="tariff-card">
        <div className="transport-admin-section-heading"><div><h2><MapPinned size={18}/> درخواست‌های ثبت‌شده</h2><p>آخرین وضعیت مأموریت‌های نظارتی تولیدکنندگان</p></div></div>
        {!data?.requests.length?<div className="table-state">درخواستی ثبت نشده است.</div>:
          <div className="table-scroll"><table className="data-table"><thead><tr><th>محل تولید</th><th>تولیدکننده</th><th>مساحت</th><th>پاداش</th><th>وضعیت</th><th>تاریخ ثبت</th></tr></thead><tbody>
            {data.requests.map(item=><tr key={item.id}><td>{item.locationTitle}<small>{item.cropType||item.inspectionType} · {[item.location?.city,item.location?.province].filter(Boolean).join('، ')}</small>
              {item.location?.latitude!=null&&item.location?.longitude!=null&&<a href={'https://www.openstreetmap.org/?mlat='+item.location.latitude+'&mlon='+item.location.longitude+'#map=15/'+item.location.latitude+'/'+item.location.longitude} target="_blank" rel="noreferrer">نمایش روی نقشه</a>}</td><td>{item.producer?.fullName||'—'}<small>{item.producer?.phone||''}</small></td><td>{number.format(item.acreage)} هکتار</td><td>{number.format(item.rewardKarsha)} کارسا</td><td>{statusLabels[item.status]||item.status}</td><td>{dates.format(new Date(item.createdAt))}</td></tr>)}
          </tbody></table></div>}
      </section>
    </>}
  </main>;
}
