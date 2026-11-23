# Bridge

Projet pour mettre en relation Claude et ChatGPT : on confie un objectif à ChatGPT (superviseur, via Codex), qui fait travailler Claude Code jusqu'à ce que l'objectif soit atteint.

## État actuel

Les décisions en vigueur pour Bridge v1 sont dans [docs/REFERENCE.md](docs/REFERENCE.md), qui fait autorité.
Phase actuelle : développement de Bridge v1 en simulation. Mode réel R0 : non autorisé à ce jour.

## Contenu

| Dossier | Contenu |
|---|---|
| `docs/REFERENCE.md` | Décisions en vigueur pour Bridge v1 (référence faisant autorité) |
| `docs/rapports/` | Les 28 rapports de conception historiques, dans l'ordre (voir `INDEX.md`) |
| `harness/` | Le harnais de test de la Phase 0A : script Node `run-phase0a.mjs`, schémas JSON, projet d'exemple (`fixture/`) |
| `simulations/phase0a1/` | Résultats de la simulation Phase 0A.1 (sans appel aux vraies IA) |

## Installation sur un autre PC

```
git clone https://github.com/Yanismrs972/bridge.git
```

Les clés API (fichier `.env`) ne sont pas envoyées sur GitHub : recopie-les à la main sur chaque PC.
