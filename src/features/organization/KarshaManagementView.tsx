import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Coins, RefreshCw, Save, ArrowDownCircle, ArrowUpCircle, History, Settings2 } from 'lucide-react';
import { ApiError, adjustKarsha, readKarshaLedger, readKarshaPolicy, saveKarshaPolicy, type KarshaLedgerPage, type KarshaPolicy } from '../../api';
import { number } from '../catalog/catalog';

const precise = new Intl.NumberFormat('fa-IR',{maximumFractionDigits:8});
const money = new Intl.NumberFormat('fa-IR',{maximumFractionDigits:0});
const dates = new Intl.DateTimeFormat('fa-IR',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Tehran'});
const labels:Record<string,string> = {credit:'افزایش',debit:'کاهش',onboarding:'هدیه تکمیل مدارک',purchase:'خرید',conversion:'تبدیل به تومان',decay:'کاهش ماهانه',admin_adjustment:'اصلاح مدیریتی',admin_debit:'کاهش مدیریتی'};
export default function KarshaManagementView({token,onExpired}:{token:string;onExpired:()=>void}) {
  const [policy,setPolicy]=useState<KarshaPolicy>();
  const [ledger,setLedger]=useState<KarshaLedgerPage>();
  const [rate,setRate]=useState('');
  const [memberId,setMemberId]=useState('');
  const [filterId,setFilterId]=useState('');
  const [direction,setDirection]=useState<'credit'|'debit'>('credit');
  const [amount,setAmount]=useState('');
  const [reason,setReason]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [revision,setRevision]=useState(0);
  const refresh=useCallback(()=>setRevision(x=>x+1),[]);
  useEffect(()=>{
    const controller=new AbortController();
    Promise.all([readKarshaPolicy(token,controller.signal),readKarshaLedger(token,filterId,1,controller.signal)]).then(([p,l])=>{
      setPolicy(p);setRate(p.rateTomanPerKarsha==null?'':String(p.rateTomanPerKarsha));setLedger(l);
    }).catch(e=>{if(controller.signal.aborted)return;if(e instanceof ApiError&&e.status===401)onExpired();else setError(e instanceof Error?e.message:'دریافت اطلاعات کارسا ناموفق بود.');});
    return ()=>controller.abort();
  },[token,onExpired,revision,filterId]);
  async function saveRate(event:FormEvent){
    event.preventDefault();setBusy(true);setError('');setNotice('');
    const value=rate.trim()===''?null:Number(rate);
    if(value!==null&&(!Number.isFinite(value)||value<=0)){setError('نرخ باید عددی مثبت بر حسب تومان باشد.');setBusy(false);return;}
    try{const saved=await saveKarshaPolicy(token,value);setPolicy(saved);setNotice('نرخ روز کارسا ذخیره شد.');}
    catch(e){if(e instanceof ApiError&&e.status===401)onExpired();else setError(e instanceof Error?e.message:'ذخیره نرخ ناموفق بود.');}
    finally{setBusy(false);}
  }
  async function submitAdjustment(event:FormEvent){
    event.preventDefault();setBusy(true);setError('');setNotice('');
    const value=Number(amount);
    if(!/^[a-f0-9]{24}$/i.test(memberId)||!Number.isFinite(value)||value<=0||!reason.trim()){
      setError('شناسه ۲۴ کاراکتری عضو، مقدار مثبت و علت تراکنش را کامل کنید.');setBusy(false);return;
    }
    try{
      await adjustKarsha(token,{memberId,direction,amount:value,reason:reason.trim(),idempotencyKey:crypto.randomUUID()});
      setNotice('تراکنش با موفقیت در دفتر کل ثبت شد.');setAmount('');setReason('');refresh();
    }catch(e){if(e instanceof ApiError&&e.status===401)onExpired();else setError(e instanceof Error?e.message:'ثبت تراکنش ناموفق بود.');}
    finally{setBusy(false);}
  }
  return <main className="workspace karsha-admin-workspace">
    <div className="page-heading"><div className="page-icon"><Coins size={23}/></div><div><h1>مدیریت کارسا</h1><p>نرخ روز، سیاست کاهش ماهانه، دفتر کل و اصلاح موجودی اعضا</p></div><button className="icon-button" type="button" onClick={refresh} aria-label="بازخوانی"><RefreshCw size={17}/></button></div>
    {error&&<p className="catalog-notice error-message" role="alert">{error}</p>}
    {notice&&<p className="catalog-notice" role="status">{notice}</p>}
    {!policy?<div className="table-state">در حال دریافت سیاست کارسا…</div>:<>
      <section className="tariff-card karsha-admin-policy">
        <div className="transport-admin-section-heading"><div><h2><Settings2 size={18}/> سیاست پولی</h2><p>کاهش ماهگرد هر واریز با مبنای نرخ مرکب سالانه محاسبه می‌شود.</p></div></div>
        <div className="karsha-policy-stats">
          <article><span>کاهش سالانه</span><strong>۰٫۲٪</strong></article>
          <article><span>کاهش ماهانه مرکب</span><strong>{precise.format(policy.monthlyDecayRate*100)}٪</strong></article>
          <article><span>مبنای اعمال</span><strong>ماهگرد هر واریز</strong></article>
          <article><span>مصرف سهمیه</span><strong>FIFO</strong></article>
        </div>
        <form className="karsha-rate-form" onSubmit={saveRate}>
          <label>نرخ هر کارسا به تومان<input type="number" min="0.0001" step="0.01" value={rate} onChange={e=>setRate(e.target.value)} placeholder="نرخ را وارد کنید؛ تا آن زمان نرخ تعیین نشده"/></label>
          <button className="primary-button" disabled={busy}><Save size={15}/> ذخیره نرخ روز</button>
        </form>
        <p className="karsha-admin-help">نرخ اولیه عمداً خالی است تا مبلغی بدون تأیید مدیریت به‌عنوان نرخ واقعی ثبت نشود. نرخ هر تراکنش در همان لحظه در دفتر کل ذخیره می‌شود.</p>
      </section>
      <section className="tariff-card">
        <div className="transport-admin-section-heading"><div><h2><ArrowUpCircle size={18}/> ثبت افزایش یا کاهش دستی</h2><p>هر اصلاح با شناسه مدیر، علت و کلید یکتا ثبت می‌شود.</p></div></div>
        <form className="karsha-adjust-form" onSubmit={submitAdjustment}>
          <label>شناسه عضو (ObjectId)<input dir="ltr" value={memberId} onChange={e=>setMemberId(e.target.value)} placeholder="شناسه ۲۴ کاراکتری عضو"/></label>
          <label>نوع عملیات<select value={direction} onChange={e=>setDirection(e.target.value as 'credit'|'debit')}><option value="credit">افزایش کارسا</option><option value="debit">کاهش کارسا</option></select></label>
          <label>مقدار کارسا<input type="number" min="0.00000001" step="0.00000001" value={amount} onChange={e=>setAmount(e.target.value)} /></label>
          <label>علت تراکنش<input value={reason} onChange={e=>setReason(e.target.value)} maxLength={300} placeholder="مثلاً اصلاح اعتبار بابت سفارش"/></label>
          <button className="primary-button" disabled={busy}>{direction==='credit'?<ArrowUpCircle size={15}/>:<ArrowDownCircle size={15}/>} ثبت در دفتر کل</button>
        </form>
      </section>
      <section className="tariff-card">
        <div className="transport-admin-section-heading"><div><h2><History size={18}/> دفتر کل کارسا</h2><p>افزایش‌ها، پرداخت‌ها، تبدیل‌ها، کاهش ماهانه و اصلاحات مدیریتی</p></div></div>
        <form className="karsha-ledger-filter" onSubmit={e=>{e.preventDefault();setFilterId(memberId);}}>
          <label>فیلتر شناسه عضو<input dir="ltr" value={filterId} onChange={e=>setFilterId(e.target.value)} placeholder="اختیاری؛ خالی برای همه اعضا"/></label>
          <button className="secondary-button" type="submit">اعمال فیلتر</button>
        </form>
        {!ledger?.items.length?<div className="table-state">تراکنشی برای نمایش وجود ندارد.</div>:
          <div className="table-scroll"><table className="data-table karsha-ledger-table"><thead><tr><th>تاریخ</th><th>عضو</th><th>نوع</th><th>مقدار</th><th>مانده بعد</th><th>علت</th><th>مدیر / سامانه</th></tr></thead>
            <tbody>{ledger.items.map(item=><tr key={item._id}>
              <td>{dates.format(new Date(item.createdAt))}</td>
              <td>{item.member?.fullName||'عضو'}<small dir="ltr">{item.member?.phone||item.memberId}</small></td>
              <td>{labels[item.type]||item.type}</td>
              <td className={item.amount>=0?'positive':'negative'} dir="ltr">{item.amount>=0?'+':''}{precise.format(item.amount)}</td>
              <td>{precise.format(item.balanceAfter)}</td>
              <td>{item.reason}</td><td dir="ltr">{item.actor||'system'}</td>
            </tr>)}</tbody></table></div>}
        <p className="karsha-admin-help">نمایش {number.format(ledger?.items.length||0)} از {number.format(ledger?.total||0)} تراکنش · برای جزئیات بیشتر از فیلتر عضو استفاده کنید.</p>
      </section>
    </>}
  </main>;
}
