# Security notes

- **Sandbox only.** `src/paypal.js` refuses any host other than the PayPal sandbox or localhost, so live PayPal is unreachable by design.
- **No secrets in the repo.** PayPal and LLM keys come from environment variables. `.env*`, `*.key`, `*.pem` and `data/*.json` are gitignored. History was checked for key patterns before publishing.
- **No logging of credentials.** Errors truncate response bodies and never print tokens or headers.
- **No dependencies**, so no supply-chain exposure. `npm audit` has nothing to scan.
- **Untrusted text.** Buyer messages are treated as data in the LLM prompt. HTML output is escaped on the client. The dashboard binds to 127.0.0.1.
- **Human in the loop.** The tool never calls provide-evidence, accept-claim or send-message on its own.
- **No personal data.** All people, emails and addresses in the simulated data are fictional (`example.test`).
