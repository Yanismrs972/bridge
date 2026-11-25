// server.ts — serveur HTTP local de Bridge. Écoute UNIQUEMENT sur 127.0.0.1.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { Stop, guard } from './core.js';
import { Mission } from './mission.js';
import { SCENARIOS, findScenario } from './scenarios.js';
import { PAGE } from './ui.js';

export const HOST = '127.0.0.1';
export interface BridgeOptions { dataDir: string; port: number; stepDelayMs?: number }
export interface BridgeServer { server: http.Server; port: number; missions: Map<string, Mission>; close: () => Promise<void> }

const MAX_BODY = 4096;

export async function startBridge(opts: BridgeOptions): Promise<BridgeServer> {
  const dataDir = path.resolve(opts.dataDir);
  if (/fastclip/i.test(dataDir)) throw new Stop('CHEMIN_INTERDIT', dataDir);
  fs.mkdirSync(dataDir, { recursive: true });
  const root = path.join(dataDir, 'missions');
  if (!fs.existsSync(root)) fs.mkdirSync(guard(dataDir, root));
  guard(dataDir, root);

  // Missions existantes : rechargées en lecture ; celles coupées en cours sont marquées INTERROMPUE (pas de reprise).
  const missions = new Map<string, Mission>();
  for (const id of fs.readdirSync(root).sort()) if (Mission.isValidId(id)) {
    try { missions.set(id, Mission.load(root, id)); } catch { /* dossier illisible : ignoré, jamais supprimé */ }
  }

  let port = opts.port;
  const allowedHosts = () => new Set([`${HOST}:${port}`, `localhost:${port}`]);

  const send = (res: http.ServerResponse, status: number, body: unknown, type = 'application/json; charset=utf-8') => {
    res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'" });
    res.end(typeof body === 'string' ? body : JSON.stringify(body));
  };
  const readBody = (req: http.IncomingMessage) => new Promise<any>((resolve, reject) => {
    let size = 0; const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => { size += c.length; if (size > MAX_BODY) { reject(new Stop('CORPS_TROP_GRAND')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}); } catch { reject(new Stop('JSON_INVALIDE')); } });
    req.on('error', reject);
  });

  const handler = async (req: http.IncomingMessage, res: http.ServerResponse) => {
    // Protection contre les pages web tierces (DNS rebinding / requêtes intersites) : hôte et origine stricts.
    if (!allowedHosts().has(String(req.headers.host ?? ''))) return send(res, 403, { erreur: 'HOTE_REFUSE' });
    const origin = req.headers.origin;
    if (req.method !== 'GET' && (origin === undefined ? false : !allowedHosts().has(String(origin).replace(/^http:\/\//, ''))))
      return send(res, 403, { erreur: 'ORIGINE_REFUSEE' });
    if (req.method !== 'GET' && !String(req.headers['content-type'] ?? '').startsWith('application/json'))
      return send(res, 415, { erreur: 'CONTENT_TYPE_JSON_REQUIS' });

    const url = new URL(req.url ?? '/', `http://${HOST}`);
    const p = url.pathname;
    if (req.method === 'GET' && p === '/') return send(res, 200, PAGE, 'text/html; charset=utf-8');
    if (req.method === 'GET' && p === '/api/etat') return send(res, 200, { mode: 'simulation', reel: false, host: HOST, port });
    if (req.method === 'GET' && p === '/api/scenarios') return send(res, 200, SCENARIOS.map((s) => ({ id: s.id, titre: s.titre, attendu: s.expect })));
    if (req.method === 'GET' && p === '/api/missions')
      return send(res, 200, [...missions.values()].reverse().map((m) => m.view(false)));
    const mm = /^\/api\/missions\/([^/]+)(\/approbation)?$/.exec(p);
    if (mm) {
      const m = missions.get(mm[1]!);
      if (!m) return send(res, 404, { erreur: 'MISSION_INCONNUE' });
      if (req.method === 'GET' && !mm[2]) return send(res, 200, m.view(true));
      if (req.method === 'POST' && mm[2]) {
        const body = await readBody(req);
        if (body.decision !== 'approuver' && body.decision !== 'refuser') return send(res, 400, { erreur: 'DECISION_INVALIDE' });
        if (!m.approve(body.decision === 'approuver')) return send(res, 409, { erreur: 'AUCUNE_APPROBATION_EN_ATTENTE' });
        return send(res, 200, { ok: true });
      }
    }
    if (req.method === 'POST' && p === '/api/missions') {
      const body = await readBody(req);
      if (body.mode !== undefined && body.mode !== 'simulation') return send(res, 403, { erreur: 'MODE_REEL_DESACTIVE' });
      const sc = findScenario(String(body.scenario ?? ''));
      if (!sc) return send(res, 400, { erreur: 'SCENARIO_INCONNU' });
      const active = [...missions.values()].find((x) => x.status === 'EN_COURS' || x.status === 'ATTENTE_APPROBATION');
      if (active) return send(res, 409, { erreur: 'MISSION_DEJA_EN_COURS', id: active.id });
      const m = new Mission(root, Mission.newId(), sc, opts.stepDelayMs ?? 0);
      m.prepare();
      missions.set(m.id, m);
      void m.run();
      return send(res, 201, { id: m.id });
    }
    return send(res, 404, { erreur: 'INTROUVABLE' });
  };

  const server = http.createServer((req, res) => {
    handler(req, res).catch((e) => send(res, e instanceof Stop ? 400 : 500, { erreur: e instanceof Stop ? e.code : 'ERREUR_INTERNE' }));
  });
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(opts.port, HOST, () => resolve()); });
  port = (server.address() as { port: number }).port;
  return { server, port, missions, close: () => new Promise<void>((r) => server.close(() => r())) };
}
