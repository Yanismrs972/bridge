<!-- Rapport extrait de la session Claude « Orchestrateur IA », 2026-11-16 02:53 UTC -->

# ORCHESTRATEUR IA : rapport d'audit, session fondatrice

## A. Résumé exécutif

**Avec votre offre ChatGPT Free, ChatGPT ne peut pas piloter directement un orchestrateur local.** J'ai vérifié sur la page officielle des tarifs, le 16/11/2026 : le mode développeur, la création de plugins et les tâches planifiées sont marqués « Non » pour Free et pour Go. Ils sont marqués « Oui » pour Plus et Pro. La documentation d'aide d'OpenAI réserve les serveurs MCP personnalisés avec actions d'écriture aux offres **Business et Enterprise/Edu, sur le web uniquement**.

Même avec une offre éligible, ChatGPT reste un **chat qui attend vos messages**. Il appelle un outil seulement quand vous lui écrivez. Il ne peut donc pas faire tourner seul une boucle « planifier → déléguer → vérifier → corriger » pendant des heures.

**Le « cerveau » doit donc être piloté par l'orchestrateur local**, et non l'inverse. La meilleure option compatible avec Free est **Codex CLI** (`codex exec`). C'est l'agent de code d'OpenAI. Il se connecte avec votre compte ChatGPT, et l'offre Free inclut un « accès limité à Codex ». Il se lance en ligne de commande et renvoie un JSON qui inclut les tokens consommés. Autre option : l'API OpenAI, facturée à l'usage et séparée de l'abonnement ChatGPT. L'interface ChatGPT pourra servir plus tard de façade, si vous changez d'offre.

Les six dépôts existent tous. Aucun ne remplit seul l'objectif :
- **Agent Bridge** est petit, sous licence MIT, bien conçu pour Windows. Mais il n'a qu'un auteur et n'est plus actif depuis juillet.
- **Cezar** et **Agent Orchestrator** sont très actifs et complets. Mais ils ne prévoient pas de supervision par ChatGPT et sont très volumineux.
- J'ai trouvé un candidat plus proche de votre vision : **claude-code-mcp-harness**. Il est prévu d'abord pour Windows, mais il est en bêta, compte 8 étoiles et je ne l'ai audité que par son README.

**Ma recommandation : un orchestrateur personnalisé et léger (stratégie D).** Il serait seul responsable de la sécurité, des budgets et de l'état. Il reprendrait le code et les idées d'Agent Bridge (MIT). Le superviseur pourrait être interchangeable : Codex CLI maintenant, API OpenAI ou connecteur ChatGPT ensuite. Avant d'en écrire beaucoup, un test d'une demi-journée sur **Cezar** permettrait de vérifier qu'un produit existant ne fait pas déjà l'essentiel.

## B. État de votre environnement

