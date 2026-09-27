const { getStore, connectLambda } = require('@netlify/blobs');

exports.handler = async function (event) {
  connectLambda(event);
  const store = getStore('leaderboard');
  const list = (await store.get('scores', { type: 'json' })) || [];

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    body: JSON.stringify({ top: list.slice(0, 20) })
  };
};
