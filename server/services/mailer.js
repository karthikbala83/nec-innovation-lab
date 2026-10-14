// ---------------------------------------------------------------
// Email via Resend (https://resend.com) — plain REST, no SDK.
//   RESEND_API_KEY  required to actually send
//   MAIL_FROM       "NEC Innovation Lab <noreply@your-verified-domain>"
// Without a key (local dev) emails are printed to the server log.
// User-written text is always HTML-escaped before it goes into a mail.
// ---------------------------------------------------------------
const escape = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const isConfigured = () => !!process.env.RESEND_API_KEY;

// Simple branded wrapper. `paragraphs` are plain strings (escaped here); `cta` = { label, url }.
const layout = ({ heading, paragraphs = [], quote, cta, footer }) => `
<div style="font-family:Arial,sans-serif;background:#fffbf3;padding:24px">
  <div style="max-width:560px;margin:auto;background:#fff;border:2px solid #1b1f3b;border-radius:16px;padding:24px">
    <p style="margin:0 0 8px;font-weight:bold;color:#ff5a36">NEC Innovation Lab</p>
    <h2 style="margin:0 0 12px;color:#1b1f3b">${escape(heading)}</h2>
    ${paragraphs.map((p) => `<p style="color:#1b1f3b;line-height:1.5">${escape(p)}</p>`).join('')}
    ${quote ? `<blockquote style="margin:12px 0;padding:12px 14px;background:#fff4d1;border-left:4px solid #ffc83d;border-radius:8px;white-space:pre-line;color:#1b1f3b">${escape(quote)}</blockquote>` : ''}
    ${cta ? `<p style="margin:20px 0"><a href="${escape(cta.url)}" style="background:#ff5a36;color:#1b1f3b;font-weight:bold;padding:10px 18px;border:2px solid #1b1f3b;border-radius:999px;text-decoration:none">${escape(cta.label)}</a></p>` : ''}
    <p style="color:#6b6f86;font-size:12px;margin-top:20px">${escape(footer || 'Sent by the NEC Innovation Lab portal of Nandha Engineering College. Contact details are never shared between students and visitors.')}</p>
  </div>
</div>`;

const toText = ({ heading, paragraphs = [], quote, cta }) =>
  [heading, '', ...paragraphs, quote ? `\n"${quote}"\n` : '', cta ? `${cta.label}: ${cta.url}` : ''].join('\n');

// send({ to, subject, heading, paragraphs, quote, cta }) -> { id } | { logged: true }
const send = async ({ to, subject, ...content }) => {
  const html = layout(content);
  const text = toText(content);
  if (!isConfigured()) {
    console.log(`[mail:dev] to=${to} subject="${subject}"\n${text}\n`);
    return { logged: true };
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: process.env.MAIL_FROM || 'NEC Innovation Lab <onboarding@resend.dev>', to: [to], subject, html, text }),
    signal: AbortSignal.timeout(15000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(`Email not sent: ${data.message || res.status}`), { status: 502 });
  return { id: data.id };
};

// Fire-and-forget for notifications that must not fail the request
const sendSoon = (msg) => { send(msg).catch((err) => console.error('Mail failed:', err.message)); };

module.exports = { send, sendSoon, isConfigured, escape };
