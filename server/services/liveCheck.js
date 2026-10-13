// ---------------------------------------------------------------
// Is a project's live URL up? One GET, 10 s timeout, ≤3 redirects.
//
// SECURITY: the URL is typed by students, and the request comes from
// OUR server. Without care, "http://169.254.169.254/" or
// "http://localhost:27017" would let anyone probe the college network
// (SSRF). So every address is checked inside the socket's own DNS
// lookup — the IP we validate is the IP we connect to (no rebinding).
// ---------------------------------------------------------------
const http = require('http');
const https = require('https');
const dns = require('dns');
const net = require('net');

const blocked = new net.BlockList();
[
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16],
  ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['224.0.0.0', 3],
].forEach(([ip, bits]) => blocked.addSubnet(ip, bits, 'ipv4'));
[['::', 128], ['::1', 128], ['fc00::', 7], ['fe80::', 10], ['ff00::', 8]]
  .forEach(([ip, bits]) => blocked.addSubnet(ip, bits, 'ipv6'));

const isPublicIp = (ip) => {
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip);   // IPv4 written as IPv6
  if (mapped) return isPublicIp(mapped[1]);
  const family = net.isIP(ip);
  if (!family) return false;
  return !blocked.check(ip, family === 6 ? 'ipv6' : 'ipv4');
};

// dns.lookup wrapper that refuses private addresses
const safeLookup = (hostname, options, cb) => {
  dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return cb(err);
    const bad = addresses.find((a) => !isPublicIp(a.address));
    if (bad) return cb(Object.assign(new Error(`Blocked private address ${bad.address}`), { code: 'EBLOCKED' }));
    if (options.all) return cb(null, addresses);
    cb(null, addresses[0].address, addresses[0].family);
  });
};

const requestOnce = (url, timeoutMs) => new Promise((resolve) => {
  const lib = url.protocol === 'https:' ? https : http;
  const req = lib.request(url, {
    method: 'GET',
    lookup: safeLookup,
    timeout: timeoutMs,
    headers: { 'User-Agent': 'NEC-Innovation-Lab-uptime/1.0 (+daily check)', Accept: 'text/html,*/*' },
  }, (res) => {
    res.resume();   // we only need the status, not the body
    resolve({ status: res.statusCode, location: res.headers.location });
    req.destroy();
  });
  req.on('timeout', () => { req.destroy(); resolve({ status: 0, error: 'timeout' }); });
  req.on('error', (err) => resolve({ status: 0, error: err.code || err.message }));
  req.end();
});

// Returns { ok, status, error? }. Up = final answer below 400.
const checkUrl = async (raw, { timeoutMs = 10000, maxRedirects = 3 } = {}) => {
  let url;
  try { url = new URL(raw); } catch { return { ok: false, status: 0, error: 'bad url' }; }
  for (let hop = 0; hop <= maxRedirects; hop++) {
    if (!['http:', 'https:'].includes(url.protocol)) return { ok: false, status: 0, error: 'not http(s)' };
    if (net.isIP(url.hostname.replace(/^\[|\]$/g, '')) && !isPublicIp(url.hostname.replace(/^\[|\]$/g, ''))) {
      return { ok: false, status: 0, error: 'private address' };
    }
    const r = await requestOnce(url, timeoutMs);
    if (r.status >= 300 && r.status < 400 && r.location) {
      url = new URL(r.location, url);   // each hop is re-validated above
      continue;
    }
    return { ok: r.status > 0 && r.status < 400, status: r.status, ...(r.error ? { error: r.error } : {}) };
  }
  return { ok: false, status: 0, error: 'too many redirects' };
};

module.exports = { checkUrl, isPublicIp };
