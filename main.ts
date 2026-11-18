// Token Radar — Survey Chart. Node 22+, standard library only.
// Reads the sealed snapshot, scores every pre-token protocol, writes the
// ranked board, the dashboard data bundle, and the library-built dossier.

import fs from 'node:fs';
import path from 'node:path';
import { buildDossier } from './vendor/makefun-board.ts';

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const OUT = process.env.MAKEFUN_OUTPUT_DIR || '/output';

// ---------------------------------------------------------------- input ----

function resolveInput(argv) {
  let p = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--input' && argv[i + 1]) p = argv[i + 1];
    else if (argv[i].startsWith('--input=')) p = argv[i].slice(8);
  }
  if (!p) p = '/input/snapshot.json';
  if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, 'snapshot.json');
  return path.resolve(p);
}

const SNAPSHOT_PATH = resolveInput(process.argv);
const snapshot = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, 'utf8'));
const protocols = snapshot.protocols;
const watchlist = new Set(snapshot.watchlist || []);
const asOf = String(snapshot.as_of || '1970-01-01');

// ------------------------------------------------------------- utilities ---

const DAY = 86400000;
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

function groupDigits(s) {
  const t = String(s);
  return t.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function ageDays(protocol) {
  if (!protocol.listed_at) return 365;
  const listed = Date.parse(protocol.listed_at + 'T00:00:00Z');
  const now = Date.parse(asOf + 'T00:00:00Z');
  if (!Number.isFinite(listed) || !Number.isFinite(now)) return 365;
  return Math.max(0, Math.floor((now - listed) / DAY));
}

// Percentile groups are computed from the whole snapshot. A categorised
// protocol is measured against its own category; an uncategorised one against
// the entire universe. Midrank handles ties without a random element.
const peerCache = new WeakMap();
function peerGroups(snap) {
  if (peerCache.has(snap)) return peerCache.get(snap);
  const groups = new Map();
  groups.set('__universe__', snap.protocols.map((p) => p.tvl_usd));
  for (const p of snap.protocols) {
    if (p.category == null) continue;
    if (!groups.has(p.category)) groups.set(p.category, []);
    groups.get(p.category).push(p.tvl_usd);
  }
  peerCache.set(snap, groups);
  return groups;
}

function peerPercentile(protocol, snap) {
  const groups = peerGroups(snap);
  const list = protocol.category == null
    ? groups.get('__universe__')
    : (groups.get(protocol.category) || groups.get('__universe__'));
  if (!list || list.length === 0) return 0.5;
  let less = 0, equal = 0;
  for (const v of list) {
    if (v < protocol.tvl_usd) less++;
    else if (v === protocol.tvl_usd) equal++;
  }
  return (less + 0.5 * equal) / list.length;
}

// ------------------------------------------------------------ value model --

// One data-driven function; no protocol name is ever special-cased.
function impliedValue(protocol, snap) {
  const tvl = protocol.tvl_usd;
  const growth = 1 + clamp(protocol.change_7d ?? 0, -60, 120) / 100 * 0.6;
  const age = ageDays(protocol);
  const tenure = 0.55 + Math.min(age, 1460) / 1460 * 0.45;
  const peer = 0.8 + 0.4 * peerPercentile(protocol, snap);
  const breadth = 1 + 0.03 * Math.min((protocol.chains || []).length, 8);
  const raw = Math.pow(tvl, 0.86) * 0.42 * growth * tenure * peer * breadth;
  const value = clamp(Math.round(raw), 1, 100000000000000);
  return { value, growth, age, tenure, peer, breadth };
}

// -------------------------------------------------------------- farm plan --

const MODES = {
  lend: ['Lending', 'Uncollateralized Lending', 'CDP', 'CDP Manager',
    'Collateral Management', 'Collateral Markets', 'Yield', 'Yield Aggregator',
    'Basis Trading', 'Onchain Capital Allocator', 'Risk Curators',
    'Interest Rate Derivatives'],
  lp: ['Dexs', 'Derivatives', 'Options', 'Options Vault', 'Synthetics',
    'Prediction Market', 'OTC Marketplace', 'Indexes', 'Algo-Stables',
    'Stablecoin Issuer', 'Reserve Currency', 'Dual-Token Stablecoin',
    'Anchor BTC', 'Decentralized BTC', 'Restaked BTC', 'Stablecoin Wrapper'],
  bridge: ['Bridge', 'Canonical Bridge', 'Cross Chain Bridge'],
  stake: ['Liquid Staking', 'Liquid Restaking', 'Restaking', 'Staking Pool'],
  govern: ['Governance Incentives', 'Decentralized AI', 'AI Agents'],
  points: ['Launchpad', 'Farm', 'Leveraged Farming', 'Liquidity Manager'],
  security: ['Insurance', 'Token Locker', 'Privacy', 'Chain'],
  rwa: ['RWA', 'CeDeFi', 'Crypto Card Issuer', 'Payments', 'CEX',
    'NFT Marketplace', 'Decentralized BTC'],
};

function modeFor(category) {
  if (!category) return 'generic';
  for (const [mode, cats] of Object.entries(MODES)) {
    if (cats.includes(category)) return mode;
  }
  return 'generic';
}

function tvlBand(tvl) {
  if (tvl < 1e7) return '$5-10M';
  if (tvl < 5e7) return '$10-50M';
  if (tvl < 2.5e8) return '$50-250M';
  if (tvl < 1e9) return '$250M-1B';
  return '$1B+';
}

function modeSteps(mode, name, chain, band) {
  switch (mode) {
    case 'lend': return [
      `At ${band} TVL, supply $250-500 of USDC into ${name}'s lending market on ${chain} for 4-6 weeks; keep the supply receipt and the market address.`,
      `Borrow a $50-150 position against that collateral on ${chain} and hold it for one 30-day epoch; keep the borrow hash and a screenshot of the health factor.`,
    ];
    case 'lp': return [
      `At ${band} TVL, provide $200-400 of two-sided liquidity to ${name}'s main pool on ${chain} for 4-8 weeks; keep the LP receipt and a position screenshot.`,
      `Route a $50-150 test swap through ${name} on ${chain} and record the execution hash and the filled price in a dated note.`,
    ];
    case 'bridge': return [
      `At ${band} TVL, bridge $100-250 of USDC into ${name}'s route ending on ${chain} and wait 20-40 minutes; keep both transaction hashes.`,
      `Return a $50-150 tranche over ${name}'s bridge from ${chain} after two weeks; keep the return hash and a timing note.`,
    ];
    case 'stake': return [
      `At ${band} TVL, stake $200-500 equivalent in ${name}'s vault on ${chain} for one 30-day epoch; keep the stake receipt and a rewards screenshot.`,
      `Top up $50-150 on ${chain} after four weeks and compound once; keep the compound hash and before-and-after balance shots.`,
    ];
    case 'govern': return [
      `At ${band} TVL, take a $100-250 governance-eligible position on ${chain} and delegate it for 6-8 weeks; keep the delegation hash and a voting-power snapshot.`,
      `Post one substantive question in ${name}'s forum about its ${chain} deployment; archive the thread URL and the reply in a dated note.`,
    ];
    case 'points': return [
      `At ${band} TVL, complete a $50-150 test transaction through ${name} on ${chain} in the first points epoch; keep the hash and an activity-ledger screenshot.`,
      `Refer one wallet to ${name} on ${chain} with a $50-150 funded balance; keep the referral code, invite screenshot and join date.`,
    ];
    case 'security': return [
      `At ${band} TVL, fund a $100-250 test position in ${name} on ${chain}, spend 20-40 minutes reading its audits, and keep the report PDF with a written risk note.`,
      `Use a dedicated wallet with $50-150 on ${chain}, revoke its approvals after two weeks, and keep the revocation hash.`,
    ];
    case 'rwa': return [
      `At ${band} TVL, take a $250-500 exposure through ${name} on ${chain} for 6-8 weeks; keep the subscription receipt and the on-chain position screenshot.`,
      `Complete the allowance or identity step with a $50-150 test amount on ${chain}; keep the approval email and the transaction hash.`,
    ];
    default: return [
      `At ${band} TVL, open a $100-250 position with ${name} on ${chain} for 4-6 weeks; keep the entry hash and a dashboard balance screenshot.`,
      `Add a second $50-150 tranche on ${chain} after two weeks; keep the hash and a dated note of the average entry.`,
    ];
  }
}

const UNIVERSAL = [
  (n, c) => `Spend 20-40 minutes reading ${n}'s governance forum and post one question about its ${c} deployment; archive the thread and note the date.`,
  (n, c) => `Enter one 30-day points epoch with a $50-150 position on ${c} in ${n}; keep the epoch-start shot, the hash and the final activity export.`,
  (n, c) => `Review ${n}'s audits and contract docs for 20-40 minutes, keep the report PDF, and write a short risk note naming the ${c} contracts used.`,
  (n, c) => `Refer one wallet to ${n} with a $50-150 balance on ${c}; keep the referral link, the invite screenshot and the join date.`,
  (n, c) => `Run a $50-150 test transaction on ${c} through ${n} and archive the hash plus a block-explorer screenshot as proof of use.`,
];

function slugOffset(slug) {
  let h = 0;
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) >>> 0;
  return h % UNIVERSAL.length;
}

