# Bridge — conception de la v1 (orchestrateur + pont)

**Date :** 18 novembre 2026
**Statut :** relu, en attente de validation finale par l'utilisateur
**Sources :** échanges de cette session, dossier `BRIDGE_ORCHESTRATEUR_IA_DOSSIER_REFERENCE` (v1.0), rapports `docs/rapports/01` à `28`, dépôt `jcharveyjr/claude-chatgpt-agent-bridge` (lu le 18/11/2026, commit du 23/07/2026).

Légende : **[DÉCIDÉ]** = décision explicite de l'utilisateur · **[CHOIX]** = choix de conception de Claude, à corriger si besoin · **[OUVERT]** = à trancher par l'utilisateur.

---

## 1. Intention

L'utilisateur veut **arrêter de faire le copier-coller entre ChatGPT et Claude Code**.

Il décrit un projet en langage libre. Bridge lui pose les questions nécessaires, découpe le projet en tâches, puis enchaîne seul, tâche après tâche :

> ChatGPT (Codex) écrit la consigne → Claude Code exécute → ChatGPT analyse le résultat sur preuves → nouvelle consigne… jusqu'à ce que la tâche soit finie, puis tâche suivante, jusqu'à l'objectif.

L'utilisateur n'intervient que pour les **décisions importantes**. Il suit et répond depuis **une page dans son navigateur, sur son PC** [DÉCIDÉ]. Bridge doit pouvoir servir à **plusieurs projets différents** [DÉCIDÉ].

## 2. Objectifs, non-objectifs, anti-objectifs

**Objectifs v1**
- O1. Entretien de départ : à partir d'une description libre, le superviseur pose ses questions, l'utilisateur répond sur la page, une mission structurée en sort.
- O2. Plan : le superviseur découpe la mission en tâches ordonnées, avec critères d'acceptation. L'utilisateur valide le plan.
- O3. Boucle autonome par tâche : consigne → exécution → preuves → évaluation → correction, sans intervention humaine tant qu'aucune décision sensible n'est requise.
- O4. Escalade : quand le superviseur ou une règle l'exige, la boucle se met en pause et la question apparaît sur la page.
- O5. Multi-projets : chaque projet a son dossier, son historique, ses budgets.
- O6. Reprise sûre après arrêt du PC ou plantage, sans double exécution.
- O7. Arrêt d'urgence depuis la page.

**Non-objectifs v1** (possibles plus tard)
- Accès depuis le téléphone, notifications à distance.
- Pilotage depuis l'interface ChatGPT (MCP, connecteur) : impossible avec l'offre Free.
- Exécution en machine virtuelle (prévue en Phase 0B ; voir §12).
- Push GitHub automatique.
- Plusieurs tâches en parallèle.

**Anti-objectifs** (ce qui ferait de la v1 un échec même si elle « marche »)
- Codex qui écrit un fichier du projet.
- Une bascule, même ponctuelle, vers une API payante.
- Une tâche relancée deux fois parce que Bridge a redémarré.
- Le superviseur qui accepte un travail sur la seule parole de Claude.
- Une boucle qui tourne indéfiniment en consommant le quota.
- Un agent qui sort du dossier de son projet.

## 3. Contraintes

- **Poste cible** : Windows 10 Famille, Node 22.23, Git 2.56, 32 Go de RAM. Codex CLI et Claude Code CLI sont à installer ou rendre accessibles dans le PATH (rapport 01).
- **Offre ChatGPT Free** : quota Codex limité et inconnu. Le quota est une ressource rare : chaque appel Codex compte.
- **Claude Code** via abonnement. `total_cost_usd` est une estimation, pas une facture.
- Décisions D01 à D06 du dossier de référence [DÉCIDÉ] :
  - D01 : Codex CLI est le superviseur initial ;
  - D02 et D03 : Claude est le seul à écrire, Codex n'écrit jamais ;
  - D04 : l'orchestrateur garde permissions, budgets, historique et arrêt d'urgence ;
  - D05 : le superviseur est remplaçable ;
  - D06 : jamais de bascule automatique vers une API payante.
- Écoute réseau sur `127.0.0.1` uniquement.
- Développement et tests dans un conteneur Linux avec de **faux agents**. Le premier essai réel a lieu sur le PC de l'utilisateur.

## 4. Approches envisagées

