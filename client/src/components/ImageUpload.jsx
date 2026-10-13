// "Upload image" button: asks our API for a presigned S3 POST, then sends the
// file straight from the browser to S3. Hidden when the server has no S3 set up.
import { useEffect, useRef, useState } from 'react';
import api from '../api/axios';
import { errorText } from './ui.jsx';

let statusPromise;   // ask the server once per page load
const uploadStatus = () => (statusPromise ||= api.get('/uploads/status').then((r) => r.data).catch(() => ({ enabled: false })));

export default function ImageUpload({ projectId, kind, onUploaded, label = 'Upload image' }) {
  const input = useRef(null);
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { uploadStatus().then(setStatus); }, []);
  if (!status?.enabled || !projectId) return null;

  const pick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError('');
    if (!status.types.includes(file.type)) return setError('Use a PNG, JPG, WebP or GIF image');
    if (file.size > status.maxMb * 1048576) return setError(`Image must be under ${status.maxMb} MB`);

    setBusy(true);
    try {
      const { data } = await api.post('/uploads/presign', { projectId, kind, contentType: file.type, size: file.size });
      const form = new FormData();
      Object.entries(data.fields).forEach(([k, v]) => form.append(k, v));
      form.append('file', file);   // must be the last field
      const res = await fetch(data.url, { method: 'POST', body: form });
      if (!res.ok) throw new Error(`S3 refused the upload (${res.status})`);
      onUploaded(data.publicUrl);
    } catch (err) {
      setError(err.response ? errorText(err) : err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <span className="upload">
      <input ref={input} type="file" accept={status.types.join(',')} onChange={pick} hidden />
      <button type="button" className="ghost small" onClick={() => input.current.click()} disabled={busy}>
        {busy ? 'Uploading…' : `⬆ ${label}`}
      </button>
      {error && <span className="error small"> {error}</span>}
    </span>
  );
}
