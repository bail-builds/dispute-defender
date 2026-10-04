# Dispute Defender

When a customer files a PayPal dispute, a small shop has a few days to answer and usually no time or process to do it well. Dispute Defender reads the dispute, gathers the evidence, scores how winnable it is, and drafts the reply. A human approves. Nothing is sent automatically.

Built for the PayPal AI Hackathon. **PayPal Sandbox only. No real money, no live PayPal.**

## What is real and what is simulated

| Part | Status |
| --- | --- |
| Sales (Orders v2 capture, fee, status, timestamps) | **Real** PayPal Sandbox captures, read back from PayPal on every run |
| PayPal Customer Disputes API client (list, get, provide-evidence, accept-claim, send-message) | **Real** endpoints, wired to the sandbox host. `GET /v1/customer/disputes` is called live |
| The disputes themselves | **Simulated.** A merchant app cannot file a dispute (buyer-side call, rejected with `INVALID_BUYER_TRANSACTION_ID`), so `src/scenarios.js` produces disputes in the Disputes API shape, each linked to a real sandbox capture ID |
| Shipping, chat, listing and risk records | **Simulated** merchant order system, fictional people and example.test emails |
| Evidence scoring and the decision | Deterministic code (`src/evidence.js`), unit tested |
| Reply drafts | Gemini through an OpenAI-compatible endpoint, from verified facts only. Template fallback is labelled |

## What it decides

For each dispute it returns a 0-100 win score and one of `CONTEST`, `CONTEST_WITH_CAUTION` or `ACCEPT_AND_REFUND`. It will refuse to contest a duplicate charge that its own order records confirm, and it will not waste time on tiny, unprovable claims.

The model writes words. It never sets a score, amount or decision, and its prompt contains only verified evidence items.

## Run it

Needs Node 20+. No dependencies.

```bash
npm test
node src/cli.js --mock                 # offline, mock sales
PORT=3000 USE_MOCK=1 node src/server.js   # dashboard on http://localhost:3000 (127.0.0.1 only)
```

Live sandbox run (creates six sandbox sales once, caches order IDs in `data/sales.json`, which is gitignored):

```bash
export PAYPAL_CLIENT_ID=...        # Sandbox app credentials only
export PAYPAL_CLIENT_SECRET=...
export LLM_API_KEY=...             # optional
export LLM_MODEL=gemini-3.1-flash-lite   # default
node src/cli.js
```

Keys live in environment variables only. See [SECURITY.md](SECURITY.md).

## Layout

- `src/paypal.js` PayPal client with a sandbox host allowlist
- `src/scenarios.js` simulated disputes and order records
- `src/evidence.js` evidence pack, score, decision
- `src/agent.js` reply drafting
- `src/run.js`, `src/cli.js`, `src/server.js`, `public/index.html`

MIT licensed.
