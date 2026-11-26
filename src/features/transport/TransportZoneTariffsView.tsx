import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Calculator, RefreshCw, Save, Truck } from 'lucide-react';
import { ApiError, readTransportZoneTariffs, saveTransportZoneTariffs, type TransportZoneTariffs } from '../../api';
import { number } from '../catalog/catalog';

const zoneLabels = [
  {id:'zone-0',label:'زون ۰',range:'کمتر از ۱۰ کیلومتر'},
  {id:'zone-1',label:'زون ۱',range:'۱۰ تا کمتر از ۲۰ کیلومتر'},
  {id:'zone-2',label:'زون ۲',range:'۲۰ تا کمتر از ۵۰ کیلومتر'},
  {id:'zone-3',label:'زون ۳',range:'۵۰ تا کمتر از ۲۰۰ کیلومتر'},
  {id:'zone-4',label:'زون ۴',range:'۲۰۰ تا ۵۰۰ کیلومتر'},
  {id:'zone-5',label:'زون ۵',range:'بیشتر از ۵۰۰ کیلومتر'},
];
const speeds = [
  {id:'normal',label:'عادی',target:'زیر ۵ روز'},
  {id:'special',label:'ویژه',target:'زیر ۲ روز'},
  {id:'express',label:'اکسپرس',target:'همان روز'},
  {id:'urgent',label:'فوری',target:'زیر ۳ ساعت'},
] as const;

export default function TransportZoneTariffsView({token,onExpired}:{token:string;onExpired:()=>void}) {
  const [data,setData]=useState<TransportZoneTariffs>();
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [busy,setBusy]=useState(false);
  const [revision,setRevision]=useState(0);
  const refresh=useCallback(()=>setRevision(v=>v+1),[]);
  useEffect(()=>{
    const controller=new AbortController();
    readTransportZoneTariffs(token,controller.signal).then(setData).catch(e=>{
      if(controller.signal.aborted)return;
      if(e instanceof ApiError&&e.status===401)onExpired();
      else setError(e instanceof Error?e.message:'دریافت تعرفه‌ها ناموفق بود.');
    });
    return ()=>controller.abort();
  },[token,revision,onExpired]);
  function changeRate(index:number,key:string,value:string){
    setData(current=>current?({...current,rates:current.rates.map((rate,i)=>i===index?{...rate,[key]:value===''?0:Number(value)}:rate)}):current);
  }
  async function save(event:FormEvent){
    event.preventDefault();if(!data)return;
    setBusy(true);setError('');setNotice('');
    try{const saved=await saveTransportZoneTariffs(token,{rates:data.rates,densityKgPerM3:data.densityKgPerM3,minimumKar:data.minimumKar});setData(saved);setNotice('تعرفه‌های زون‌بندی با موفقیت ذخیره شد.');}
    catch(e){if(e instanceof ApiError&&e.status===401)onExpired();else setError(e instanceof Error?e.message:'ذخیره تعرفه‌ها ناموفق بود.');}
    finally{setBusy(false);}
  }
  return <main className="workspace transport-zone-workspace">
    <div className="page-heading"><div className="page-icon"><Calculator size={23}/></div><div><h1>زون‌بندی و تعرفه حمل</h1><p>مدیریت تعرفه بر اساس مسافت جاده‌ای، وزن حجمی و سرعت تحویل</p></div><button className="icon-button" type="button" title="بازخوانی" onClick={refresh}><RefreshCw size={17}/></button></div>
    {error&&<p className="catalog-notice error-message" role="alert">{error}</p>}
    {notice&&<p className="catalog-notice" role="status">{notice}</p>}
    {!data?<div className="table-state">در حال دریافت تنظیمات…</div>:<form onSubmit={save}>
      <section className="tariff-card">
        <div className="transport-admin-section-heading"><div><h2>تعریف زون‌های مسافتی</h2><p>زون بر اساس مجموع فاصله مسیر جاده‌ای بین نقاط متوالی تعیین می‌شود.</p></div></div>
        <div className="transport-zone-grid">{zoneLabels.map(zone=><article key={zone.id}><b>{zone.label}</b><span>{zone.range}</span></article>)}</div>
      </section>
      <section className="tariff-card">
        <div className="transport-admin-section-heading"><div><h2>پارامترهای محاسبه</h2><p>وزن قابل محاسبه برابر بیشترین مقدار وزن واقعی و وزن حجمی است.</p></div></div>
        <div className="tariff-grid">
          <label>ضریب چگالی (کیلوگرم بر مترمکعب)<input type="number" min="1" max="10000" step="1" value={data.densityKgPerM3} onChange={e=>setData({...data,densityKgPerM3:Number(e.target.value)})}/></label>
          <label>حداقل هزینه حمل (کارسا)<input type="number" min="0" step="0.01" value={data.minimumKar} onChange={e=>setData({...data,minimumKar:Number(e.target.value)})}/></label>
        </div>
      </section>
      <section className="tariff-card">
        <div className="transport-admin-section-heading"><div><h2>جدول تعرفه زون و سرعت</h2><p>برای هر ترکیب زون و سرعت، هزینه پایه و ضرایب جداگانه تنظیم می‌شود.</p></div></div>
        {zoneLabels.map(zone=><div className="transport-zone-rate-group" key={zone.id}>
          <header><b>{zone.label}</b><span>{zone.range}</span></header>
          <div className="transport-zone-rate-table-wrap"><table className="transport-zone-rate-table"><thead><tr><th>سرعت تحویل</th><th>هزینه پایه</th><th>هر کیلومتر</th><th>هر کیلوگرم قابل محاسبه</th><th>هر توقف اضافه</th><th>ضریب سرعت</th></tr></thead><tbody>
          {speeds.map(speed=>{const index=data.rates.findIndex(rate=>rate.zoneId===zone.id&&rate.speed===speed.id);const rate=data.rates[index];return <tr key={speed.id}><th>{speed.label}<small>{speed.target}</small></th>{(['baseKar','perKmKar','perBillableKgKar','stopKar','multiplier'] as const).map(key=><td key={key}><input aria-label={zone.label+' '+speed.label+' '+key} type="number" min="0" step="0.0001" value={rate?.[key]??0} onChange={e=>changeRate(index,key,e.target.value)}/></td>)}</tr>})}
          </tbody></table></div>
        </div>)}
        <div className="tariff-actions"><small>واحد تمام نرخ‌ها کارسا است. تغییر تعرفه فقط روی سفارش‌های جدید اثر می‌گذارد.</small><button className="primary-button" type="submit" disabled={busy}><Save size={16}/>{busy?'در حال ذخیره…':'ذخیره همه تعرفه‌ها'}</button></div>
      </section>
    </form>}
  </main>;
}
