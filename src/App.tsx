import { readAccess, ApiError } from './api';
import OrdersView from './features/organization/OrdersView';
import StoreOrdersView from './features/organization/StoreOrdersView';
import KarshaManagementView from './features/organization/KarshaManagementView';
import TransportVehiclesView from './features/transport/TransportVehiclesView';
import TransportOrdersView from './features/transport/TransportOrdersView';
import TransportZoneTariffsView from './features/transport/TransportZoneTariffsView';
import AccountUpgradeRequestsView from './features/members/AccountUpgradeRequestsView';
import InspectionManagementView from './features/inspections/InspectionManagementView';
import SettingsDrawer from './features/organization/SettingsDrawer';
import { roleLabels, type Access } from './features/organization/organization';
import { useCallback, useEffect, useRef, useState } from 'react';
import { BookUser, Calculator, ClipboardList, FileCheck2, LogOut, Menu, Moon, PackageSearch, Settings, Sun, Truck, Users, X, Coins, ImagePlus, ClipboardCheck } from 'lucide-react';
import Login from './features/auth/Login';
import CatalogView from './features/catalog/CatalogView';
import InventoryView from './features/inventory/InventoryView';
import SuppliersView from './features/directory/SuppliersView';
import HomeSlidesView from './features/home-slides/HomeSlidesView';
import MembersView from './features/members/MembersView';
import { type MemberGroup, memberSections } from './features/members/members';
import { type Section, sections } from './features/catalog/catalog';

const tokenKey = 'sarichain-panel-token';
const demoKey = 'sarichain-panel-demo';

function getSection(): Section | MemberGroup | 'directory' | 'orders' | 'transport' | 'transport-orders' | 'transport-tariffs' | 'account-upgrades' | 'inventory' | 'store-kanban' | 'karsha' | 'home-slides' | 'inspections' {
  const section = location.hash.slice(1);
  if (section === 'directory' || section === 'orders' || section === 'transport' || section === 'transport-orders' || section === 'transport-tariffs' || section === 'account-upgrades' || section === 'inventory' || section === 'store-kanban' || section === 'karsha' || section === 'home-slides' || section === 'inspections') return section;
  if (Object.hasOwn(memberSections, section)) return section as MemberGroup;
  return Object.hasOwn(sections, section) ? section as Section : 'orders';
}

