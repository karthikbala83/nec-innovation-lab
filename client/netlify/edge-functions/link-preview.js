// Link previews on WhatsApp, LinkedIn, Telegram, X… Those crawlers don't run JavaScript,
// so they would only see an empty React shell. For crawlers we return the API's small
// Open Graph page (title, tagline, picture); people get the normal app at the same URL.
// The Docker/nginx setup does the same in client/nginx.conf.
const BOTS = /whatsapp|facebookexternalhit|facebot|linkedinbot|twitterbot|telegrambot|slackbot|discordbot|skypeuripreview|pinterest|redditbot|applebot|embedly|iframely|mastodon|vkshare/i;

const apiBase = () => {
  let base = (Netlify.env.get('API_URL') || Netlify.env.get('VITE_API_URL') || '').trim().replace(/\/+$/, '');
  if (!base) return null;
  if (!/^https?:\/\//.test(base)) base = `https://${base}`;
  return /\/api$/.test(base) ? base : `${base}/api`;
};

export default async (request, context) => {
  if (!BOTS.test(request.headers.get('user-agent') || '')) return context.next();
  const api = apiBase();
  if (!api) return context.next();

  const { pathname } = new URL(request.url);
  const m = /^\/(p|u)\/([^/]+)\/?$/.exec(pathname);
  const path = m ? `/share/html/${m[1]}/${encodeURIComponent(decodeURIComponent(m[2]))}` : '/share/html';
  try {
    // Render's free tier may be waking up; crawlers give up after ~10 s anyway
    const res = await fetch(api + path, { signal: AbortSignal.timeout(9000) });
    if (!res.ok) return context.next();
    return new Response(await res.text(), {
      headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'private, max-age=0', vary: 'User-Agent' },
    });
  } catch {
    return context.next();
  }
};

export const config = {
  path: '/*',
  excludedPath: ['/assets/*', '/*.png', '/*.jpg', '/*.svg', '/*.ico', '/*.txt', '/*.json', '/*.webmanifest'],
};