function farmPlan(protocol) {
  const name = protocol.name;
  const chain = (protocol.chains && protocol.chains[0]) || 'Ethereum';
  const band = tvlBand(protocol.tvl_usd);
  const steps = modeSteps(modeFor(protocol.category), name, chain, band);
  const off = slugOffset(protocol.slug);
  for (let i = 0; i < 3; i++) {
    steps.push(UNIVERSAL[(off + i) % UNIVERSAL.length](name, chain));
  }
  return steps;
}

// --------------------------------------------------------------- assemble --

const pre = protocols.filter((p) =>
  p.mcap_usd == null && p.gecko_id == null && p.symbol == null);
const live = protocols.filter((p) =>
  !(p.mcap_usd == null && p.gecko_id == null && p.symbol == null));

const scored = pre.map((p) => {
  const s = impliedValue(p, snapshot);
  return {
    slug: p.slug, name: p.name,
    category: p.category || 'Uncategorised',
    mode: modeFor(p.category),
    chains: p.chains || [],
    tvl_usd: p.tvl_usd,
    change_7d: p.change_7d,
    listed_at: p.listed_at,
    age_days: s.age,
    growth: s.growth, tenure: s.tenure, peer: s.peer, breadth: s.breadth,
    implied_value_usd: s.value,
    watchlisted: watchlist.has(p.slug),
    // A structured breakdown lets the survey card show each factor beside
    // its substituted arithmetic instead of a single opaque result.
    factors: {
      tvl_usd: p.tvl_usd,
      exponent: 0.86,
      change_7d: p.change_7d,
      growth: Number(s.growth.toFixed(3)),
      age_days: s.age,
      tenure: Number(s.tenure.toFixed(3)),
      peer_group: p.category == null ? 'whole universe' : p.category,
      peer_percentile: Number(((s.peer - 0.8) / 0.4).toFixed(3)),
      peer: Number(s.peer.toFixed(3)),
      chain_count: (p.chains || []).length,
      breadth: Number(s.breadth.toFixed(3)),
    },
    formula: `round(pow(${groupDigits(p.tvl_usd)}, 0.86) × 0.42 × ${s.growth.toFixed(3)} × ${s.tenure.toFixed(3)} × ${s.peer.toFixed(3)} × ${s.breadth.toFixed(3)}) = ${groupDigits(s.value)}`,
    farm_steps: farmPlan(p),
  };
});

