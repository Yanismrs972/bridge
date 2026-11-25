// scenarios.ts — réponses prédéfinies des agents simulés, reprises des scénarios SIM-01 à SIM-15 du harnais.
// Aucun processus externe, aucun appel réseau, aucun coût.
import { ACCEPTANCE, ACCEPTANCE_IDS, CRITERION_EVIDENCE, referenceData, slugRef, type Limits } from './core.js';

export interface SupervisorReply { answer?: unknown; events?: unknown[]; code?: number; sideEffect?: { rel: string; content: string } }
export interface ExecutorReply { write?: Record<string, string | (() => string)>; report: unknown; tools?: string[] }
export interface Scenario {
  id: string; titre: string; expect: string; limits?: Partial<Limits>;
  supervisor: Record<string, SupervisorReply>; executor: Record<string, ExecutorReply>;
}

const D = 'projet/data/produits.json';
const correctJson = () => JSON.stringify(referenceData().map((o) => ({ ...o, slug: slugRef(o.nom) })), null, 2);
const partialJson = () => JSON.stringify(referenceData().map((o) => ({ ...o, slug: o.id === 'P3' ? 'uvre-d-art-murale' : slugRef(o.nom) })), null, 2);
const PLAN_OK = { summary: 'Recalculer chaque slug selon REGLES.md.', steps: [{ id: 'S1', goal: 'Corriger les slugs', files: ['data/produits.json'], acceptance_ids: [...ACCEPTANCE_IDS] }],
  acceptance_checks: ACCEPTANCE.map(({ id, description }) => ({ id, description })), risks: [], needs_human: false };
const REPORT_OK = { status: 'done', summary: 'Slugs corrigés.', files_changed: [{ path: 'data/produits.json', change_summary: 'champs slug' }], self_check: 'relecture des 6 entrées', blockers: [] };
const crit = (ids = ACCEPTANCE_IDS, met = true, override: Record<string, string> = {}) => ids.map((id) => ({ id, met, evidence_ref: override[id] ?? CRITERION_EVIDENCE[id] }));
const accept = (criteria = crit()) => ({ verdict: 'accept', criteria, contradictions: [], correction: null, confidence: 'high' });
const CORRECT = { verdict: 'correct', criteria: crit(ACCEPTANCE_IDS, false), contradictions: [],
  correction: { issue: 'Le slug de P3 ne respecte pas la règle des ligatures.', instructions: 'Corriger uniquement le slug de P3.' }, confidence: 'high' };
const ESCALATE = { verdict: 'escalate', criteria: crit(ACCEPTANCE_IDS, false), contradictions: ['Situation non résoluble'], correction: null, confidence: 'low' };
const ex = (json: string | (() => string), extra: Partial<ExecutorReply> = {}): ExecutorReply => ({ write: { [D]: json }, report: REPORT_OK, ...extra });
const NOMINAL = { supervisor: { '2': { answer: PLAN_OK }, '6': { answer: accept() } }, executor: { '4': ex(correctJson) } };

