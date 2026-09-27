const { getStore } = require('@netlify/blobs');

// Heuristic ceiling on points-per-second the game can actually award.
// Best-case play (max streak bonus, frequent hits, occasional powered
// cop takedowns) tops out well under this - it's deliberately generous
// so real skilled runs never get rejected, while a submitted score that
// implies an impossible rate gets caught.
const MAX_POINTS_PER_SECOND = 90;
const FLAT_BUFFER = 120;
const MIN_RUN_MS = 1500; // a run has to last at least this long to submit anything
const MAX_NAME_LEN = 16;
const LEADERBOARD_SIZE = 50;

function sanitizeName(raw) {
  if (typeof raw !== 'string') return 'Ninja';
  var n = raw.trim().slice(0, MAX_NAME_LEN);
  n = n.replace(/[<>]/g, '');
  return n.length ? n : 'Ninja';
}

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'bad json' }) };
  }

  var runId = body.runId;
  var score = Math.floor(Number(body.score));
  var name = sanitizeName(body.name);

  if (!runId || !isFinite(score) || score < 0) {
    return { statusCode: 400, body: JSON.stringify({ error: 'invalid payload' }) };
  }

  var runStore = getStore('runs');
  var run = await runStore.get(runId, { type: 'json' });

  if (!run) {
    // unknown or already-used runId
    return { statusCode: 403, body: JSON.stringify({ error: 'invalid run' }) };
  }

  // single-use: consume the run token immediately
  await runStore.delete(runId);

  var elapsedMs = Date.now() - run.startedAt;
  if (elapsedMs < MIN_RUN_MS) {
    return { statusCode: 403, body: JSON.stringify({ error: 'run too short' }) };
  }

  var maxAllowed = FLAT_BUFFER + (elapsedMs / 1000) * MAX_POINTS_PER_SECOND;
  if (score > maxAllowed) {
    return { statusCode: 403, body: JSON.stringify({ error: 'score exceeds plausible maximum' }) };
  }

  var lbStore = getStore('leaderboard');
  var list = (await lbStore.get('scores', { type: 'json' })) || [];
  list.push({ name: name, score: score, at: Date.now() });
  list.sort(function (a, b) { return b.score - a.score; });
  list = list.slice(0, LEADERBOARD_SIZE);
  await lbStore.setJSON('scores', list);

  var rank = list.findIndex(function (e) { return e.score === score && e.name === name && e.at; }) + 1;

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ok: true, rank: rank > 0 ? rank : null, top: list.slice(0, 10) })
  };
};