| Élément | État vérifié |
|---|---|
| Dossier courant | Dossier temporaire créé par l'app pour cette session : **ce n'est pas Fastclip** |
| OS | Windows 10 Famille 10.0.19045, PowerShell 5.1, 32 Go de RAM |
| Git | 2.56.0 |
| Python | 3.12.10 |
| Node.js / npm | v22.23.4 / 10.9.9 |
| Claude Code | Utilisé via l'app Claude Desktop (cette session), `~/.claude` présent. **La commande `claude` n'est pas dans le PATH** : il faudra installer le CLI pour lancer Claude Code automatiquement |
| Codex CLI | Absent |
| WSL | Installé mais **aucune distribution Linux** |
| Docker | Absent (ce qui bloque la méthode d'installation principale de Task Orchestrator) |
| GitHub CLI (`gh`) | Absent |
| ngrok | 3.39.11 présent. À ne pas utiliser pour exposer le PC sans authentification |

Je n'ai rien installé ni modifié. Je n'ai ouvert aucun fichier de Fastclip.

## C. Faisabilité ChatGPT ↔ Claude Code

| Mécanisme | Free | Plus/Pro | Business/Ent | Remarques |
|---|---|---|---|---|
| Mode développeur / MCP personnalisé | ❌ | ✅ mode dév. (vérifié sur la page des tarifs) | ✅ | Écriture via MCP officiellement réservée à Business/Ent/Edu. Pour Plus, **non vérifié** : les sources tierces parlent de lecture seule |
| Secure MCP Tunnel (relie un serveur privé sans l'exposer) | ❌ | Non vérifié | ✅ | Connexion sortante, sans port ouvert. Un utilisateur signale un rattachement obligatoire espace Business ↔ organisation API |
| Tâches planifiées ChatGPT | ❌ | ✅ | ✅ | Ne transforme pas ChatGPT en superviseur continu |
| **Codex CLI `codex exec`** | ✅ limité | ✅ étendu | ✅ | Lancement en ligne de commande, sortie JSON, `usage` en tokens (y compris le cache), bac à sable lecture seule par défaut |
| API OpenAI | Paiement séparé | Idem (Pro : crédits API inclus) | Idem | Vraie autonomie, coûts mesurables |
| Claude Code `claude -p` | — | — | — | Sortie JSON avec `session_id`, `total_cost_usd` (une estimation), `--json-schema`, `--max-turns`, `--max-budget-usd`, `--permission-mode`, `--allowedTools`, `--resume`. Les demandes d'autorisation sont refusées par défaut en mode non interactif |

Les quatre modes à distinguer :
- **Pilotage initié depuis ChatGPT** : impossible en Free. Possible en Business, et en Plus avec des limites à vérifier.
- **Exécution autonome d'une tâche déjà autorisée** : possible, gérée par l'orchestrateur avec `claude -p`.
- **Supervision continue** : seulement si le superviseur est appelé par l'orchestrateur (Codex CLI ou API), jamais par l'interface ChatGPT.
- **Notifications et demandes d'approbation** : à construire (console locale, notification Windows, puis mobile).

## D. Audit des six dépôts

### D1. Agent Bridge (jcharveyjr/claude-chatgpt-agent-bridge)
- **État** : existe, public, MIT, TypeScript. Créé le 14/07/2026, dernier push le 23/07/2026. 1 étoile, 1 seul auteur, environ 50 commits, release v0.2.0. 17 fichiers source et 14 fichiers de test, CI GitHub.
- **Vérifié dans le code** :
  - Claude Code est lancé via `claude -p --output-format json --no-session-persistence --permission-mode <plan|acceptEdits> --max-turns 30`, avec le prompt passé en entrée standard et le dossier de travail fixé sur l'espace de travail.
  - La persistance est un **fichier JSON** à écriture atomique (`rename`, sans `fsync`), protégé en `0o600`. Les tâches « en cours » repassent « en file » au redémarrage.
  - Seuls `session_id` et `total_cost_usd` sont récupérés : pas de compte de tokens.
- **Avantages** : liste blanche d'espaces de travail nommés, lecture seule par défaut, écoute locale uniquement, jeton ou OAuth obligatoire hors machine locale, profondeur de délégation 2, scripts Windows et journal d'installation Windows. Le code est compact et lisible.
- **Inconvénients** : aucun `--allowedTools`, donc en écriture `acceptEdits` reste large. Rien contre les injections de prompt. Pas de boucle de supervision ni de budget. Le support de ChatGPT web relève de la déclaration, pas d'un test (son propre VALIDATION.md le précise).
- **Maturité** : faible (prototype soigné, mono-auteur, inactif depuis 4 mois).
- **Réutilisation** : **excellente comme base de code ou d'inspiration** (adaptateurs, transport MCP HTTP, file d'attente).

### D2. Cezar (open-mercato/cezar)
- **État** : MIT, TypeScript. Dernier push le 15/11/2026, environ 1 060 étoiles, 48 contributeurs, release v0.20.0 du 15/11, 324 issues ouvertes, 1 898 commits.
- **Selon le README, non vérifié dans le code** : cockpit web local, workflows YAML (étapes agent ou shell, `onFail: {retry, max}`), une worktree Git par tâche, file d'attente, variantes ×2/×3, plusieurs projets, coûts « reported », pas de fusion automatique, webhooks, CLI et API HTTP. Prend en charge Claude Code, Codex et une dizaine d'autres agents. Stockage en fichiers simples.
- **Point de sécurité** : un document interne parle de modes de permission « non-skip-all », ce qui laisse penser que le **mode par défaut contourne les autorisations**. Non vérifié.
- **Avantages** : un workflow « Codex planifie → Claude code → tests shell → Codex relit, avec reprises » est probablement faisable **sans développement**.
- **Inconvénients** : environ 180 Mo de dépôt, évolution très rapide, pas d'intégration ChatGPT, support Windows non vérifié.
- **Réutilisation** : à tester comme « produit à adopter », pas à fusionner.

### D3. Concord MCP (Get-Concord-AI/concord-mcp)
- **État** : MIT, TypeScript, environ 1 155 étoiles, actif, 674 commits.
- **Rôle réel** : couche de messagerie et de coordination entre agents sur un même dépôt (SQLite, revendication de tâches, détection de chevauchements). Le README précise que ce **n'est pas un orchestrateur**.
- **Points négatifs** : **télémétrie activée par défaut** vers getconcord.ai. ChatGPT n'est pas dans les clients pris en charge. Installeur pour macOS et Linux seulement.
- **Réutilisation** : faible pour vous. C'est surtout utile quand plusieurs agents écrivent en parallèle dans un même dépôt.

### D4. Task Orchestrator (jpicklyk/task-orchestrator)
- **État** : MIT, Kotlin/JVM, 214 étoiles, 1 067 commits, très actif (push le 16/11).
- **Selon le README** : serveur MCP avec graphe de tâches, dépendances typées, **étapes de validation obligatoires imposées par le serveur** (`gate_blocked`), SQLite avec migrations, tests JUnit et contrôles d'architecture.
- **Inconvénients** : Docker conseillé (absent chez vous), une JVM en plus de Node. Sans authentification, n'importe qui pouvant joindre le port a un accès complet. Aucun suivi de coûts.
- **Réutilisation** : **les idées** (étapes de validation déclaratives, reprise d'état en 1 ou 2 appels). Ajouter un second gestionnaire de tâches dupliquerait celui de l'orchestrateur.

### D5. Clade (shenxingy/clade)
- **État** : MIT, Python, 10 étoiles, 1 623 commits, marqué expérimental.
- **Selon le README** : skills `/green` et `/verify`, transfert de contexte (`/handoff`, `/pickup`), un pont MCP.
- **Problème bloquant** : le README indique que le mode Claude « **contourne les autorisations du CLI** ». L'installation exige Bash et `jq`, et **remplace vos hooks Claude existants**. Windows n'est pas mentionné.
- **Réutilisation** : seulement l'idée « le rapport de vérification est une matière à relire, pas une autorisation de fusion ».

### D6. « Composio Agent Orchestrator »
- **Le dépôt a été renommé** : l'adresse redirige vers **OrchestratorInc/agent-orchestrator** (vérifié via l'API GitHub).
- **État** : Apache-2.0, Go et TypeScript, environ 14 750 étoiles, 4 193 commits, 1 010 issues ouvertes.
- **Selon le README** : application de bureau (dont un .exe Windows) et mobile, un agent principal qui planifie, des agents secondaires chacun dans sa worktree, tableau Kanban, réactions à la CI et aux revues, notifications mobiles d'approbation.
- **Points négatifs** : **télémétrie incluant votre nom GitHub** (désactivable), option cloud, mise à jour automatique, pas d'API ni de MCP documentés pour un pilotage externe. Suivi de coûts non vérifié.
- **Réutilisation** : bonne alternative « produit clé en main » si vous renoncez à ChatGPT comme cerveau. Impossible à intégrer comme composant.

## E. Autres dépôts intéressants

- **claude-code-mcp-harness** (zhuzai-2007), MIT, JavaScript, 8 étoiles, dernier push en août 2026. **C'est le plus proche de votre vision** :
  - ChatGPT Web joue le superviseur, Claude Code l'exécutant borné.
  - Politiques versionnées (`policy.json`, `resource-profiles.json`, `projects.json`), confinement à la racine du projet.
  - Étape d'approbation humaine avant toute écriture, audit, reprise après déconnexion.
  - **Windows est sa plateforme principale.**
  - Limites : exige Business/Enterprise et Secure MCP Tunnel pour ChatGPT. Bêta sur invitation, étapes séquentielles sans reprise automatique. Le README dit lui-même « pas une isolation de production ». **Audité par le README seulement.**
- **Omnigent** (omnigent-ai/omnigent), Apache-2.0, Python, environ 11 400 étoiles, 2 425 issues. Couche générique pour piloter plusieurs agents, avec politiques et bac à sable. Trop large pour un départ simple. Non audité dans le code.
- **Orchestra-MCP** (ngoclinh93qt) : intention similaire, mais conçu pour Mac. Non audité.

## F. Tableau comparatif

Notes de 0 à 5. ⓡ = note fondée sur le README seulement (non vérifié dans le code). Score pondéré sur 340.

| Critère (poids) | Agent Bridge | Cezar | Concord | Task Orch. | Clade | Agent Orch. | MCP Harness |
|---|---|---|---|---|---|---|---|
| Communication ChatGPT/Claude (5) | 4 | 1ⓡ | 1 | 1 | 1 | 1ⓡ | 4ⓡ |
| Compatibilité ChatGPT réel (5) | 2 | 1 | 0 | 1 | 1 | 1 | 2ⓡ |
| Sécurité et permissions (5) | 3 | 2ⓡ | 2 | 3ⓡ | 1 | 3ⓡ | 4ⓡ |
| Persistance des tâches (5) | 3 | 3ⓡ | 4ⓡ | 5ⓡ | 2 | 4ⓡ | 4ⓡ |
| Autonomie et supervision (5) | 2 | 4ⓡ | 1 | 3ⓡ | 3ⓡ | 5ⓡ | 3ⓡ |
| Gestion des erreurs (5) | 3 | 4ⓡ | 2 | 3ⓡ | 3ⓡ | 4ⓡ | 3ⓡ |
| Reprise après interruption (4) | 3 | 3ⓡ | 3ⓡ | 4ⓡ | 2 | 3ⓡ | 4ⓡ |
| Multi-projets (4) | 3 | 5ⓡ | 3 | 4ⓡ | 2 | 5ⓡ | 3ⓡ |
| Optimisation des tokens (5) | 2 | 2 | 2 | 3ⓡ | 2 | 2 | 2 |
| Gestion des coûts (5) | 2 | 3ⓡ | 0 | 0 | 0 | 1ⓡ | 3ⓡ |
| Extensibilité (4) | 3 | 4 | 3 | 4 | 3 | 4 | 3 |
| Facilité de maintenance (4) | 4 | 2 | 3 | 3 | 2 | 2 | 2 |
| Compatibilité Windows (4) | 4 | 3ⓡ | 2 | 2 | 1 | 4ⓡ | 5ⓡ |
| Qualité des tests (4) | 3 | 3ⓡ | 3ⓡ | 4ⓡ | 2ⓡ | 3ⓡ | 3ⓡ |
| Licence (4) | 5 | 5 | 5 | 5 | 5 | 5 | 5 |
| **Score /340** | **205** | **200** | **148** | **199** | **133** | **209** | **225** |

Ce qui ressort :
- **Aucun candidat ne dépasse 66 %.**
- Le meilleur score (MCP Harness) repose surtout sur des déclarations du README et sur une offre ChatGPT que vous n'avez pas.
- Les critères notés 0 à 2 partout, l'optimisation des tokens et la gestion des coûts, sont justement deux de vos critères majeurs : **il faudra les développer quoi qu'il arrive.**

## G. Architecture recommandée

```
Vous ── ChatGPT (plus tard, si l'offre le permet : façade MCP, lecture seule d'abord)
  │
  └── Console locale (127.0.0.1) + CLI + notifications ── approbations, arrêt d'urgence
            │
     ORCHESTRATEUR LOCAL (Node/TypeScript, SQLite)
     ├─ Registre des projets (id, chemin, permissions, budget, politique, état)
     ├─ Moteur de tâches (machine à états, dépendances, tentatives, délais)
     ├─ Garde-fous centralisés (niveaux de permission, garde Git, limites de boucle, budgets)
     ├─ Comptabilité (mesuré / estimé / indisponible) + cache
     ├─ Adaptateur SUPERVISEUR (interchangeable) : Codex CLI → API OpenAI → MCP ChatGPT
     └─ Adaptateur EXÉCUTANT : claude -p (JSON, --json-schema, --allowedTools,
                                --max-turns, --max-budget-usd, worktree dédiée)
```

Justification de chaque choix :
- **Node/TypeScript** : il est déjà installé, c'est le langage d'Agent Bridge, et c'est celui du SDK MCP officiel.
- **SQLite plutôt qu'un fichier JSON** : transactions, historique, requêtes de coûts.
- **Une seule source de vérité pour les permissions**, et aucun second gestionnaire de tâches importé.
- **Superviseur interchangeable** : c'est ce qui contourne la limite Free sans s'enfermer.
- **Le superviseur ne reçoit que des rapports structurés et compacts** : le diff résumé, les tests réussis ou échoués et les erreurs. Jamais les fichiers entiers.
- **Garde Git** :
  - règles d'interdiction Claude du type `Bash(git push *)` ;
  - aucun identifiant Git d'écriture dans l'environnement de l'exécutant ;
  - une branche par tâche, sans fusion ni push automatiques.
- **Tout contenu de dépôt est traité comme une donnée** : il passe dans des champs balisés et n'est jamais suivi comme une instruction.

## H. Fonctionnalités à récupérer et à développer

**À récupérer (MIT, en citant les sources) :**
- **Agent Bridge** : structure des adaptateurs CLI, gestion des arborescences de processus Windows, transport MCP HTTP, file d'attente avec reprise, scripts de démarrage et d'arrêt.
- **Task Orchestrator** (idée seulement) : étapes de validation déclaratives par phase.
- **MCP Harness et Cezar** (idées) : profils de ressources, approbation liée à une empreinte du prompt, workflows avec `onFail retry max`.
- **Fonctions natives de Claude Code** : `--json-schema` pour des rapports structurés, `--max-budget-usd`, modes de permission.

**À développer :**
- registre des projets et politique graduée (lecture, écriture, Git, réseau, installation) ;
- comptabilité des coûts et tokens à trois statuts (mesuré, estimé, indisponible) et budgets par tâche, projet et période ;
- cache des résultats de tests indexé sur l'état exact du code (hash Git) ;
- détection des répétitions et des erreurs récurrentes, arrêt d'urgence ;
- protocole de rapport et critères d'acceptation ;
- adaptateur Codex et adaptateur API OpenAI ;
- façade MCP pour ChatGPT (en dernier).

## I. Risques et difficultés

- **Économiques** :
  - le quota Codex de l'offre Free est « limité » et son montant exact n'est pas publié (non vérifié) ;
  - le `total_cost_usd` de Claude est une estimation ;
  - avec un abonnement Claude, le coût réel n'est pas un coût par token.
- **Techniques** :
  - pas de Docker ni de distribution WSL, donc pas d'isolation forte : il faudra un compte Windows dédié ou une VM plus tard ;
  - les CLI Claude et Codex évoluent vite et leurs options changent ;
  - `claude -p` sans `--bare` exécute les hooks et serveurs MCP présents dans le projet ciblé.
- **Sécurité** :
  - injection de prompt via le contenu des dépôts ;
  - des outils de dépôt qui contournent les permissions (Clade, peut-être Cezar) ;
  - télémétrie (Concord, Agent Orchestrator) ;
  - exposer le PC via ngrok sans authentification serait dangereux.
- **Conditions d'utilisation** : la doc de Codex déconseille l'authentification ChatGPT sur des machines non fiables. Pour Claude, vérifier les conditions d'usage automatisé de l'abonnement (non vérifié ici).
- **Produit** : le « ChatGPT autonome dans le navigateur » de votre vision n'est **pas atteignable tel quel**, même avec une offre payante.

## J. Plan de développement

| Phase | Objectif | Critère d'acceptation |
|---|---|---|
| 0. Test préalable (avec votre accord) | Installer les CLI Claude et Codex, mesurer les quotas, tester Cezar dans un dossier isolé | Un `claude -p` et un `codex exec` réussis sur un projet de test, avec coûts et tokens relevés. Décision : adopter Cezar ou construire |
| 1. Fondations | Dépôt dédié, registre de projets, SQLite, journal | Tests unitaires du registre et du stockage. Un projet hors liste est refusé |
| 2. Exécutant | Adaptateur `claude -p` avec rapport JSON structuré | Une tâche lecture seule n'écrit jamais. Délais et budget respectés. Test de reprise après arrêt brutal |
| 3. Garde-fous | Permissions graduées, garde Git, arrêt d'urgence | Tests de sécurité : push refusé, sortie du dossier refusée, l'arrêt d'urgence stoppe tout |
| 4. Superviseur | Adaptateur Codex (puis API), schémas « plan » et « relecture » | Le superviseur rejette un rapport sans preuve de tests |
| 5. Boucle autonome | Plan → exécution → relecture → correction → terminaison | Arrêt sur nombre max de tentatives, répétition détectée, escalade vers vous |
| 6. Coûts et cache | Tableaux de bord mesuré/estimé, cache des tests | Les appels évités sont comptés. Budget dépassé = pause et demande d'accord |
| 7. Interface humaine | Console locale, notifications, approbations | Une approbation est liée à une tâche et à une empreinte précises |
| 8. Façade ChatGPT | Serveur MCP (si l'offre le permet), lecture seule d'abord | Fonctionne via le tunnel sans exposition publique |
| 9. Parallélisme | Worktrees, plusieurs projets en simultané | Pas de conflit entre tâches, coûts bien attribués |

## K. Décisions qui nécessitent votre accord

1. **Le superviseur** : Codex CLI sur Free (gratuit, quota limité), API OpenAI (payante, pleinement autonome), ou passage à Plus ou Business. C'est la question posée dans l'encadré.
2. **L'installation du CLI Claude Code et du CLI Codex** sur votre PC.
3. **Le mode de facturation Claude** pour l'exécutant : abonnement ou clé API.
4. **L'emplacement du dossier du projet** et l'initialisation de son dépôt Git (hors Fastclip).
5. **Le test préalable de Cezar** : téléchargement et exécution dans un dossier isolé, avec un projet de test.
6. **Le langage** : TypeScript (recommandé) ou Python.
7. **Les plafonds de budget** par tâche, par projet et par mois.

## L. Recommandation finale

À votre place, je ne bâtirais pas le système sur ChatGPT web aujourd'hui, et je ne fusionnerais aucun de ces dépôts. Je construirais :
- **un orchestrateur local léger en TypeScript**, seul gardien de la sécurité, des budgets et de l'état ;
- en reprenant légalement le code utile d'**Agent Bridge** ;
- avec **Codex CLI comme premier superviseur**, ce qui donne un cerveau OpenAI dès l'offre Free, sans tunnel ni exposition réseau ;
- et **Claude Code `claude -p` comme seul exécutant**.

Je commencerais par la phase 0 : si Cezar remplit déjà l'essentiel de façon sûre sous Windows, l'adopter vaudra mieux que développer. La connexion directe depuis ChatGPT viendra en dernier, et seulement si vous passez à une offre qui la permet.

J'attends votre validation avant toute installation, création de fichier ou modification.

**Sources :**
- [OpenAI : Connecting custom MCP servers in ChatGPT](https://help.openai.com/en/articles/12584461)
- [Tarifs ChatGPT](https://chatgpt.com/pricing)
- [OpenAI : Secure MCP Tunnel](https://developers.openai.com/api/docs/guides/secure-mcp-tunnels)
- [Codex : mode non interactif](https://learn.chatgpt.com/docs/non-interactive-mode)
- [Claude Code : exécution programmatique](https://code.claude.com/docs/en/headless)
- [Agent Bridge](https://github.com/jcharveyjr/claude-chatgpt-agent-bridge)
- [Cezar](https://github.com/open-mercato/cezar)
- [Concord MCP](https://github.com/Get-Concord-AI/concord-mcp)
- [Task Orchestrator](https://github.com/jpicklyk/task-orchestrator)
- [Clade](https://github.com/shenxingy/clade)
- [Agent Orchestrator](https://github.com/ComposioHQ/agent-orchestrator)
- [claude-code-mcp-harness](https://github.com/zhuzai-2007/claude-code-mcp-harness)
- [Omnigent](https://github.com/omnigent-ai/omnigent)
- [Orchestra-MCP](https://github.com/ngoclinh93qt/Orchestra-MCP)
- Sources tierces non officielles : [ScreenWeaver](https://www.screenweaver.ai/blog/connect-chatgpt-to-screenweaver), [BuildMyMCPServer](https://buildmymcpserver.com/guides/chatgpt-mcp-connector), [mer.vin](https://mer.vin/2026/05/openai-secure-mcp-tunnel-private-mcp-servers-for-chatgpt-codex-and-the-api/), [forum OpenAI](https://community.openai.com/t/secure-mcp-tunnel-workspace-org-association-fails-and-support-says-there-is-no-manual-fix/1384494)
