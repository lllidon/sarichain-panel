import { useEffect, useState } from 'react';
import { Plus, Tag, X } from 'lucide-react';
import { addTag, ApiError, searchTags } from '../../api';
import { type NamedRecord } from './catalog';

export default function TagManager({ value, onChange, token, onExpired }: {
  value: NamedRecord[]; onChange: (value: NamedRecord[]) => void; token: string; onExpired: () => void;
}) {
  const [query, setQuery] = useState('');
  const [choices, setChoices] = useState<NamedRecord[]>([]);
  const [error, setError] = useState('');
  const [working, setWorking] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      searchTags(query.trim(), token, controller.signal).then(data => setChoices(data.items)).catch(error => {
        if (controller.signal.aborted) return;
        if (error instanceof ApiError && error.status === 401) onExpired();
        else setError('دریافت تگ‌ها انجام نشد.');
      });
    }, 180);
    return () => { clearTimeout(timeout); controller.abort(); };
  }, [query, token, open, onExpired]);

  function select(tag: NamedRecord) {
    if (!value.some(item => item._id === tag._id) && value.length < 30) onChange([...value, tag]);
    setQuery('');
    setOpen(false);
  }

  async function create() {
    setWorking(true);
    setError('');
    try {
      select(await addTag(query.trim(), token));
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) onExpired();
      else setError(error instanceof ApiError && error.message ? error.message : 'ایجاد تگ انجام نشد.');
    } finally { setWorking(false); }
  }

  return (
    <fieldset className="tag-manager">
      <legend><Tag size={15} /> تگ‌ها</legend>
      {value.length > 0 && <ul className="tag-chips">{value.map(tag => (
        <li key={tag._id}>{tag.name}<button type="button" aria-label={`برداشتن تگ ${tag.name}`} onClick={() => onChange(value.filter(item => item._id !== tag._id))}><X size={14} /></button></li>
      ))}</ul>}
      <label>
        جستجو یا ساخت تگ
        <input type="search" value={query} maxLength={60} placeholder="نام تگ"
          onFocus={() => setOpen(true)} onChange={event => { setQuery(event.target.value); setChoices([]); setError(''); setOpen(true); }}
          onKeyDown={event => { if (event.key === 'Enter') event.preventDefault(); }} />
      </label>
      {open && (
        <div className="tag-choices">
          {choices.filter(tag => !value.some(item => item._id === tag._id)).map(tag => (
            <button type="button" key={tag._id} disabled={working || value.length >= 30} onClick={() => select(tag)}>{tag.name}</button>
          ))}
          {query.trim() && <button type="button" disabled={working || value.length >= 30} onClick={create}><Plus size={15} /> ساخت تگ «{query.trim()}»</button>}
        </div>
      )}
      {error && <p className="editor-error" role="alert">{error}</p>}
    </fieldset>
  );
}