| Approche | Pour | Contre |
|---|---|---|
| **1. Partir d'Agent Bridge** (jcharveyjr, MIT, ~2 500 lignes TS) | Base petite et lisible. Adaptateurs Codex/Claude CLI, file atomique, annulation, arrêt d'arbre de processus sous Windows, liste blanche de dossiers déjà écrits et testés. Retenu provisoirement dans le dossier (D08). | Pas de boucle de supervision, pas de page, pas de projets ni de budgets. Reprise après crash contraire à nos règles. |
| 2. Partir de « Supervisor » (claude-code-mcp-harness, MIT, ~7 600 lignes JS) | Tableau de bord, projets, approbations déjà présents. | Tout le cœur suppose ChatGPT Web via MCP et tunnel, avec une offre Business. Il faudrait démonter sa pièce centrale. |
| 3. Tout réécrire | Contrôle total. | Rejeté par l'utilisateur : « éviter de tout réécrire ». |

**Retenue : approche 1** [DÉCIDÉ]. Pour la page et les approbations, on s'inspire de « Supervisor » sans reprendre son code [CHOIX].

## 5. Architecture

Un seul programme, deux couches séparées [CHOIX, conforme au dossier de référence] :

```
 Navigateur (page locale)
        │  HTTP 127.0.0.1 + jeton
        ▼
┌──────────────────────── ORCHESTRATEUR ────────────────────────┐
│ serveur web · missions · plans · boucle · permissions ·       │
│ budgets · validations humaines · preuves · historique ·       │
│ arrêt d'urgence · SQLite (source de vérité unique)            │
└───────────────┬───────────────────────────────────────────────┘
                │ appels internes : envoyer(message orch/1) → résultat
┌───────────────▼──────────────── BRIDGE ───────────────────────┐
│ adaptateurs CLI (codex, claude, faux agents) · lancement      │
│ sans shell · délais · annulation · arrêt d'arbre de processus │
│ · normalisation des sorties · aucune décision                 │
└───────────────┬───────────────────────────────┬───────────────┘
                ▼                               ▼
        Codex CLI (lecture seule)        Claude Code (écrit)
```

**Règle de frontière.** Bridge ne décide rien. Il reçoit un message `orch/1` déjà autorisé, avec des permissions explicites. Il le traduit en arguments CLI **qui ne peuvent pas être plus larges** que ces permissions, exécute, et rend un résultat normalisé. Toute la logique de décision vit dans l'orchestrateur.

**Persistance.** Un seul stockage : SQLite via `node:sqlite`, intégré à Node 22, sans dépendance [CHOIX]. Bridge n'a pas de file à lui : la file JSON d'Agent Bridge est remplacée par les tables de l'orchestrateur. Cela évite deux sources de vérité (dossier, SECURITE §5).

**Langage.** TypeScript, comme Agent Bridge [CHOIX]. Les dépendances se limitent à `zod`, pour valider `orch/1`. Le SDK MCP et `jose` d'Agent Bridge sont retirés en v1 [CHOIX] : sans client MCP, ils n'apportent rien. Une couche MCP pourra être rajoutée par-dessus l'orchestrateur plus tard.

## 6. Parcours utilisateur (la page)

La page est servie par l'orchestrateur sur `http://127.0.0.1:<port>/` [CHOIX : port 8790 par défaut, modifiable]. Au premier lancement, Bridge écrit un jeton aléatoire dans son dossier de données et affiche une URL contenant ce jeton. La page le garde ensuite en `sessionStorage`. Toute requête sans jeton valide est refusée, de même que toute requête dont l'en-tête `Origin` n'est pas local.

```
┌ Bridge ───────────────────────────────────────── [■ ARRÊT D'URGENCE] ┐
│ Projets            │ Projet : Gestion-stock        état : en cours     │
│  • Gestion-stock ● │ Tâche 3/7 « Écran de saisie »  cycle 2/3          │
│  • Site-perso      │ Quota Codex : 5/8 mission · 12/30 jour            │
│  + Nouveau projet  │──────────────────────────────────────────────────│
│                    │ 14:02 ChatGPT → consigne envoyée à Claude         │
│                    │ 14:09 Claude  → rapport : 3 fichiers modifiés     │
│                    │ 14:09 Preuves → tests 12/14 OK                    │
│                    │ 14:10 ChatGPT → correction demandée (2 tests)     │
│                    │──────────────────────────────────────────────────│
│                    │ ⚠ DÉCISION REQUISE                                │
│                    │ Claude veut installer la librairie « xlsx ».      │
│                    │ [Autoriser]  [Refuser]  [Répondre…]               │
└────────────────────┴──────────────────────────────────────────────────┘
```

