// Content check for feedback / requests / replies, visitor contact checks, rate limiter.
const test = require('node:test');
const assert = require('node:assert/strict');
const { checkMessage, checkContact, normalise } = require('../moderation/contentCheck');
const { hit } = require('../utils/rateLimit');

const P = { title: 'KrishiMitra Smart Drip', tagline: 'Soil-moisture sensors open the drip valve', stack: ['Arduino', 'Flutter'] };
const v = (msg, opts = {}) => checkMessage(msg, { project: P, ...opts }).verdict;

test('genuine feedback and requests pass', () => {
  assert.equal(v('Great work! The drip valve logic is clean, maybe add a manual override in the Flutter app.'), 'pass');
  assert.equal(v('Tested it on 1200 2000 3000 readings, accuracy was 91 percent in 2026.'), 'pass');
  assert.equal(v('Batch 2023-2027 classmate here, loved the demo video'), 'pass');
  assert.equal(v('We need a similar system for our 5 acre farm, budget around 50k, timeline 2 months', { kind: 'request' }), 'pass');
});

test('abuse, harassment, threats and spam are rejected — including leetspeak and Tanglish', () => {
  for (const m of ['You are a f*ck1ng sh1t team, the app is bad', 'otha unga project waste', 'chutiya project bro, the app crashed',
    'send nudes pls, nice app', 'I will kill you if the demo fails again', 'EARN MONEY FAST WITH BITCOIN INVESTMENT PLAN TODAY',
    'Nice project! whatsapp me for a collab']) {
    assert.equal(v(m), 'reject', m);
  }
});

test('contact details in the message are refused (they go in the verified form fields)', () => {
  for (const m of ['call me 98765 43210 for a chat about the app', 'ping +91-98765-43210 nice project', 'mail me at abc@gmail.com nice project',
    'follow @spammy_page for more project ideas']) {
    const r = checkMessage(m, { project: P });
    assert.equal(r.verdict, 'reject', m);
    assert.match(r.reasons.join(' '), /phone numbers, emails/);
  }
});

test('doubtful messages are held for a moderator, not delivered', () => {
  assert.equal(v('Hello there how are you doing today friend'), 'hold');               // not about the project
  assert.equal(v('This is stupid, the sensor never works'), 'hold');                   // mild insult
  assert.equal(v('Check my channel www.example.xyz for great project ideas'), 'hold'); // one link
  assert.equal(v('THIS PROJECT IS GREAT BUT THE SENSOR READINGS ARE OFF'), 'hold');    // shouting
  assert.equal(v('இது மிகவும் நல்ல திட்டம், வாழ்த்துக்கள்'), 'hold');                     // Tamil: a person reads it
  assert.equal(v('hello hello can we talk sometime soon please', { kind: 'request' }), 'hold');
});

test('too short, too long, repetitive and multi-link messages are rejected', () => {
  assert.equal(v('nice'), 'reject');
  assert.equal(v('a'.repeat(2001)), 'reject');
  assert.equal(v('hi hi hi hi hi hi hi hi hi hi'), 'reject');
  assert.equal(v('see www.a.com and www.b.com for the app'), 'reject');
});

test('replies skip the relevance test but keep the safety rules', () => {
  assert.equal(checkMessage('Thanks a lot, will do that next week!', { skipRelevance: true }).verdict, 'pass');
  assert.equal(checkMessage('Thanks, call me on 98765 43210', { skipRelevance: true }).verdict, 'reject');
  assert.equal(checkMessage('Thanks!', { skipRelevance: true, minLength: 2 }).verdict, 'pass', 'short replies/comments are fine');
  assert.equal(checkMessage('ok', { skipRelevance: false }).verdict, 'reject', 'but feedback needs substance');
});

test('normaliser undoes leetspeak inside words only', () => {
  assert.equal(normalise('Great!! s0ooo g00d sh1t'), 'great soo good shit');
});

test('visitor contact fields are validated; throwaway emails refused', () => {
  assert.deepEqual(checkContact({ name: 'Ravi Kumar', email: 'ravi@gmail.com', phone: '98765 43210' }), []);
  assert.deepEqual(checkContact({ name: 'Anne-Marie O\'Neil', email: 'a@x.co.uk', phone: '+447911123456' }), []);
  assert.deepEqual(checkContact({ name: 'Ravi', email: 'ravi@yopmail.com', phone: '9876543210' }), ['Temporary email addresses are not accepted']);
  assert.equal(checkContact({ name: 'R2D2', email: 'x', phone: '12345' }).length, 3);
  assert.equal(checkContact({ name: 'Ravi', email: 'r@gmail.com', phone: '1234567890' }).length, 1, 'Indian mobiles start 6-9');
});

test('rate limiter allows max per window, then blocks', () => {
  const key = `t-${Date.now()}`;
  for (let i = 0; i < 3; i++) assert.ok(hit('test', key, 3, 60000).ok);
  const blocked = hit('test', key, 3, 60000);
  assert.equal(blocked.ok, false);
  assert.ok(blocked.retryAfter > 0);
});
