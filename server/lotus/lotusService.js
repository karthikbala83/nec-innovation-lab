// ---------------------------------------------------------------
// Lotus flow: start (questions) -> answer -> submit (scores) ->
// faculty override + viva. Calls to the Lotus API run in the
// background; the client polls the attempt status.
// ---------------------------------------------------------------
const LotusSet = require('./LotusSet');
const LotusAttempt = require('./LotusAttempt');
const Project = require('../projects/Project');
const RepoSnapshot = require('../projects/RepoSnapshot');
const User = require('../models/User');
const Setting = require('../settings/Setting');
const { generateQuestions, scoreAnswers } = require('../services/lotusClient');
const { isEnvFile } = require('../projects/repoRules');
const { recomputeSoon } = require('../score/labScore');

const fail = (status, message) => Object.assign(new Error(message), { status });
const MAX_QUESTIONS = 30;

// Keep only questions that are well-formed and cite a real file (spec §7)
const validateQuestions = (questions, treePaths) => {
  const paths = new Set(treePaths);
  const seen = new Set();
  const kept = [];
  for (const q of questions || []) {
    const qid = String(q.id ?? q.qid ?? '');
    const ok = qid && !seen.has(qid)
      && Number.isInteger(q.petal) && q.petal >= 1 && q.petal <= 8
      && Number.isInteger(q.level) && q.level >= 1 && q.level <= 3
      && typeof q.text === 'string' && q.text.trim()
      && paths.has(q.filePath);
    if (!ok) continue;
    seen.add(qid);
    kept.push({ qid, petal: q.petal, level: q.level, text: q.text.trim().slice(0, 2000), filePath: q.filePath });
    if (kept.length >= MAX_QUESTIONS) break;
  }
  return { kept, dropped: (questions || []).length - kept.length };
};

// What we send to Saravonix: repo coordinates + file lists. No names, emails or roll numbers.
const buildPayload = (set, project, snapshot, user) => {
  const stats = (snapshot.memberStats || []).find((s) => String(s.user) === String(user._id));
  return {
    ref: String(set._id),
    student: { ref: String(user._id), githubUsername: user.githubUsername || stats?.githubUsername || null },
    project: {
      ref: String(project._id), title: project.title, tagline: project.tagline, problem: project.problem,
      solution: project.solution, category: project.category, stack: snapshot.stack, liveUrl: project.liveUrl || null,
    },
    repo: {
      owner: snapshot.owner, name: snapshot.name, sha: snapshot.sha,
      tree: snapshot.tree.map((f) => f.path),
      keyFiles: (snapshot.keyFiles || []).filter((f) => !isEnvFile(f.path)),
      memberFiles: stats?.files || [],   // weight questions toward what this student committed
    },
  };
};

const runGenerate = async (setId) => {
  const set = await LotusSet.findById(setId);
  try {
    const [project, snapshot, user] = await Promise.all([
      Project.findById(set.project), RepoSnapshot.findOne({ project: set.project }), User.findById(set.user),
    ]);
    const result = await generateQuestions(buildPayload(set, project, snapshot, user));
    const { kept, dropped } = validateQuestions(result.questions, snapshot.tree.map((f) => f.path));
    if (!kept.length) throw new Error('Lotus returned no usable questions');
    Object.assign(set, {
      questions: kept, dropped, externalId: result.setId, mock: !!result.mock,
      status: 'ready', generatedAt: new Date(), error: undefined,
    });
    await set.save();
    await LotusAttempt.create({ set: set._id, project: set.project, user: set.user, answers: kept.map((q) => ({ qid: q.qid })) });
  } catch (err) {
    set.status = 'failed';
    set.error = err.message.slice(0, 300);
    await set.save();
  }
};

// POST start: one active set per student per project
const start = async (projectId, user) => {
  const project = await Project.findById(projectId);
  if (!project) throw fail(404, 'Project not found');
  if (!project.isMember(user._id)) throw fail(403, 'Only team members take the Lotus check for this project');
  const snapshot = await RepoSnapshot.findOne({ project: project._id }).select('sha tree');
  if (!snapshot?.tree?.length) throw fail(400, 'Import your GitHub repo first — questions are built from your code');

  const existing = await LotusSet.findOne({ project: project._id, user: user._id, active: true });
  if (existing && existing.status !== 'failed') throw fail(409, 'You already have a Lotus check for this project');
  if (existing) { existing.active = false; await existing.save(); }   // retry after a failure

  await Setting.useLotusQuota('generated');
  const set = await LotusSet.create({ project: project._id, user: user._id, snapshotSha: snapshot.sha });
  runGenerate(set._id);   // background; client polls
  return set;
};

