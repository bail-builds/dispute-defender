import { runPipeline } from './run.js';
const args = process.argv.slice(2);
const out = await runPipeline({ mock: args.includes('--mock') || undefined });
if (args.includes('--json')) { console.log(JSON.stringify(out, null, 2)); process.exit(0); }
console.log(`Dispute Defender (${out.mode}; disputes are SIMULATED, sales are ${out.mode === 'mock' ? 'mocked' : 'real PayPal Sandbox captures'})`);
for (const r of out.rows) {
  const d = r.dispute; const a = r.assessment;
  console.log(`\n${d.dispute_id}  ${d.reason}  ${a.amount.toFixed(2)} ${a.currency}  respond by ${d.seller_response_due_date.slice(0, 10)}`);
  console.log(`  win score ${a.score}/100 -> ${a.recommendation}: ${a.why}`);
  for (const e of a.evidence.filter((x) => x.type !== 'TRANSACTION')) console.log(`   ${e.ok ? '+' : '-'} ${e.label}: ${e.detail}`);
  console.log(`  draft (${r.response.source}):\n    ${r.response.text.replace(/\n/g, '\n    ')}`);
}
