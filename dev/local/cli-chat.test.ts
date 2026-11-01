import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildAuthHeaders,
  getDefaultModel,
  getGatewayUrl,
  sendChat,
} from './cli-chat-core';

test('top-level model takes precedence over nested fallback', () => {
  assert.equal(
    getDefaultModel({ model: 'openai/gpt-test', models: { default: 'kilo-auto/free' } }),
    'openai/gpt-test'
  );
});

test('model falls back to nested default and then the free router', () => {
  assert.equal(getDefaultModel({ models: { default: 'kilo-auto/balanced' } }), 'kilo-auto/balanced');
  assert.equal(getDefaultModel({}), 'kilo-auto/free');
});

test('gateway URL uses the documented default and removes trailing slashes', () => {
  assert.equal(getGatewayUrl({}), 'https://ai-gateway.kilo.ai/api/v1');
  assert.equal(
    getGatewayUrl({ gateway: { url: 'https://gateway.example/api/v1///' } }),
    'https://gateway.example/api/v1'
  );
});

test('auth header is omitted when no API key is supplied', () => {
  assert.deepEqual(buildAuthHeaders(), { 'Content-Type': 'application/json' });
});

test('auth header uses a trimmed Bearer API key', () => {
  assert.equal(buildAuthHeaders('  test-token  ').Authorization, 'Bearer test-token');
});

test('sendChat posts an OpenAI-compatible request and returns its text', async () => {
  let requestedUrl = '';
  let requestInit: RequestInit | undefined;
  const fetchImpl: typeof fetch = async (input, init) => {
    requestedUrl = String(input);
    requestInit = init;
    return new Response(
      JSON.stringify({ choices: [{ message: { content: 'hello from Kilo' } }] }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  };

  const result = await sendChat(
    'https://gateway.example/api/v1/',
    'kilo-auto/free',
    [{ role: 'user', content: 'hello' }],
    { apiKey: 'secret-test-token', fetchImpl }
  );

  assert.equal(result, 'hello from Kilo');
  assert.equal(requestedUrl, 'https://gateway.example/api/v1/chat/completions');
  assert.equal(new Headers(requestInit?.headers).get('authorization'), 'Bearer secret-test-token');
  assert.deepEqual(JSON.parse(String(requestInit?.body)), {
    model: 'kilo-auto/free',
    messages: [{ role: 'user', content: 'hello' }],
    stream: false,
  });
});

test('sendChat explains how to authenticate when a paid model receives anonymous 401', async () => {
  const fetchImpl: typeof fetch = async () =>
    new Response(JSON.stringify({ error: { message: 'Sign in required' } }), { status: 401 });

  await assert.rejects(
    () => sendChat('https://gateway.example/api/v1', 'anthropic/paid-model', [], { fetchImpl }),
    /Set KILO_API_KEY/
  );
});

test('sendChat aborts requests that exceed the configured timeout', async () => {
  const fetchImpl: typeof fetch = async (_input, init) =>
    new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener(
        'abort',
        () => reject(new DOMException('Aborted', 'AbortError')),
        { once: true }
      );
    });

  await assert.rejects(
    () =>
      sendChat('https://gateway.example/api/v1', 'kilo-auto/free', [], {
        timeoutMs: 5,
        fetchImpl,
      }),
    /timed out after 5 ms/
  );
});
