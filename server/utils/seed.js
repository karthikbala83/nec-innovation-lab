// Run: npm run seed      (WIPES users, sessions, notes, projects, snapshots, metrics,
//                        backings, follows, comments, updates, settings, Lotus, intros,
//                        likes, feedback & requests)
// Creates 1 admin, 2 faculty mentors, 7 students, 3 published demo
// projects and 1 project waiting in the mentor queue. Repo snapshots
// are fixtures (no GitHub calls), so seeding works offline.
require('dotenv').config();
const crypto = require('crypto');
const User = require('../models/User');
const Note = require('../models/Note');
const Session = require('../models/Session');
const Project = require('../projects/Project');
const RepoSnapshot = require('../projects/RepoSnapshot');
const MetricDaily = require('../feed/MetricDaily');
const Backing = require('../community/Backing');
const Follow = require('../community/Follow');
const Comment = require('../community/Comment');
const Update = require('../updates/Update');
const Setting = require('../settings/Setting');
const { mapMembers, weeklyCounts, summarise } = require('../projects/repoImport');
const { recompute } = require('../score/labScore');
const LotusSet = require('../lotus/LotusSet');
const LotusAttempt = require('../lotus/LotusAttempt');
const IntroRequest = require('../intros/IntroRequest');
const { mock: lotusMock } = require('../services/lotusClient');
const { checkDuplicates } = require('../projects/duplicateCheck');
const Like = require('../feedback/Like');
const Feedback = require('../feedback/Feedback');

const DOMAIN = (process.env.ALLOWED_EMAIL_DOMAIN || 'nandhaengg.org').split(',')[0].trim();
const mail = (local) => `${local}@${DOMAIN}`;
const DAY = 864e5;
const daysAgo = (n) => new Date(Date.now() - n * DAY);

// Deterministic "random" so every seed looks the same
let seed = 7;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

// Fake commit history: n commits spread over `days`, by the given logins
const fakeCommits = (logins, n, days, files) =>
  Array.from({ length: n }, (_, i) => {
    const login = logins[i % logins.length];
    return {
      sha: Math.floor(rand() * 1e16).toString(16).padStart(14, '0') + i.toString(16).padStart(26, '0'),
      authorLogin: login,
      authorName: login,
      date: daysAgo(Math.floor((i / n) * days) + rand()),
      message: ['Add', 'Fix', 'Update', 'Refactor', 'Wire up'][i % 5] + ' ' + files[i % files.length].split('/').pop(),
      files: [files[i % files.length], files[(i + 3) % files.length]],
    };
  });

const snapshotFor = (project, members, spec) => {
  const commits = fakeCommits(spec.logins, spec.commits, spec.days, spec.files);
  const tree = spec.files.map((path) => ({ path, size: 800 + Math.floor(rand() * 6000) }));
  return {
    project: project._id,
    owner: spec.owner,
    name: spec.name,
    sha: commits[0].sha,
    defaultBranch: 'main',
    meta: { description: project.tagline, stars: spec.stars, forks: 1, license: 'MIT', topics: spec.topics, createdAt: daysAgo(spec.days), pushedAt: commits[0].date, htmlUrl: project.repoUrl },
    languages: spec.languages,
    stack: spec.stack,
    tree,
    // git-like blob hash per file; files "copied" from another repo get that repo's hash
    fileHashes: tree.map((f) => ({
      path: f.path,
      sha: crypto.createHash('sha1').update(`${(spec.copied || []).includes(f.path) ? spec.copiedFrom : spec.name}:${f.path}`).digest('hex'),
    })),
    skipped: { count: spec.skipped, reasons: { node_modules: spec.skipped - 3, lockfile: 2, binary: 1 } },
    treeTruncated: false,
    keyFiles: [{ path: 'README.md', size: 1200, content: `# ${project.title}\n\n${project.tagline}` }],
    commits,
    detailedCommits: Math.min(40, commits.length),
    weeklyCommits: weeklyCounts(commits),
    ...mapMembers(commits, members),
    secretWarnings: spec.secretWarnings || [],
    scan: { filesScanned: tree.length, complete: true },
    fetchedAt: new Date(),
    durationMs: 0,
    apiCalls: 0,
  };
};

