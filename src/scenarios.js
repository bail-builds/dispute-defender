// SIMULATED data. A merchant app cannot file a PayPal dispute, so these disputes follow the shape of the
// Customer Disputes v1 API (dispute_id, reason, status, dispute_amount, disputed_transactions, messages,
// seller_response_due_date). The merchant's own records (shipping, store policy, chat) are the "order system".
// Everything here is fictional: no real people, emails or addresses.
const days = (n) => new Date(Date.UTC(2026, 9, 4) - n * 864e5).toISOString();
const due = (n) => new Date(Date.UTC(2026, 9, 4) + n * 864e5).toISOString();

export const SCENARIOS = [
  {
    key: 'tracked-delivered', amount: 84.0, sku: 'LAMP-OAK', item: 'Oak desk lamp',
    dispute: { reason: 'MERCHANDISE_OR_SERVICE_NOT_RECEIVED', buyerNote: 'Parcel never arrived.', created: days(3), respondBy: due(7) },
    order: {
      customer: { name: 'Buyer A', email: 'buyer-a@example.test', priorOrders: 2 },
      shipping: { carrier: 'DPD', tracking: 'DPD-0001-TEST', status: 'DELIVERED', shipped: days(12), delivered: days(9), signedBy: 'B. Anders', address: 'matches the PayPal shipping address', photoProof: true },
      chat: [{ at: days(8), from: 'buyer', text: 'Thanks, looks lovely on the shelf!' }],
      policy: 'Refunds within 30 days if the item is unused.',
    },
  },
  {
    key: 'in-transit', amount: 129.0, sku: 'KETTLE-RED', item: 'Red kettle',
    dispute: { reason: 'MERCHANDISE_OR_SERVICE_NOT_RECEIVED', buyerNote: 'Still nothing after two weeks.', created: days(2), respondBy: due(9) },
    order: {
      customer: { name: 'Buyer B', email: 'buyer-b@example.test', priorOrders: 0 },
      shipping: { carrier: 'Royal Mail', tracking: 'RM-0002-TEST', status: 'IN_TRANSIT', shipped: days(15), delivered: null, signedBy: null, address: 'matches the PayPal shipping address', photoProof: false, lastScan: days(11) },
      chat: [{ at: days(5), from: 'buyer', text: 'Where is my kettle?' }],
      policy: 'Refunds within 30 days if the item is unused.',
    },
  },
  {
    key: 'not-as-described', amount: 58.0, sku: 'RUG-GREY', item: 'Grey wool rug 120x180',
    dispute: { reason: 'MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED', buyerNote: 'Rug is smaller than advertised.', created: days(4), respondBy: due(6) },
    order: {
      customer: { name: 'Buyer C', email: 'buyer-c@example.test', priorOrders: 1 },
      shipping: { carrier: 'DPD', tracking: 'DPD-0003-TEST', status: 'DELIVERED', shipped: days(14), delivered: days(10), signedBy: 'front door', address: 'matches the PayPal shipping address', photoProof: false },
      listing: { title: 'Grey wool rug 120x180cm', dimensions: '120 x 180 cm', measured: '118 x 178 cm (within 2% manufacturing tolerance, stated on listing)' },
      chat: [
        { at: days(6), from: 'buyer', text: 'The rug looks a bit small.' },
        { at: days(6), from: 'seller', text: 'Happy to take it back for a full refund, or send a size chart. Your choice.' },
        { at: days(5), from: 'buyer', text: 'I will open a dispute.' },
      ],
      policy: 'Returns accepted within 30 days. Buyer pays return postage unless item is faulty.',
    },
  },
  {
    key: 'unauthorised', amount: 240.0, sku: 'BOOTS-TAN', item: 'Tan leather boots',
    dispute: { reason: 'UNAUTHORISED', buyerNote: 'I did not make this purchase.', created: days(5), respondBy: due(5) },
    order: {
      customer: { name: 'Buyer D', email: 'buyer-d@example.test', priorOrders: 4 },
      shipping: { carrier: 'DHL', tracking: 'DHL-0004-TEST', status: 'DELIVERED', shipped: days(20), delivered: days(17), signedBy: 'B. Dunn', address: 'matches the PayPal shipping address', photoProof: true },
      risk: { avs: 'MATCH', cvv: 'MATCH', ipCountry: 'GB', billingCountry: 'GB', sameDeviceAsPriorOrders: true },
      chat: [],
      policy: 'Refunds within 30 days if the item is unused.',
    },
  },
  {
    key: 'duplicate', amount: 36.0, sku: 'MUG-SET', item: 'Ceramic mug set',
    dispute: { reason: 'DUPLICATE_TRANSACTION', buyerNote: 'I was charged twice for the same order.', created: days(1), respondBy: due(10) },
    order: {
      customer: { name: 'Buyer E', email: 'buyer-e@example.test', priorOrders: 0 },
      shipping: { carrier: 'DPD', tracking: 'DPD-0005-TEST', status: 'DELIVERED', shipped: days(6), delivered: days(4), signedBy: 'neighbour', address: 'matches the PayPal shipping address', photoProof: false },
      duplicateCharge: { confirmed: true, note: 'Order system shows one order but two captures 40 seconds apart (checkout retry).' },
      chat: [],
      policy: 'Refunds within 30 days if the item is unused.',
    },
  },
  {
    key: 'no-tracking', amount: 12.0, sku: 'CARD-PACK', item: 'Greeting card pack',
    dispute: { reason: 'MERCHANDISE_OR_SERVICE_NOT_RECEIVED', buyerNote: 'Never came.', created: days(2), respondBy: due(8) },
    order: {
      customer: { name: 'Buyer F', email: 'buyer-f@example.test', priorOrders: 0 },
      shipping: { carrier: 'Royal Mail 2nd class letter', tracking: null, status: 'NO_TRACKING', shipped: days(25), delivered: null, signedBy: null, address: 'matches the PayPal shipping address', photoProof: false },
      chat: [],
      policy: 'Refunds within 30 days if the item is unused.',
    },
  },
];

export function disputeFor(sc, i, sale) {
  const id = `PP-D-SIM-${String(i + 1).padStart(4, '0')}`;
  return {
    dispute_id: id, status: 'WAITING_FOR_SELLER_RESPONSE', reason: sc.dispute.reason, dispute_life_cycle_stage: 'INQUIRY',
    create_time: sc.dispute.created, seller_response_due_date: sc.dispute.respondBy,
    dispute_amount: { currency_code: sale.currency, value: sale.gross.toFixed(2) },
    disputed_transactions: [{ seller_transaction_id: sale.captureId, buyer: { name: sc.order.customer.name } }],
    messages: [{ posted_by: 'BUYER', time_posted: sc.dispute.created, content: sc.dispute.buyerNote }],
    simulated: true,
  };
}
