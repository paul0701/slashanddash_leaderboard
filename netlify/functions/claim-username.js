const { getStore, connectLambda } = require('@netlify/blobs');
const crypto = require('crypto');

const MAX_NAME_LEN = 16;
const MIN_NAME_LEN = 2;
const NAME_PATTERN = /^[A-Za-z0-9 _-]+$/;
const PIN_PATTERN = /^[0-9]{4,8}$/;

function clean(raw) {
  if (typeof raw !== 'string') return '';
  return raw.trim().replace(/\s+/g, ' ');
}

function hashPin(pin, key) {
  // Not real security (no per-user salt store, just a fixed pepper mixed with
  // the username) - this is a lightweight "prove it's you" check for a casual
  // game leaderboard, not an authentication system for anything sensitive.
  return crypto.createHash('sha256').update('sd-pin::' + key + '::' + pin).digest('hex');
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

  var username = clean(body.username);
  var deviceId = clean(body.deviceId);
  var pin = clean(body.pin);

  if (!deviceId) {
    return { statusCode: 400, body: JSON.stringify({ error: 'missing device id' }) };
  }
  if (username.length < MIN_NAME_LEN || username.length > MAX_NAME_LEN || !NAME_PATTERN.test(username)) {
    return { statusCode: 400, body: JSON.stringify({ error: 'invalid_name' }) };
  }
  if (!PIN_PATTERN.test(pin)) {
    return { statusCode: 400, body: JSON.stringify({ error: 'invalid_pin' }) };
  }

  var key = username.toLowerCase();
  var store = getStore('usernames');
  var existing = await store.get(key, { type: 'json' });

  if (existing) {
    var alreadyThisDevice = (existing.deviceIds || []).indexOf(deviceId) !== -1;
    if (!alreadyThisDevice) {
      return { statusCode: 409, body: JSON.stringify({ error: 'taken' }) };
    }
    // same device re-claiming its own name - nothing to change
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true, username: existing.username })
    };
  }

  await store.setJSON(key, {
    username: username,
    deviceIds: [deviceId],
    pinHash: hashPin(pin, key),
    claimedAt: Date.now()
  });

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ok: true, username: username })
  };
};