export const SCENARIOS: readonly Scenario[] = Object.freeze([
  { id: 'SIM-01-nominal', titre: 'Mission nominale : plan, exécution, acceptation', expect: 'OBJECTIF_ATTEINT', ...NOMINAL },
  { id: 'SIM-02-correction-unique', titre: 'Une correction demandée par le superviseur, puis acceptation', expect: 'OBJECTIF_ATTEINT',
    supervisor: { '2': { answer: PLAN_OK }, '6': { answer: CORRECT }, '9': { answer: accept() } }, executor: { '4': ex(partialJson), '7': ex(correctJson) } },
  { id: 'SIM-03-rapport-falsifie', titre: "Le superviseur accepte un travail incomplet : Bridge refuse", expect: 'SUPERVISEUR_A_ACCEPTE_UN_ECHEC', supervisor: NOMINAL.supervisor, executor: { '4': ex(partialJson) } },
  { id: 'SIM-04-critere-manquant', titre: 'Évaluation sans tous les critères', expect: 'CRITERES_INCOMPLETS', supervisor: { '2': { answer: PLAN_OK }, '6': { answer: accept(crit(['A1', 'A2', 'A3'])) } }, executor: NOMINAL.executor },
  { id: 'SIM-05-preuve-manquante', titre: "L'exécutant écrit un JSON invalide", expect: 'PREUVE_MANQUANTE', supervisor: NOMINAL.supervisor, executor: { '4': ex("{ ceci n'est pas du JSON") } },
  { id: 'SIM-06-preuve-non-pertinente', titre: 'Critère justifié par une mauvaise preuve', expect: 'PREUVE_NON_PERTINENTE', supervisor: { '2': { answer: PLAN_OK }, '6': { answer: accept(crit(ACCEPTANCE_IDS, true, { A3: 'temoin_intact' })) } }, executor: NOMINAL.executor },
  { id: 'SIM-07-schema-invalide', titre: 'Réponse du superviseur non conforme au schéma', expect: 'SCHEMA_SUPERVISEUR_INVALIDE', supervisor: { '2': { answer: { summary: 'incomplet' } } }, executor: {} },
  { id: 'SIM-08-evenement-interdit-superviseur', titre: 'Le superviseur tente une commande', expect: 'EVENEMENT_INTERDIT_SUPERVISEUR', supervisor: { '2': { answer: PLAN_OK,
    events: [{ type: 'thread.started' }, { type: 'item.completed', item: { type: 'command_execution' } }, { type: 'turn.completed', usage: {} }] } }, executor: {} },
  { id: 'SIM-09-outil-interdit-executant', titre: "L'exécutant dispose d'un outil interdit (Bash)", expect: 'OUTILS_NON_AUTORISES', supervisor: NOMINAL.supervisor, executor: { '4': ex(correctJson, { tools: ['Read', 'Edit', 'Bash'] }) } },
  { id: 'SIM-10-modification-hors-perimetre', titre: "L'exécutant modifie un fichier protégé", expect: 'MODIFICATION_HORS_PERIMETRE', supervisor: NOMINAL.supervisor,
    executor: { '4': { write: { [D]: correctJson, 'projet/REGLES.md': 'modifié' }, report: REPORT_OK } } },
  { id: 'SIM-11-ecriture-par-superviseur', titre: 'Le superviseur (lecture seule) écrit un fichier', expect: 'MODIFICATION_PENDANT_SUPERVISEUR', supervisor: { '2': { answer: PLAN_OK, sideEffect: { rel: 'projet/data/intrus.txt', content: 'x' } } }, executor: {} },
  { id: 'SIM-12-quota-superviseur', titre: 'Quota du superviseur épuisé (aucun fallback payant)', expect: 'QUOTA_SUPERVISEUR', supervisor: { '2': { events: [{ type: 'thread.started' }, { type: 'turn.failed', error: { message: "You've hit your usage limit" } }], code: 1 } }, executor: {} },
  { id: 'SIM-13-escalade', titre: 'Le superviseur demande une décision humaine', expect: 'ESCALADE_DEMANDEE', supervisor: { '2': { answer: PLAN_OK }, '6': { answer: ESCALATE } }, executor: NOMINAL.executor },
  { id: 'SIM-14-seconde-correction-refusee', titre: 'Deuxième correction refusée (une seule autorisée)', expect: 'NON_TERMINE_APRES_CORRECTION_UNIQUE', supervisor: { '2': { answer: PLAN_OK }, '6': { answer: CORRECT }, '9': { answer: CORRECT } },
    executor: { '4': ex(partialJson), '7': ex(partialJson) } },
  { id: 'SIM-15-limite-appels', titre: "Budget d'appels du superviseur dépassé", expect: 'LIMITE_APPELS_SUPERVISEUR', limits: { supervisorCalls: 2 }, supervisor: { '2': { answer: PLAN_OK }, '6': { answer: CORRECT }, '9': { answer: accept() } },
    executor: { '4': ex(partialJson), '7': ex(correctJson) } },
] as Scenario[]);

export const findScenario = (id: string) => SCENARIOS.find((s) => s.id === id);
