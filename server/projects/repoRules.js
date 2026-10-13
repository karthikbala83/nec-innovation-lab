// ---------------------------------------------------------------
// Pure rules used by the repo import. No network, no database —
// so they are easy to unit test (see tests/repoRules.test.js).
//   skipReason()   which files we ignore
//   scanSecrets()  committed keys / passwords, masked
//   detectStack()  React, Flask, Arduino… from manifest files
// ---------------------------------------------------------------

const MAX_FILE_BYTES = Number(process.env.GITHUB_MAX_FILE_KB || 500) * 1024;

const SKIP_DIRS = new Set([
  'node_modules', 'bower_components', 'vendor', '.git', 'dist', 'build', 'out', '.next', '.nuxt',
  'coverage', '__pycache__', 'venv', '.venv', 'env', 'target', '.gradle', '.idea', '.vscode',
  'Pods', 'DerivedData', '.dart_tool', '.pio', '.expo',
]);

const LOCK_FILES = new Set([
  'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'bun.lockb', 'composer.lock', 'Gemfile.lock',
  'poetry.lock', 'Pipfile.lock', 'Cargo.lock', 'go.sum', 'pubspec.lock', 'gradle.lockfile',
]);

const BINARY_EXT = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'bmp', 'ico', 'webp', 'svgz', 'psd', 'ai', 'tif', 'tiff', 'heic',
  'mp3', 'wav', 'ogg', 'flac', 'mp4', 'mov', 'avi', 'mkv', 'webm',
  'zip', 'gz', 'tgz', 'rar', '7z', 'tar', 'jar', 'war', 'apk', 'aab', 'ipa', 'exe', 'dll', 'so',
  'dylib', 'bin', 'o', 'a', 'class', 'pyc', 'pyo', 'whl', 'hex', 'elf',
  'pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx',
  'woff', 'woff2', 'ttf', 'otf', 'eot',
  'h5', 'hdf5', 'pkl', 'pickle', 'pt', 'pth', 'onnx', 'tflite', 'pb', 'ckpt', 'npy', 'npz',
  'sqlite', 'db', 'mdb',
]);

const ext = (path) => {
  const base = path.split('/').pop();
  const i = base.lastIndexOf('.');
  return i > 0 ? base.slice(i + 1).toLowerCase() : '';
};

// Returns why a file is skipped, or null if we keep it
const skipReason = (path, size = 0) => {
  const parts = path.split('/');
  const dir = parts.slice(0, -1).find((p) => SKIP_DIRS.has(p));
  if (dir) return dir;
  const base = parts[parts.length - 1];
  if (LOCK_FILES.has(base)) return 'lockfile';
  if (/\.min\.(js|css)$/i.test(base) || /\.map$/i.test(base)) return 'minified';
  if (BINARY_EXT.has(ext(base))) return 'binary';
  if (size > MAX_FILE_BYTES) return 'large';
  return null;
};

// ---- Secret scan ----
// High-confidence patterns first; the generic one catches `password = "…"` style leaks.
const SECRET_PATTERNS = [
  { type: 'Private key', re: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP |ENCRYPTED )?PRIVATE KEY-----/ },
  { type: 'AWS access key', re: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/ },
  { type: 'GitHub token', re: /\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{60,})\b/ },
  { type: 'Google API key', re: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  { type: 'Stripe live key', re: /\b(?:sk|rk)_live_[0-9A-Za-z]{20,}\b/ },
  { type: 'Slack token', re: /\bxox[abprs]-[0-9A-Za-z-]{10,}\b/ },
  { type: 'SendGrid key', re: /\bSG\.[\w-]{22}\.[\w-]{43}\b/ },
  { type: 'Anthropic API key', re: /\bsk-ant-[A-Za-z0-9_-]{20,}\b/ },
  { type: 'OpenAI API key', re: /\bsk-(?:proj-)?[A-Za-z0-9_-]{32,}\b/ },
  { type: 'Twilio key', re: /\bSK[0-9a-fA-F]{32}\b/ },
  { type: 'Database URL with password', re: /\b(?:mongodb(?:\+srv)?|postgres(?:ql)?|mysql|redis|amqp):\/\/[^\s:/@'"]+:[^\s@'"]{3,}@[^\s'"]+/ },
  {
    type: 'Hard-coded secret',
    re: /\b(?:api[_-]?key|secret(?:[_-]?key)?|client[_-]?secret|access[_-]?token|auth[_-]?token|password|passwd|jwt[_-]?secret)\b["']?\s*[:=]\s*["']([^"'\s$<>{}]{8,})["']/i,
  },
];

// Values that are obviously placeholders, not leaks
const PLACEHOLDER = /(change[_-]?me|change[_-]?this|your[_-]|example|placeholder|xxxx|dummy|sample|<.*>|\*\*\*|process\.env|os\.environ|test123|password123)/i;

const mask = (s) => (s.length <= 6 ? '****' : `${s.slice(0, 4)}****`);

// Committed env files are a warning by themselves, whatever is inside
const isEnvFile = (path) => {
  const base = path.split('/').pop();
  return /^\.env(\..+)?$/.test(base) && !/\.(example|sample|template|dist)$/i.test(base);
};

const MAX_WARNINGS = 50;

