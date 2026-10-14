// ---------------------------------------------------------------
// First-run app tour, one script per role. A step can:
//   route   go to this page first
//   target  CSS selector to spotlight (use data-tour="…" attributes)
//   menu    the target lives in the nav — on phones open the menu
// No target (or not found) = a centred card.
// Bump TOUR_VERSION when the steps change enough to show everyone again.
// ---------------------------------------------------------------
export const TOUR_VERSION = 1;

// "Dr. S. Lakshmi" -> "Lakshmi", "Arun Kumar" -> "Arun": skip titles and initials
const first = (user) => (user?.name || '').split(/\s+/)
  .find((w) => !/^(dr|prof|mr|mrs|ms|er)\.?$/i.test(w) && w.replace(/\./g, '').length > 1) || 'there';
const t = (name) => `[data-tour="${name}"]`;

const finish = {
  emoji: '🎉',
  title: 'You\'re all set!',
  body: 'Replay this tour any time with the ? button. Got stuck? Ask your mentor or the student tech club.',
  target: t('tour-fab'),
};

const STUDENT = (user) => [
  { emoji: '🪷', title: `Welcome, ${first(user)}!`,
    body: 'NEC Innovation Lab is where Nandha students launch projects — on the college\'s own domain, verified by the college. Here\'s a one-minute tour.' },
  { route: '/', target: t('feed-tabs'), title: 'See what others built',
    body: 'New launches and Trending this week. Open any card for the full launch page — like it, back it, follow it, comment.' },
  { target: t('nav-launch'), menu: true, title: 'Launch your project',
    body: 'Six short steps: basics, story, links & photos, team & mentor, GitHub import, submit. About 10 minutes — it saves as you go.' },
  { route: '/me/projects', target: t('my-projects'), title: 'Track your projects',
    body: 'Draft → In review → Published. Your faculty mentor approves before anything goes public; their notes show up here.' },
  { emoji: '🧠', title: 'The Lotus check',
    body: 'After your GitHub import, open your project page and tap "Take your Lotus check": 24 questions about your own code. A short faculty viva then earns the ✔ Verified badge recruiters look for.' },
  { target: t('nav-inbox'), menu: true, title: 'Likes, feedback & requests',
    body: 'Share your project link on WhatsApp — anyone can like it and send feedback, even companies asking for a project like yours. Messages are checked first, then land here. Reply without sharing your number.' },
  { target: t('nav-profile'), menu: true, title: 'Your profile + QR',
    body: 'One public link for your resume, with a QR code. Recruiters reach you through the placement cell — never directly.' },
  { target: t('nav-leaderboards'), menu: true, title: 'Leaderboards',
    body: 'Lab Score, most backed, best Lotus… every score shows exactly how it is calculated, so you know what to improve.' },
  finish,
];

const FACULTY = (user) => [
  { emoji: '🎓', title: `Welcome, ${first(user)}!`,
    body: 'As a mentor you decide what goes public and you run the viva that makes a student "Verified". Quick tour.' },
  { route: '/review', target: t('review-tab-approvals'), title: 'Approve launches',
    body: 'Projects where you are the mentor wait here. Approve to publish, or send back with a note. The copy check flags projects that look duplicated — only you and admins see it.' },
  { route: '/review', target: t('review-tab-viva'), title: 'Lotus & viva',
    body: 'Read each student\'s Lotus answers (private to you and them), adjust any score, then mark the viva done after a short chat.' },
  { target: t('nav-talent'), menu: true, title: 'Talent view',
    body: 'See students by stack and Lotus strength — handy for recommending them to companies.' },
  { target: t('nav-profile'), menu: true, title: 'Your mentor profile', body: 'Lists every project you mentor, on one public page.' },
  finish,
];

const RECRUITER = (user) => [
  { emoji: '🤝', title: `Welcome, ${first(user)}!`,
    body: 'Every student here signed in with a college email, has code pulled from GitHub by the college, and may be faculty-verified. Quick tour.' },
  { route: '/talent', target: t('talent-filters'), title: 'Find talent',
    body: 'Filter by stack, stage, department, Lotus petals (understanding of their own code) and viva-verified.' },
  { route: '/talent', target: `${t('talent-results')} > .talent-card:first-child`, title: 'Request an intro',
    body: 'Tap "Request intro" on a student. The placement cell reviews it and connects you — contact details are never shared directly.' },
  { target: t('nav-requests'), menu: true, title: 'Track your requests', body: 'See each request\'s status and the placement cell\'s notes.' },
  { route: '/', target: t('feed-tabs'), title: 'Browse projects',
    body: 'Like a project, or use "Need one like this?" on its page to ask the team to build something for you.' },
  finish,
];

const ADMIN = (user) => [
  { emoji: '🛠', title: `Welcome, ${first(user)}!`, body: 'Here\'s where you run the portal.' },
  { route: '/admin', target: t('admin-links'), title: 'Admin tools',
    body: 'People & roles (promote faculty, verify students, invite recruiters), Lab Score weights, intro requests, and feedback moderation.' },
  { target: t('nav-review'), menu: true, title: 'Review queue', body: 'Admins can approve any project and open viva mode for any team.' },
  { route: '/admin/moderation', target: t('moderation-tabs'), title: 'Moderation',
    body: 'Feedback the content check held back (off-topic, links, insults, Tamil text) waits here. Deliver or reject.' },
  finish,
];

export const stepsFor = (user) =>
  ({ student: STUDENT, faculty: FACULTY, recruiter: RECRUITER, admin: ADMIN }[user?.role] || STUDENT)(user);
