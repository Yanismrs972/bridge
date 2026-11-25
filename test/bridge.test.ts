// Tests Bridge v1 (simulation uniquement). Données écrites dans un dossier temporaire, jamais dans le dépôt.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { parseArgs } from '../src/args.js';
import { REPO_ROOT, Stop, guard, referenceData, sha, slugRef } from '../src/core.js';
import { Mission } from '../src/mission.js';
import { SCENARIOS, findScenario } from '../src/scenarios.js';
import { startBridge } from '../src/server.js';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'bridge-test-'));
const harnessHash = () => {
  const h: string[] = [];
  const walk = (d: string) => { for (const n of fs.readdirSync(d).sort()) { const p = path.join(d, n); if (fs.statSync(p).isDirectory()) walk(p); else h.push(n + sha(fs.readFileSync(p))); } };
  walk(path.join(REPO_ROOT, 'harness'));
  return sha(h.join('|'));
};
const HARNESS_BEFORE = harnessHash();

async function runAuto(root: string, scenarioId: string, decisions: boolean[] | 'all') {
  const m = new Mission(root, Mission.newId(), findScenario(scenarioId)!);
  m.prepare();
  const done = m.run();
  let i = 0;
  while (m.status === 'EN_COURS' || m.status === 'ATTENTE_APPROBATION') {
    if (m.status === 'ATTENTE_APPROBATION') m.approve(decisions === 'all' ? true : decisions[i++] ?? false);
    await new Promise((r) => setImmediate(r));
  }
  await done;
  return m;
}

test('les 15 scénarios repris du harnais donnent le résultat attendu (approbations accordées)', async () => {
  const root = tmp();
  for (const sc of SCENARIOS) {
    const m = await runAuto(root, sc.id, 'all');
    assert.equal(m.code, sc.expect, `${sc.id} : obtenu ${m.code} (${m.detail})`);
  }
});

test('mission nominale : les 6 slugs sont corrigés, REGLES.md intact, journal terminé', async () => {
  const root = tmp();
  const m = await runAuto(root, 'SIM-01-nominal', 'all');
  assert.equal(m.status, 'TERMINEE'); assert.equal(m.code, 'OBJECTIF_ATTEINT');
  const data = JSON.parse(fs.readFileSync(path.join(m.dir.projet, 'data', 'produits.json'), 'utf8'));
  assert.deepEqual(data.map((o: any) => o.slug), referenceData().map((o) => slugRef(o.nom)));
  assert.equal(fs.readFileSync(path.join(m.dir.projet, 'REGLES.md'), 'utf8'), fs.readFileSync(path.join(REPO_ROOT, 'harness', 'fixture', 'REGLES.md'), 'utf8'));
  const events = m.readJournal().map((e) => e.event);
  assert.ok(events.includes('APPROBATION_ACCORDEE')); assert.equal(events.at(-1), 'FIN');
});

test("refus humain : l'exécutant n'est jamais appelé et le projet n'est pas modifié", async () => {
  const root = tmp();
  const m = await runAuto(root, 'SIM-01-nominal', [false]);
  assert.equal(m.code, 'REFUSE_PAR_HUMAIN'); assert.equal(m.calls.executor, 0);
  assert.equal(fs.readFileSync(path.join(m.dir.projet, 'data', 'produits.json'), 'utf8'),
    fs.readFileSync(path.join(REPO_ROOT, 'harness', 'fixture', 'data', 'produits.json'), 'utf8'));
});

test('correction : refus de la seconde approbation arrête la mission', async () => {
  const m = await runAuto(tmp(), 'SIM-02-correction-unique', [true, false]);
  assert.equal(m.code, 'REFUSE_PAR_HUMAIN'); assert.equal(m.calls.executor, 1);
});

test('garde de périmètre : hors racine, Fastclip et noms réservés refusés', () => {
  const root = tmp();
  const code = (p: string) => { try { guard(root, p); return null; } catch (e) { return (e as Stop).code; } };
  assert.equal(code(path.join(root, '..', 'x.txt')), 'CHEMIN_HORS_PERIMETRE');
  assert.equal(code(path.join(root, 'Fastclip', 'x.txt')), 'CHEMIN_INTERDIT');
  assert.equal(code(path.join(root, 'NUL')), 'CHEMIN_INVALIDE');
  assert.equal(code(path.join(root, 'a.txt:flux')), 'CHEMIN_INVALIDE');
  assert.equal(code(path.join(root, 'ok.txt')), null);
});

