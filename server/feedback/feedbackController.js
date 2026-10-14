// ---------------------------------------------------------------
// Likes, feedback and project requests — open to anyone with the link.
//
// Visitors (no account): name + email + mobile, and the email is proved
// with a 6-digit code before anything is accepted. Classmates and other
// signed-in users skip the code — their college account is enough.
// Every message passes the content check first; only clean messages
// reach the team (and the owner's inbox by email). Contacts stay with
// the portal: students reply on the site, the portal emails the sender.
// ---------------------------------------------------------------
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const Project = require('../projects/Project');
const User = require('../models/User');
const Like = require('./Like');
const EmailCode = require('./EmailCode');
const Feedback = require('./Feedback');
const { checkMessage, checkContact } = require('../moderation/contentCheck');
const { send, sendSoon, isConfigured: mailConfigured } = require('../services/mailer');
const { hit } = require('../utils/rateLimit');
const { clientUrl } = require('../controllers/authController');
const { recomputeSoon } = require('../score/labScore');

const fail = (status, message, extra) => Object.assign(new Error(message), { status, ...extra });
const secret = () => process.env.JWT_SECRET;
const sha = (s) => crypto.createHash('sha256').update(`${s}|${secret()}`).digest('hex');
const visitorKey = (req) => sha(`${req.ip}|${req.headers['user-agent'] || ''}`);
// Per-IP limits are generous: a whole campus often shares ONE public IP (NAT).
// The per-email / per-user limits do the real work.
const limit = (name, key, max, windowMs, message) => {
  if (!hit(name, key, max, windowMs).ok) throw fail(429, message || 'Too many attempts. Try again later.');
};

const publishedProject = async (id) => {
  const project = await Project.findOne({ _id: id, status: 'published' }).populate('owner', 'name email');
  if (!project) throw fail(404, 'Project not found');
  return project;
};

// ========================= likes =========================

// POST /api/projects/:id/like — toggle. Anyone, account or not.
exports.toggleLike = async (req, res) => {
  limit('like', req.ip, 300, 3600e3, 'Too many likes from this network — try later');
  const project = await publishedProject(req.params.id);
  const who = req.user ? { user: req.user._id } : { visitor: visitorKey(req) };
  const existing = await Like.findOneAndDelete({ project: project._id, ...who });
  if (!existing) await Like.create({ project: project._id, ...who }).catch((e) => { if (e.code !== 11000) throw e; });
  const likes = await Like.countDocuments({ project: project._id });
  await Project.updateOne({ _id: project._id }, { $set: { 'counts.likes': likes } });
  recomputeSoon(project._id);
  res.json({ liked: !existing, likes });
};

exports.hasLiked = async (req, projectId) =>
  !!(await Like.exists({ project: projectId, ...(req.user ? { user: req.user._id } : { visitor: visitorKey(req) }) }));

// ========================= visitor email check =========================

// POST /api/visitor/email-code   { name, email, phone }
exports.sendCode = async (req, res) => {
  const errors = checkContact(req.body);
  if (errors.length) throw fail(400, errors.join('. '), { errors });
  const email = String(req.body.email).trim().toLowerCase();
  limit('code-ip', req.ip, 40, 3600e3, 'Too many codes from this network — try again in an hour');
  limit('code-email', email, 3, 3600e3, 'We already sent 3 codes to this email — check your inbox (and spam) or try in an hour');

  const code = await EmailCode.issue(email);
  await send({
    to: email,
    subject: `Your NEC Innovation Lab code: ${code}`,
    heading: `Your code is ${code}`,
    paragraphs: [`Hi ${String(req.body.name).trim()}, enter this code on the project page to send your message. It expires in ${EmailCode.TTL_MIN} minutes.`,
      'If you did not ask for this, ignore this email.'],
  });
  const out = { sent: true, minutes: EmailCode.TTL_MIN };
  if (!mailConfigured() && process.env.NODE_ENV !== 'production') out.devCode = code;   // local testing only
  res.json(out);
};

