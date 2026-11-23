import { readAccess, ApiError } from './api';
import OrdersView from './features/organization/OrdersView';
import SettingsDrawer from './features/organization/SettingsDrawer';
import { roleLabels, type Access } from './features/organization/organization';
import { useCallback, useEffect, useRef, useState } from 'react';
import { BookUser, ClipboardList, LogOut, Menu, Moon, Settings, Sun, Users, X } from 'lucide-react';
import Login from './features/auth/Login';
import CatalogView from './features/catalog/CatalogView';
import SuppliersView from './features/directory/SuppliersView';
import MembersView from './features/members/MembersView';
import { type MemberGroup, memberSections } from './features/members/members';
import { type Section, sections } from './features/catalog/catalog';

const tokenKey = 'sarichain-panel-token';
const demoKey = 'sarichain-panel-demo';

function getSection(): Section | MemberGroup | 'directory' | 'orders' {
  const section = location.hash.slice(1);
  if (section === 'directory' || section === 'orders') return section;
  if (Object.hasOwn(memberSections, section)) return section as MemberGroup;
  return Object.hasOwn(sections, section) ? section as Section : 'products';
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
  const isMembers = Object.hasOwn(memberSections, visibleSection);
  const isDirectory = visibleSection === 'directory';
  const current = isOrders ? { label: 'سفارش‌ها' } : isDirectory ? { label: 'مواد اولیه' } : isMembers ? (section === 'users' ? memberSections.users : { label: 'همکاران' }) : sections[section as Section];
  const hasNavigation = signedIn && Boolean(demo || access);
  const identity = (
    <a href={clientOnly ? '#orders' : '#products'} className="identity"><img src="/img/logo.png" alt="" /><span>پنل ساری چین</span></a>
  );
  const navigation = (
    <>
      {token && <nav className="sidebar-menu" aria-label="سفارش‌ها">
        <a href="#orders" aria-current={isOrders ? 'page' : undefined}><ClipboardList size={18} /> سفارش‌ها</a>
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
        <a href="#customers" aria-current={isMembers && visibleSection !== 'users' ? 'page' : undefined}><Users size={18} /> همکاران</a>
      </nav>
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
            {!signedIn ? <a href="./" className="identity"><img src="/img/logo.png" alt="" /><span>پنل ساری چین</span></a>
            : <span className="header-context">{!isOrders && <>{isDirectory ? 'معرفی' : isMembers ? 'اعضا' : 'کاتالوگ'} <span aria-hidden="true">/</span></>}{current.label}</span>}
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
            : isOrders && token
              ? <OrdersView token={token} onExpired={expire} />
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