test('--real est refusé (option et processus), les autres options inconnues aussi', () => {
  for (const a of [['--real'], ['--real=1'], ['--port', '5000', '--real']])
    assert.throws(() => parseArgs(a), (e: Stop) => e.code === 'MODE_REEL_DESACTIVE');
  assert.throws(() => parseArgs(['--autre']), (e: Stop) => e.code === 'OPTION_INCONNUE');
  assert.equal(parseArgs([]).port, 4317);
  const r = spawnSync(process.execPath, [path.join(REPO_ROOT, 'dist', 'src', 'cli.js'), '--real'], { encoding: 'utf8', timeout: 10_000 });
  assert.equal(r.status, 2); assert.match(r.stderr, /MODE_REEL_DESACTIVE/);
});

test('serveur : écoute sur 127.0.0.1, mission complète via HTTP avec approbation', async () => {
  const b = await startBridge({ dataDir: tmp(), port: 0 });
  try {
    assert.equal((b.server.address() as any).address, '127.0.0.1');
    const base = `http://127.0.0.1:${b.port}`;
    const post = (p: string, body: unknown) => fetch(base + p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    assert.match(await (await fetch(base + '/')).text(), /Bridge v1/);
    assert.equal((await post('/api/missions', { mode: 'reel', scenario: 'SIM-01-nominal' })).status, 403);
    const { id } = await (await post('/api/missions', { mode: 'simulation', scenario: 'SIM-02-correction-unique' })).json() as any;
    assert.equal((await post('/api/missions', { scenario: 'SIM-01-nominal' })).status, 409); // une seule mission à la fois
    let v: any; let approvals = 0;
    for (let i = 0; i < 200; i++) {
      v = await (await fetch(`${base}/api/missions/${id}`)).json();
      if (v.status === 'ATTENTE_APPROBATION') { assert.equal((await post(`/api/missions/${id}/approbation`, { decision: 'approuver' })).status, 200); approvals++; }
      if (v.status === 'TERMINEE' || v.status === 'ARRETEE') break;
      await new Promise((r) => setTimeout(r, 10));
    }
    assert.equal(v.code, 'OBJECTIF_ATTEINT'); assert.equal(approvals, 2);
    assert.deepEqual(v.produitsActuels.map((o: any) => o.slug), referenceData().map((o) => slugRef(o.nom)));
    // Requête d'une page tierce : refusée.
    const evil = await fetch(base + '/api/missions', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'http://evil.example' }, body: '{"scenario":"SIM-01-nominal"}' });
    assert.equal(evil.status, 403);
    const rebindingStatus = await new Promise<number>((resolve, reject) => {
      http.get({ host: '127.0.0.1', port: b.port, path: '/api/etat', headers: { Host: 'evil.example' } }, (res) => { res.resume(); resolve(res.statusCode ?? 0); }).on('error', reject);
    });
    assert.equal(rebindingStatus, 403);
  } finally { await b.close(); }
});

test('redémarrage : une mission coupée en cours est marquée INTERROMPUE, sans reprise automatique', async () => {
  const dataDir = tmp();
  const b1 = await startBridge({ dataDir, port: 0 });
  const r = await fetch(`http://127.0.0.1:${b1.port}/api/missions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"scenario":"SIM-01-nominal"}' });
  const { id } = await r.json() as any;
  for (let i = 0; i < 100 && b1.missions.get(id)!.status !== 'ATTENTE_APPROBATION'; i++) await new Promise((x) => setTimeout(x, 10));
  await b1.close(); // Bridge s'arrête pendant l'attente d'approbation
  const b2 = await startBridge({ dataDir, port: 0 });
  try {
    const m = b2.missions.get(id)!;
    assert.equal(m.status, 'INTERROMPUE'); assert.equal(m.code, 'INTERROMPUE_SANS_REPRISE'); assert.equal(m.calls.executor, 0);
  } finally { await b2.close(); }
});

test('le harnais validé (harness/) n\'est jamais modifié', () => { assert.equal(harnessHash(), HARNESS_BEFORE); });