// POST /api/visitor/verify   { email, code } -> { token } (valid 2 h)
exports.verifyCode = async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  limit('verify-ip', req.ip, 100, 3600e3);
  if (!(await EmailCode.verify(email, req.body.code))) throw fail(400, 'That code is wrong or expired');
  res.json({ token: jwt.sign({ typ: 'visitor', email }, secret(), { expiresIn: '2h' }) });
};

// ========================= feedback & requests =========================

const notifyOwner = (project, fb) => {
  if (!project.owner?.email) return;
  const isRequest = fb.kind === 'request';
  const who = [fb.from.name, fb.from.organisation].filter(Boolean).join(', ');
  sendSoon({
    to: project.owner.email,
    subject: isRequest ? `New project request for ${project.title}` : `New feedback on ${project.title}`,
    heading: isRequest ? 'Someone wants a project like yours' : 'You have new feedback',
    paragraphs: [
      `From ${who} (${fb.from.relation})${fb.rating ? ` · rated ${fb.rating}/5` : ''}${isRequest && fb.request?.timeline ? ` · timeline: ${fb.request.timeline}` : ''}.`,
      'Reply on the portal — your email and phone stay private, and so do theirs.',
    ],
    quote: fb.message,
    cta: { label: 'Open your inbox', url: `${clientUrl()}/inbox` },
  });
};

// POST /api/projects/:id/feedback
// body: { kind, message, rating?, relation?, organisation?, timeline?, budget?, name?, email?, phone?, visitorToken? }
exports.submit = async (req, res) => {
  const project = await publishedProject(req.params.id);
  const kind = req.body.kind === 'request' ? 'request' : 'feedback';
  limit('fb-ip', req.ip, 40, 3600e3, 'Too many messages from this network — try again later');

  // Who is writing?
  let from;
  if (req.user) {
    if (project.isMember(req.user._id)) throw fail(400, 'This is your own project');
    const phone = String(req.body.phone || '').trim();
    from = {
      user: req.user._id, name: req.user.name, email: req.user.email, phone: phone || undefined,
      relation: req.user.role === 'faculty' ? 'faculty' : req.user.role === 'recruiter' ? 'industry' : (req.body.relation === 'friend' ? 'friend' : 'classmate'),
      organisation: req.user.profile?.company || undefined,
    };
  } else {
    let claims;
    try { claims = jwt.verify(String(req.body.visitorToken || ''), secret()); } catch { claims = null; }
    const email = String(req.body.email || '').trim().toLowerCase();
    if (claims?.typ !== 'visitor' || claims.email !== email) throw fail(401, 'Verify your email first');
    const errors = checkContact(req.body);
    if (errors.length) throw fail(400, errors.join('. '), { errors });
    const relation = Feedback.RELATIONS.includes(req.body.relation) && !['classmate', 'faculty'].includes(req.body.relation)
      ? req.body.relation : 'visitor';   // "classmate" / "faculty" only via a college account
    from = { name: String(req.body.name).trim(), email, phone: String(req.body.phone).replace(/[\s-]/g, ''), relation,
      organisation: String(req.body.organisation || '').trim() || undefined };
  }
  limit('fb-email', `${from.email}:${kind}`, 10, 864e5, 'You have sent a lot of messages today — try tomorrow');

  const message = String(req.body.message || '').trim();
  const check = checkMessage(message, { kind, project });
  if (check.verdict === 'reject') throw fail(400, check.reasons[0], { reasons: check.reasons });

  const dup = await Feedback.exists({ project: project._id, 'from.email': from.email, message, createdAt: { $gte: new Date(Date.now() - 864e5) } });
  if (dup) throw fail(409, 'You already sent this message');

  const rating = Number(req.body.rating);
  const fb = await Feedback.create({
    project: project._id, kind, from, message,
    rating: kind === 'feedback' && rating >= 1 && rating <= 5 ? Math.round(rating) : undefined,
    request: kind === 'request' ? { timeline: req.body.timeline, budget: req.body.budget } : undefined,
    status: check.verdict === 'pass' ? 'delivered' : 'held',
    check,
    ipHash: sha(req.ip),
  });
  if (fb.status === 'delivered') notifyOwner(project, fb);
  res.status(201).json({
    status: fb.status,
    message: fb.status === 'delivered'
      ? `Sent to the ${project.title} team. ${kind === 'request' ? 'They will reply by email through the portal.' : 'Thank you!'}`
      : 'Thanks — a moderator will take a quick look before the team sees it.',
    reasons: fb.status === 'held' ? check.reasons : undefined,
  });
};

