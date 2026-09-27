const { getStore, connectLambda } = require('@netlify/blobs');

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

function clean(raw) {
  if (typeof raw !== 'string') return '';
  return raw.trim().replace(/\s+/g, ' ');
}

exports.handler = async function (event) {
  connectLambda(event);
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
  var username = clean(body.username).slice(0, MAX_NAME_LEN);
  var deviceId = clean(body.deviceId);

  if (!runId || !isFinite(score) || score < 0 || !username || !deviceId) {
    return { statusCode: 400, body: JSON.stringify({ error: 'invalid payload' }) };
  }

  // confirm this device actually owns the username it's submitting under
  var nameStore = getStore('usernames');
  var owner = await nameStore.get(username.toLowerCase(), { type: 'json' });
  if (!owner || (owner.deviceIds || []).indexOf(deviceId) === -1) {
    return { statusCode: 403, body: JSON.stringify({ error: 'username not claimed by this device' }) };
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

  var key = username.toLowerCase();
  var existingIdx = list.findIndex(function (e) { return e.key === key; });
  var improved = existingIdx === -1 || score > list[existingIdx].score;

  if (existingIdx !== -1) {
    if (improved) list[existingIdx] = { key: key, name: username, score: score, at: Date.now() };
  } else {
    list.push({ key: key, name: username, score: score, at: Date.now() });
  }

  list.sort(function (a, b) { return b.score - a.score; });
  list = list.slice(0, LEADERBOARD_SIZE);
  await lbStore.setJSON('scores', list);

  var rank = list.findIndex(function (e) { return e.key === key; }) + 1;

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ok: true,
      improved: improved,
      rank: rank > 0 ? rank : null,
      top: list.slice(0, 10).map(function (e) { return { name: e.name, score: e.score }; })
    })
  };
};
