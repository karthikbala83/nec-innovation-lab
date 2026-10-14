// ---------------------------------------------------------------
// Thin GitHub REST client. Read-only, public repos only.
// Uses the server token (GITHUB_TOKEN) when set: 5000 req/hour
// instead of 60/hour per IP — one lab would hit 60 in minutes.
// ---------------------------------------------------------------
const API = 'https://api.github.com';

class GitHubError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

// token: a student's own read-only token for a PRIVATE repo (used for that one import, never stored);
// otherwise the server's GITHUB_TOKEN for public repos.
const headers = (accept = 'application/vnd.github+json', token = process.env.GITHUB_TOKEN) => {
  const h = { Accept: accept, 'User-Agent': 'nec-innovation-lab', 'X-GitHub-Api-Version': '2022-11-28' };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
};

// Every call goes through here so we can count calls and explain errors in plain words
const createClient = ({ timeoutMs = 20000, token } = {}) => {
  let calls = 0;

  const request = async (path, { accept, raw = false, timeout = timeoutMs } = {}) => {
    calls += 1;
    const res = await fetch(path.startsWith('http') ? path : `${API}${path}`, {
      headers: headers(accept, token || process.env.GITHUB_TOKEN),
      signal: AbortSignal.timeout(timeout),   // covers reading the body too
    });
    if (res.status === 404) {
      throw new GitHubError(token
        ? 'Repository not found — check the token was created for THIS repository with Contents: Read-only'
        : 'Repository not found or private. If it is private, import it with a read-only token (see "My repo is private").', 404);
    }
    if (res.status === 401) throw new GitHubError('GitHub rejected the token — it may be expired or mistyped. Create a new one.', 400);
    if (res.status === 409) throw new GitHubError('Repository is empty', 409);
    if (res.status === 403 || res.status === 429) {
      const reset = Number(res.headers.get('x-ratelimit-reset')) * 1000;
      const when = reset ? ` Try again after ${new Date(reset).toLocaleTimeString('en-IN')}.` : '';
      throw new GitHubError(`GitHub rate limit reached.${when}`, 429);
    }
    if (!res.ok) throw new GitHubError(`GitHub returned ${res.status}`, 502);
    return raw ? res : res.json();
  };

  return {
    get calls() { return calls; },
    repo: (o, r) => request(`/repos/${o}/${r}`),
    headSha: async (o, r, ref) => (await request(`/repos/${o}/${r}/commits/${ref}`, {
      accept: 'application/vnd.github.sha', raw: true,
    })).text(),
    tree: (o, r, sha) => request(`/repos/${o}/${r}/git/trees/${sha}?recursive=1`),
    languages: (o, r) => request(`/repos/${o}/${r}/languages`),
    commits: (o, r, sha, page) => request(`/repos/${o}/${r}/commits?sha=${sha}&per_page=100&page=${page}`),
    commit: (o, r, sha) => request(`/repos/${o}/${r}/commits/${sha}`),
    // Whole repo in ONE request (instead of one call per file). Returns the fetch Response.
    tarball: (o, r, sha) => request(`/repos/${o}/${r}/tarball/${sha}`, { raw: true, timeout: 2 * timeoutMs }),
  };
};

module.exports = { createClient, GitHubError };