const runScoring = async (attemptId) => {
  const attempt = await LotusAttempt.findById(attemptId);
  const set = await LotusSet.findById(attempt.set);
  try {
    const { scores } = await scoreAnswers({
      setId: set.externalId,
      answers: attempt.answers.map((a) => ({ questionId: a.qid, answer: a.answer })),
    });
    const byQ = new Map(scores.map((s) => [String(s.questionId), s]));
    attempt.answers.forEach((a) => {
      const s = byQ.get(a.qid);
      const score = Number(s?.score);
      a.aiScore = Number.isInteger(score) && score >= 0 && score <= 3 ? score : 0;
      a.aiFeedback = String(s?.feedback || '').slice(0, 500);
    });
    attempt.summary = LotusAttempt.summarise(set.questions, attempt.answers);
    attempt.status = 'scored';
    attempt.scoredAt = new Date();
    attempt.error = undefined;
    await attempt.save();
    recomputeSoon(attempt.project);
  } catch (err) {
    attempt.status = 'failed';
    attempt.error = err.message.slice(0, 300);
    await attempt.save();
  }
};

// Student saves draft answers (only while in progress)
const saveAnswers = async (attempt, answers) => {
  if (attempt.status !== 'in_progress') throw fail(400, 'Answers are already submitted');
  const byQ = new Map((answers || []).map((a) => [String(a.qid), String(a.answer ?? '')]));
  attempt.answers.forEach((a) => { if (byQ.has(a.qid)) a.answer = byQ.get(a.qid).slice(0, 3000); });
  await attempt.save();
  return attempt;
};

// Submit for scoring (also used to retry a failed scoring)
const submit = async (attempt) => {
  if (!['in_progress', 'failed'].includes(attempt.status)) throw fail(400, 'Already submitted');
  if (!attempt.answers.some((a) => a.answer.trim())) throw fail(400, 'Answer at least one question first');
  await Setting.useLotusQuota('scored');
  attempt.status = 'scoring';
  attempt.submittedAt = attempt.submittedAt || new Date();
  await attempt.save();
  runScoring(attempt._id);   // background; client polls
  return attempt;
};

// Faculty: override one question's score
const override = async (attempt, { qid, score, note }) => {
  if (attempt.status !== 'scored') throw fail(400, 'Wait until the answers are scored');
  const a = attempt.answers.find((x) => x.qid === qid);
  if (!a) throw fail(404, 'Question not found');
  if (score === null || score === '') { a.mentorScore = undefined; a.mentorNote = undefined; }
  else {
    const n = Number(score);
    if (!Number.isInteger(n) || n < 0 || n > 3) throw fail(400, 'Score must be 0, 1, 2 or 3');
    a.mentorScore = n;
    a.mentorNote = String(note || '').slice(0, 500) || undefined;
  }
  const set = await LotusSet.findById(attempt.set).select('questions');
  attempt.summary = LotusAttempt.summarise(set.questions, attempt.answers);
  await attempt.save();
  recomputeSoon(attempt.project);
  return attempt;
};

// Faculty: mark viva done / undo
const setViva = async (attempt, { done, note }, faculty) => {
  if (done && attempt.status !== 'scored') throw fail(400, 'Score the written answers before the viva');
  attempt.viva = done
    ? { done: true, by: faculty._id, at: new Date(), note: String(note || '').slice(0, 1000) || undefined }
    : { done: false };
  await attempt.save();
  recomputeSoon(attempt.project);
  return attempt;
};

// Faculty/admin: let the student start over (e.g. after a big rewrite). The old set stays for history.
const reset = async (projectId, userId) => {
  await LotusSet.updateMany({ project: projectId, user: userId, active: true }, { $set: { active: false } });
  recomputeSoon(projectId);
};

module.exports = { start, saveAnswers, submit, override, setViva, reset, validateQuestions, buildPayload };
