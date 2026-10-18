import { createHash } from 'node:crypto';

export const REPORT_DOCUMENT_VERSION = 'report_document_v3';
const TAGS = new Set('section div p h1 h2 h3 h4 h5 h6 ul ol li table thead tbody tfoot tr th td strong b em i u span br hr blockquote'.split(' '));
const VOID = new Set(['br', 'hr']);
const ATTRS = new Set(['colspan', 'rowspan', 'data-evidence-id', 'data-laiq-provenance', 'data-source-evidence-ids', 'data-block-id', 'data-section-id', 'data-report-format']);
const REPORT_FORMATS = new Set(['paired-fields', 'labelled-fields', 'component-narrative']);

export function escapeReportText(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function decode(value) {
  return String(value).replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (_, key) => {
    const codes = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
    if (key[0] !== '#') return codes[key.toLowerCase()] ?? '';
    const number = key[1].toLowerCase() === 'x' ? parseInt(key.slice(2), 16) : parseInt(key.slice(1), 10);
    return number > 0 && number <= 0x10ffff ? String.fromCodePoint(number) : '';
  });
}

export function parseSectionDocument({ sectionId, html = '', planId = null }) {
  const input = String(html);
  const safe = input.replace(/<(script|style|iframe|object)\b[^>]*>[\s\S]*?<\/\1>/gi, '');
  const root = { tag: 'root', children: [] };
  const stack = [root];
  let count = 0;
  for (const token of safe.match(/<!--[^]*?-->|<[^>]*>|[^<]+|</g) ?? []) {
    if (token.startsWith('<!--')) continue;
    if (!token.startsWith('<') || token === '<') {
      stack.at(-1).children.push({ text: decode(token) });
      continue;
    }
    const close = token.match(/^<\/\s*([a-z0-9]+)/i);
    if (close) {
      const tag = close[1].toLowerCase();
      for (let index = stack.length - 1; index > 0; index -= 1) {
        if (stack[index].tag === tag) { stack.length = index; break; }
      }
      continue;
    }
    const tag = token.match(/^<\s*([a-z0-9]+)/i)?.[1].toLowerCase();
    if (!TAGS.has(tag)) continue;
    const attrs = {};
    for (const match of token.matchAll(/([\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
      const key = match[1].toLowerCase();
      if (!ATTRS.has(key)) continue;
      const value = decode(match[2] ?? match[3]);
      if (['colspan', 'rowspan'].includes(key)) {
        if (/^[1-9]\d?$/.test(value)) attrs[key] = value;
      } else if (key === 'data-report-format') {
        if (REPORT_FORMATS.has(value)) attrs[key] = value;
      } else attrs[key] = value;
    }
    const node = { blockId: `${sectionId}:node:${++count}`, tag, attrs, children: [] };
    stack.at(-1).children.push(node);
    if (!VOID.has(tag) && !token.endsWith('/>')) stack.push(node);
  }
  return {
    contractVersion: REPORT_DOCUMENT_VERSION,
    sectionId,
    planId,
    sourceContentHash: createHash('sha256').update(input).digest('hex'),
    blocks: root.children,
  };
}

export function renderSectionDocumentHtml(document) {
  const render = (node) => Object.hasOwn(node, 'text') ? escapeReportText(node.text)
    : `<${node.tag}${Object.entries(node.attrs ?? {}).map(([key, value]) => ` ${key}="${escapeReportText(value)}"`).join('')}>${VOID.has(node.tag) ? '' : `${node.children.map(render).join('')}</${node.tag}>`}`;
  return document.blocks.map(render).join('');
}

export function reportNodeText(node) {
  return Object.hasOwn(node ?? {}, 'text') ? node.text : (node?.children ?? []).map(reportNodeText).join('');
}

export function sectionDocumentNodes(document) {
  const nodes = [];
  const visit = (node) => {
    if (!node || Object.hasOwn(node, 'text')) return;
    nodes.push(node);
    (node.children ?? []).forEach(visit);
  };
  (document?.blocks ?? []).forEach(visit);
  return nodes;
}

export function validateSectionDocument(document) {
  const issues = [];
  const nodes = sectionDocumentNodes(document);
  if (!nodes.some((node) => ['p', 'td', 'li'].includes(node.tag) && reportNodeText(node).trim())) {
    issues.push('Section has no substantive report content.');
  }
  for (const node of nodes) {
    if (node.tag === 'table' && !reportNodeText(node).trim()) issues.push('Empty report table.');
  }
  return { valid: issues.length === 0, issues: [...new Set(issues)] };
}

