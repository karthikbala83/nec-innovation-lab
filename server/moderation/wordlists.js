// ---------------------------------------------------------------
// Word lists for the content check. Matched on a normalised copy of
// the text (lower-case, leetspeak undone, repeated letters squeezed),
// as whole words. Extend these as the moderators see new abuse —
// they are data, not logic. Includes common English plus Tamil and
// Hindi abuse written in Latin letters (as students type on phones).
// ---------------------------------------------------------------

// Abuse / slurs -> reject
const ABUSE = [
  'fuck', 'fucker', 'fucking', 'motherfucker', 'shit', 'bullshit', 'bitch', 'bastard', 'asshole', 'dickhead',
  'cunt', 'slut', 'whore', 'retard', 'retarded', 'dumbass', 'jackass', 'wanker', 'twat', 'nigger', 'faggot',
  // Tamil (Latin script)
  'otha', 'ommala', 'thevidiya', 'thevdiya', 'punda', 'pundai', 'koothi', 'baadu',
  // Hindi (Latin script)
  'chutiya', 'chutia', 'madarchod', 'behenchod', 'bhenchod', 'bhosdike', 'gandu', 'harami', 'randi',
];

// Mild insults -> hold for a moderator (can be banter between friends, can be bullying)
const MILD = ['idiot', 'stupid', 'moron', 'loser', 'useless', 'pathetic', 'worst', 'trash', 'garbage', 'loosu', 'paradesi', 'saala', 'kutta', 'kamina'];

// Sexual / harassment phrases -> reject
const HARASSMENT = [
  'send nudes', 'nudes', 'sexy', 'hot girl', 'date me', 'marry me', 'be my girlfriend', 'be my boyfriend',
  'your photo', 'your pic', 'private chat', 'meet me alone', 'kiss', 'boobs', 'porn',
];

// Threats -> reject
const THREATS = ['kill you', 'i will kill', 'hurt you', 'beat you', 'finish you', 'watch your back', 'you will regret', 'acid attack'];

// Scams / spam -> reject
const SPAM = [
  'lottery', 'jackpot', 'bitcoin', 'crypto', 'forex', 'earn money', 'earn rs', 'work from home', 'guaranteed returns',
  'double your money', 'investment plan', 'instant loan', 'betting', 'casino', 'click here', 'free money', 'you have won',
  'prize money', 'mlm', 'refer and earn', 'followers cheap', 'buy followers', 'seo services', 'whatsapp me', 'telegram me',
  'dm me', 'call me on', 'ping me on',
];

// Words that show a message is ABOUT a project (relevance check)
const FEEDBACK_WORDS = [
  'project', 'app', 'application', 'website', 'site', 'page', 'demo', 'video', 'code', 'repo', 'github', 'feature', 'features',
  'design', 'ui', 'ux', 'interface', 'layout', 'bug', 'bugs', 'error', 'crash', 'fix', 'issue', 'idea', 'ideas', 'suggest',
  'suggestion', 'improve', 'improvement', 'better', 'add', 'adding', 'remove', 'feedback', 'work', 'working', 'works', 'useful',
  'helpful', 'great', 'good', 'nice', 'awesome', 'cool', 'impressive', 'amazing', 'excellent', 'well', 'done', 'clean', 'simple',
  'fast', 'slow', 'easy', 'hard', 'confusing', 'clear', 'team', 'model', 'data', 'database', 'api', 'login', 'mobile', 'phone',
  'sensor', 'hardware', 'prototype', 'accuracy', 'performance', 'security', 'deploy', 'deployment', 'users', 'user', 'problem',
  'solution', 'impact', 'future', 'scale', 'test', 'testing', 'research', 'paper', 'tried', 'loved',
  'congrats', 'congratulations', 'documentation', 'readme', 'explain', 'readings', 'results', 'dataset', 'sensor', 'map',
];

// Words that show a message is a genuine project REQUEST
const REQUEST_WORDS = [
  'need', 'needs', 'require', 'requirement', 'requirements', 'build', 'develop', 'development', 'similar', 'like this', 'same',
  'customise', 'customize', 'custom', 'version', 'project', 'app', 'website', 'system', 'software', 'hardware', 'device',
  'budget', 'timeline', 'deadline', 'quote', 'quotation', 'cost', 'price', 'hire', 'collaborate', 'collaboration', 'pilot',
  'deploy', 'implement', 'company', 'startup', 'college', 'school', 'hospital', 'farm', 'shop', 'business', 'client',
  'internship', 'freelance', 'contract', 'weeks', 'months', 'interested', 'want', 'looking', 'help', 'features', 'integrate',
];

// Throwaway email domains -> refuse at verification
const DISPOSABLE_DOMAINS = [
  'mailinator.com', 'yopmail.com', 'guerrillamail.com', 'guerrillamail.info', '10minutemail.com', 'tempmail.com', 'temp-mail.org',
  'trashmail.com', 'getnada.com', 'sharklasers.com', 'dispostable.com', 'maildrop.cc', 'throwawaymail.com', 'fakeinbox.com',
  'mintemail.com', 'mohmal.com', 'emailondeck.com', 'tempail.com', 'burnermail.io',
];

module.exports = { ABUSE, MILD, HARASSMENT, THREATS, SPAM, FEEDBACK_WORDS, REQUEST_WORDS, DISPOSABLE_DOMAINS };
