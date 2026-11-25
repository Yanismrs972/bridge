# Bridge

Projet pour mettre en relation Claude et ChatGPT : on confie un objectif à ChatGPT (superviseur, via Codex), qui fait travailler Claude Code jusqu'à ce que l'objectif soit atteint.

## État actuel

Le projet est en **phase de conception**. Rien n'est installé ni branché sur les vraies IA.
Le dernier état validé est la **Phase 0B v19 + annexe v19.1** : cadrage documentaire de la sécurité (isolation par machine virtuelle, broker, pare-feu). Implémentation, installation et appels réels aux agents : **NO-GO** tant qu'ils ne sont pas autorisés explicitement.

## Contenu

| Dossier | Contenu |
|---|---|
| `docs/rapports/` | Les 28 rapports de conception, dans l'ordre (voir `INDEX.md`) |
| `harness/` | Le harnais de test de la Phase 0A : script Node `run-phase0a.mjs`, schémas JSON, projet d'exemple (`fixture/`) |
| `simulations/phase0a1/` | Résultats de la simulation Phase 0A.1 (sans appel aux vraies IA) |

## Installation sur un autre PC

```
git clone https://github.com/Yanismrs972/bridge.git
```

Les clés API (fichier `.env`) ne sont pas envoyées sur GitHub : recopie-les à la main sur chaque PC.

## Bridge v1 (minimal) : démarrer

Prérequis : Node.js 22.13 ou plus récent. Dans le dossier `bridge` :

```
npm install
npm run build
bridge.cmd
```

Ouvrir ensuite http://127.0.0.1:4317/ dans le navigateur, choisir un scénario, cliquer « Lancer la mission » et approuver ou refuser les étapes.

- Mode **simulation** uniquement : les agents sont simulés, aucun appel réseau, aucun coût. `--real` est refusé.
- `bridge.cmd --port 4318` change le port. `npm test` lance les tests.
- Les missions sont écrites dans `.bridge-data/` (copie du projet d'exemple, jamais un vrai projet).
