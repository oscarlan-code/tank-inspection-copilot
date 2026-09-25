#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { SECTION_IDS } from '../experiments/section-kb-ablation.mjs';
const root = fileURLToPath(new URL('../../docs/reviews/data/tk5452-kb-ablation-v1/', import.meta.url));
const read = async name => JSON.parse(await readFile(join(root, name), 'utf8'));
const preview = process.argv.includes('--preview');
const data = preview ? await read('live-request-preview.json') : await read('comparison.json');
const obligations = await read('frozen-input-obligations.json');
const sources = await read('historical-source-audit.json');
const patterns = await read('historical-patterns.json');
const esc = value => String(value ?? '').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const title = id => id==='01-scope' ? '1 Scope of Inspection' : '5 Repair Recommendations';
const sections = SECTION_IDS.map(sectionId => {
  const arms = preview ? [] : data.results.filter(row=>row.sectionId===sectionId);
  if (!preview) { assert.equal(arms.length, 2); assert.equal(arms[0].baseRequestHash, arms[1].baseRequestHash); }
  const expected = obligations.sections.find(row=>row.sectionId===sectionId).obligations;
  const cards = arms.map(row=>`<div><strong>${row.arm==='without_kb'?'Without historical KB':'With historical KB'}</strong><p>${row.words} words · ${row.rawFindings.length} statements</p><p class="status">${row.generationRun.usedLiveModel ? 'Accepted by current checks; inspector review remains required.' : 'AI candidate not accepted. Retained draft uses the original captured notes.'}</p><p>${esc(row.generationRun.fallbackReason ?? '')}</p></div>`).join('');
  const table = expected.map((item,index)=>{
    const cells = ['without_kb','with_kb'].map(arm=>{
      if(preview) return '<td class="pending">Awaiting approved live test.</td>';
      const result = arms.find(row=>row.arm===arm);
      const finding = result.rawFindings.find(f=>item.evidenceIds.includes(f.evidenceId));
      return `<td>${esc(finding?.text ?? 'Missing statement')}</td>`;
    }).join('');
    return `<tr><td><span class="number">${index+1}</span>${esc(item.expected.text)}</td>${cells}</tr>`;
  }).join('');
  return `<section><h2>${title(sectionId)}</h2><div class="arm-summary">${cards}</div><div class="table-scroll"><table><thead><tr><th>Same processed app evidence</th><th>AI without historical KB</th><th>AI with historical KB</th></tr></thead><tbody>${table}</tbody></table></div>
    <details><summary>Historical guidance supplied to the KB version</summary>${patterns[sectionId].map(p=>`<p><strong>${esc(p.pattern)}</strong><br>${esc(p.instruction)}</p>`).join('')}</details>
    ${preview ? '' : `<details><summary>Formatted candidates, using the shared report formatter</summary><div class="formatted">${arms.map(row=>`<div><h3>${row.arm==='without_kb'?'Without KB':'With KB'}</h3>${row.candidateContent}</div>`).join('')}</div></details>`}</section>`;
}).join('');
const sourceList = [...new Map(sources.sources.map(s=>[s.document_id,s])).values()].map(s=>`<li>${esc(s.selected_relative_path)} · issued ${esc(s.issuedOn)} · approved training source, different asset.</li>`).join('');
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Two-section KB comparison</title><style>
*{box-sizing:border-box}body{margin:0;background:#f3f6f8;color:#203348;font:16px/1.55 system-ui,sans-serif}main{max-width:1550px;margin:0 auto;padding:28px}h1{font-size:30px;margin:12px 0}h2{color:#076b89}h3{font-size:18px}.badge{display:inline-block;background:#107653;color:white;padding:4px 12px;border-radius:5px;font-weight:700}section{background:white;border:1px solid #d3dee6;border-radius:10px;padding:24px;margin:24px 0}table{width:100%;border-collapse:collapse;table-layout:fixed}th,td{text-align:left;vertical-align:top;padding:14px;border:1px solid #c8d5df;overflow-wrap:anywhere}th{background:#edf4f8}td:first-child{background:#f8fafb}.number{display:block;color:#607386;font-size:13px}.arm-summary{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:20px}.status{color:#845512}.pending{color:#677e91}details{border-top:1px solid #d3dee6;padding:16px 0;margin-top:20px}summary{cursor:pointer;font-weight:600}.formatted{display:grid;grid-template-columns:1fr 1fr;gap:24px}.formatted>div{min-width:0;overflow:auto}.formatted h1{font-size:24px}.formatted table{table-layout:auto}code{overflow-wrap:anywhere;font-size:12px}footer{color:#546b7d} @media(max-width:850px){main{padding:12px}section{padding:12px}.table-scroll{overflow:auto}table{min-width:850px}.formatted,.arm-summary{grid-template-columns:1fr}}
</style></head><body><main><span class="badge">EVALUATION ONLY</span><h1>Does historical KB improve these two sections?</h1><p>Identical TK5452 mock input, model, outline, shared formatter and validation. The only intervention is curated historical writing guidance. ${preview ? '<strong>Prepared preview — no live results yet.</strong>' : 'These are the actual raw AI candidates; acceptance status is shown separately.'}</p><p>One response per condition. This is a small source-derived reconstruction experiment, not an independent benchmark or promotion result.</p><p>Frozen input SHA-256: <code>${esc(data.inputSha256)}</code></p>${sections}<section><h2>Source isolation</h2><ul>${sourceList}</ul><p>The worker receives abstracted writing patterns, not the original historical paragraphs, their identities or extra findings. No target-report answer text, same-asset history or held-out sources are supplied. Source selection is curated; full automated retrieval quality is outside this test.</p></section><footer>No production policy or draft is changed. No evidence appendix is generated. Original response JSON and request hashes are saved beside this file.</footer></main></body></html>`;
await writeFile(join(root, preview ? 'comparison-preview.html' : 'comparison.html'), html);
console.log(`Rendered ${preview ? 'prepared preview' : 'actual comparison'}; ${obligations.sections.reduce((n,s)=>n+s.obligations.length,0)} input-relative statement rows.`);
