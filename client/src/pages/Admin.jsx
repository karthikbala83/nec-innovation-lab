// Live dashboard: polls /api/admin/dashboard every 10 seconds.
// "Active" = a session touched the API within the last 5 minutes.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';

export default function Admin() {
  const [data, setData] = useState(null);

  useEffect(() => {
    const load = () => api.get('/admin/dashboard').then((r) => setData(r.data)).catch(() => {});
    load();
    const id = setInterval(load, 10000);   // simple polling — WebSockets is the next lesson
    return () => clearInterval(id);
  }, []);

  if (!data) return <p>Loading dashboard…</p>;
  const { counts, activeUsers, loginsPerDay, topWriters } = data;

  return (
    <div>
      <div className="row-between">
        <h2>Admin Dashboard <span className="live-dot" title="auto-refreshes every 10s" /></h2>
        <span data-tour="admin-links"><Link to="/admin/people">People &amp; roles</Link> · <Link to="/admin/lab">Lab Score &amp; moderation</Link> · <Link to="/admin/intros">Intro requests</Link> · <Link to="/admin/moderation">Feedback moderation</Link> · <Link to="/review">Review</Link></span>
      </div>

      <div className="stat-grid">
        <div className="stat"><span>{counts.activeNow}</span>Active now</div>
        <div className="stat"><span>{counts.totalUsers}</span>Total users</div>
        <div className="stat"><span>{counts.totalNotes}</span>Total notes</div>
        <div className="stat"><span>{counts.totalSessions}</span>All-time logins</div>
      </div>

      <div className="card">
        <h3>Who is online (last 5 min)</h3>
        <table>
          <thead><tr><th>Name</th><th>Email</th><th>Dept</th><th>Tabs</th><th>Last seen</th></tr></thead>
          <tbody>
            {activeUsers.length === 0 && <tr><td colSpan="5">Nobody active right now</td></tr>}
            {activeUsers.map((u) => (
              <tr key={u._id}>
                <td>{u.name}</td><td>{u.email}</td><td>{u.department || '-'}</td>
                <td>{u.sessions}</td>
                <td>{new Date(u.lastActiveAt).toLocaleTimeString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3>Logins per day (7 days)</h3>
        <table>
          <thead><tr><th>Date</th><th>Logins</th><th>Unique users</th></tr></thead>
          <tbody>
            {loginsPerDay.map((d) => (
              <tr key={d._id}><td>{d._id}</td><td>{d.logins}</td><td>{d.uniqueUsers}</td></tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3>Top note writers</h3>
        <table>
          <thead><tr><th>Name</th><th>Year</th><th>Notes</th><th>High priority</th></tr></thead>
          <tbody>
            {topWriters.map((w) => (
              <tr key={w._id}><td>{w.name}</td><td>{w.year || '-'}</td>
                  <td>{w.noteCount}</td><td>{w.highPriority}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
