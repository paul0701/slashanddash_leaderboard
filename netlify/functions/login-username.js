const { getStore, connectLambda } = require('@netlify/blobs');
const crypto = require('crypto');

const PIN_PATTERN = /^[0-9]{4,8}$/;

function clean(raw) {
  if (typeof raw !== 'string') return '';
  return raw.trim().replace(/\s+/g, ' ');
}

function hashPin(pin, key) {
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

  if (!username || !deviceId || !PIN_PATTERN.test(pin)) {
    return { statusCode: 400, body: JSON.stringify({ error: 'invalid payload' }) };
  }

  var key = username.toLowerCase();
  var store = getStore('usernames');
  var record = await store.get(key, { type: 'json' });

  if (!record) {
    return { statusCode: 404, body: JSON.stringify({ error: 'not_found' }) };
  }
  if (record.pinHash !== hashPin(pin, key)) {
    return { statusCode: 403, body: JSON.stringify({ error: 'wrong_pin' }) };
  }

  var deviceIds = record.deviceIds || [];
  if (deviceIds.indexOf(deviceId) === -1) {
    deviceIds.push(deviceId);
    record.deviceIds = deviceIds;
    await store.setJSON(key, record);
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ok: true, username: record.username })
  };
};
