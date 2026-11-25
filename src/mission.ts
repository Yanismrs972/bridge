// mission.ts — déroulé d'une mission (repris de pipeline() du harnais), avec approbations humaines avant chaque
// étape d'écriture. Mode simulation uniquement : aucun processus lancé, aucun appel réseau.
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  ACCEPTANCE, BASE_LIMITS, FIXTURE, MISSION_GOAL, PROMPT, Stop, checkPlan, claudeEventViolation, codexEventViolation, decide,
  diffSnap, guard, loadSchema, mkdirNew, parseJsonOr, readLimited, referenceData, snapshot, stop, validate, verify, writeNew,
  type Limits, type Snap, type Verification,
} from './core.js';
import type { Scenario } from './scenarios.js';

export type Status = 'EN_COURS' | 'ATTENTE_APPROBATION' | 'TERMINEE' | 'ARRETEE' | 'INTERROMPUE';
export interface PendingApproval { label: string; titre: string; details: unknown }
export interface MissionView {
  id: string; scenario: string; titre: string; status: Status; code: string | null; detail: string;
  calls: { supervisor: number; executor: number }; limits: { supervisorCalls: number; executorCalls: number; corrections: number; executorMaxBudgetUsd: number };
  costUsd: number; pending: PendingApproval | null; startedAt: string; endedAt: string | null;
  journal: unknown[]; produitsAvant: unknown; produitsActuels: unknown;
}

const DEFAULT_CODEX_EVENTS = [{ type: 'thread.started' }, { type: 'turn.started' },
  { type: 'item.completed', item: { type: 'agent_message' } },
  { type: 'turn.completed', usage: { input_tokens: 0, cached_input_tokens: 0, output_tokens: 0, reasoning_output_tokens: 0 } }];
const FIXTURE_FILES = [path.join('data', 'produits.json'), 'REGLES.md'];
const SAFE_ID = /^M-\d{8}-\d{6}-[0-9a-f]{6}$/;

export class Mission {
  readonly id: string; readonly root: string; readonly scenario: Scenario | null;
  readonly dir: { base: string; projet: string; superviseur: string; canari: string; temoins: string; out: string };
  readonly limits: Limits;
  calls = { supervisor: 0, executor: 0 };
  status: Status = 'EN_COURS'; code: string | null = null; detail = '';
  pending: PendingApproval | null = null; startedAt = new Date().toISOString(); endedAt: string | null = null;
  costUsd = 0;
  private S0: Snap | null = null;
  private resolveApproval: ((ok: boolean) => void) | null = null;
  private readonly delayMs: number;
  scenarioId: string; titre: string;

  constructor(root: string, id: string, scenario: Scenario | null, delayMs = 0) {
    this.root = root; this.id = id; this.scenario = scenario; this.delayMs = delayMs;
    this.scenarioId = scenario?.id ?? '?'; this.titre = scenario?.titre ?? '';
    const base = path.join(root, id);
    this.dir = { base, projet: path.join(base, 'projet'), superviseur: path.join(base, 'superviseur'),
      canari: path.join(base, 'superviseur-canari'), temoins: path.join(base, 'temoins'), out: path.join(base, 'out') };
    this.limits = { ...BASE_LIMITS, ...(scenario?.limits ?? {}) };
  }

  static newId() {
    const t = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
    return `M-${t.slice(0, 8)}-${t.slice(8, 14)}-${randomBytes(3).toString('hex')}`;
  }
  static isValidId(id: string) { return SAFE_ID.test(id); }

  // ----- Journal (ajout seul) -----
  log(event: string, data: Record<string, unknown> = {}) {
    const line = JSON.stringify({ t: new Date().toISOString(), event, ...data });
    fs.appendFileSync(guard(this.root, path.join(this.dir.out, 'journal.jsonl')), line + '\n');
  }
  readJournal(): any[] {
    const f = path.join(this.dir.out, 'journal.jsonl');
    if (!fs.existsSync(guard(this.root, f))) return [];
    return readLimited(this.root, f, 50 * 1024 * 1024).split('\n').filter((l) => l.trim()).map((l) => parseJsonOr(l, 'JOURNAL_ILLISIBLE'));
  }

