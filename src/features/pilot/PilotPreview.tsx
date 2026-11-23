import { useState } from 'react';
import { ArrowLeft, Boxes, CalendarDays, ChartNoAxesCombined, ClipboardCheck, FlaskConical, Layers, MapPin, PackageCheck, ShieldCheck, Truck, Users, Wallet } from 'lucide-react';
import { steps, views, zones, type PilotRow } from './pilotData';
import './pilot.css';

const icons = [MapPin, CalendarDays, PackageCheck, Boxes, ShieldCheck, Truck, Users, Wallet, ClipboardCheck, ChartNoAxesCombined];

function FinanceScenario() {
  const [scenario, setScenario] = useState('base');
  const cost = scenario === 'base' ? 0.10 : 0.18;
  const margin = Math.round((0.15 - cost) * 1000);
  const format = new Intl.NumberFormat('fa-IR');
  return <section className="pilot-finance" aria-label="سناریوی نمونه اقتصاد زون">
    <label>هزینه متغیر هر سبد
      <select value={scenario} onChange={event => setScenario(event.target.value)}>
        <option value="base">۰٫۱۰ کارسا</option>
        <option value="higher">۰٫۱۸ کارسا</option>
      </select>
    </label>
    <dl>
      <div><dt>تعداد سبد نمونه</dt><dd>۱٬۰۰۰</dd></div>
      <div><dt>درآمد خدماتی</dt><dd>۱۵۰ کارسا</dd></div>
      <div><dt>هزینه متغیر</dt><dd>{format.format(cost * 1000)} کارسا</dd></div>
      <div><dt>مازاد مشارکت پیش از هزینه ثابت و مالیات</dt><dd className={margin < 0 ? 'pilot-negative' : undefined}>{format.format(margin)} کارسا</dd></div>
    </dl>
  </section>;
}

export default function PilotPreview() {
  const [tab, selectTab] = useState(0);
  const [zone, selectZone] = useState('');
  const [selected, inspect] = useState<PilotRow>();
  const view = views[tab];
  const rows = view.rows.filter(row => !zone || row.zone === zone);
  const Icon = icons[tab];

  return <div className="pilot-shell" dir="rtl">
    <aside className="pilot-sidebar">
      <a className="identity" href="/"><img src="/img/sarichain-logo.svg" alt="پنل ساری‌چین" width="116" height="39" /></a>
      <nav aria-label="بخش‌های پیش‌نمایش">{views.map((item, index) => {
        const ItemIcon = icons[index];
        return <button type="button" key={item.id} aria-current={index === tab ? 'page' : undefined}
          onClick={() => { selectTab(index); inspect(undefined); }}><ItemIcon size={17} />{item.name}</button>;
      })}</nav>
      <a className="pilot-back" href="/">بازگشت به پنل <ArrowLeft size={16} /></a>
    </aside>

    <main className="pilot-main">
      <header className="pilot-header">
        <div>
          <span className="pilot-badge"><FlaskConical size={15} /> پیش‌نمایش با دادهٔ نمونه</span>
          <h1>عملیات زون پایلوت</h1>
        </div>
        <label>فیلتر زون<select value={zone} onChange={event => { selectZone(event.target.value); inspect(undefined); }}>
          <option value="">همه زون‌ها</option>{zones.map(item => <option key={item}>{item}</option>)}
        </select></label>
      </header>
      <div className="pilot-metrics">
        {[['۲', 'زون نمونه'], ['۱۲۸', 'سبد چرخه ساری'], ['۹۲٪', 'تکمیل سفارش نمونه'], ['۰٫۰۵ کارسا', 'حاشیه سناریویی هر سبد']].map(([value, label]) =>
          <div key={label}><strong>{value}</strong><span>{label}</span></div>)}
      </div>
      <section className="pilot-cycle" aria-label="چرخه هفتگی نمونهٔ ساری">
        <h2><Layers size={17} /> چرخه هفتگی نمونهٔ ساری</h2>
        <ol>{steps.map((step, index) => <li key={step} aria-current={index === 1 ? 'step' : undefined}>{step}</li>)}</ol>
      </section>

      {view.id === 'finance' && <FinanceScenario />}
      <section className="pilot-records">
        <h2><Icon size={20} />{view.name}</h2>
        <div className="pilot-table-scroll">
          <table><thead><tr>{['موضوع', 'زون', 'مسئول', 'شاخص نمونه', 'وضعیت', 'جزئیات'].map(label => <th key={label} scope="col">{label}</th>)}</tr></thead>
            <tbody>{rows.map(row => <tr key={row.title}>
              <th scope="row">{row.title}</th><td>{row.zone}</td><td>{row.owner}</td><td>{row.metric}</td>
              <td><span className={row.status === 'آماده' ? 'pilot-status' : 'pilot-status pilot-pending'}>{row.status}</span></td>
              <td><button type="button" aria-expanded={selected?.title === row.title} onClick={() => inspect(selected?.title === row.title ? undefined : row)}>مشاهده</button></td>
            </tr>)}</tbody>
          </table>
        </div>
        {!rows.length && <p className="pilot-detail">در این زون رکورد نمونه‌ای برای بخش انتخاب‌شده وجود ندارد.</p>}
        {selected && <div className="pilot-detail" aria-live="polite">
          <strong>{selected.title}</strong><p>{selected.next}</p>
        </div>}
      </section>
    </main>
  </div>;
}
