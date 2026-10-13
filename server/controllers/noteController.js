const Note = require('../models/Note');

// POST /api/notes
exports.createNote = async (req, res) => {
  const note = await Note.create({ ...req.body, user: req.user._id });
  res.status(201).json(note);
};

// GET /api/notes
// Lesson: NOT "select *". Filter, sort, project, paginate — always.
exports.getMyNotes = async (req, res) => {
  const { tag, priority, page = 1, limit = 10 } = req.query;

  const filter = { user: req.user._id };
  if (tag) filter.tags = tag;                        // match inside an array
  if (priority) filter['meta.priority'] = priority;  // match inside nested JSON

  const notes = await Note.find(filter)
    .sort({ 'meta.pinned': -1, updatedAt: -1 })      // pinned first, newest next
    .skip((page - 1) * limit)
    .limit(Number(limit))
    .select('title tags meta updatedAt');            // projection — only what UI needs

  const total = await Note.countDocuments(filter);
  res.json({ notes, total, page: Number(page), pages: Math.ceil(total / limit) });
};

// GET /api/notes/:id
exports.getNote = async (req, res) => {
  const note = await Note.findOne({ _id: req.params.id, user: req.user._id });
  if (!note) return res.status(404).json({ message: 'Note not found' });
  res.json(note);
};

// PUT /api/notes/:id
exports.updateNote = async (req, res) => {
  const note = await Note.findOneAndUpdate(
    { _id: req.params.id, user: req.user._id },   // ownership check in the query itself
    req.body,
    { new: true, runValidators: true }
  );
  if (!note) return res.status(404).json({ message: 'Note not found' });
  res.json(note);
};

// DELETE /api/notes/:id
exports.deleteNote = async (req, res) => {
  const note = await Note.findOneAndDelete({ _id: req.params.id, user: req.user._id });
  if (!note) return res.status(404).json({ message: 'Note not found' });
  res.json({ message: 'Deleted' });
};

// GET /api/notes/stats/by-tag
// First taste of the aggregation pipeline: $unwind + $group
exports.myTagStats = async (req, res) => {
  const stats = await Note.aggregate([
    { $match: { user: req.user._id } },
    { $unwind: '$tags' },                                  // one row per tag
    { $group: { _id: '$tags', count: { $sum: 1 } } },      // GROUP BY tag
    { $sort: { count: -1 } },
    { $limit: 10 },
  ]);
  res.json(stats);
};