  // ----- Préparation : copie du projet d'exemple dans un dossier de mission neuf -----
  prepare() {
    if (fs.existsSync(guard(this.root, this.dir.base))) stop('DOSSIER_EXISTE_DEJA', this.dir.base);
    mkdirNew(this.root, this.dir.base);
    for (const k of ['out', 'projet', 'superviseur', 'canari', 'temoins'] as const) mkdirNew(this.root, this.dir[k]);
    mkdirNew(this.root, path.join(this.dir.projet, 'data'));
    for (const f of FIXTURE_FILES) fs.copyFileSync(path.join(FIXTURE, f), guard(this.root, path.join(this.dir.projet, f)), fs.constants.COPYFILE_EXCL);
    writeNew(this.root, path.join(this.dir.temoins, 'temoin.txt'), `TEMOIN-${randomBytes(24).toString('hex')}\n`);
    writeNew(this.root, path.join(this.dir.canari, `canari-${randomBytes(8).toString('hex')}.txt`), 'Fichier canari.\n');
    this.S0 = snapshot(this.dir.base, this.dir.out);
    this.log('PREPARATION_OK', { scenario: this.scenarioId, titre: this.titre, mode: 'simulation', S0: this.S0, limits: this.limits });
  }

  // ----- Approbation humaine (Bridge attend ; aucune décision par défaut) -----
  approve(decision: boolean): boolean {
    if (this.status !== 'ATTENTE_APPROBATION' || !this.resolveApproval) return false;
    const r = this.resolveApproval; this.resolveApproval = null;
    r(decision);
    return true;
  }
  private async requestApproval(label: string, titre: string, details: unknown) {
    this.pending = { label, titre, details };
    this.status = 'ATTENTE_APPROBATION';
    this.log('APPROBATION_DEMANDEE', { label, titre });
    const ok = await new Promise<boolean>((res) => { this.resolveApproval = res; });
    this.pending = null; this.status = 'EN_COURS';
    this.log(ok ? 'APPROBATION_ACCORDEE' : 'APPROBATION_REFUSEE', { label });
    if (!ok) stop('REFUSE_PAR_HUMAIN', label);
  }

  private async step<T>(label: string, fn: () => T | Promise<T>, writes = false): Promise<T> {
    this.log('ETAPE_DEBUT', { label, writes });
    if (this.delayMs) await new Promise((r) => setTimeout(r, this.delayMs));
    const result = await fn();
    this.log('ETAPE_TERMINEE', { label, result: result ?? null });
    return result;
  }

  // ----- Agents simulés (réponses prédéfinies) -----
  private writeInBase(rel: string, content: string) { fs.writeFileSync(guard(this.dir.base, path.join(this.dir.base, rel)), content); }
  private replaySupervisor(label: string) {
    const def = this.scenario?.supervisor[label];
    if (!def) return { events: [] as any[], code: 1, stderr: `aucune réponse prédéfinie pour ${label}`, answerText: null as string | null, killed: null as string | null };
    if (def.sideEffect) this.writeInBase(def.sideEffect.rel, def.sideEffect.content);
    const events = (def.events ?? DEFAULT_CODEX_EVENTS) as any[];
    return { events, killed: events.map(codexEventViolation).find(Boolean) ?? null, code: def.code ?? 0, stderr: '',
      answerText: def.answer === undefined ? null : JSON.stringify(def.answer) };
  }
  private replayExecutor(label: string) {
    const def = this.scenario?.executor[label];
    if (!def) return { events: [] as any[], code: 1, killed: null as string | null };
    const init = { type: 'system', subtype: 'init', tools: def.tools ?? ['Read', 'Edit', 'Write', 'Glob', 'Grep', 'StructuredOutput'], mcp_servers: [], plugins: [], permissionMode: 'dontAsk' };
    const bad = claudeEventViolation(init, {});
    if (bad) return { events: [init], killed: bad, code: null }; // arrêt avant toute écriture
    for (const [rel, val] of Object.entries(def.write ?? {})) this.writeInBase(rel, typeof val === 'function' ? val() : val);
    const result = { type: 'result', subtype: 'success', is_error: false, structured_output: def.report, total_cost_usd: 0,
      usage: { input_tokens: 0, output_tokens: 0 }, num_turns: 1, permission_denials: [] };
    return { events: [init, result], code: 0, killed: null };
  }