export default function App() {
  const [token, setToken] = useState(() => sessionStorage.getItem(tokenKey));
  const [demo, setDemo] = useState(() => sessionStorage.getItem(demoKey) === '1');
  const [section, setSection] = useState(getSection);
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem('sarichain-panel-theme');
    return saved ? saved === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  });
  const [expired, setExpired] = useState(false);
  const [access, setAccess] = useState<Access>();
  const [accessError, setAccessError] = useState(false);
  const [settings, setSettings] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menu = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const mobile = matchMedia('(max-width: 860px)');
    const closeOnDesktop = () => { if (!mobile.matches) menu.current?.close(); };
    mobile.addEventListener('change', closeOnDesktop);
    return () => mobile.removeEventListener('change', closeOnDesktop);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    localStorage.setItem('sarichain-panel-theme', dark ? 'dark' : 'light');
  }, [dark]);

  useEffect(() => {
    const synchronize = () => setSection(getSection());
    window.addEventListener('hashchange', synchronize);
    return () => window.removeEventListener('hashchange', synchronize);
  }, []);

  const logout = useCallback(() => {
    sessionStorage.removeItem(tokenKey);
    sessionStorage.removeItem(demoKey);
    setToken(null);
    setDemo(false);
    setAccess(undefined);
    setSettings(false);
    setMenuOpen(false);
  }, []);

  const expire = useCallback(() => {
    logout();
    setExpired(true);
  }, [logout]);

  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    setAccessError(false);
    readAccess(token, controller.signal).then(current => {
      if (!controller.signal.aborted) setAccess(current);
    }).catch(error => {
      if (controller.signal.aborted) return;
      if (error instanceof ApiError && error.status === 401) expire();
      else setAccessError(true);
    });
    return () => controller.abort();
  }, [token, expire]);

  function openLive(accessToken: string) {
    sessionStorage.setItem(tokenKey, accessToken);
    sessionStorage.removeItem(demoKey);
    setDemo(false);
    setToken(accessToken);
    setExpired(false);
  }

  function openDemo() {
    sessionStorage.setItem(demoKey, '1');
    setDemo(true);
    setExpired(false);
  }

  const signedIn = Boolean(token || demo);
  const clientOnly = access?.role === 'client';
  const visibleSection = clientOnly ? 'orders' : section;
  const isOrders = visibleSection === 'orders';
  const isStoreKanban = visibleSection === 'store-kanban';
  const isKarsha = visibleSection === 'karsha';
  const isTransport = visibleSection === 'transport';
  const isTransportOrders = visibleSection === 'transport-orders';
  const isTransportTariffs = visibleSection === 'transport-tariffs';
  const isAccountUpgrades = visibleSection === 'account-upgrades';
  const isInventory = visibleSection === 'inventory';
  const isMembers = Object.hasOwn(memberSections, visibleSection);
  const isDirectory = visibleSection === 'directory';
  const isHomeSlides = visibleSection === 'home-slides';
  const isInspections = visibleSection === 'inspections';
  const current = isInspections ? { label: 'مدیریت نظارت' } : isHomeSlides ? { label: 'مدیریت اسلایدر صفحه اصلی' } : isKarsha ? { label: 'مدیریت کارسا' } : isStoreKanban ? { label: 'مدیریت سفارشات' } : isOrders ? { label: 'سفارش‌ها' } : isInventory ? { label: 'مدیریت موجودی' } : isAccountUpgrades ? { label: 'درخواست ارتقای حساب' } : isTransportOrders ? { label: 'سفارش‌های حمل' } : isTransportTariffs ? { label: 'زون‌بندی و تعرفه حمل' } : isTransport ? { label: 'وسایل نقلیه' } : isDirectory ? { label: 'مواد اولیه' } : isMembers ? (section === 'users' ? memberSections.users : { label: 'همکاران' }) : sections[section as Section];
  const canReviewUpgrades = access?.role === 'management' || access?.role === 'admin';
  const hasNavigation = signedIn && Boolean(demo || access);
  const identity = (
    <a href={clientOnly ? '#orders' : '#products'} className="identity"><img src="/img/sarichain-logo.svg" alt="پنل ساری‌چین" width="116" height="39" /></a>
  );
  const navigation = (
    <>
      {token && <nav className="sidebar-menu" aria-label="سفارش‌ها">
        <a href="#orders" aria-current={isOrders ? 'page' : undefined}><ClipboardList size={18} /> سفارش‌ها</a>
        {token && access?.role === 'management' && <a className="sidebar-subitem" href="#store-kanban" aria-current={isStoreKanban ? 'page' : undefined}><ClipboardList size={16} /> مدیریت سفارشات (کانبان)</a>}
      </nav>}
      {!clientOnly && <>
      <nav className="sidebar-menu" aria-label="پیش‌نمایش">
        <a href="/pilot"><ClipboardList size={18} /> پیش‌نمایش پایلوت</a>
      </nav>
      <nav className="sidebar-menu members-menu" aria-label="کاتالوگ">
        <h2>کاتالوگ</h2>
        {(Object.keys(sections) as Section[]).map(key => {
          const { label, icon: Icon } = sections[key];
          return <a key={key} href={`#${key}`} aria-current={section === key ? 'page' : undefined}><Icon size={18} />{label}</a>;
        })}
      </nav>
      <nav className="sidebar-menu members-menu" aria-label="اعضا">
        <h2>اعضا</h2>
        <a href="#users" aria-current={visibleSection === 'users' ? 'page' : undefined}><Users size={18} /> کاربران پنل</a>
        <a href="#customers" aria-current={isMembers && visibleSection !== 'users' ? 'page' : undefined}><Users size={18} /> مشتریان و همکاران</a>
        {token && canReviewUpgrades && <a href="#account-upgrades" aria-current={isAccountUpgrades ? 'page' : undefined}><FileCheck2 size={18} /> درخواست ارتقای حساب</a>}
      </nav>
      {token && access?.role === 'management' && <nav className="sidebar-menu members-menu" aria-label="عملیات">
        <h2>عملیات</h2>
        <a href="#inventory" aria-current={isInventory ? 'page' : undefined}><PackageSearch size={18} /> مدیریت موجودی</a>
        <a href="#transport-orders" aria-current={isTransportOrders ? 'page' : undefined}><ClipboardList size={18} /> سفارش‌های حمل</a>
        <a href="#transport" aria-current={isTransport ? 'page' : undefined}><Truck size={18} /> وسایل نقلیه</a>
        <a href="#transport-tariffs" aria-current={isTransportTariffs ? 'page' : undefined}><Calculator size={18} /> زون‌بندی و تعرفه حمل</a>
        <a href="#karsha" aria-current={isKarsha ? 'page' : undefined}><Coins size={18} /> مدیریت کارسا</a>
        <a href="#home-slides" aria-current={isHomeSlides ? 'page' : undefined}><ImagePlus size={18} /> اسلایدر صفحه اصلی</a>
      </nav>}
      {token && canReviewUpgrades && <nav className="sidebar-menu members-menu" aria-label="نظارت">
        <h2>نظارت</h2>
        <a href="#inspections" aria-current={isInspections ? 'page' : undefined}><ClipboardCheck size={18} /> مدیریت نظارت</a>
      </nav>}
      <nav className="sidebar-menu members-menu" aria-label="معرفی">
        <h2>معرفی</h2>
        <a href="#directory" aria-current={isDirectory ? 'page' : undefined}><BookUser size={18} /> مواد اولیه</a>
      </nav>
      </>}
    </>
  );

  return (
    <div className={hasNavigation ? 'shell' : 'shell logged-out'}>
      {hasNavigation && <>
        <aside className="sidebar">{identity}{navigation}</aside>
        <dialog id="mobile-navigation" ref={menu} className="mobile-navigation" aria-label="منوی پنل"
          onClose={() => setMenuOpen(false)} onClick={event => {
            const target = event.target;
            const boundary = event.currentTarget.getBoundingClientRect();
            if (target instanceof Element && (target.closest('a') ||
                (target === event.currentTarget && event.clientX < boundary.left))) menu.current?.close();
          }}>
          <div className="mobile-navigation-heading">{identity}
            <button type="button" className="icon-button" aria-label="بستن منو" onClick={() => menu.current?.close()}><X size={19} /></button>
          </div>
          {navigation}
        </dialog>
      </>}
      <div className="main-column">
        <header className="topbar">
          <div className="header-start">
            {hasNavigation && <button type="button" className="icon-button mobile-menu-trigger" aria-label="باز کردن منو"
              aria-controls="mobile-navigation" aria-expanded={menuOpen}
              onClick={() => { menu.current?.showModal(); setMenuOpen(true); }}><Menu size={21} /></button>}
            {!signedIn ? <a href="./" className="identity"><img src="/img/sarichain-logo.svg" alt="پنل ساری‌چین" width="116" height="39" /></a>
            : <span className="header-context">{!isOrders && <>{isStoreKanban || isKarsha || isInventory || isTransport || isTransportOrders || isTransportTariffs || isHomeSlides || isInspections ? 'عملیات' : isDirectory ? 'معرفی' : isMembers ? 'اعضا' : 'کاتالوگ'} <span aria-hidden="true">/</span></>}{current.label}</span>}
          </div>
          <div className="header-actions">
            {signedIn && <span className={demo ? 'mode demo' : 'mode'}>{demo ? 'داده آزمایشی' : access ? roleLabels[access.role] : 'داده بک‌اند'}</span>}
            <button className="icon-button" type="button" aria-label={dark ? 'تم روشن' : 'تم تیره'} title={dark ? 'تم روشن' : 'تم تیره'} onClick={() => setDark(value => !value)}>
              {dark ? <Sun size={19} /> : <Moon size={18} />}
            </button>
            {token && access?.role === 'management' && (
              <button className="icon-button" type="button" aria-label="تنظیمات" title="تنظیمات" onClick={() => setSettings(true)}><Settings size={18} /></button>
            )}
            {signedIn && <button className="icon-button" type="button" aria-label={demo ? 'خروج از نسخه آزمایشی' : 'خروج'} onClick={logout}><LogOut size={18} /></button>}
          </div>
        </header>
        {expired && <p className="session-alert" role="status">نشست شما پایان یافت. دوباره وارد شوید.</p>}
        {signedIn
          ? token && !access
            ? <main className="workspace"><p role="status">{accessError ? 'دسترسی حساب دریافت نشد. دوباره وارد شوید.' : 'در حال دریافت دسترسی حساب…'}</p></main>
             : isHomeSlides && token && access?.role === 'management'
              ? <HomeSlidesView token={token} onExpired={expire} />
              : isHomeSlides ? <main className="workspace"><p role="alert">این بخش فقط برای نقش مدیریت در دسترس است.</p></main>
              : isKarsha && token && access?.role === 'management'
              ? <KarshaManagementView token={token} onExpired={expire} />
              : isKarsha ? <main className="workspace"><p role="alert">این بخش فقط برای نقش مدیریت در دسترس است.</p></main>
              : isStoreKanban && token && access?.role === 'management'
              ? <StoreOrdersView token={token} onExpired={expire} />
              : isStoreKanban ? <main className="workspace"><p role="alert">این بخش فقط برای نقش مدیریت در دسترس است.</p></main>
              : isOrders && token
              ? <OrdersView token={token} onExpired={expire} management={access?.role === 'management'} />
              : isInventory && token && access?.role === 'management'
                ? <InventoryView token={token} onExpired={expire} />
              : isInventory ? <main className="workspace"><p role="alert">این بخش فقط برای نقش مدیریت در دسترس است.</p></main>
              : isInventory && token && access?.role === 'management'
                ? <InventoryView token={token} onExpired={expire} />
              : isInventory ? <main className="workspace"><p role="alert">این بخش فقط برای نقش مدیریت در دسترس است.</p></main>
              : isTransportOrders && token && access?.role === 'management'
                ? <TransportOrdersView token={token} onExpired={expire} />
              : isTransportTariffs && token && access?.role === 'management'
                ? <TransportZoneTariffsView token={token} onExpired={expire} />
              : isInspections && token && canReviewUpgrades
                ? <InspectionManagementView token={token} onExpired={expire} />
              : isInspections ? <main className="workspace"><p role="alert">این بخش فقط برای مدیریت در دسترس است.</p></main>
              : isAccountUpgrades && token && canReviewUpgrades
                ? <AccountUpgradeRequestsView token={token} onExpired={expire} />
              : isAccountUpgrades ? <main className="workspace"><p role="alert">این بخش فقط برای مدیریت در دسترس است.</p></main>
              : isTransport && token && access?.role === 'management'
                ? <TransportVehiclesView token={token} onExpired={expire} />
                : (isTransport || isTransportOrders || isTransportTariffs) ? <main className="workspace"><p role="alert">این بخش فقط برای نقش مدیریت در دسترس است.</p></main>
                : isDirectory
                ? <SuppliersView token={token} onExpired={expire} />
                : isMembers
                  ? <MembersView key={visibleSection} group={visibleSection as MemberGroup} token={token} access={access} onExpired={expire} />
                  : <CatalogView key={visibleSection} section={isOrders ? 'products' : visibleSection as Section} token={token}
                    canEdit={access?.role === 'management'} onExpired={expire} />
          : <Login onLogin={openLive} onDemo={openDemo} />}
        {settings && token && access?.role === 'management' && <SettingsDrawer token={token} onClose={() => setSettings(false)} onExpired={expire} />}

      </div>
    </div>
  );
}
