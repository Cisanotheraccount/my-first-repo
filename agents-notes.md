# NYC Housing Guide

## Agent Role

NYC Housing Guide is a small chatbot agent embedded at the end of the existing urban rental study. It helps visitors interpret the website's fixed evidence without requiring them to understand every chart control or visual encoding first.

The agent can explain:

- NYC median asking rent and rental inventory from July 2016 through June 2026.
- The 2017, 2021, and 2023 NYC Housing and Vacancy Survey checkpoints.
- The designed relational network connecting boroughs, supply, vacancy, rent pressure, and selected events.
- The Manhattan Hex MapDrop, including its 31 neighborhood sources, 217 hex cells, rent-height encoding, and visual exaggeration.

It does not search live listings, predict future prices, recommend a neighborhood, or provide legal, financial, investment, relocation, or housing advice. When the fixed evidence cannot answer a question, the agent states that limit instead of inventing an answer.

## Architecture

The implementation extends the course Firebase chatbot pattern while keeping the OpenAI credential off the public GitHub Pages site:

1. The visitor signs in with Google through Firebase Authentication.
2. The browser obtains a short-lived Firebase ID token.
3. The browser sends that token and up to eight recent messages to a Cloudflare Worker.
4. The Worker verifies the token against the project's Firebase Authentication service and requires `google.com` as the provider.
5. The Worker atomically increments `agentUsage/{uid}/{YYYY-MM-DD}` in Firebase Realtime Database.
6. After the daily limit check, the Worker calls the OpenAI Responses API with the fixed study context.
7. The browser displays the reply and keeps the current conversation only in `sessionStorage`.

The OpenAI key is an encrypted Cloudflare Worker secret. It is never included in the HTML, JavaScript bundle, local repository, or GitHub history.

## Request Limits

- 10 requests per Firebase UID per UTC day.
- A question can contain up to 500 characters.
- The browser sends at most eight recent messages.
- Assistant history is limited to 2,200 characters per message.
- Model output is capped at approximately 350 tokens.
- OpenAI response storage is disabled with `store: false`.
- Browser access is limited by CORS to the GitHub Pages origin and the two named local testing origins.

The Firebase count is updated with a conditional ETag request. This prevents two simultaneous requests from overwriting the same count.

## Data Boundary

The prompt contains a compact, fixed evidence table derived from the datasets already used by the page. It includes borough endpoints and annual checkpoints, observed rent and inventory extremes, vacancy checkpoints, network semantics, map methodology, and selected Manhattan neighborhood values. June 2026 is described as the endpoint of a static study rather than a live market reading.

The relational network is explicitly described as an interpretive structure, not proof that one variable caused another. The map is described as a stylized 300-meter hex model whose columns represent asking rent with 10x visual exaggeration, not literal building heights or official neighborhood boundaries.

## Privacy And Ethics

Google and Firebase Authentication necessarily process account identity so the service can assign a stable Firebase UID. The agent's Realtime Database branch stores only a numeric daily request count under that UID and UTC date. It does not store questions, answers, names, email addresses, income, location, or housing preferences.

Conversation text remains in the current tab's `sessionStorage`, separated by Firebase UID, and disappears when the tab session ends or the visitor clears the chat. OpenAI request storage is disabled. The design still requires informed restraint: authentication creates an access record, model answers can be imperfect, and the underlying datasets do not represent every renter's lived experience.

## Project Use

I could use a chatbot agent to help visitors interpret complex urban datasets without requiring them to understand every chart interface. In this project, the agent translates the 2016-2026 NYC rent, inventory, vacancy, and neighborhood evidence into concise answers while remaining bounded to the data shown on the site. This approach could later support public-facing spatial research by letting visitors ask questions in ordinary language while the project clearly communicates its evidence, assumptions, and limits.

## Files

- `agent-chat.css`: responsive interface and visual system.
- `agent-chat.js`: Firebase Google sign-in, local session history, and Worker requests.
- `agent-config.js`: public Worker endpoint only.
- `agent-worker/src/housing-context.js`: fixed study evidence and behavioral boundary.
- `agent-worker/src/index.js`: authentication, validation, rate limiting, CORS, and Responses API proxy.
- `agent-worker/test/worker.test.js`: backend behavior tests with mocked external services.
- `firebase-database.rules.json`: poll rules plus UID-scoped daily usage rules.
