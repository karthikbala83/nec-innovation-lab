import { useEffect, useState, useCallback } from 'react';
import api from '../api/axios';

export default function Notes() {
  const [notes, setNotes] = useState([]);
  const [stats, setStats] = useState([]);
  const [form, setForm] = useState({ title: '', body: '', tags: '', priority: 'low' });
  const [filterTag, setFilterTag] = useState('');

  const load = useCallback(async () => {
    const params = filterTag ? { tag: filterTag } : {};
    const [{ data: n }, { data: s }] = await Promise.all([
      api.get('/notes', { params }),
      api.get('/notes/stats/by-tag'),
    ]);
    setNotes(n.notes);
    setStats(s);
  }, [filterTag]);

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (!form.title) return;
    await api.post('/notes', {
      title: form.title,
      body: form.body,
      tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
      meta: { priority: form.priority },
    });
    setForm({ title: '', body: '', tags: '', priority: 'low' });
    load();
  };

  const remove = async (id) => { await api.delete(`/notes/${id}`); load(); };

  return (
    <div>
      <h2>My Notes</h2>
      <div className="card">
        <input placeholder="Title" value={form.title}
               onChange={(e) => setForm({ ...form, title: e.target.value })} />
        <textarea placeholder="Body" value={form.body}
                  onChange={(e) => setForm({ ...form, body: e.target.value })} />
        <input placeholder="Tags (comma separated)" value={form.tags}
               onChange={(e) => setForm({ ...form, tags: e.target.value })} />
        <select value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}>
          <option value="low">Low</option><option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
        <button onClick={create}>Add note</button>
      </div>

      <div className="tag-row">
        <button className={!filterTag ? 'tag active' : 'tag'} onClick={() => setFilterTag('')}>all</button>
        {stats.map((s) => (
          <button key={s._id} className={filterTag === s._id ? 'tag active' : 'tag'}
                  onClick={() => setFilterTag(s._id)}>
            {s._id} ({s.count})
          </button>
        ))}
      </div>

      {notes.map((n) => (
        <div key={n._id} className="card note">
          <div>
            <strong>{n.title}</strong>
            <span className={`badge ${n.meta?.priority}`}>{n.meta?.priority}</span>
            {n.meta?.pinned && <span className="badge">pinned</span>}
            <div className="muted">{n.tags?.join(', ')}</div>
          </div>
          <button className="danger" onClick={() => remove(n._id)}>Delete</button>
        </div>
      ))}
    </div>
  );
}
