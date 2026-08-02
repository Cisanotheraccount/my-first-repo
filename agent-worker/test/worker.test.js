import assert from "node:assert/strict";
import test from "node:test";
import worker from "../src/index.js";

const allowedOrigin = "http://localhost:8026";

function makeEnv(fetcher) {
  return {
    OPENAI_API_KEY: "test-openai-key",
    OPENAI_MODEL: "gpt-5.6-luna",
    FIREBASE_WEB_API_KEY: "test-firebase-key",
    FIREBASE_DATABASE_URL: "https://example-default-rtdb.firebaseio.com",
    ALLOWED_ORIGINS: allowedOrigin,
    __fetch: fetcher,
    __now: function () {
      return "2026-08-02T15:30:00.000Z";
    }
  };
}

function request(path, options = {}) {
  return new Request("https://worker.example" + path, {
    method: options.method || "GET",
    headers: {
      "Origin": options.origin === undefined ? allowedOrigin : options.origin,
      ...(options.headers || {})
    },
    body: options.body
  });
}

function chatRequest(messages, overrides = {}) {
  return request("/chat", {
    method: "POST",
    headers: {
      "Authorization": "Bearer firebase-token",
      "Content-Type": "application/json",
      ...(overrides.headers || {})
    },
    body: JSON.stringify({ messages }),
    origin: overrides.origin
  });
}

function createSuccessfulFetcher(options = {}) {
  let usageGetCount = 0;
  const calls = [];

  async function mockFetch(url, init = {}) {
    calls.push({ url: String(url), init });

    if (String(url).includes("identitytoolkit.googleapis.com")) {
      return Response.json({
        users: [{ localId: "google-user-1", providerUserInfo: [{ providerId: "google.com" }] }]
      });
    }

    if (String(url).includes("example-default-rtdb.firebaseio.com")) {
      if (init.method === "GET") {
        usageGetCount += 1;
        const value = options.currentUsage === undefined ? null : options.currentUsage;
        return new Response(JSON.stringify(value), {
          status: 200,
          headers: { "ETag": '"usage-etag-' + usageGetCount + '"' }
        });
      }

      if (init.method === "PUT") {
        if (options.conflictOnce && usageGetCount === 1) {
          return new Response(JSON.stringify(options.currentUsage || null), { status: 412 });
        }
        return Response.json(JSON.parse(init.body));
      }
    }

    if (String(url) === "https://api.openai.com/v1/responses") {
      if (options.openAIError) {
        return Response.json(
          { error: { code: options.openAIError, message: "Sensitive upstream detail" } },
          { status: 400, headers: { "x-request-id": "req_test" } }
        );
      }

      return Response.json({
        output: [{ type: "message", content: [{ type: "output_text", text: "The Bronx had the largest endpoint increase at 76.2%." }] }]
      });
    }

    throw new Error("Unexpected fetch: " + url);
  }

  mockFetch.calls = calls;
  return mockFetch;
}

test("GET /health reports configuration without exposing secrets", async function () {
  const env = makeEnv(createSuccessfulFetcher());
  const response = await worker.fetch(request("/health"), env);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), allowedOrigin);
  assert.deepEqual(body, {
    ok: true,
    service: "NYC Housing Guide",
    model: "gpt-5.6-luna",
    openAIConfigured: true,
    firebaseConfigured: true
  });
  assert.equal(JSON.stringify(body).includes("test-openai-key"), false);
});

test("rejects a browser origin outside the allowlist", async function () {
  const response = await worker.fetch(request("/health", { origin: "https://malicious.example" }), makeEnv(createSuccessfulFetcher()));

  assert.equal(response.status, 403);
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), null);
});

test("rejects an unauthenticated chat request", async function () {
  const response = await worker.fetch(
    request("/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [{ role: "user", content: "Compare boroughs." }] })
    }),
    makeEnv(createSuccessfulFetcher())
  );

  assert.equal(response.status, 401);
});

test("rejects invalid or oversized chat messages", async function () {
  const fetcher = createSuccessfulFetcher();
  const response = await worker.fetch(
    chatRequest([{ role: "user", content: "x".repeat(501) }]),
    makeEnv(fetcher)
  );

  assert.equal(response.status, 400);
  assert.equal(fetcher.calls.some(function (call) { return call.url.includes("api.openai.com"); }), false);
});

test("verifies Firebase, increments usage, and returns an OpenAI response", async function () {
  const fetcher = createSuccessfulFetcher();
  const response = await worker.fetch(
    chatRequest([{ role: "user", content: "Which borough increased most?" }]),
    makeEnv(fetcher)
  );
  const body = await response.json();
  const openAICall = fetcher.calls.find(function (call) {
    return call.url === "https://api.openai.com/v1/responses";
  });
  const openAIBody = JSON.parse(openAICall.init.body);

  assert.equal(response.status, 200);
  assert.equal(body.reply, "The Bronx had the largest endpoint increase at 76.2%.");
  assert.equal(body.remaining, 9);
  assert.equal(body.resetAt, "2026-08-03T00:00:00.000Z");
  assert.equal(openAIBody.model, "gpt-5.6-luna");
  assert.equal(openAIBody.store, false);
  assert.equal(openAIBody.max_output_tokens, 350);
  assert.equal(JSON.stringify(openAIBody).includes("test-openai-key"), false);
});

test("returns 429 without calling OpenAI when the daily quota is exhausted", async function () {
  const fetcher = createSuccessfulFetcher({ currentUsage: 10 });
  const response = await worker.fetch(
    chatRequest([{ role: "user", content: "Read the map." }]),
    makeEnv(fetcher)
  );

  assert.equal(response.status, 429);
  assert.equal(fetcher.calls.some(function (call) { return call.url === "https://api.openai.com/v1/responses"; }), false);
});

test("retries an ETag conflict before sending the model request", async function () {
  const fetcher = createSuccessfulFetcher({ currentUsage: 2, conflictOnce: true });
  const response = await worker.fetch(
    chatRequest([{ role: "user", content: "Explain vacancy." }]),
    makeEnv(fetcher)
  );

  assert.equal(response.status, 200);
  assert.equal(fetcher.calls.filter(function (call) { return call.init.method === "GET" && call.url.includes("agentUsage"); }).length, 2);
});

test("returns 403 for a Firebase account without Google as a provider", async function () {
  const fetcher = async function (url) {
    if (String(url).includes("identitytoolkit.googleapis.com")) {
      return Response.json({ users: [{ localId: "password-user", providerUserInfo: [{ providerId: "password" }] }] });
    }
    throw new Error("No other request expected");
  };
  const response = await worker.fetch(
    chatRequest([{ role: "user", content: "Compare rent." }]),
    makeEnv(fetcher)
  );

  assert.equal(response.status, 403);
});

test("returns a sanitized OpenAI error code without upstream detail", async function () {
  const fetcher = createSuccessfulFetcher({ openAIError: "model_not_found" });
  const response = await worker.fetch(
    chatRequest([{ role: "user", content: "Compare rent." }]),
    makeEnv(fetcher)
  );
  const body = await response.json();

  assert.equal(response.status, 503);
  assert.deepEqual(body, {
    error: "The language service is temporarily unavailable.",
    code: "model_not_found"
  });
  assert.equal(JSON.stringify(body).includes("Sensitive upstream detail"), false);
});
