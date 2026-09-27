const { getStore, connectLambda } = require('@netlify/blobs');
const crypto = require('crypto');

exports.handler = async function (event) {
  connectLambda(event);
  const runId = crypto.randomUUID();
  const store = getStore('runs');
  await store.setJSON(runId, { startedAt: Date.now() });

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ runId })
  };
};