// Deterministic total order: implied value, then TVL, then slug.
scored.sort((a, b) =>
  b.implied_value_usd - a.implied_value_usd ||
  b.tvl_usd - a.tvl_usd ||
  a.slug.localeCompare(b.slug));
scored.forEach((r, i) => { r.rank = i + 1; });

const liveRows = live.map((p) => ({
  slug: p.slug, name: p.name,
  category: p.category || 'Uncategorised',
  chains: p.chains || [],
  tvl_usd: p.tvl_usd,
  change_7d: p.change_7d,
  listed_at: p.listed_at,
})).sort((a, b) => b.tvl_usd - a.tvl_usd || a.slug.localeCompare(b.slug));

fs.mkdirSync(OUT, { recursive: true });

// board.json — ranks are the model's claim, not the array order.
const board = {
  as_of: asOf,
  count: scored.length,
  rows: scored.map((r) => ({
    slug: r.slug,
    name: r.name,
    rank: r.rank,
    implied_value_usd: r.implied_value_usd,
    farm_steps: r.farm_steps,
  })),
};
fs.writeFileSync(path.join(OUT, 'board.json'), JSON.stringify(board));

// data.js — everything the dashboard needs, inline, no fetch.
const radar = {
  meta: {
    as_of: asOf,
    source: 'DefiLlama protocols endpoint',
    total_protocols: protocols.length,
    pre_count: scored.length,
    live_count: liveRows.length,
    watchlist_count: watchlist.size,
    floor_usd: snapshot.floor_usd,
  },
  rows: scored,
  live: liveRows,
  categories: [...new Set(scored.map((r) => r.category))].sort((a, b) => a.localeCompare(b)),
};
fs.writeFileSync(path.join(OUT, 'data.js'), 'window.RADAR = ' + JSON.stringify(radar) + ';\n');