// Public summary for the launch page (no names, no text)
exports.summary = async (projectId) => {
  const [r] = await Feedback.aggregate([
    { $match: { project: projectId, kind: 'feedback', status: 'delivered' } },
    { $group: { _id: null, count: { $sum: 1 }, rated: { $sum: { $cond: [{ $gt: ['$rating', null] }, 1, 0] } }, avg: { $avg: '$rating' } } },
  ]);
  return { count: r?.count || 0, rated: r?.rated || 0, avgRating: r?.avg ? Math.round(r.avg * 10) / 10 : null };
};

// ========================= team inbox =========================

// What students see about a sender: never email or phone
const forTeam = (fb, userId) => ({
  _id: fb._id, kind: fb.kind, project: fb.project, message: fb.message, rating: fb.rating, request: fb.request,
  from: { name: fb.from.name, relation: fb.from.relation, organisation: fb.from.organisation, user: fb.from.user },
  thread: fb.thread.map((p) => ({ _id: p._id, by: p.by, body: p.body, at: p.at, user: p.user })),
  createdAt: fb.createdAt,
  unread: !fb.readBy?.some((u) => String(u) === String(userId)),
});

const myProjectIds = (user) => Project.find({ 'members.user': user._id }).distinct('_id');

// GET /api/inbox?kind=feedback|request
exports.inbox = async (req, res) => {
  const filter = { project: { $in: await myProjectIds(req.user) }, status: 'delivered' };
  if (['feedback', 'request'].includes(req.query.kind)) filter.kind = req.query.kind;
  const items = await Feedback.find(filter).sort({ updatedAt: -1 }).limit(200)
    .populate('project', 'title slug').populate('thread.user', 'name handle').populate('from.user', 'name handle').lean();
  res.json(items.map((fb) => forTeam(fb, req.user._id)));
};

// GET /api/inbox/unread — nav badge
exports.unread = async (req, res) => {
  const n = await Feedback.countDocuments({ project: { $in: await myProjectIds(req.user) }, status: 'delivered', readBy: { $ne: req.user._id } });
  res.json({ unread: n });
};

const teamItem = async (req) => {
  const fb = await Feedback.findById(req.params.id);
  if (!fb || fb.status !== 'delivered') throw fail(404, 'Message not found');
  const project = await Project.findById(fb.project).select('members title slug');
  if (!project.isMember(req.user._id)) throw fail(403, 'Not your project');
  return { fb, project };
};

// POST /api/inbox/:id/read
exports.markRead = async (req, res) => {
  const { fb } = await teamItem(req);
  await Feedback.updateOne({ _id: fb._id }, { $addToSet: { readBy: req.user._id } });
  res.json({ ok: true });
};

const threadLink = (fb) => `${clientUrl()}/messages/${fb._id}?t=${jwt.sign({ typ: 'thread', fid: String(fb._id) }, secret(), { expiresIn: '60d' })}`;

// Replies: same content rules, but no "is it about the project" test, and nothing is held —
// a reply with a link or an insult is simply refused so the writer can fix it.
const checkReply = (body) => {
  const check = checkMessage(body, { kind: 'reply', skipRelevance: true, minLength: 2 });
  if (check.verdict !== 'pass') throw fail(400, check.reasons[0], { reasons: check.reasons });
};

