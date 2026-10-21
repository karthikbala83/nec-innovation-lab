// "Fill from GitHub" README parsing, demo-video links and link-preview helpers (no network, no DB).
const test = require('node:test');
const assert = require('node:assert/strict');
const { parseReadme } = require('../projects/readmeDraft');
const { youTubeId, driveId, coverImage } = require('../utils/media');

const README = `# CampusBus Live

[![Build](https://img.shields.io/badge/build-passing-green.svg)](https://ci)

Know where your college bus is, live on a map. Built for Nandha students.

![Map screen](docs/map.png)
<img src="https://example.com/eta.jpg" width="300">

## Problem Statement
Students wait 20–40 minutes at stops because nobody knows where the bus is.

## Features
- Live bus location every 5 s
- **ETA** to your stop

\`\`\`bash
# not a heading
npm start
\`\`\`

## Results
Average wait dropped from 25 to 6 minutes in a 2-week trial.

Demo: https://youtu.be/dQw4w9WgXcQ
`;

test('README becomes a launch-page draft', () => {
  const d = parseReadme(README, { owner: 'nec', name: 'campusbus', branch: 'main' });
  assert.equal(d.title, 'CampusBus Live');
  assert.match(d.problem, /^Students wait 20–40 minutes/);
  assert.match(d.solution, /• Live bus location/);
  assert.match(d.solution, /• ETA to your stop/);          // markdown stripped
  assert.doesNotMatch(d.solution, /npm start/);            // code blocks dropped
  assert.match(d.impact, /25 to 6 minutes/);
  assert.equal(d.videoUrl, 'https://youtu.be/dQw4w9WgXcQ');
  assert.deepEqual(d.screenshots, ['https://raw.githubusercontent.com/nec/campusbus/main/docs/map.png', 'https://example.com/eta.jpg']);   // badge skipped
  assert.match(d.introSentence, /^Know where your college bus is/);
});

test('README without sections uses the intro as the solution', () => {
  const d = parseReadme('Smart irrigation using soil moisture sensors and an ESP32 that waters only when needed.', { owner: 'a', name: 'b' });
  assert.match(d.solution, /^Smart irrigation/);
  assert.equal(d.problem, undefined);
  assert.deepEqual(parseReadme(null, { owner: 'a', name: 'b' }), { screenshots: [] });
});

test('demo video links: YouTube (incl. Shorts) and Google Drive', () => {
  assert.equal(youTubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  assert.equal(youTubeId('https://youtube.com/shorts/dQw4w9WgXcQ?feature=share'), 'dQw4w9WgXcQ');
  assert.equal(youTubeId('https://www.youtube.com/watch?feature=x&v=dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  assert.equal(driveId('https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345/view?usp=sharing'), '1AbCdEfGhIjKlMnOpQrStUvWxYz012345');
  assert.equal(youTubeId('https://vimeo.com/123'), null);
});

test('link preview picks the best picture', () => {
  assert.equal(coverImage({ thumbnail: 'https://x/t.png', screenshots: ['https://x/s.png'] }), 'https://x/t.png');
  assert.equal(coverImage({ screenshots: ['https://x/s.png'] }), 'https://x/s.png');
  assert.equal(coverImage({ videoUrl: 'https://youtu.be/dQw4w9WgXcQ' }), 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg');
  assert.equal(coverImage({}), null);
});