// Dashboard assets.
const destDashboard = path.join(OUT, 'dashboard');
fs.rmSync(destDashboard, { recursive: true, force: true });
fs.cpSync(path.join(ROOT, 'dashboard'), destDashboard, { recursive: true });

// Screenshots: prefer a committed repo/screenshots, then a force-added
// out/screenshots; otherwise keep the ones the helper already wrote into OUT.
const outShots = path.join(OUT, 'screenshots');
fs.mkdirSync(outShots, { recursive: true });
const hasImages = (dir) => {
  try { return fs.readdirSync(dir).some((f) => /\.(png|jpe?g)$/i.test(f)); }
  catch { return false; }
};
for (const candidate of [path.join(ROOT, 'screenshots'), path.join(ROOT, 'out', 'screenshots')]) {
  if (hasImages(candidate)) {
    for (const f of fs.readdirSync(candidate)) {
      if (/\.(png|jpe?g)$/i.test(f)) fs.copyFileSync(path.join(candidate, f), path.join(outShots, f));
    }
    break;
  }
}

// Dossier. The library writes dossier.json itself when screenshots exist; the
// fallbacks cover a string/Buffer return and the screenshot-free first pass.
const dossierPath = path.join(OUT, 'dossier.json');
let dossierWritten = false;
if (hasImages(outShots)) {
  try {
    const result = buildDossier(OUT, { text_max_bytes: 65536 });
    // The library returns the exact dossier bytes for us to write.
    const buf = typeof result === 'string' ? Buffer.from(result)
      : Buffer.from(result.buffer || result, result.byteOffset || 0, result.byteLength);
    fs.writeFileSync(dossierPath, buf);
    dossierWritten = true;
  } catch (err) {
    fs.writeFileSync(path.join(OUT, '.dossier-error'), String(err && err.stack ? err.stack : err));
  }
}
if (!dossierWritten) fs.writeFileSync(dossierPath, '{"placeholder":true}\n');

process.stdout.write(
  `Survey Chart: ${scored.length} soundings, ${liveRows.length} live, ` +
  `${watchlist.size} watchlist covered, top=${scored[0] ? scored[0].name : 'none'}\n`);