Étapes :
1. **Nouveau projet.** Un nom, puis une description libre (grande zone de texte). Bridge crée le dossier du projet (§9).
2. **Entretien.** Le superviseur renvoie une liste de questions, affichées sous forme de formulaire. L'utilisateur répond. Il peut y avoir plusieurs tours, au maximum 3 [CHOIX]. Le superviseur produit ensuite la `MISSION`.
3. **Plan.** Le superviseur produit le `PLAN` : tâches, dépendances, critères d'acceptation, risques. Il s'affiche, et l'utilisateur clique **Valider le plan** ou écrit une demande de modification.
4. **Exécution.** La boucle de §7 tourne. La page montre le fil des événements en direct (rafraîchissement par interrogation toutes les 2 s [CHOIX], plus simple que les WebSockets).
5. **Décisions.** Toute escalade apparaît en encart, avec des boutons. La boucle reste en pause jusqu'à la réponse.
6. **Fin.** Le rapport `FINAL` s'affiche : critères atteints ou non, cycles utilisés, consommation, actions humaines restantes.

La page est en HTML, CSS et JavaScript simples, sans framework ni étape de compilation [CHOIX].

## 7. La boucle de supervision

Pour chaque tâche du plan, dans l'ordre :

```
 ┌─► TASK (consigne écrite par le superviseur, permissions fixées par l'orchestrateur)
 │      │
 │      ▼
 │   Claude exécute ─► EXEC_REPORT (déclaratif)
 │      │
 │      ▼
 │   Orchestrateur collecte les PREUVES (indépendantes de Claude)
 │      │
 │      ▼
 │   Superviseur ─► EVALUATION { verdict }
 │      │
 │      ├─ accept    → tâche terminée, tâche suivante
 │      ├─ correct   → CORRECTION ─┐ (si budget de cycles restant, sinon escalade)
 │      ├─ escalate  → pause, question à l'utilisateur
 │      └─ abort     → arrêt de la mission, rapport FINAL
 └────────────────────────────────┘
```

**Rédaction des consignes.** Le superviseur écrit l'objectif et les instructions de la `TASK`. Les **permissions, chemins et limites** de la `TASK` sont toujours fixés par l'orchestrateur, jamais par le superviseur. Si le superviseur demande plus de droits (installation, suppression, commande hors liste), c'est une escalade.