const run = async () => {
  await require('../config/db').connect();
  await Promise.all([
    User.deleteMany(), Note.deleteMany(), Session.deleteMany(),
    Project.deleteMany(), RepoSnapshot.deleteMany(), MetricDaily.deleteMany(),
    Backing.deleteMany(), Follow.deleteMany(), Comment.deleteMany(), Update.deleteMany(), Setting.deleteMany(),
    LotusSet.deleteMany(), LotusAttempt.deleteMany(), IntroRequest.deleteMany(), Like.deleteMany(), Feedback.deleteMany(),
  ]);
  await Promise.all([User, Project, RepoSnapshot, MetricDaily, Backing, Follow, Comment, Update, Setting, LotusSet, LotusAttempt, IntroRequest, Like, Feedback]
    .map((M) => M.syncIndexes()));
  await Setting.get();   // default Lab Score weights

  await User.create({ name: 'Portal Admin', email: mail('innovationlab.admin'), password: 'admin123', role: 'admin', verified: true });

  const [drRamesh, drLakshmi] = await User.create([
    { name: 'Dr. R. Ramesh', email: mail('ramesh.cse'), password: 'faculty123', role: 'faculty', verified: true, profile: { department: 'CSE' } },
    { name: 'Dr. S. Lakshmi', email: mail('lakshmi.ece'), password: 'faculty123', role: 'faculty', verified: true, profile: { department: 'ECE' } },
  ]);

  const people = [
    ['Arun Kumar', 'arun.k', 'CSE', 'arun-k-dev', ['react', 'node']],
    ['Priya S', 'priya.s', 'CSE', 'priya-codes', ['python', 'ml']],
    ['Karthik M', 'karthik.m', 'IT', 'karthikm', ['mongodb', 'express']],
    ['Divya R', 'divya.r', 'ECE', 'divya-iot', ['arduino', 'c']],
    ['Suresh P', 'suresh.p', 'EEE', 'sureshp', ['flutter']],
    ['Meena V', 'meena.v', 'CSE', 'meena-ai', ['python', 'tensorflow']],
    ['Vignesh T', 'vignesh.t', 'MECH', 'vigneshtech', ['cad', 'iot']],
  ];
  const students = await User.create(people.map(([name, local, department, gh, skills], i) => ({
    name,
    email: mail(local),
    password: 'student123',
    githubUsername: gh,
    verified: i < 5,
    profile: { department, year: 3, batch: '2023-2027', rollNo: `23${department}${String(101 + i)}`, skills },
  })));
  const [arun, priya, karthik, divya, suresh, meena, vignesh] = students;
  // A few more students so backer counts look like a real campus
  const crowd = await User.create(['Anitha', 'Bala', 'Charan', 'Deepa', 'Ezhil', 'Farhan', 'Gokul', 'Harini'].map((name, i) => ({
    name: `${name} ${String.fromCharCode(65 + i)}`, email: mail(`${name.toLowerCase()}.${i + 1}`), password: 'student123',
    profile: { department: ['CSE', 'IT', 'ECE', 'EEE'][i % 4], year: 2, batch: '2024-2028' },
  })));
  const m = (u, role) => ({ user: u._id, githubUsername: u.githubUsername, role });

  // ---- 1. Live MERN app, launched 5 days ago (shows the "New" badge) ----
  const bus = await Project.create({
    title: 'CampusBus Live', tagline: 'Know where your college bus is — live on a map, ETA to your stop, no app install.',
    department: 'CSE', year: 3, theme: 'Smart campus', category: 'software', stage: 'live',
    problem: 'Students and staff wait 20–40 minutes at stops because nobody knows where the 32 college buses are. Drivers get calls while driving.',
    solution: 'A driver web app shares GPS every 10 seconds; students open a PWA, pick their route and see the bus on a map with an ETA to their stop. Admin sees all buses and late trips.',
    impact: 'Pilot on 4 routes: average wait at stop down from 24 to 7 minutes in two weeks.',
    lookingFor: ['Drivers on routes 9-14 willing to test the driver app', 'A mentor who has shipped a PWA at scale'],
    liveUrl: 'https://example.com', repoUrl: 'https://github.com/nec-demo/campusbus-live',
    competitions: [{ name: 'NEC Hackathon 2026', stage: 'winner', confirmed: true, date: daysAgo(40) }],
    owner: arun._id, members: [m(arun, 'Lead · Backend'), m(karthik, 'Frontend')], mentor: drRamesh._id,
    status: 'published', publishedAt: daysAgo(5), review: { submittedAt: daysAgo(6), reviewedAt: daysAgo(5), reviewedBy: drRamesh._id },
  });

  // ---- 2. Hardware, SIH finalist, launched 30 days ago, very active repo ----
  const krishi = await Project.create({
    title: 'KrishiMitra Smart Drip', tagline: 'Soil-moisture sensors + ESP32 open the drip valve only when the crop needs water.',
    department: 'ECE', year: 3, theme: 'Agri-tech', category: 'hardware', stage: 'prototype',
    problem: 'Small farmers around Erode run drip lines on a timer, wasting 30–40% of water and power, and over-watering turmeric causes root rot.',
    solution: 'Capacitive soil sensors feed an ESP32 that opens a solenoid valve below a moisture threshold. Readings go to a Flutter app over MQTT so the farmer can see each bed and override by SMS when the network is weak.',
    impact: 'Field trial on 0.5 acre: 31% less water over 3 weeks with the same leaf health score.',
    lookingFor: ['20 farmers around Erode to pilot for one season', 'A teammate who knows PCB design'],
    repoUrl: 'https://github.com/nec-demo/krishimitra-drip',
    competitions: [{ name: 'SIH 2026', psId: 'SIH1642', stage: 'finalist', date: daysAgo(20) }],
    owner: divya._id, members: [m(divya, 'Lead · Firmware'), m(suresh, 'Mobile app'), m(vignesh, 'Mechanical')], mentor: drLakshmi._id,
    status: 'published', publishedAt: daysAgo(30), review: { submittedAt: daysAgo(31), reviewedAt: daysAgo(30), reviewedBy: drLakshmi._id },
  });

  // ---- 3. Research / ML, launched 60 days ago ----
  const medi = await Project.create({
    title: 'MediScan Chest X-ray Triage', tagline: 'Flags likely pneumonia X-rays first so the radiologist reads urgent cases sooner.',
    department: 'CSE', year: 3, theme: 'Health', category: 'research', stage: 'prototype',
    problem: 'District hospitals have one radiologist for hundreds of X-rays a day; urgent pneumonia cases wait in the same queue as routine checks.',
    solution: 'A DenseNet-121 model fine-tuned on public chest X-ray data scores each image; a Flask service reorders the reading queue and highlights the region the model looked at (Grad-CAM). The doctor always makes the call.',
    impact: 'On a held-out set: 0.91 AUC. Not a diagnosis tool — a queue-ordering aid.',
    repoUrl: 'https://github.com/nec-demo/mediscan-triage',
    owner: priya._id, members: [m(priya, 'Lead · ML'), m(meena, 'Data & evaluation')], mentor: drRamesh._id,
    status: 'published', publishedAt: daysAgo(60), review: { submittedAt: daysAgo(61), reviewedAt: daysAgo(60), reviewedBy: drRamesh._id },
  });

  // ---- 4. Waiting for Dr. Ramesh in the approval queue (not public) ----
  const queued = await Project.create({
    title: 'Hostel Mess Feedback Bot', tagline: 'Rate today\'s mess food on WhatsApp in 10 seconds; the warden sees trends by dish.',
    department: 'IT', year: 3, theme: 'Smart campus', category: 'software', stage: 'prototype',
    problem: 'Mess complaints arrive as long WhatsApp arguments; nobody can tell which dish or day is the real problem.',
    solution: 'A WhatsApp bot asks one question after each meal; answers land in MongoDB and a dashboard shows ratings by dish and day.',
    repoUrl: 'https://github.com/nec-demo/mess-feedback-bot',
    owner: karthik._id, members: [m(karthik, 'Lead')], mentor: drRamesh._id,
    status: 'in_review', review: { submittedAt: daysAgo(1) },
  });

  // ---- Repo snapshots (fixtures) ----
  const specs = [
    [bus, {
      owner: 'nec-demo', name: 'campusbus-live', logins: ['arun-k-dev', 'karthikm', 'arun-k-dev'], commits: 86, days: 70, stars: 12,
      topics: ['mern', 'pwa', 'gps'], languages: { JavaScript: 182000, CSS: 21000, HTML: 3000 },
      stack: ['Express', 'Leaflet', 'MongoDB', 'Node.js', 'React', 'Socket.IO', 'Vite'], skipped: 1240,
      files: ['server/server.js', 'server/controllers/busController.js', 'server/models/Bus.js', 'server/sockets/gps.js',
        'client/src/pages/RouteMap.jsx', 'client/src/pages/DriverApp.jsx', 'client/src/api/axios.js', 'README.md'],
    }],
    [krishi, {
      owner: 'nec-demo', name: 'krishimitra-drip', logins: ['divya-iot', 'sureshp', 'divya-iot', 'vigneshtech'], commits: 140, days: 45, stars: 21,
      topics: ['iot', 'esp32', 'agritech', 'sih2026'], languages: { 'C++': 64000, Dart: 98000, Python: 8000 },
      stack: ['Arduino', 'Flutter', 'MQTT', 'PlatformIO'], skipped: 310,
      files: ['firmware/src/main.cpp', 'firmware/src/valve.cpp', 'firmware/platformio.ini', 'app/lib/main.dart',
        'app/lib/screens/beds.dart', 'app/lib/mqtt_service.dart', 'tools/calibrate.py', 'README.md'],
      secretWarnings: [{ path: 'firmware/src/secrets.h', line: 3, type: 'Hard-coded secret', preview: 'mqtt****' }],
    }],
    [medi, {
      owner: 'nec-demo', name: 'mediscan-triage', logins: ['priya-codes', 'meena-ai'], commits: 64, days: 90, stars: 9,
      topics: ['deep-learning', 'healthcare'], languages: { Python: 75000, 'Jupyter Notebook': 410000, HTML: 4000 },
      stack: ['Flask', 'Jupyter', 'NumPy', 'Python', 'TensorFlow'], skipped: 52,
      files: ['app.py', 'model/train.py', 'model/gradcam.py', 'notebooks/eda.ipynb', 'templates/queue.html', 'requirements.txt', 'README.md'],
    }],
    [queued, {
      owner: 'nec-demo', name: 'mess-feedback-bot', logins: ['karthikm'], commits: 23, days: 20, stars: 2,
      topics: ['whatsapp-bot'], languages: { JavaScript: 34000 },
      stack: ['Express', 'MongoDB', 'Node.js'], skipped: 610,
      // Demo for the duplicate check: 7 of its 10 files are byte-identical to CampusBus Live
      files: ['index.js', 'bot/flows.js', 'README.md', 'server/server.js', 'server/controllers/busController.js', 'server/models/Bus.js',
        'server/sockets/gps.js', 'client/src/pages/RouteMap.jsx', 'client/src/pages/DriverApp.jsx', 'client/src/api/axios.js'],
      copiedFrom: 'campusbus-live',
      copied: ['server/server.js', 'server/controllers/busController.js', 'server/models/Bus.js', 'server/sockets/gps.js',
        'client/src/pages/RouteMap.jsx', 'client/src/pages/DriverApp.jsx', 'client/src/api/axios.js'],
    }],
  ];
  for (const [project, spec] of specs) {
    await project.populate('members.user', 'githubUsername');
    const snap = await RepoSnapshot.create(snapshotFor(project, project.members, spec));
    await summarise(project, snap);
  }
  for (const snap of await RepoSnapshot.find()) await checkDuplicates(snap);

  // ---- Views over the last 10 days (drives the Trending tab) ----
  const views = [[bus, 40], [krishi, 25], [medi, 6]];
  const rows = [];
  for (const [p, perDay] of views) {
    for (let d = 0; d < 10; d++) {
      const date = daysAgo(d);
      date.setUTCHours(0, 0, 0, 0);
      rows.push({ project: p._id, date, views: Math.round(perDay * (0.6 + rand() * 0.8)) });
    }
  }
  await MetricDaily.insertMany(rows);
  for (const [p] of views) {
    const total = rows.filter((r) => String(r.project) === String(p._id)).reduce((s, r) => s + r.views, 0);
    await Project.updateOne({ _id: p._id }, { 'counts.views': total });
  }

  // ---- P1: backers, follows, offers, comments, updates ----
  const everyone = [...students, ...crowd];
  const onTeam = (p, u) => p.members.some((m) => String(m.user?._id || m.user) === String(u._id));
  const backRows = [];
  for (const [p, n] of [[bus, 12], [krishi, 9], [medi, 4]]) {
    everyone.filter((u) => !onTeam(p, u)).slice(0, n)
      .forEach((u, i) => backRows.push({ project: p._id, user: u._id, type: 'back', fromCollege: true, createdAt: daysAgo(i % 9) }));
  }
  await Backing.insertMany([
    ...backRows,
    { project: krishi._id, user: drRamesh._id, type: 'back', fromCollege: true },
    { project: krishi._id, user: drRamesh._id, type: 'mentor', note: 'Happy to review the MQTT reliability design before the SIH finals.' },
    { project: bus._id, user: drLakshmi._id, type: 'pilot', status: 'confirmed', note: 'Transport office: pilot on all 32 buses for the odd semester.' },
    { project: medi._id, user: karthik._id, type: 'pilot', status: 'pending', note: 'College health centre wants to try it at the weekly X-ray camps.' },
  ]);
  const follows = [];
  for (const [p, from, to] of [[bus, 0, 10], [krishi, 3, 9], [medi, 5, 8]]) {
    everyone.slice(from, to).filter((u) => !onTeam(p, u)).forEach((u) => follows.push({ project: p._id, user: u._id }));
  }
  await Follow.insertMany(follows);

  const question = await Comment.create({ project: krishi._id, user: crowd[2]._id, body: 'Does it still work when the mobile network drops in the field?', createdAt: daysAgo(3) });
  await Comment.create([
    { project: krishi._id, user: divya._id, parent: question._id, body: 'Yes. The ESP32 keeps the last threshold and runs offline; the app syncs when it reconnects.', createdAt: daysAgo(2) },
    { project: krishi._id, user: drRamesh._id, body: 'Strong field data. Add the water-meter readings to the impact section.', createdAt: daysAgo(1) },
    { project: bus._id, user: crowd[0]._id, body: 'Used it this morning on route 7, the ETA was spot on!', createdAt: daysAgo(2) },
    { project: bus._id, user: crowd[5]._id, body: 'buy cheap followers at spam-link dot com', reports: [crowd[1]._id], createdAt: daysAgo(1) },
    { project: medi._id, user: crowd[3]._id, body: 'Which dataset did you fine-tune on, and how did you handle class imbalance?', createdAt: daysAgo(6) },
  ]);

  await Update.create([
    { project: bus._id, author: arun._id, title: 'Live on 4 routes', body: 'Transport office approved a 2-week pilot. Wait time at stops dropped from 24 to 7 minutes.', createdAt: daysAgo(4) },
    { project: bus._id, author: karthik._id, title: 'Offline map tiles', body: 'The PWA now caches route maps, so it works in the dead zone near the hostel.', createdAt: daysAgo(12) },
    { project: krishi._id, author: divya._id, title: 'SIH 2026: through to the finals', body: 'Grand finale in December. Working on the SMS fallback next.', createdAt: daysAgo(20) },
    { project: medi._id, author: priya._id, title: 'Grad-CAM heat maps added', createdAt: daysAgo(75) },
  ]);

  // Counters from the rows above
  for (const p of [bus, krishi, medi, queued]) {
    const [backers, followers, comments, updates] = await Promise.all([
      Backing.countDocuments({ project: p._id, type: 'back' }),
      Follow.countDocuments({ project: p._id }),
      Comment.countDocuments({ project: p._id, hidden: false, deleted: false }),
      Update.countDocuments({ project: p._id }),
    ]);
    await Project.updateOne({ _id: p._id }, { $set: {
      'counts.backers': backers, 'counts.backersCollege': backers, 'counts.backersPublic': 0,
      'counts.followers': followers, 'counts.comments': comments, 'counts.updates': updates,
    } });
  }

  // 30 days of live checks for CampusBus: 29 up, 1 down
  for (let d = 0; d < 30; d++) {
    const date = daysAgo(d);
    date.setUTCHours(0, 0, 0, 0);
    await MetricDaily.updateOne({ project: bus._id, date }, { $set: { uptimeOk: d !== 11, status: d !== 11 ? 200 : 503 } }, { upsert: true });
  }
  await Project.updateOne({ _id: bus._id }, { $set: { live: { checkedAt: new Date(), ok: true, status: 200 } } });

  // ---- P2: Lotus checks (demo data from the MOCK — labelled [MOCK] everywhere) ----
  const ANSWER = {
    long: (q) => `In ${q.filePath} the code handles this step: it validates the input, calls the model layer and returns JSON. `
      + 'To change it I would add a parameter, update the query and write a test for the new case. '
      + 'The trade-off is an extra database round trip, which I would cache for 60 seconds.',
    short: (q) => `It is in ${q.filePath}; it handles the request.`,
  };
  const lotusFor = async (project, student, { answered, style, viva }) => {
    await project.populate('members.user', 'githubUsername');
    const snap = await RepoSnapshot.findOne({ project: project._id });
    const stats = snap.memberStats.find((m) => String(m.user) === String(student._id));
    const gen = lotusMock.questions({ repo: { tree: snap.tree.map((f) => f.path), memberFiles: stats?.files || [] } });
    const set = await LotusSet.create({
      project: project._id, user: student._id, snapshotSha: snap.sha, externalId: gen.setId, status: 'ready', mock: true,
      generatedAt: daysAgo(6), questions: gen.questions.map((q) => ({ qid: q.id, petal: q.petal, level: q.level, text: q.text, filePath: q.filePath })),
    });
    const answers = set.questions.map((q, i) => ({ qid: q.qid, answer: i < answered ? ANSWER[typeof style === 'function' ? style(i) : style](q) : '' }));
    if (answered === 0) { await LotusAttempt.create({ set: set._id, project: project._id, user: student._id, answers }); return; }
    const { scores } = lotusMock.scores({ answers: answers.map((a) => ({ questionId: a.qid, answer: a.answer })) });
    answers.forEach((a, i) => { a.aiScore = scores[i].score; a.aiFeedback = scores[i].feedback; });
    await LotusAttempt.create({
      set: set._id, project: project._id, user: student._id, answers, status: 'scored', submittedAt: daysAgo(5), scoredAt: daysAgo(5),
      summary: LotusAttempt.summarise(set.questions, answers),
      viva: viva ? { done: true, by: viva._id, at: daysAgo(2), note: 'Clear on the data flow; revisit indexing.' } : { done: false },
    });
  };
  await lotusFor(bus, arun, { answered: 24, style: 'long', viva: drRamesh });                          // 8/8, Verified
  await lotusFor(bus, karthik, { answered: 18, style: (i) => (i % 3 ? 'long' : 'short') });             // partial, no viva yet
  await lotusFor(krishi, divya, { answered: 24, style: (i) => (i % 4 ? 'long' : 'short'), viva: drLakshmi });
  await lotusFor(krishi, suresh, { answered: 0, style: 'long' });                                       // started, not submitted
  await lotusFor(medi, priya, { answered: 20, style: 'long' });

  // ---- P2: a recruiter (invited by the placement cell) and one intro request ----
  const recruiter = await User.create({
    name: 'Meera Iyer', email: 'meera.iyer@kaveri-labs.example', password: 'recruiter123', role: 'recruiter', verified: true,
    profile: { company: 'Kaveri Software Labs (demo)' },
  });
  await IntroRequest.create([
    { from: recruiter._id, student: arun._id, project: bus._id, purpose: 'internship', message: 'Summer internship on our logistics team (Chennai, 8 weeks). Liked the live GPS work and the viva result.' },
    { from: recruiter._id, project: krishi._id, purpose: 'pilot', message: 'Our agri client in Erode may pilot this on 5 acres.', status: 'forwarded', placementNote: 'Team informed; faculty mentor will join the first call.' },
  ]);

  // ---- Likes (visitors via shared links + students) and feedback / requests ----
  const visitorLikes = { [bus._id]: 41, [krishi._id]: 27, [medi._id]: 9 };
  const likeRows = [];
  for (const p of [bus, krishi, medi]) {
    for (let i = 0; i < visitorLikes[p._id]; i++) likeRows.push({ project: p._id, visitor: crypto.createHash('sha256').update(`demo-${p.slug}-${i}`).digest('hex') });
    crowd.slice(0, 4).forEach((u) => likeRows.push({ project: p._id, user: u._id }));
  }
  await Like.insertMany(likeRows);
  for (const p of [bus, krishi, medi]) await Project.updateOne({ _id: p._id }, { $set: { 'counts.likes': await Like.countDocuments({ project: p._id }) } });

  const visitor = (name, email, phone, relation, organisation) => ({ name, email, phone, relation, organisation });
  await Feedback.create([
    { project: krishi._id, kind: 'feedback', status: 'delivered', rating: 5, createdAt: daysAgo(2),
      from: { user: crowd[1]._id, name: crowd[1].name, email: crowd[1].email, relation: 'classmate' },
      message: 'Loved the field trial numbers. The Flutter app could show a weekly water-saved chart so farmers see the benefit.',
      check: { verdict: 'pass', reasons: [] } },
    { project: krishi._id, kind: 'feedback', status: 'delivered', rating: 4, createdAt: daysAgo(1),
      from: visitor('Selvi R', 'selvi.r@example.com', '9876500011', 'visitor'),
      message: 'My father farms turmeric near Bhavani. The valve idea is great — is there an SMS mode for when mobile data is weak?',
      check: { verdict: 'pass', reasons: [] } },
    { project: krishi._id, kind: 'request', status: 'delivered', createdAt: daysAgo(3),
      from: visitor('Prakash M', 'prakash@greenrow-demo.example', '9876500022', 'industry', 'GreenRow Agro (demo)'),
      message: 'We need a similar drip controller for 12 acres of banana with 4 zones. Can your team build a custom version? Pilot in January.',
      request: { timeline: '3 months', budget: '₹1–1.5 lakh' },
      check: { verdict: 'pass', reasons: [] },
      thread: [{ by: 'team', user: divya._id, body: 'Thank you! Four zones is doable with one ESP32 per two zones. Could you share the pump rating and water source?', at: daysAgo(2) }] },
    { project: bus._id, kind: 'feedback', status: 'delivered', rating: 5, createdAt: daysAgo(1),
      from: { user: crowd[4]._id, name: crowd[4].name, email: crowd[4].email, relation: 'classmate' },
      message: 'Route 7 ETA was spot on this week. Please add a dark mode for the evening buses.',
      check: { verdict: 'pass', reasons: [] } },
    { project: bus._id, kind: 'feedback', status: 'held', createdAt: daysAgo(0),
      from: visitor('Unknown', 'someone@example.com', '9876500033', 'visitor'),
      message: 'Hello there how are you doing today friend',
      check: { verdict: 'hold', reasons: ['Doesn\'t seem to be about this project'] } },
  ]);

  for (const p of [bus, krishi, medi]) await recompute(p._id);

  // ---- A few notes so the starter's admin dashboard still has data ----
  await Note.create(students.slice(0, 3).map((s) => ({ user: s._id, title: `${s.name}'s demo-day checklist`, tags: ['project'] })));

  console.log(`Seeded on @${DOMAIN}:
  admin    ${mail('innovationlab.admin')} / admin123
  faculty  ${mail('ramesh.cse')}, ${mail('lakshmi.ece')} / faculty123
  students ${mail('arun.k')}, ${mail('priya.s')}, ${mail('karthik.m')}, ${mail('divya.r')}… / student123
  3 published projects + 1 waiting in Dr. Ramesh's review queue
  P1: backers, follows, comments (1 reported), updates, 1 pending pilot, Lab Scores computed
  P2: Lotus (mock) for 5 students, 2 vivas; recruiter meera.iyer@kaveri-labs.example / recruiter123;
      2 intro requests; the queued project is flagged as 70% identical to CampusBus Live
  Likes on all 3; 4 feedback + 1 project request (with a reply) delivered; 1 message held for moderation`);
  process.exit(0);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