const scanSecrets = (path, text) => {
  const found = [];
  if (isEnvFile(path)) found.push({ path, line: 0, type: 'Committed .env file', preview: '' });
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length && found.length < MAX_WARNINGS; i++) {
    const line = lines[i];
    if (line.length > 2000) continue;   // minified blob that slipped through
    for (const { type, re } of SECRET_PATTERNS) {
      const m = re.exec(line);
      if (!m) continue;
      const value = m[1] || m[0];
      if (type === 'Hard-coded secret' && PLACEHOLDER.test(value)) continue;
      if (type === 'Database URL with password' && PLACEHOLDER.test(value)) continue;
      found.push({ path, line: i + 1, type, preview: mask(value) });
      break;   // one warning per line is enough
    }
  }
  return found;
};

// ---- Stack detection ----
const NPM_STACK = {
  react: 'React', 'react-native': 'React Native', next: 'Next.js', vue: 'Vue', nuxt: 'Nuxt',
  '@angular/core': 'Angular', svelte: 'Svelte', express: 'Express', '@nestjs/core': 'NestJS',
  fastify: 'Fastify', mongoose: 'MongoDB', mongodb: 'MongoDB', pg: 'PostgreSQL', mysql2: 'MySQL',
  prisma: 'Prisma', '@prisma/client': 'Prisma', firebase: 'Firebase', 'socket.io': 'Socket.IO',
  tailwindcss: 'Tailwind CSS', vite: 'Vite', electron: 'Electron', expo: 'Expo',
  '@tensorflow/tfjs': 'TensorFlow.js', 'three': 'Three.js', typescript: 'TypeScript',
};
const PY_STACK = {
  django: 'Django', flask: 'Flask', fastapi: 'FastAPI', streamlit: 'Streamlit', tensorflow: 'TensorFlow',
  keras: 'Keras', torch: 'PyTorch', 'scikit-learn': 'scikit-learn', sklearn: 'scikit-learn',
  pandas: 'pandas', numpy: 'NumPy', 'opencv-python': 'OpenCV', 'opencv-contrib-python': 'OpenCV',
  ultralytics: 'YOLO', transformers: 'Hugging Face', langchain: 'LangChain', pymongo: 'MongoDB',
  sqlalchemy: 'SQLAlchemy', 'rpi.gpio': 'Raspberry Pi', gradio: 'Gradio',
};
const FILE_STACK = [
  [/(^|\/)Dockerfile$/, 'Docker'],
  [/(^|\/)docker-compose\.ya?ml$/, 'Docker'],
  [/(^|\/)pubspec\.yaml$/, 'Flutter'],
  [/(^|\/)pom\.xml$/, 'Java (Maven)'],
  [/(^|\/)build\.gradle(\.kts)?$/, 'Gradle'],
  [/(^|\/)AndroidManifest\.xml$/, 'Android'],
  [/(^|\/)go\.mod$/, 'Go'],
  [/(^|\/)Cargo\.toml$/, 'Rust'],
  [/(^|\/)composer\.json$/, 'PHP'],
  [/(^|\/)platformio\.ini$/, 'PlatformIO'],
  [/\.ino$/, 'Arduino'],
  [/(^|\/)firebase\.json$/, 'Firebase'],
  [/(^|\/)vercel\.json$/, 'Vercel'],
  [/(^|\/)render\.yaml$/, 'Render'],
  [/\.ipynb$/, 'Jupyter'],
  [/(^|\/)\.github\/workflows\/.+\.ya?ml$/, 'GitHub Actions'],
];

// Files whose content we keep (trimmed) for the stack + Lotus later
const isKeyFile = (path) => {
  const base = path.split('/').pop();
  const depth = path.split('/').length;
  return (/^readme(\.md|\.txt|\.rst)?$/i.test(base) && depth <= 2)
    || ['package.json', 'requirements.txt', 'pyproject.toml', 'pubspec.yaml', 'pom.xml',
      'build.gradle', 'go.mod', 'Cargo.toml', 'composer.json', 'platformio.ini',
      'Dockerfile', 'docker-compose.yml'].includes(base);
};

const detectStack = (paths, keyFiles) => {
  const stack = new Set();
  for (const p of paths) for (const [re, name] of FILE_STACK) if (re.test(p)) stack.add(name);
  for (const { path, content } of keyFiles) {
    const base = path.split('/').pop();
    if (base === 'package.json') {
      try {
        const pkg = JSON.parse(content);
        const deps = { ...pkg.dependencies, ...pkg.devDependencies };
        Object.keys(deps).forEach((d) => NPM_STACK[d] && stack.add(NPM_STACK[d]));
        stack.add('Node.js');
      } catch { /* trimmed or invalid json */ }
    }
    if (base === 'requirements.txt' || base === 'pyproject.toml') {
      content.toLowerCase().split(/[\s"',[\]]+/).forEach((tok) => {
        const name = tok.split(/[=<>~!;]/)[0];
        if (PY_STACK[name]) stack.add(PY_STACK[name]);
      });
      stack.add('Python');
    }
  }
  return [...stack].sort();
};

module.exports = { skipReason, scanSecrets, detectStack, isKeyFile, isEnvFile, mask, MAX_FILE_BYTES };
