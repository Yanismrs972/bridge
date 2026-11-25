// ui.ts — page unique de l'interface Bridge (HTML + JS sans dépendance). Tout contenu affiché passe par textContent.
export const PAGE = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Bridge v1</title>
<style>
:root{--bg:#fff;--fg:#1b1b1b;--mut:#666;--bd:#ddd;--ok:#127a2e;--ko:#b3261e;--warn:#8a5a00;--card:#f6f6f6}
@media (prefers-color-scheme:dark){:root{--bg:#161616;--fg:#eee;--mut:#aaa;--bd:#333;--ok:#5fd37c;--ko:#ff8a80;--warn:#ffcc66;--card:#222}}
body{background:var(--bg);color:var(--fg);font:15px/1.45 system-ui,sans-serif;margin:0;padding:16px;max-width:1100px}
h1{font-size:20px;margin:0 0 4px}h2{font-size:16px;margin:18px 0 8px}
.mut{color:var(--mut)}.badge{display:inline-block;padding:2px 8px;border-radius:10px;border:1px solid var(--bd);font-size:13px}
.ok{color:var(--ok)}.ko{color:var(--ko)}.warn{color:var(--warn)}
.card{background:var(--card);border:1px solid var(--bd);border-radius:8px;padding:12px;margin:10px 0}
select,button{font:inherit;padding:6px 10px}select{max-width:100%}button{cursor:pointer}
.row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}@media(max-width:700px){.grid{grid-template-columns:1fr}}
pre{white-space:pre-wrap;word-break:break-word;font-size:12.5px;margin:0;max-height:320px;overflow:auto}
table{border-collapse:collapse;width:100%;font-size:13px}td,th{border-bottom:1px solid var(--bd);padding:4px 6px;text-align:left;vertical-align:top}
li{cursor:pointer;margin:2px 0}li.sel{font-weight:bold}
</style></head><body>
<h1>Bridge v1</h1>
<div class="mut">Mode : <span class="badge" id="mode">…</span> · agents simulés, aucun appel réseau, aucun coût · Superviseur Codex (lecture seule) · Exécutant Claude Code (seul autorisé à modifier)</div>

<div class="card">
  <h2 style="margin-top:0">Nouvelle mission simulée</h2>
  <div class="mut">Mission : « Corriger les slugs de data/produits.json selon REGLES.md » sur une copie du projet d'exemple.</div>
  <div class="row" style="margin-top:8px">
    <select id="scenario"></select>
    <button id="lancer">Lancer la mission</button>
    <span id="msg" class="ko"></span>
  </div>
</div>

<div class="grid">
  <div><h2>Missions</h2><ul id="liste" class="mut"></ul></div>
  <div id="detail"><h2>Détail</h2><div class="mut">Aucune mission sélectionnée.</div></div>
</div>

<script>
'use strict';
let selected = null;
const $ = (id) => document.getElementById(id);
const el = (tag, text, cls) => { const e = document.createElement(tag); if (text !== undefined) e.textContent = text; if (cls) e.className = cls; return e; };
async function api(path, body) {
  const r = await fetch(path, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {});
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.erreur || ('HTTP ' + r.status));
  return j;
}
const STATUT = { EN_COURS: ['En cours', 'warn'], ATTENTE_APPROBATION: ['En attente de votre approbation', 'warn'],
  TERMINEE: ['Terminée', 'ok'], ARRETEE: ['Arrêtée par Bridge', 'ko'], INTERROMPUE: ['Interrompue', 'ko'] };

async function init() {
  const etat = await api('/api/etat');
  $('mode').textContent = etat.mode.toUpperCase();
  for (const s of await api('/api/scenarios')) {
    const o = el('option', s.id + ' — ' + s.titre); o.value = s.id; $('scenario').appendChild(o);
  }
  $('lancer').onclick = async () => {
    $('msg').textContent = '';
    try { const r = await api('/api/missions', { mode: 'simulation', scenario: $('scenario').value }); selected = r.id; refresh(); }
    catch (e) { $('msg').textContent = e.message; }
  };
  refresh(); setInterval(refresh, 1000);
}

async function refresh() {
  const list = await api('/api/missions').catch(() => null);
  if (!list) return;
  const ul = $('liste'); ul.replaceChildren();
  if (!list.length) ul.appendChild(el('li', 'Aucune mission pour l\\'instant.'));
  for (const m of list) {
    const [lib, cls] = STATUT[m.status] || [m.status, ''];
    const li = el('li'); if (m.id === selected) li.className = 'sel';
    li.append(el('span', m.id + ' · ' + m.scenario + ' · '), el('span', lib + (m.code ? ' (' + m.code + ')' : ''), cls));
    li.onclick = () => { selected = m.id; refresh(); };
    ul.appendChild(li);
  }
  if (!selected && list.length) selected = list[0].id;
  if (selected) renderDetail(await api('/api/missions/' + encodeURIComponent(selected)).catch(() => null));
}

function pre(obj) { return el('pre', typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2)); }

function renderDetail(m) {
  const d = $('detail'); d.replaceChildren(el('h2', 'Détail'));
  if (!m) { d.appendChild(el('div', 'Mission introuvable.', 'mut')); return; }
  const [lib, cls] = STATUT[m.status] || [m.status, ''];
  const head = el('div', null, 'card');
  head.append(el('div', m.id + ' — ' + m.titre), el('div', lib + (m.code ? ' : ' + m.code : ''), cls));
  if (m.detail) head.appendChild(el('div', m.detail, 'mut'));
  head.appendChild(el('div', 'Appels superviseur ' + m.calls.supervisor + '/' + m.limits.supervisorCalls +
    ' · exécutant ' + m.calls.executor + '/' + m.limits.executorCalls + ' · corrections max ' + m.limits.corrections +
    ' · coût ' + m.costUsd.toFixed(2) + ' $ / budget ' + m.limits.executorMaxBudgetUsd.toFixed(2) + ' $', 'mut'));
  d.appendChild(head);

  if (m.pending) {
    const c = el('div', null, 'card');
    c.append(el('strong', 'Approbation requise : ' + m.pending.titre), pre(m.pending.details));
    const row = el('div', null, 'row'); row.style.marginTop = '8px';
    const yes = el('button', 'Approuver'), no = el('button', 'Refuser');
    yes.onclick = () => api('/api/missions/' + m.id + '/approbation', { decision: 'approuver' }).then(refresh).catch((e) => alert(e.message));
    no.onclick = () => api('/api/missions/' + m.id + '/approbation', { decision: 'refuser' }).then(refresh).catch((e) => alert(e.message));
    row.append(yes, no); c.appendChild(row); d.appendChild(c);
  }

  const t = el('table'); const hr = el('tr'); ['id', 'nom', 'slug avant', 'slug actuel'].forEach((h) => hr.appendChild(el('th', h))); t.appendChild(hr);
  const cur = Array.isArray(m.produitsActuels) ? m.produitsActuels : [];
  (m.produitsAvant || []).forEach((p, i) => {
    const tr = el('tr'); const now = cur[i] ? String(cur[i].slug) : '(illisible)';
    tr.append(el('td', p.id), el('td', p.nom), el('td', p.slug), el('td', now, now !== p.slug ? 'ok' : ''));
    t.appendChild(tr);
  });
  const pc = el('div', null, 'card'); pc.append(el('strong', 'Projet (copie) : data/produits.json'), t);
  if (!Array.isArray(m.produitsActuels)) pc.appendChild(pre(m.produitsActuels));
  d.appendChild(pc);

  const jc = el('div', null, 'card'); jc.appendChild(el('strong', 'Journal'));
  const jt = el('table');
  for (const e of m.journal) {
    const tr = el('tr'); const { t: ts, event, ...rest } = e;
    tr.append(el('td', String(ts).slice(11, 19)), el('td', event), el('td', JSON.stringify(rest).slice(0, 300)));
    jt.appendChild(tr);
  }
  jc.appendChild(jt); d.appendChild(jc);
}
init().catch((e) => { document.body.appendChild(el('p', 'Erreur : ' + e.message, 'ko')); });
</script></body></html>`;