**Preuves** (collectées par l'orchestrateur, jamais par un agent) :
- `git diff --stat` et la liste des fichiers ajoutés, modifiés ou supprimés, comparée au dernier point de contrôle (§9) ;
- le résultat des **commandes de vérification du projet** (tests, compilation), relancées par l'orchestrateur lui-même. Ces commandes sont définies dans la mission et validées par l'utilisateur avec le plan [CHOIX] ;
- le constat de fichiers modifiés hors des chemins autorisés, qui vaut échec immédiat de la tâche ;
- un extrait du diff (200 lignes au plus, sinon un résumé).

Le superviseur reçoit la mission, le plan, la tâche, le rapport de Claude (balisé comme donnée non fiable) et les preuves (balisées comme provenant de l'orchestrateur). Il évalue **sur les preuves** : c'est la consigne de son prompt, et c'est aussi vérifié par l'orchestrateur. Un `accept` alors qu'une commande de vérification échoue est transformé en `escalate`.

**Garde-fous** (valeurs par défaut modifiables par projet, reprises du rapport 02 et du dossier) [CHOIX sur les valeurs] :

| Limite | Défaut | Quand on l'atteint |
|---|---|---|
| Cycles de correction par tâche | 3 | escalade |
| Appels Codex | 8 par tâche, 80 par projet [DÉCIDÉ] | pause et question |
| Appels Codex par jour (tous projets) | 30 [DÉCIDÉ] | pause jusqu'au lendemain ou décision |
| Tours Claude par exécution | 20 (`--max-turns`) | rapport `partial`, évaluation normale |
| Budget Claude par exécution | 0,50 USD (`--max-budget-usd`, estimation) | idem |
| Délai par appel Codex / Claude | 5 min / 15 min | échec classé `timeout` |
| Même erreur ou même diff deux fois de suite | 2 | escalade (détection de boucle) |
| Réponse non conforme au schéma | 1 nouvel essai | puis escalade |
| Quota Codex épuisé (erreur détectée) | — | pause et notification, **jamais de bascule** |

Le dossier proposait « 8 appels Codex par mission ». Pour un projet entier de plusieurs tâches, ce chiffre ne suffit pas (une tâche consomme au minimum 2 appels). La v1 le transforme donc en limite par tâche, avec un plafond global. Ce point est signalé à l'utilisateur.

## 8. Protocole `orch/1`

On reprend l'enveloppe du rapport 02 §5, plus complète que l'exemple du dossier [CHOIX] :

```json
{ "schema": "orch/1",
  "type": "mission|plan|task|exec_report|evaluation|correction|final|question|answer",
  "id": "uuid", "mission_id": "uuid", "project_id": "string", "parent_id": "uuid|null",
  "attempt": 1, "created_at": "ISO-8601",
  "producer": { "role": "orchestrator|supervisor|executor|user", "adapter": "codex-cli|claude-cli|fake|web", "model": "string|null" },
  "usage": { "source": "measured|estimated|unavailable", "input_tokens": null, "cached_input_tokens": null,
             "output_tokens": null, "cost_usd": null, "duration_ms": 0, "session_id": null },
  "payload": {} }
```

Les `payload` des sept types sont ceux du tableau du rapport 02 §5. Deux types sont ajoutés pour l'entretien et les escalades [CHOIX] :
- `question` : `{ origin: "interview|escalation|approval", items: [{id, text, kind: "free|choice|approve", choices[]}] }`
- `answer` : `{ question_id, items: [{id, value}] }`

Chaque type a un schéma `zod`. Tout message non conforme est rejeté. Côté agent, on demande la sortie structurée au CLI : `--output-schema` pour Codex, `--json-schema` pour Claude. Ces schémas sont générés depuis `zod`.

Les champs `usage` ne sont jamais inventés :
- Codex : les tokens viennent de l'événement `turn.completed`, avec `source = measured`, coût `null` ;
- Claude : `total_cost_usd` est marqué `estimated`, les tokens sont lus s'ils sont présents dans la sortie JSON, sinon `unavailable`.

## 9. Projets, dossiers et Git

- Racine des projets configurable, par défaut `%USERPROFILE%\BridgeProjets\` [CHOIX]. Un sous-dossier par projet. **Fastclip et tout dossier hors racine sont refusés**, sauf ajout explicite par l'utilisateur dans la configuration.
- À la création, l'orchestrateur exécute `git init` dans le dossier du projet [CHOIX]. Git sert uniquement d'**outil de preuve et de retour arrière local**.
  - Avant chaque exécution de Claude, l'orchestrateur fait un commit de point de contrôle (`bridge: avant tâche X tentative N`).
  - Le diff de la tentative est calculé contre ce point.
  - Aucun `push`, aucun dépôt distant configuré.
- Les chemins autorisés d'une tâche sont résolus en chemins réels (`realpath`) et comparés à la racine du projet. Les liens symboliques et jonctions qui sortent du projet sont refusés.

## 10. Permissions effectives

Les permissions sont appliquées **par les arguments CLI et par le contrôle a posteriori**, pas seulement par le texte du prompt.

**Codex** [DÉCIDÉ : jamais d'écriture]
- Arguments repris **du harnais Phase 0A** (`codexAdapter`), plus verrouillés que ceux d'Agent Bridge : `codex exec - --ignore-user-config --ignore-rules --ephemeral --skip-git-repo-check --sandbox read-only -c approval_policy="never" -c web_search="disabled" --disable <fonctions de CODEX_DISABLED_FEATURES> -C <projet> --output-schema <fichier> -o <réponse> --json --color never`, avec le prompt passé sur l'entrée standard.
- Chaque événement JSONL est contrôlé au fil de l'eau (`codexEventViolation`). Un élément autre que `agent_message` ou `reasoning` (par exemple un appel de commande) arrête l'appel.
- Mode `workspace-write` d'Agent Bridge **supprimé** : l'adaptateur Codex refuse toute tâche dont `write` vaut vrai.
- Lancé dans le dossier du projet, pour lire le code.
- Après chaque appel Codex, l'orchestrateur vérifie que l'arbre Git n'a pas changé (`git status --porcelain` identique). Sinon : arrêt de la mission et alerte.

**Claude Code**
- Arguments repris **du harnais Phase 0A** (`claudeAdapter`) : `claude -p --restricted --tools <liste> --allowedTools <liste> --disallowedTools <liste> --strict-mcp-config --disable-slash-commands --settings <fichier> --permission-mode dontAsk --permission-prompts none --no-session-persistence --output-format stream-json --verbose --json-schema <…> --max-turns N --max-budget-usd X`.
- Le mode `acceptEdits` global d'Agent Bridge est abandonné. Les outils sont `Read`, `Edit`, `Write`, `Glob` et `Grep`, plus les commandes de la liste blanche du projet (voir §16). Avec `dontAsk`, tout ce qui n'est pas listé est refusé sans question.
- Le flux `stream-json` est contrôlé au fil de l'eau (`claudeEventViolation`). Un appel d'outil interdit arrête l'exécution.
- Interdits dans tous les cas : `WebFetch`, `WebSearch`, `Agent`/`Task`, `mcp__*`, `git push`, `git remote`, toute commande de suppression récursive.
- Variables d'environnement filtrées comme dans le harnais Phase 0A (`STRIP_ENV`) : aucune clé API transmise, ce qui rend impossible une bascule vers l'API payante.

**Contrôle a posteriori** : un fichier modifié hors des chemins autorisés, une suppression non autorisée, ou une modification de `.git/` hors des commits de l'orchestrateur entraînent l'échec de la tentative. Les changements sont alors **conservés** (pas d'annulation automatique), et une escalade propose à l'utilisateur de revenir au point de contrôle.

## 11. États, reprise et annulation

États d'une exécution d'agent (une tentative) [CHOIX, sous-ensemble de la proposition du dossier] :
`pending → dispatched → running → completed | failed | cancelled | timed_out`, plus `unknown`.

États d'une tâche du plan :
`pending → in_progress → done | failed | skipped`, plus `waiting_user` et `needs_review`.

**Reprise au démarrage :**
- Toute tentative `dispatched` ou `running` devient `unknown`, et sa tâche passe à `needs_review`.
- Aucune relance automatique.
- La page présente à l'utilisateur le diff depuis le point de contrôle, avec trois choix : **reprendre cette tâche** (nouvelle tentative), **revenir au point de contrôle puis reprendre**, ou **arrêter**.
- Une tentative `unknown` qui concerne Codex (lecture seule) peut être relancée sans risque d'effet. On demande quand même confirmation en v1, par simplicité.

**Annulation et arrêt d'urgence :**
- Le bouton tue l'arbre de processus en cours (`terminateProcessTree` d'Agent Bridge, `taskkill /T /F` sous Windows).
- La tentative passe à `cancelled` et la mission à `stopped`.
- Aucun nouvel appel n'est lancé tant que l'utilisateur n'a pas repris.

**Idempotence :**
- Chaque tentative a un identifiant propre.
- L'orchestrateur ne lance une tentative qu'après l'avoir enregistrée `dispatched` en base, dans une transaction.
- Un seul agent tourne à la fois (pas de parallélisme en v1).

## 12. Sécurité : ce que la v1 garantit, et ce qu'elle ne garantit pas

**Garanti par construction :**
- écoute locale seulement, avec jeton ;
- Codex en bac à sable lecture seule, avec contrôle Git après chaque appel ;
- aucune clé API transmise aux agents ;
- outils Claude limités par liste ;
- aucun push ;
- détection a posteriori des écritures hors projet dans le dossier du projet ;
- limites d'appels et de cycles ;
- contenu du projet et rapports d'agents balisés comme données non fiables dans tous les prompts.

**Non garanti** (déjà documenté en Phase 0B) :
- Claude Code n'a pas de bac à sable système sous Windows. Une commande autorisée (par exemple `npm test`) exécute du code du projet avec les droits de l'utilisateur. Une écriture **hors** du dossier du projet par ce biais ne serait pas détectée.
- L'exfiltration vers les domaines que les CLI contactent eux-mêmes reste possible.
- La machine virtuelle de la Phase 0B reste la protection forte. Elle sort du périmètre v1 et pourra venir ensuite.

L'utilisateur accepte ce niveau de risque en lançant la v1 sur son PC. Recommandation : ne pas pointer Bridge vers des projets contenant des secrets.

## 13. Ce qu'on reprend d'Agent Bridge

| Fichier source | Sort | Modification |
|---|---|---|
| `adapters/command.ts` (lancement, `terminateProcessTree`, `buildWindowsShellCommand`, `findCommand`, `workerEnvironment`) | **repris** | filtrage d'environnement aligné sur `STRIP_ENV`, plafond de taille stdout/stderr |
| `adapters/codex-cli.ts` | **repris et modifié** | lecture seule forcée, `--output-schema`, lecture de `usage` dans `turn.completed`, détection du quota épuisé |
| `adapters/claude-cli.ts` | **repris et modifié** | `--json-schema`, `--max-budget-usd`, listes d'outils au lieu de `acceptEdits`, extraction de `usage` |
| `adapters/mock.ts` | **repris et étendu** | faux Codex et faux Claude scriptables (scénarios de test, y compris rapport falsifié et quota épuisé) |
| `store.ts` (file JSON) | **remplacé** | par SQLite dans l'orchestrateur |
| `broker.ts` | **remplacé** | par la boucle de l'orchestrateur |
| `transports/*`, `mcp-server.ts`, `demo-console.ts`, OAuth | **retirés en v1** | |
| tests `command*.test.ts`, `claude-cli.test.ts` | **repris** | adaptés |

L'en-tête de licence MIT d'Agent Bridge est conservé dans un fichier `THIRD_PARTY_NOTICES.md` et en tête des fichiers repris.

Du harnais Phase 0A (`harness/run-phase0a.mjs`), on reprend : `STRIP_ENV`, la liste des outils Claude interdits, le balisage `<donnees_non_fiables>` des prompts, et les scénarios de simulation SIM-01 à SIM-17 comme base des tests.

## 14. Tests

- Tests unitaires `node --test` : schémas `orch/1`, garde-fous, transitions d'état, résolution des chemins, construction des arguments CLI (vérifier qu'aucune combinaison de permissions ne produit un argument plus large).
- **Tests de scénario avec faux agents**, portage des simulations Phase 0A.1 : nominal, correction unique, rapport falsifié rejeté, schéma invalide, écriture hors périmètre, quota épuisé, boucle détectée, reprise après interruption (`unknown`), arrêt d'urgence.
- Test de la page : un test bout en bout avec Playwright sur un scénario factice (création de projet, entretien, plan, une tâche, décision, fin).
- **Premier essai réel** sur le PC de l'utilisateur, avec un petit projet jetable, et seulement après validation de tout ce qui précède.

## 15. Laissé au développeur

- Structure exacte des tables SQLite et des fichiers source.
- Formulation détaillée des prompts du superviseur et de l'exécutant (en partant de ceux du harnais Phase 0A).
- Format interne des événements du fil d'activité.
- Style visuel de la page.

## 16. Décisions prises pendant la relecture

- **Commandes de Claude : liste blanche par projet** [DÉCIDÉ, option a].
  - Au moment du plan, le superviseur propose une courte liste de commandes : tests, compilation, lancement local. L'utilisateur la valide ou la modifie avec le plan. Elle est stockée dans la mission.
  - Claude reçoit uniquement ces commandes, sous forme de règles `Bash(<commande exacte>)` dans `--allowedTools`. Avec `--permission-mode dontAsk`, toute autre commande est refusée.
  - **Installation de paquets** (`npm install <x>`, `pip install`…) : jamais dans la liste. Claude la signale dans `needs_approval[]` de son rapport. L'orchestrateur affiche alors une décision sur la page (« Claude veut installer xlsx »). Si l'utilisateur autorise, **l'orchestrateur exécute lui-même l'installation** dans le dossier du projet, puis relance la tâche. Claude ne lance jamais d'installation.
  - Les commandes de vérification relancées par l'orchestrateur (§7, preuves) sont les mêmes que celles de la liste blanche.
- **Limites d'appels Codex** [DÉCIDÉ] : 8 par tâche, 80 par projet, 30 par jour, tous projets confondus. Quand une limite est atteinte : pause et question à l'utilisateur.