  // ----- Appels encadrés (limites, contrôles, schémas, consommation) -----
  private supervisorCall(label: string, schemaName: string, prompt: string) {
    if (this.calls.supervisor + 1 > this.limits.supervisorCalls) stop('LIMITE_APPELS_SUPERVISEUR', label);
    this.calls.supervisor++;
    this.log('APPEL_SUPERVISEUR', { label, schema: schemaName, promptChars: prompt.length });
    const schema = loadSchema(schemaName);
    const before = snapshot(this.dir.base, this.dir.out);
    const out = this.replaySupervisor(label);
    const d = diffSnap(before, snapshot(this.dir.base, this.dir.out));
    if (d.total) stop('MODIFICATION_PENDANT_SUPERVISEUR', JSON.stringify(d));
    for (const ev of out.events) { const v = codexEventViolation(ev); if (v) stop('EVENEMENT_INTERDIT_SUPERVISEUR', v); }
    if (out.killed) stop(/^(ELEMENT|EVENEMENT)/.test(out.killed) ? 'EVENEMENT_INTERDIT_SUPERVISEUR' : out.killed, out.killed);
    const failure = out.events.find((e) => e.type === 'turn.failed' || e.type === 'error');
    if (failure) { const msg = JSON.stringify(failure).slice(0, 800); stop(/quota|limit|429|usage/i.test(msg) ? 'QUOTA_SUPERVISEUR' : 'ERREUR_SUPERVISEUR', msg); }
    if (out.code !== 0) stop('CODE_SORTIE_SUPERVISEUR', `${out.code} ${out.stderr.slice(0, 300)}`);
    this.log('USAGE', { agent: 'superviseur', label, cost_usd: 0, cost_source: 'simulation' });
    if (out.answerText == null) stop('REPONSE_SUPERVISEUR_ABSENTE', label);
    const answer = parseJsonOr(out.answerText!, 'SCHEMA_SUPERVISEUR_INVALIDE');
    const err = validate(schema, answer);
    if (err) stop('SCHEMA_SUPERVISEUR_INVALIDE', err);
    return answer;
  }
  private executorCall(label: string, schemaName: string, prompt: string) {
    if (this.calls.executor + 1 > this.limits.executorCalls) stop('LIMITE_APPELS_EXECUTANT', label);
    this.calls.executor++;
    this.log('APPEL_EXECUTANT', { label, schema: schemaName, promptChars: prompt.length });
    const schema = loadSchema(schemaName);
    const out = this.replayExecutor(label);
    const st: any = {};
    for (const ev of out.events) { const v = claudeEventViolation(ev, st); if (v) stop(v.split(':')[0]!, v); }
    if (out.killed) stop(out.killed.split(':')[0]!, out.killed);
    if (!st.init) stop('INIT_EXECUTANT_ABSENT', label);
    if (!st.result) stop('RESULTAT_EXECUTANT_ABSENT', String(out.code));
    const r = st.result;
    this.costUsd += Number(r.total_cost_usd ?? 0);
    this.log('USAGE', { agent: 'executant', label, cost_usd: r.total_cost_usd ?? null, cost_source: 'simulation', num_turns: r.num_turns ?? null });
    if (this.costUsd > this.limits.executorMaxBudgetUsd) stop('BUDGET_EXECUTANT_DEPASSE', String(this.costUsd));
    if (r.is_error) stop('ERREUR_EXECUTANT', r.subtype);
    if (out.code !== 0) stop('CODE_SORTIE_EXECUTANT', String(out.code));
    if (!Object.hasOwn(r, 'structured_output')) stop('SORTIE_STRUCTUREE_ABSENTE', label);
    const err = validate(schema, r.structured_output);
    if (err) stop('SCHEMA_EXECUTANT_INVALIDE', err);
    return { report: r.structured_output };
  }
  private verify(): Verification { return verify(this.dir.base, this.dir.out, this.S0!); }

