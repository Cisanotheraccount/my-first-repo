import { HOUSING_CONTEXT } from "./housing-context.js";

const DEFAULT_MODEL = "gpt-5.6-luna";
const MAX_DAILY_REQUESTS = 10;
const MAX_MESSAGES = 8;
const MAX_USER_CHARACTERS = 500;
const MAX_ASSISTANT_CHARACTERS = 2200;
const MAX_TOTAL_CHARACTERS = 7000;
const DEFAULT_ALLOWED_ORIGINS = [
  "https://cisanotheraccount.github.io",
  "http://localhost:8026",
  "http://127.0.0.1:8026"
];

class PublicError extends Error {
  constructor(status, message, code = "") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export default {
  async fetch(request, env) {
    const cors = getCorsHeaders(request, env);

    if (cors === null) {
      return jsonResponse({ error: "Origin not allowed." }, 403);
    }

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: baseHeaders(cors) });
    }

    const url = new URL(request.url);

    try {
      if (url.pathname === "/health" && request.method === "GET") {
        return jsonResponse(
          {
            ok: true,
            service: "NYC Housing Guide",
            model: env.OPENAI_MODEL || DEFAULT_MODEL,
            openAIConfigured: Boolean(env.OPENAI_API_KEY),
            firebaseConfigured: Boolean(env.FIREBASE_WEB_API_KEY && env.FIREBASE_DATABASE_URL)
          },
          200,
          cors
        );
      }

      if (url.pathname === "/chat" && request.method === "POST") {
        return await handleChat(request, env, cors);
      }

      if (url.pathname === "/chat" || url.pathname === "/health") {
        throw new PublicError(405, "Method not allowed.");
      }

      throw new PublicError(404, "Not found.");
    } catch (error) {
      if (error instanceof PublicError) {
        return jsonResponse(
          {
            error: error.message,
            ...(error.code ? { code: error.code } : {})
          },
          error.status,
          cors
        );
      }

      return jsonResponse({ error: "The data guide is temporarily unavailable." }, 503, cors);
    }
  }
};

async function handleChat(request, env, cors) {
  requireConfiguration(env);
  requireJsonRequest(request);

  const idToken = readBearerToken(request);
  const user = await verifyFirebaseUser(idToken, env);
  const messages = validateMessages(await readRequestJson(request));
  const usage = await incrementDailyUsage(user.uid, idToken, env);
  const reply = await createOpenAIResponse(messages, env);

  return jsonResponse(
    {
      reply,
      remaining: usage.remaining,
      resetAt: usage.resetAt
    },
    200,
    cors
  );
}

function requireConfiguration(env) {
  if (!env.OPENAI_API_KEY || !env.FIREBASE_WEB_API_KEY || !env.FIREBASE_DATABASE_URL) {
    throw new PublicError(503, "The data guide is not fully configured.");
  }
}

function requireJsonRequest(request) {
  const contentType = request.headers.get("Content-Type") || "";

  if (!contentType.toLowerCase().includes("application/json")) {
    throw new PublicError(400, "Send the request as JSON.");
  }
}

function readBearerToken(request) {
  const header = request.headers.get("Authorization") || "";
  const match = header.match(/^Bearer\s+([^\s]+)$/i);

  if (!match || match[1].length > 5000) {
    throw new PublicError(401, "Google sign-in is required.");
  }

  return match[1];
}

async function readRequestJson(request) {
  try {
    return await request.json();
  } catch (error) {
    throw new PublicError(400, "The request body is not valid JSON.");
  }
}

function validateMessages(body) {
  if (!body || !Array.isArray(body.messages) || body.messages.length < 1 || body.messages.length > MAX_MESSAGES) {
    throw new PublicError(400, "Include between 1 and 8 recent messages.");
  }

  let totalCharacters = 0;
  let previousRole = null;
  const messages = body.messages.map(function (message) {
    if (!message || (message.role !== "user" && message.role !== "assistant") || typeof message.content !== "string") {
      throw new PublicError(400, "Each message must have a valid role and text content.");
    }

    const content = message.content.trim();
    const limit = message.role === "user" ? MAX_USER_CHARACTERS : MAX_ASSISTANT_CHARACTERS;

    if (!content || content.length > limit) {
      throw new PublicError(400, message.role === "user" ? "Questions must be 1-500 characters." : "Conversation history is too long.");
    }

    if (previousRole === message.role) {
      throw new PublicError(400, "Conversation roles must alternate.");
    }

    previousRole = message.role;
    totalCharacters += content.length;
    return { role: message.role, content };
  });

  if (messages.at(-1).role !== "user") {
    throw new PublicError(400, "The latest message must be a user question.");
  }

  if (totalCharacters > MAX_TOTAL_CHARACTERS) {
    throw new PublicError(400, "Conversation history is too long.");
  }

  return messages;
}

async function verifyFirebaseUser(idToken, env) {
  const fetcher = getFetcher(env);
  const endpoint = "https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=" + encodeURIComponent(env.FIREBASE_WEB_API_KEY);
  let response;

  try {
    response = await fetcher(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken })
    });
  } catch (error) {
    throw new PublicError(503, "Firebase Authentication is temporarily unavailable.");
  }

  if (!response.ok) {
    throw new PublicError(401, "Your Google session could not be verified.");
  }

  const data = await response.json();
  const account = Array.isArray(data.users) ? data.users[0] : null;
  const providers = account && Array.isArray(account.providerUserInfo) ? account.providerUserInfo : [];
  const hasGoogleProvider = providers.some(function (provider) {
    return provider.providerId === "google.com";
  });

  if (!account || typeof account.localId !== "string" || !account.localId || !hasGoogleProvider) {
    throw new PublicError(403, "A Google-authenticated Firebase account is required.");
  }

  return { uid: account.localId };
}

