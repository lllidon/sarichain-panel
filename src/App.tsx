import { useCallback, useEffect, useState } from 'react';
import { LogOut, Moon, Sun } from 'lucide-react';
import Login from './features/auth/Login';
import CatalogView from './features/catalog/CatalogView';
import MembersView from './features/members/MembersView';
import { type MemberGroup, memberSections } from './features/members/members';
import { type Section, sections } from './features/catalog/catalog';

const tokenKey = 'sarichain-panel-token';
const demoKey = 'sarichain-panel-demo';

function getSection(): Section | MemberGroup {
  const section = location.hash.slice(1);
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
  }, []);

  const expire = useCallback(() => {
    logout();
    setExpired(true);
  }, [logout]);

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
  const isMembers = Object.hasOwn(memberSections, section);
  const current = isMembers ? memberSections[section as MemberGroup] : sections[section as Section];
  return (
    <div className={signedIn ? 'shell' : 'shell logged-out'}>
      {signedIn && (
        <aside className="sidebar">
          <a href="#products" className="identity"><img src="/img/logo.png" alt="" /><span>پنل ساری چین</span></a>
          <nav className="sidebar-menu" aria-label="کاتالوگ">
            <h2>کاتالوگ</h2>
            {(Object.keys(sections) as Section[]).map(key => {
              const { label, icon: Icon } = sections[key];
              return <a key={key} href={`#${key}`} aria-current={section === key ? 'page' : undefined}><Icon size={18} />{label}</a>;
            })}
          </nav>
          <nav className="sidebar-menu members-menu" aria-label="اعضا">
            <h2>اعضا</h2>
            {(Object.keys(memberSections) as MemberGroup[]).map(key => {
              const { label, icon: Icon } = memberSections[key];
              return <a key={key} href={`#${key}`} aria-current={section === key ? 'page' : undefined}><Icon size={18} />{label}</a>;
            })}
          </nav>
        </aside>
      )}
      <div className="main-column">
        <header className="topbar">
          {!signedIn ? <a href="./" className="identity"><img src="/img/logo.png" alt="" /><span>پنل ساری چین</span></a>
            : <span className="header-context">{isMembers ? 'اعضا' : 'کاتالوگ'} <span aria-hidden="true">/</span> {current.label}</span>}
          <div className="header-actions">
            {signedIn && <span className={demo ? 'mode demo' : 'mode'}>{demo ? 'داده آزمایشی' : 'داده بک‌اند'}</span>}
            <button className="icon-button" type="button" aria-label={dark ? 'تم روشن' : 'تم تیره'} title={dark ? 'تم روشن' : 'تم تیره'} onClick={() => setDark(value => !value)}>
              {dark ? <Sun size={19} /> : <Moon size={18} />}
            </button>
            {signedIn && <button className="icon-button" type="button" aria-label={demo ? 'خروج از نسخه آزمایشی' : 'خروج'} onClick={logout}><LogOut size={18} /></button>}
          </div>
        </header>
        {expired && <p className="session-alert" role="status">نشست شما پایان یافت. دوباره وارد شوید.</p>}
        {signedIn
          ? isMembers
            ? <MembersView key={section} group={section as MemberGroup} token={token} onExpired={expire} />
            : <CatalogView key={section} section={section as Section} token={token} onExpired={expire} />
          : <Login onLogin={openLive} onDemo={openDemo} />}
      </div>
    </div>
  );
}
