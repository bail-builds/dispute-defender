// Thin PayPal REST client, sandbox only. Orders v2 for the sale, Customer Disputes v1 for disputes.
export class PayPal {
  constructor({ clientId, secret, baseUrl = 'https://api-m.sandbox.paypal.com' }) {
    const host = new URL(baseUrl).hostname;
    const allowed = ['api-m.sandbox.paypal.com', 'api.sandbox.paypal.com', '127.0.0.1', 'localhost'];
    if (!allowed.includes(host)) throw new Error(`Refusing to talk to ${host}. This project is sandbox only (allowed: ${allowed.join(', ')}).`);
    Object.assign(this, { clientId, secret, baseUrl: baseUrl.replace(/\/$/, ''), token: null, tokenExpires: 0 });
  }
  async auth() {
    if (this.token && Date.now() < this.tokenExpires - 30_000) return this.token;
    const basic = Buffer.from(`${this.clientId}:${this.secret}`).toString('base64');
    const res = await fetch(`${this.baseUrl}/v1/oauth2/token`, {
      method: 'POST', headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=client_credentials',
    });
    if (!res.ok) throw new Error(`PayPal auth failed: ${res.status}`);
    const j = await res.json();
    this.token = j.access_token; this.tokenExpires = Date.now() + j.expires_in * 1000;
    return this.token;
  }
  async call(method, path, body, headers = {}) {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method, headers: { Authorization: `Bearer ${await this.auth()}`, 'Content-Type': 'application/json', ...headers },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`PayPal ${method} ${path} -> ${res.status} ${text.slice(0, 300)}`);
    return text ? JSON.parse(text) : {};
  }
  // REAL: create and capture a sandbox sale with PayPal's sandbox test card. Returns the capture id.
  async createSale({ amount, currency = 'USD', description, sku, buyerName = 'Test Buyer' }) {
    const order = await this.call('POST', '/v2/checkout/orders', {
      intent: 'CAPTURE',
      purchase_units: [{ custom_id: sku, description, amount: { currency_code: currency, value: Number(amount).toFixed(2) } }],
      payment_source: { card: { number: '4111111111111111', expiry: '2030-12', security_code: '123', name: buyerName } },
    }, { 'PayPal-Request-Id': `sale-${sku}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` });
    return parseSale(order);
  }
  async getSale(orderId) { return parseSale(await this.call('GET', `/v2/checkout/orders/${encodeURIComponent(orderId)}`)); }
  // Customer Disputes v1 (merchant side). These are the real endpoints; a merchant app cannot file a dispute,
  // so in this project the dispute payloads come from a mock that follows the same schema.
  async listDisputes() { return (await this.call('GET', '/v1/customer/disputes?page_size=20')).items || []; }
  async getDispute(id) { return this.call('GET', `/v1/customer/disputes/${encodeURIComponent(id)}`); }
  async provideEvidence(id, evidences) { return this.call('POST', `/v1/customer/disputes/${encodeURIComponent(id)}/provide-evidence`, { evidences }); }
  async acceptClaim(id, note) { return this.call('POST', `/v1/customer/disputes/${encodeURIComponent(id)}/accept-claim`, { note }); }
  async sendMessage(id, message) { return this.call('POST', `/v1/customer/disputes/${encodeURIComponent(id)}/send-message`, { message }); }
}

export function parseSale(order) {
  const cap = order.purchase_units?.[0]?.payments?.captures?.[0];
  if (!cap) throw new Error(`Order ${order.id} has no capture`);
  const b = cap.seller_receivable_breakdown || {};
  return {
    orderId: order.id, captureId: cap.id, status: cap.status, created: cap.create_time,
    gross: Number(b.gross_amount?.value ?? cap.amount.value), fee: Number(b.paypal_fee?.value ?? 0), currency: cap.amount.currency_code,
    sku: order.purchase_units[0].custom_id, description: order.purchase_units[0].description,
  };
}
