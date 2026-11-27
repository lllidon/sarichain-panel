import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Activity, Calculator, Clock3, Gauge, MapPin, Package, RefreshCw, RotateCcw, Save, Scale, Truck, Weight } from 'lucide-react';
import { ApiError, readTransportZoneTariffs, saveTransportZoneTariffs, type TransportZoneTariffs, type TransportSpeed } from '../../api';
import { number } from '../catalog/catalog';

const speedFields: Array<{id:TransportSpeed;label:string;target:string;field:'normalMultiplier'|'specialMultiplier'|'expressMultiplier'|'urgentMultiplier'}> = [
  {id:'normal',label:'عادی',target:'زیر ۵ روز',field:'normalMultiplier'},
  {id:'special',label:'ویژه',target:'زیر ۲ روز',field:'specialMultiplier'},
  {id:'express',label:'اکسپرس',target:'همان روز',field:'expressMultiplier'},
  {id:'urgent',label:'فوری',target:'زیر ۳ ساعت',field:'urgentMultiplier'},
];
const standardDefaults: Omit<TransportZoneTariffs,'zones'|'speeds'> = {
  baseKar:2,distanceWeight:0.02,billableWeightWeight:0.001,stopWeight:0.1,
  densityKgPerM3:250,minimumKar:2,normalMultiplier:1,specialMultiplier:1.35,expressMultiplier:1.8,urgentMultiplier:2.5,
};
const calculatorDefaults = {distance:35,weight:80,volume:0.8,stops:2,speed:'normal' as TransportSpeed};
export default function TransportZoneTariffsView({token,onExpired}:{token:string;onExpired:()=>void}) {
  const [data,setData]=useState<TransportZoneTariffs>();
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [busy,setBusy]=useState(false);
  const [revision,setRevision]=useState(0);
  const [distance,setDistance]=useState(calculatorDefaults.distance);
  const [weight,setWeight]=useState(calculatorDefaults.weight);
  const [volume,setVolume]=useState(calculatorDefaults.volume);
  const [stops,setStops]=useState(calculatorDefaults.stops);
  const [speed,setSpeed]=useState<TransportSpeed>(calculatorDefaults.speed);
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
  function restoreStandard(){
    setData(current=>current?({...current,...standardDefaults}):current);
    setNotice('مقادیر استاندارد در فرم قرار گرفتند؛ برای اعمال نهایی، ذخیره فرمول را بزنید.');
    setError('');
  }
  function resetCalculator(){
    setDistance(calculatorDefaults.distance);setWeight(calculatorDefaults.weight);
    setVolume(calculatorDefaults.volume);setStops(calculatorDefaults.stops);setSpeed(calculatorDefaults.speed);
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
    <div className="page-heading"><div className="page-icon"><Calculator size={23}/></div><div><h1>فرمول هوشمند هزینه حمل</h1><p>محاسبه‌گر سریع با مقادیر استاندارد، سپس تنظیم ضرایب فرمول مرکزی</p></div><button className="icon-button" type="button" title="بازخوانی" onClick={refresh}><RefreshCw size={17}/></button></div>
    {error&&<p className="catalog-notice error-message" role="alert">{error}</p>}
    {notice&&<p className="catalog-notice" role="status">{notice}</p>}
    {!data?<div className="table-state">در حال دریافت تنظیمات…</div>:<>
      <section className="tariff-card transport-calculator-card">
        <div className="transport-admin-section-heading"><div><h2><Calculator size={18}/> محاسبه‌گر سریع حمل</h2><p>مقادیر نمونه استاندارد از قبل وارد شده‌اند؛ برای دیدن هزینه فقط در صورت نیاز آن‌ها را تغییر دهید.</p></div><button className="transport-reset-button" type="button" onClick={resetCalculator}><RotateCcw size={15}/> بازنشانی نمونه</button></div>
        <div className="transport-calculator-fields">
          <label><span><MapPin size={15}/> مسافت (km)</span><input type="number" min="0" step="0.1" value={distance} onChange={e=>setDistance(Math.max(0,Number(e.target.value)))}/></label>
          <label><span><Weight size={15}/> وزن (kg)</span><input type="number" min="0" step="0.1" value={weight} onChange={e=>setWeight(Math.max(0,Number(e.target.value)))}/></label>
          <label><span><Package size={15}/> حجم (m³)</span><input type="number" min="0" step="0.01" value={volume} onChange={e=>setVolume(Math.max(0,Number(e.target.value)))}/></label>
          <label><span><Truck size={15}/> تعداد توقف</span><input type="number" min="2" max="20" step="1" value={stops} onChange={e=>setStops(Math.min(20,Math.max(2,Number(e.target.value))))}/></label>
          <label><span><Clock3 size={15}/> سرعت تحویل</span><select value={speed} onChange={e=>setSpeed(e.target.value as TransportSpeed)}>{speedFields.map(x=><option key={x.id} value={x.id}>{x.label}</option>)}</select></label>
        </div>
        {preview&&<div className="transport-calculator-result">
          <div><small><Scale size={13}/> وزن قابل محاسبه</small><b>{number.format(preview.billable)} kg</b></div>
          <div><small><Gauge size={13}/> ضریب سرعت</small><b>× {number.format(preview.multiplier)}</b></div>
          <div className="transport-calculator-total"><small><Activity size={13}/> هزینه نهایی تخمینی</small><strong>{number.format(preview.total)} <em>کارسا</em></strong></div>
        </div>}
      </section>
      <form onSubmit={save}>
        <section className="tariff-card">
          <div className="transport-admin-section-heading"><div><h2><Gauge size={18}/> تنظیم ضرایب فرمول</h2><p>مقادیر استاندارد نقطه شروع هستند؛ متناسب با سیاست حمل‌ونقل قابل تغییرند.</p></div><button className="transport-reset-button" type="button" onClick={restoreStandard}><RotateCcw size={15}/> بازگردانی استاندارد</button></div>
          <div className="tariff-grid">
            <label><span><Calculator size={14}/> هزینه پایه (کارسا)</span><input type="number" min="0" step="0.0001" value={data.baseKar} onChange={e=>update('baseKar',Number(e.target.value))}/></label>
            <label><span><MapPin size={14}/> وزن ضریب مسافت</span><input type="number" min="0" step="0.0001" value={data.distanceWeight} onChange={e=>update('distanceWeight',Number(e.target.value))}/></label>
            <label><span><Weight size={14}/> وزن ضریب بار</span><input type="number" min="0" step="0.000001" value={data.billableWeightWeight} onChange={e=>update('billableWeightWeight',Number(e.target.value))}/></label>
            <label><span><Truck size={14}/> وزن ضریب توقف</span><input type="number" min="0" step="0.0001" value={data.stopWeight} onChange={e=>update('stopWeight',Number(e.target.value))}/></label>
            <label><span><Package size={14}/> ضریب چگالی (kg/m³)</span><input type="number" min="1" step="1" value={data.densityKgPerM3} onChange={e=>update('densityKgPerM3',Number(e.target.value))}/></label>
            <label><span><Calculator size={14}/> حداقل هزینه (کارسا)</span><input type="number" min="0" step="0.0001" value={data.minimumKar} onChange={e=>update('minimumKar',Number(e.target.value))}/></label>
          </div>
          <div className="transport-zone-rate-group"><header><b>ضرایب سرعت تحویل</b><span>روی مبلغ پایه محاسبه‌شده اعمال می‌شوند</span></header>
            <div className="tariff-grid">{speedFields.map(item=><label key={item.id}><span><Clock3 size={14}/> {item.label} · {item.target}</span><input type="number" min="0.1" max="10" step="0.01" value={data[item.field]} onChange={e=>update(item.field,Number(e.target.value))}/></label>)}</div>
          </div>
          <div className="tariff-actions"><small>زون مسافتی از مجموع مسیر جاده‌ای تشخیص داده می‌شود. واحد تمام مبالغ کارسا است.</small><button className="primary-button" type="submit" disabled={busy}><Save size={16}/>{busy?'در حال ذخیره…':'ذخیره فرمول'}</button></div>
        </section>
      </form>
    </>}
  </main>;
}
