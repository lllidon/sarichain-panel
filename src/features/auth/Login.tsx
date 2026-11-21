import { useState, type FormEvent } from 'react';
import { ArrowLeft, LogIn } from 'lucide-react';
import { ApiError, login } from '../../api';

export default function Login({ onLogin, onDemo }: { onLogin: (token: string) => void; onDemo: () => void }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    const data = new FormData(event.currentTarget);
    try {
      const response = await login(String(data.get('phone')), String(data.get('password')));
      onLogin(response.accessToken);
    } catch (error) {
      const status = error instanceof ApiError ? error.status : 0;
      if (status === 401) setMessage('شماره موبایل یا رمز عبور صحیح نیست.');
      else if (status === 400) setMessage('شماره موبایل و رمز عبور را بررسی کنید.');
      else if (status === 429) setMessage('تعداد تلاش‌ها زیاد است. کمی بعد دوباره امتحان کنید.');
      else setMessage('ارتباط با بک‌اند برقرار نشد.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-page">
      <div className="login-card">
        <div className="login-icon"><LogIn size={21} /></div>
        <h1>ورود به پنل ساری چین</h1>
        <p>با حساب بک‌اند خود وارد شوید.</p>
        <form onSubmit={submit}>
          <label>شماره موبایل<input name="phone" type="tel" dir="ltr" autoComplete="username" placeholder="09123456789" required /></label>
          <label>رمز عبور<input name="password" type="password" dir="ltr" autoComplete="current-password" required /></label>
          {message && <p role="alert" className="error-message">{message}</p>}
          <button className="primary-button" type="submit" disabled={busy}>{busy ? 'در حال ورود…' : 'ورود به پنل'} <ArrowLeft size={16} /></button>
        </form>
        <button className="demo-button" type="button" onClick={onDemo} disabled={busy}>مشاهده نسخه آزمایشی</button>
      </div>
    </main>
  );
}
