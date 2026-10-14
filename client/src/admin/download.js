// Download an admin CSV. A plain <a href> can't send the login token,
// so fetch it as a blob through the shared axios instance and save it.
import api from '../api/axios';

export async function downloadCsv(path, fallbackName) {
  const res = await api.get(path, { responseType: 'blob' });
  const name = /filename="([^"]+)"/.exec(res.headers['content-disposition'] || '')?.[1] || fallbackName;
  const url = URL.createObjectURL(res.data);
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
