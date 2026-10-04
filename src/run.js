import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { PayPal } from './paypal.js';
import { SCENARIOS, disputeFor } from './scenarios.js';
import { assess } from './evidence.js';
import { draftResponse } from './agent.js';

const CACHE = process.env.SALES_FILE || new URL('../data/sales.json', import.meta.url).pathname;

function mockSale(sc, i) {
  return { orderId: `MOCK-ORDER-${i + 1}`, captureId: `MOCK-CAPTURE-${i + 1}`, status: 'COMPLETED', created: new Date(Date.UTC(2026, 8, 10 + i)).toISOString(),
    gross: sc.amount, fee: Math.round((sc.amount * 0.029 + 0.3) * 100) / 100, currency: 'USD', sku: sc.sku, description: sc.item };
}

// Real sandbox sales: create once (cached by order id), then always read back from PayPal so the numbers are verified live.
async function liveSales(pp) {
  const cache = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, 'utf8')) : {};
  const out = [];
  for (const sc of SCENARIOS) {
    let id = cache[sc.key];
    if (!id) { id = (await pp.createSale({ amount: sc.amount, description: sc.item, sku: sc.sku })).orderId; cache[sc.key] = id; }
    out.push(await pp.getSale(id));
  }
  mkdirSync(new URL('../data/', import.meta.url).pathname, { recursive: true });
  writeFileSync(CACHE, JSON.stringify(cache, null, 2), { mode: 0o600 });
  return out;
}

export async function runPipeline({ mock = !process.env.PAYPAL_CLIENT_ID } = {}) {
  let sales; let realDisputes = null;
  if (mock) sales = SCENARIOS.map(mockSale);
  else {
    const pp = new PayPal({ clientId: process.env.PAYPAL_CLIENT_ID, secret: process.env.PAYPAL_CLIENT_SECRET, baseUrl: process.env.PAYPAL_BASE_URL });
    sales = await liveSales(pp);
    realDisputes = (await pp.listDisputes()).length; // real Disputes API call; the sandbox merchant has none open
  }
  const rows = await Promise.all(SCENARIOS.map(async (sc, i) => {
    const dispute = disputeFor(sc, i, sales[i]);
    const assessment = assess(dispute, sc.order, sales[i]);
    const response = await draftResponse(dispute, assessment);
    return { dispute, item: sc.item, sale: sales[i], assessment, response };
  }));
  rows.sort((a, b) => a.dispute.seller_response_due_date.localeCompare(b.dispute.seller_response_due_date));
  const atStake = rows.reduce((t, r) => t + r.assessment.amount, 0);
  const contest = rows.filter((r) => r.assessment.recommendation.startsWith('CONTEST'));
  return {
    generatedAt: new Date().toISOString(), mode: mock ? 'mock' : 'paypal-sandbox', realSandboxDisputes: realDisputes,
    summary: { disputes: rows.length, atStake, worthContesting: contest.reduce((t, r) => t + r.assessment.amount, 0), toRefund: rows.length - contest.length },
    rows,
  };
}