// POST /api/inbox/:id/reply   { body }
exports.reply = async (req, res) => {
  const { fb, project } = await teamItem(req);
  limit('reply-user', String(req.user._id), 30, 3600e3, 'Too many replies — take a break and try later');
  const body = String(req.body.body || '').trim();
  checkReply(body);
  fb.thread.push({ by: 'team', user: req.user._id, body });
  fb.readBy.addToSet(req.user._id);
  await fb.save();
  sendSoon({
    to: fb.from.email,
    subject: `Reply from the ${project.title} team`,
    heading: `${req.user.name} from ${project.title} replied`,
    paragraphs: [`Hi ${fb.from.name}, the team replied to your ${fb.kind === 'request' ? 'project request' : 'feedback'}.`],
    quote: body,
    cta: { label: 'View and reply', url: threadLink(fb) },
    footer: 'Replies go through the NEC Innovation Lab portal so nobody\'s phone or email is shared. This link is private to you.',
  });
  res.json(forTeam(fb.toObject(), req.user._id));
};

// ========================= sender's private thread (link from email) =========================

const senderItem = async (req) => {
  let claims;
  try { claims = jwt.verify(String(req.query.t || ''), secret()); } catch { claims = null; }
  if (claims?.typ !== 'thread' || claims.fid !== req.params.id) throw fail(401, 'This link is invalid or expired');
  const fb = await Feedback.findById(req.params.id).populate('project', 'title slug owner').populate('thread.user', 'name');
  if (!fb || fb.status !== 'delivered') throw fail(404, 'Message not found');
  return fb;
};

const forSender = (fb) => ({
  _id: fb._id, kind: fb.kind, message: fb.message, createdAt: fb.createdAt,
  project: { title: fb.project.title, slug: fb.project.slug },
  name: fb.from.name,
  thread: fb.thread.map((p) => ({ by: p.by, body: p.body, at: p.at, name: p.by === 'team' ? p.user?.name : fb.from.name })),
});

// GET /api/messages/:id?t=…
exports.senderThread = async (req, res) => {
  res.json(forSender(await senderItem(req)));
};

// POST /api/messages/:id/reply?t=…   { body }
exports.senderReply = async (req, res) => {
  const fb = await senderItem(req);
  limit('reply-sender', String(fb._id), 10, 3600e3, 'Too many replies — try later');
  const body = String(req.body.body || '').trim();
  checkReply(body);
  fb.thread.push({ by: 'sender', body });
  fb.readBy = [];   // unread again for the team
  await fb.save();
  const owner = await User.findById(fb.project.owner).select('email');
  if (owner?.email) {
    sendSoon({
      to: owner.email,
      subject: `${fb.from.name} replied about ${fb.project.title}`,
      heading: `New reply from ${fb.from.name}`,
      quote: body,
      cta: { label: 'Open your inbox', url: `${clientUrl()}/inbox` },
    });
  }
  res.json(forSender(fb));
};

// ========================= admin moderation =========================

// GET /api/admin/feedback?status=held
exports.adminList = async (req, res) => {
  const status = ['held', 'delivered', 'rejected'].includes(req.query.status) ? req.query.status : 'held';
  const items = await Feedback.find({ status }).sort({ createdAt: -1 }).limit(200)
    .populate('project', 'title slug').populate('moderatedBy', 'name').lean();
  const counts = await Feedback.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]);
  res.json({ items, counts: Object.fromEntries(counts.map((c) => [c._id, c.n])) });
};

// POST /api/admin/feedback/:id   { action: 'deliver' | 'reject' }
exports.adminDecide = async (req, res) => {
  const fb = await Feedback.findById(req.params.id);
  if (!fb) throw fail(404, 'Message not found');
  if (fb.status !== 'held') throw fail(400, `Already ${fb.status}`);
  fb.status = req.body.action === 'deliver' ? 'delivered' : 'rejected';
  fb.moderatedBy = req.user._id;
  fb.moderatedAt = new Date();
  await fb.save();
  if (fb.status === 'delivered') notifyOwner(await Project.findById(fb.project).populate('owner', 'email'), fb);
  res.json({ status: fb.status });
};
