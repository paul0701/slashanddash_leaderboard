const { getStore } = require('@netlify/blobs');

const MAX_NAME_LEN = 16;
const MIN_NAME_LEN = 2;
const NAME_PATTERN = /^[A-Za-z0-9 _-]+$/;

function clean(raw) {
  if (typeof raw !== 'string') return '';
  return raw.trim().replace(/\s+/g, ' ');
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

  var username = clean(body.username);
  var deviceId = clean(body.deviceId);

  if (!deviceId) {
    return { statusCode: 400, body: JSON.stringify({ error: 'missing device id' }) };
  }
  if (username.length < MIN_NAME_LEN || username.length > MAX_NAME_LEN || !NAME_PATTERN.test(username)) {
    return { statusCode: 400, body: JSON.stringify({ error: 'invalid_name' }) };
  }

  var key = username.toLowerCase();
  var store = getStore('usernames');
  var existing = await store.get(key, { type: 'json' });

  if (existing && existing.deviceId !== deviceId) {
    return { statusCode: 409, body: JSON.stringify({ error: 'taken' }) };
  }

  // free this device's previous name, if it had a different one, so it doesn't
  // hang around unowned and unusable by anyone
  if (!existing) {
    await store.setJSON(key, { username: username, deviceId: deviceId, claimedAt: Date.now() });
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ok: true, username: username })
  };
};