async function incrementDailyUsage(uid, idToken, env) {
  const now = getNow(env);
  const day = now.toISOString().slice(0, 10);
  const resetAt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)).toISOString();
  const databaseRoot = env.FIREBASE_DATABASE_URL.replace(/\/$/, "");
  const endpoint = databaseRoot + "/agentUsage/" + encodeURIComponent(uid) + "/" + day + ".json?auth=" + encodeURIComponent(idToken);
  const fetcher = getFetcher(env);

  for (let attempt = 0; attempt < 5; attempt += 1) {
    let currentResponse;

    try {
      currentResponse = await fetcher(endpoint, {
        method: "GET",
        headers: { "X-Firebase-ETag": "true" }
      });
    } catch (error) {
      throw new PublicError(503, "The request counter is temporarily unavailable.");
    }

    if (!currentResponse.ok) {
      throw new PublicError(503, "The request counter is temporarily unavailable.");
    }

    const currentValue = await currentResponse.json();
    const currentCount = currentValue === null ? 0 : Number(currentValue);

    if (!Number.isInteger(currentCount) || currentCount < 0) {
      throw new PublicError(503, "The request counter returned invalid data.");
    }

    if (currentCount >= MAX_DAILY_REQUESTS) {
      throw new PublicError(429, "The 10-request UTC daily limit has been reached.");
    }

    const etag = currentResponse.headers.get("ETag");

    if (!etag) {
      throw new PublicError(503, "The request counter could not be updated safely.");
    }

    let updateResponse;

    try {
      updateResponse = await fetcher(endpoint, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "If-Match": etag
        },
        body: JSON.stringify(currentCount + 1)
      });
    } catch (error) {
      throw new PublicError(503, "The request counter is temporarily unavailable.");
    }

    if (updateResponse.status === 412) {
      continue;
    }

    if (!updateResponse.ok) {
      throw new PublicError(503, "The request counter could not be updated.");
    }

    const nextCount = currentCount + 1;
    return {
      count: nextCount,
      remaining: MAX_DAILY_REQUESTS - nextCount,
      resetAt
    };
  }

  throw new PublicError(503, "The request counter is busy. Please try again.");
}

async function createOpenAIResponse(messages, env) {
  const fetcher = getFetcher(env);
  const controller = new AbortController();
  const timeout = setTimeout(function () {
    controller.abort();
  }, 25000);
  let response;

  try {
    response = await fetcher("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + env.OPENAI_API_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: env.OPENAI_MODEL || DEFAULT_MODEL,
        reasoning: { effort: "low" },
        instructions: HOUSING_CONTEXT,
        input: messages,
        max_output_tokens: 350,
        store: false
      }),
      signal: controller.signal
    });
  } catch (error) {
    throw new PublicError(503, "The language service is temporarily unavailable.");
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const upstreamError = await readUpstreamError(response);
    console.error(JSON.stringify({
      event: "openai_error",
      status: response.status,
      code: upstreamError.code,
      requestId: response.headers.get("x-request-id") || ""
    }));
    throw new PublicError(503, "The language service is temporarily unavailable.", upstreamError.code);
  }

  const data = await response.json();
  const reply = extractOutputText(data);

  if (!reply) {
    throw new PublicError(503, "The language service returned an empty response.");
  }

  return reply;
}

function extractOutputText(data) {
  if (data && typeof data.output_text === "string" && data.output_text.trim()) {
    return data.output_text.trim();
  }

  if (!data || !Array.isArray(data.output)) {
    return "";
  }

  return data.output
    .filter(function (item) {
      return item && item.type === "message" && Array.isArray(item.content);
    })
    .flatMap(function (item) {
      return item.content;
    })
    .filter(function (part) {
      return part && part.type === "output_text" && typeof part.text === "string";
    })
    .map(function (part) {
      return part.text.trim();
    })
    .filter(Boolean)
    .join("\n\n");
}

async function readUpstreamError(response) {
  let data = {};

  try {
    data = await response.json();
  } catch (error) {
    data = {};
  }

  const rawCode = data && data.error && (data.error.code || data.error.type);
  const safeCode = typeof rawCode === "string" && /^[a-z0-9_.-]{1,80}$/i.test(rawCode)
    ? rawCode
    : "openai_http_" + response.status;

  return { code: safeCode };
}

function getCorsHeaders(request, env) {
  const origin = request.headers.get("Origin");
  const allowedOrigins = String(env.ALLOWED_ORIGINS || DEFAULT_ALLOWED_ORIGINS.join(","))
    .split(",")
    .map(function (value) {
      return value.trim();
    })
    .filter(Boolean);

  if (!origin) {
    return {};
  }

  if (!allowedOrigins.includes(origin)) {
    return null;
  }

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "86400"
  };
}

function baseHeaders(cors) {
  return {
    ...cors,
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
    "Vary": "Origin",
    "X-Content-Type-Options": "nosniff"
  };
}

function jsonResponse(payload, status, cors = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: baseHeaders(cors)
  });
}

function getFetcher(env) {
  return typeof env.__fetch === "function" ? env.__fetch : fetch;
}

function getNow(env) {
  if (typeof env.__now === "function") {
    return new Date(env.__now());
  }

  return new Date();
}
