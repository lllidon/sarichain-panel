import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Calculator, RefreshCw, Save } from 'lucide-react';
import { ApiError, readTransportZoneTariffs, saveTransportZoneTariffs, type TransportZoneTariffs, type TransportSpeed } from '../../api';
import { number } from '../catalog/catalog';

const speedFields: Array<{id:TransportSpeed;label:string;target:string;field:'normalMultiplier'|'specialMultiplier'|'expressMultiplier'|'urgentMultiplier'}> = [
  {id:'normal',label:'عادی',target:'زیر ۵ روز',field:'normalMultiplier'},
  {id:'special',label:'ویژه',target:'زیر ۲ روز',field:'specialMultiplier'},
  {id:'express',label:'اکسپرس',target:'همان روز',field:'expressMultiplier'},
  {id:'urgent',label:'فوری',target:'زیر ۳ ساعت',field:'urgentMultiplier'},
];
const defaults: Omit<TransportZoneTariffs,'zones'|'speeds'> = {
  baseKar:2,distanceWeight:0.02,billableWeightWeight:0.001,stopWeight:0.1,
  densityKgPerM3:250,minimumKar:2,normalMultiplier:1,specialMultiplier:1.35,expressMultiplier:1.8,urgentMultiplier:2.5,
};
export default function TransportZoneTariffsView({token,onExpired}:{token:string;onExpired:()=>void}) {
  const [data,setData]=useState<TransportZoneTariffs>();
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [busy,setBusy]=useState(false);
  const [revision,setRevision]=useState(0);
  const [distance,setDistance]=useState(35);
  const [weight,setWeight]=useState(80);
  const [volume,setVolume]=useState(0.8);
  const [stops,setStops]=useState(2);
  const [speed,setSpeed]=useState<TransportSpeed>('normal');
  const refresh=useCallback(()=>setRevision(v=>v+1),[]);
  useEffect(()=>{
    const controller=new AbortController();
    readTransportZoneTariffs(token,controller.signal).then(setData).catch(e=>{
      if(controller.signal.aborted)return;
      if(e instanceof ApiError&&e.status===401)onExpired();
      else setError(e instanceof Error?e.message:'دریافت تنظیمات ناموفق بود.');
    });
    return ()=>controller.abort();
  },[token,revision,onExpired]);
  const preview=useMemo(()=>{
    if(!data)return null;
    const billable=Math.max(weight,volume*data.densityKgPerM3);
    const field=speedFields.find(x=>x.id===speed)!.field;
    const multiplier=data[field];
    const raw=data.baseKar+distance*data.distanceWeight+billable*data.billableWeightWeight+Math.max(0,stops-2)*data.stopWeight;
    return {billable,raw,total:Math.max(data.minimumKar,raw*multiplier),multiplier};
  },[data,distance,weight,volume,stops,speed]);
  function update<K extends keyof Omit<TransportZoneTariffs,'zones'|'speeds'>>(key:K,value:number){
    setData(current=>current?({...current,[key]:value}):current);
  }
  async function save(event:FormEvent){
    event.preventDefault();if(!data)return;
    setBusy(true);setError('');setNotice('');
    const {zones,speeds:ignored,...fields}=data;
    try{const saved=await saveTransportZoneTariffs(token,fields);setData(saved);setNotice('فرمول و ضرایب با موفقیت ذخیره شدند.');}
    catch(e){if(e instanceof ApiError&&e.status===401)onExpired();else setError(e instanceof Error?e.message:'ذخیره فرمول ناموفق بود.');}
    finally{setBusy(false);}
  }
  return <main className="workspace transport-zone-workspace">
    <div className="page-heading"><div className="page-icon"><Calculator size={23}/></div><div><h1>فرمول هوشمند هزینه حمل</h1><p>یک فرمول مرکزی با وزن‌دهی ضرایب؛ هزینه نهایی به‌صورت خودکار محاسبه می‌شود.</p></div><button className="icon-button" type="button" title="بازخوانی" onClick={refresh}><RefreshCw size={17}/></button></div>
    {error&&<p className="catalog-notice error-message" role="alert">{error}</p>}
    {notice&&<p className="catalog-notice" role="status">{notice}</p>}
    {!data?<div className="table-state">در حال دریافت تنظیمات…</div>:<form onSubmit={save}>
      <section className="tariff-card">
        <div className="transport-admin-section-heading"><div><h2>ضرایب فرمول</h2><p>به هر عامل وزن بدهید؛ موتور حمل مبلغ نهایی را محاسبه می‌کند. تمام مبالغ با واحد کارسا هستند.</p></div></div>
        <div className="tariff-grid">
          <label>هزینه پایه (کارسا)<input type="number" min="0" step="0.0001" value={data.baseKar} onChange={e=>update('baseKar',Number(e.target.value))}/></label>
          <label>وزن فاصله؛ به ازای هر کیلومتر<input type="number" min="0" step="0.0001" value={data.distanceWeight} onChange={e=>update('distanceWeight',Number(e.target.value))}/></label>
          <label>وزن بار؛ به ازای هر کیلوگرم قابل محاسبه<input type="number" min="0" step="0.000001" value={data.billableWeightWeight} onChange={e=>update('billableWeightWeight',Number(e.target.value))}/></label>
          <label>وزن هر توقف اضافه (کارسا)<input type="number" min="0" step="0.0001" value={data.stopWeight} onChange={e=>update('stopWeight',Number(e.target.value))}/></label>
          <label>ضریب چگالی (کیلوگرم بر مترمکعب)<input type="number" min="1" step="1" value={data.densityKgPerM3} onChange={e=>update('densityKgPerM3',Number(e.target.value))}/></label>
          <label>حداقل هزینه نهایی (کارسا)<input type="number" min="0" step="0.0001" value={data.minimumKar} onChange={e=>update('minimumKar',Number(e.target.value))}/></label>
        </div>
        <div className="transport-zone-rate-group"><header><b>ضریب سرعت تحویل</b><span>ضریب روی مبلغ پایه محاسبه‌شده اعمال می‌شود</span></header>
          <div className="tariff-grid">{speedFields.map(item=><label key={item.id}>{item.label} · {item.target}<input type="number" min="0.1" max="10" step="0.01" value={data[item.field]} onChange={e=>update(item.field,Number(e.target.value))}/></label>)}</div>
        </div>
        <div className="tariff-actions"><small>زون‌ها همچنان از روی مجموع مسافت جاده‌ای تشخیص داده می‌شوند؛ اما تعرفه جداگانه برای هر زون نگهداری نمی‌شود.</small><button className="primary-button" type="submit" disabled={busy}><Save size={16}/>{busy?'در حال ذخیره…':'ذخیره فرمول'}</button></div>
      </section>
      <section className="tariff-card">
        <div className="transport-admin-section-heading"><div><h2>محاسبه‌گر آزمایشی</h2><p>مقادیر دلخواه وارد کنید و نتیجه فرمول را بدون ثبت سفارش ببینید.</p></div></div>
        <div className="tariff-grid">
          <label>مسافت جاده‌ای (کیلومتر)<input type="number" min="0" step="0.1" value={distance} onChange={e=>setDistance(Number(e.target.value))}/></label>
          <label>وزن واقعی بار (کیلوگرم)<input type="number" min="0" step="0.1" value={weight} onChange={e=>setWeight(Number(e.target.value))}/></label>
          <label>حجم بار (مترمکعب)<input type="number" min="0" step="0.01" value={volume} onChange={e=>setVolume(Number(e.target.value))}/></label>
          <label>تعداد توقف‌ها<input type="number" min="2" max="20" step="1" value={stops} onChange={e=>setStops(Math.max(2,Number(e.target.value)))}/></label>
          <label>سرعت تحویل<select value={speed} onChange={e=>setSpeed(e.target.value as TransportSpeed)}>{speedFields.map(x=><option key={x.id} value={x.id}>{x.label} · {x.target}</option>)}</select></label>
        </div>
        {preview&&<div className="transport-quote-preview">
          <div><small>وزن قابل محاسبه · بیشترین وزن واقعی و حجمی</small><strong>{number.format(preview.billable)} کیلوگرم</strong></div>
          <div><small>مبلغ پیش از ضریب سرعت</small><strong>{number.format(preview.raw)} کارسا</strong></div>
          <div><small>ضریب سرعت</small><strong>× {number.format(preview.multiplier)}</strong></div>
          <div className="transport-quote-total"><small>هزینه نهایی آزمایشی</small><strong>{number.format(preview.total)} کارسا</strong></div>
        </div>}
        <p className="tariff-hint">فرمول: (هزینه پایه + مسافت × وزن فاصله + وزن قابل محاسبه × وزن بار + توقف اضافه × وزن توقف) × ضریب سرعت؛ با رعایت حداقل هزینه.</p>
      </section>
    </form>}
  </main>;
}