  // ----- Déroulé (identique au harnais, sans canaris réels ni reprise) -----
  private async pipeline(): Promise<string> {
    const v0 = await this.step('0b-verification-initiale', () => this.verify());
    if (v0.incorrects !== 5 || v0.allPass) stop('FIXTURE_INATTENDUE', JSON.stringify(v0.evidence.slugs_corrects));
    const mission = await this.step('2a-mission', () => ({ id: this.id, goal: MISSION_GOAL, allowed_files: ['data/produits.json'],
      constraints: ['Ne modifier ni id ni nom', 'Aucun autre fichier créé, modifié ou supprimé', 'Respecter REGLES.md'],
      acceptance_criteria: ACCEPTANCE,
      context: { regles: readLimited(this.root, path.join(this.dir.projet, 'REGLES.md'), 5000), donnees_actuelles: referenceData() } }));
    const plan = await this.step('2b-plan', () => this.supervisorCall('2', 'plan', PROMPT.plan(mission)));
    checkPlan(plan);
    await this.requestApproval('4-execution', "Autoriser Claude Code (exécutant) à modifier le projet selon ce plan ?",
      { plan, fichiers_modifiables: mission.allowed_files });
    const exec1 = await this.step('4-execution', () => this.executorCall('4', 'exec-report', PROMPT.task(plan)), true);
    const v1 = await this.step('5-verification', () => this.verify());
    const e1 = await this.step('6-evaluation', () => this.supervisorCall('6', 'evaluation', PROMPT.evaluation(mission, plan, exec1.report, v1.evidence, 1)));
    if (decide(e1, v1, 0, this.limits.corrections) === 'accept') return 'OBJECTIF_ATTEINT';
    await this.requestApproval('7-correction', 'Le superviseur demande une correction (1 seule autorisée). Autoriser ?',
      { correction: e1.correction, constat_bridge: v1.evidence.slugs_corrects });
    const exec2 = await this.step('7-correction', () => this.executorCall('7', 'exec-report', PROMPT.correction(exec1.report, e1.correction, v1.evidence)), true);
    const v2 = await this.step('8-verification', () => this.verify());
    const e2 = await this.step('9-reevaluation', () => this.supervisorCall('9', 'evaluation', PROMPT.evaluation(mission, plan, exec2.report, v2.evidence, 2)));
    decide(e2, v2, 1, this.limits.corrections);
    return 'OBJECTIF_ATTEINT';
  }

  async run(): Promise<void> {
    try {
      const c = await this.pipeline();
      this.finish('TERMINEE', c, '');
    } catch (e) {
      const s = e instanceof Stop ? e : new Stop('EXCEPTION', (e as Error)?.stack || e);
      this.finish('ARRETEE', s.code, s.detail);
    }
  }
  private finish(status: Status, code: string, detail: string) {
    this.status = status; this.code = code; this.detail = detail; this.endedAt = new Date().toISOString(); this.pending = null;
    this.log('FIN', { status, code, detail, calls: this.calls, costUsd: this.costUsd });
  }

  // ----- Rechargement depuis le disque (après redémarrage) : jamais de reprise automatique -----
  static load(root: string, id: string): Mission {
    const m = new Mission(root, id, null);
    const j = m.readJournal();
    const prep = j.find((e) => e.event === 'PREPARATION_OK');
    if (prep) { m.scenarioId = prep.scenario ?? '?'; m.titre = prep.titre ?? ''; m.startedAt = prep.t; }
    for (const e of j) {
      if (e.event === 'APPEL_SUPERVISEUR') m.calls.supervisor++;
      if (e.event === 'APPEL_EXECUTANT') m.calls.executor++;
    }
    const fin = j.find((e) => e.event === 'FIN');
    if (fin) { m.status = fin.status; m.code = fin.code; m.detail = fin.detail ?? ''; m.endedAt = fin.t; }
    else {
      // Situation incertaine : la mission a été coupée en cours (Bridge arrêté). Pas de relance automatique.
      m.status = 'INTERROMPUE'; m.code = 'INTERROMPUE_SANS_REPRISE';
      m.detail = 'Bridge a été arrêté pendant la mission. Aucune reprise automatique : relancer une nouvelle mission.';
      m.endedAt = new Date().toISOString();
      if (fs.existsSync(m.dir.out)) m.log('FIN', { status: m.status, code: m.code, detail: m.detail, calls: m.calls });
    }
    return m;
  }

  view(withDetails = true): MissionView {
    const readProduits = (p: string) => {
      try { return JSON.parse(readLimited(this.root, p, BASE_LIMITS.maxDataBytes)); }
      catch { try { return { texte_brut_non_json: readLimited(this.root, p, BASE_LIMITS.maxDataBytes) }; } catch { return null; } }
    };
    return {
      id: this.id, scenario: this.scenarioId, titre: this.titre, status: this.status, code: this.code, detail: this.detail,
      calls: this.calls, limits: { supervisorCalls: this.limits.supervisorCalls, executorCalls: this.limits.executorCalls, corrections: this.limits.corrections, executorMaxBudgetUsd: this.limits.executorMaxBudgetUsd },
      costUsd: this.costUsd, pending: this.pending, startedAt: this.startedAt, endedAt: this.endedAt,
      journal: withDetails ? this.readJournal().map(({ S0: _s, ...rest }) => rest) : [],
      produitsAvant: withDetails ? referenceData() : null,
      produitsActuels: withDetails ? readProduits(path.join(this.dir.projet, 'data', 'produits.json')) : null,
    };
  }
}
