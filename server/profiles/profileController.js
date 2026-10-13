// ---------------------------------------------------------------
// People: public student profile (/u/:handle, the URL behind the
// resume QR) plus two small lookups the project wizard needs.
// Never returns email, phone or roll number publicly.
// ---------------------------------------------------------------
const User = require('../models/User');
const Project = require('../projects/Project');

const CARD_FIELDS = 'title slug tagline thumbnail stage category department year publishedAt counts repo.stack liveUrl members';

// GET /api/profiles/:handle  — public, no login
exports.profile = async (req, res) => {
  const user = await User.findOne({ handle: String(req.params.handle).toLowerCase() })
    .select(User.PUBLIC_FIELDS + ' createdAt')
    .lean();
  if (!user || user.role === 'admin') return res.status(404).json({ message: 'Profile not found' });

  const filter = user.role === 'faculty'
    ? { mentor: user._id, status: 'published' }
    : { 'members.user': user._id, status: 'published' };
  const projects = await Project.find(filter)
    .sort({ publishedAt: -1 })
    .select(CARD_FIELDS)
    .populate('members.user', 'name handle')
    .lean();

  // My role on each project ("Lead", "Frontend"…)
  projects.forEach((p) => {
    p.myRole = p.members.find((m) => String(m.user?._id) === String(user._id))?.role;
  });
  res.json({ user, projects });
};

// GET /api/users/lookup?email=  — wizard: add a teammate by college email (exact match only)
exports.lookup = async (req, res) => {
  const email = String(req.query.email || '').toLowerCase().trim();
  if (!User.isCollegeEmail(email)) return res.status(400).json({ message: 'Enter a college email' });
  const user = await User.findOne({ email, role: 'student' }).select('name handle githubUsername').lean();
  if (!user) return res.status(404).json({ message: 'No student with that email has signed up yet' });
  res.json(user);
};

// GET /api/users/mentors  — faculty list for the mentor picker
exports.mentors = async (req, res) => {
  const mentors = await User.find({ role: 'faculty' })
    .sort({ 'profile.department': 1, name: 1 })
    .select('name handle profile.department')
    .lean();
  res.json(mentors);
};
