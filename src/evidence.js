// Deterministic evidence engine. The model never decides the score or the recommendation: this code does.
// Each evidence item says what we have, whether it helps, and how much it weighs.
const item = (type, label, detail, weight, ok = true) => ({ type, label, detail, weight, ok });
const fmt = (d) => (d ? d.slice(0, 10) : 'n/a');

export function buildEvidence(dispute, order, sale) {
  const ev = [];
  const s = order.shipping || {};
  const txn = `PayPal capture ${sale.captureId}: ${sale.gross.toFixed(2)} ${sale.currency}, status ${sale.status}, ${fmt(sale.created)}`;
  ev.push(item('TRANSACTION', 'Verified payment', txn, 0));
  const reason = dispute.reason;

  const delivery = () => {
    if (s.status === 'DELIVERED') {
      ev.push(item('PROOF_OF_FULFILLMENT', 'Carrier says delivered', `${s.carrier} ${s.tracking}: delivered ${fmt(s.delivered)}${s.signedBy ? `, signed by ${s.signedBy}` : ''}`, 35));
      ev.push(item('ADDRESS', 'Delivery address', `Address ${s.address}`, s.address?.startsWith('matches') ? 20 : -30, s.address?.startsWith('matches')));
      if (s.photoProof) ev.push(item('DELIVERY_PHOTO', 'Delivery photo on file', 'Carrier delivery photo available', 15));
    } else if (s.status === 'IN_TRANSIT') {
      ev.push(item('PROOF_OF_FULFILLMENT', 'Parcel not delivered', `${s.carrier} ${s.tracking}: still in transit, last scan ${fmt(s.lastScan)}`, -10, false));
    } else {
      ev.push(item('PROOF_OF_FULFILLMENT', 'No tracking', `Sent by ${s.carrier} with no tracking number`, -25, false));
    }
  };

  if (reason === 'MERCHANDISE_OR_SERVICE_NOT_RECEIVED') {
    delivery();
    if (order.chat?.some((m) => m.from === 'buyer' && /thanks|lovely|great|love/i.test(m.text))) ev.push(item('COMMUNICATION', 'Buyer message after delivery', 'Buyer thanked the seller after delivery date', 20));
  } else if (reason === 'MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED') {
    delivery();
    if (order.listing) ev.push(item('LISTING', 'Listing matches item', `Listed ${order.listing.dimensions}; measured ${order.listing.measured}`, 25));
    if (order.chat?.some((m) => m.from === 'seller' && /refund|take it back|return/i.test(m.text))) ev.push(item('COMMUNICATION', 'Remedy offered, buyer chose dispute', 'Seller offered a return or refund before the dispute; buyer did not take it', 20));
    ev.push(item('POLICY', 'Return policy', order.policy, 5));
  } else if (reason === 'UNAUTHORISED') {
    delivery();
    const r = order.risk || {};
    if (r.avs === 'MATCH' && r.cvv === 'MATCH') ev.push(item('RISK', 'Card checks passed', 'AVS and CVV both matched at checkout', 15));
    if (r.sameDeviceAsPriorOrders) ev.push(item('RISK', 'Known device', 'Same device and country (GB) as the buyer\'s earlier orders', 15));
    if (order.customer.priorOrders >= 2) ev.push(item('HISTORY', 'Repeat customer', `${order.customer.priorOrders} earlier orders, none disputed`, 10));
  } else if (reason === 'DUPLICATE_TRANSACTION') {
    if (order.duplicateCharge?.confirmed) ev.push(item('DUPLICATE', 'We charged twice', order.duplicateCharge.note, -100, false));
  }
  return ev;
}

export function assess(dispute, order, sale) {
  const evidence = buildEvidence(dispute, order, sale);
  const sum = evidence.reduce((a, e) => a + e.weight, 0);
  const score = sum <= 0 ? 0 : Math.round(95 * (1 - Math.exp(-sum / 60)));
  const amount = Number(dispute.dispute_amount.value);
  let recommendation = score >= 65 ? 'CONTEST' : score >= 40 ? 'CONTEST_WITH_CAUTION' : 'ACCEPT_AND_REFUND';
  let why;
  if (dispute.reason === 'DUPLICATE_TRANSACTION' && order.duplicateCharge?.confirmed) {
    recommendation = 'ACCEPT_AND_REFUND'; why = 'Our own records show a double charge. Contesting would be wrong and would hurt the account.';
  } else if (recommendation !== 'CONTEST' && amount < 15) {
    recommendation = 'ACCEPT_AND_REFUND'; why = 'Evidence is thin and the amount is too small to be worth the time.';
  } else if (recommendation === 'CONTEST') why = 'Strong proof of fulfilment and matching details.';
  else if (recommendation === 'CONTEST_WITH_CAUTION') why = 'Some good evidence, but gaps a reviewer may notice.';
  else why = 'We cannot prove the buyer got what they paid for.';
  return { evidence, score, recommendation, why, amount, currency: dispute.dispute_amount.currency_code };
}
