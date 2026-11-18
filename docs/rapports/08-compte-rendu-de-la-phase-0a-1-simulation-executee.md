<!-- Rapport extrait de la session Claude « Orchestrateur IA », 2026-11-16 22:43 UTC -->

# Compte rendu de la Phase 0A.1 (simulation exécutée)

**La simulation a réussi : les 10 auto-tests et les 17 scénarios passent, `all_ok` vaut `true` et le code de sortie est 0.** Je l'ai lancée une seule fois. Je n'ai fait aucun appel à Codex, Claude Code, une API, Git ou Fastclip, et rien n'a été écrit en dehors de `%LOCALAPPDATA%\Temp\orch-ia-phase0a\`.

## 1. Les 9 fichiers créés

Ils sont dans `C:\Users\<utilisateur>\AppData\Local\Temp\orch-ia-phase0a\harness\`, avec un contenu identique au rapport v5. Ils n'ont pas été modifiés après leur création : leur heure de modification n'a pas changé après la simulation.

| Fichier | Taille |
|---|---|
| `run-phase0a.mjs` | 59 063 o |
| `claude-settings.json` | 358 o |
| `fixture\REGLES.md` | 363 o |
| `fixture\data\produits.json` | 434 o |
| `schemas\claude-canary.schema.json` | 510 o |
| `schemas\codex-canary.schema.json` | 219 o |
| `schemas\evaluation.schema.json` | 977 o |
| `schemas\exec-report.schema.json` | 541 o |
| `schemas\plan.schema.json` | 778 o |

Empreinte du harnais enregistrée par le script : `bc969f47251cfc28a2607571ab941e5ee335a491d79e976f6236cb9616d2885b`.

## 2. Commandes exécutées

1. **Vérification préalable** (lecture seule). Elle a confirmé que `TEMP` et `TMP` valent bien `...\AppData\Local\Temp` et que `orch-ia-phase0a` n'existait pas encore.
2. **Création des 9 fichiers** avec l'outil d'écriture, sans commande shell.
3. **Simulation**, en un seul appel PowerShell, exactement le bloc du rapport v5 :
   ```powershell
   $NODE = (Get-Command node -CommandType Application).Source
   if (@($NODE).Count -ne 1 -or [IO.Path]::GetFileName([string]$NODE) -ne 'node.exe' -or -not (Test-Path -LiteralPath $NODE -PathType Leaf)) { throw 'node.exe introuvable ou ambigu' }
   $version = & $NODE --version
   if ($version -ne 'v22.23.4') { throw "Version de Node inattendue : $version" }
   $R = Join-Path $env:LOCALAPPDATA 'Temp\orch-ia-phase0a'
   & $NODE --permission "--allow-fs-read=$R" "--allow-fs-read=$R\*" "--allow-fs-write=$R\sim" "--allow-fs-write=$R\sim\*" --disallow-code-generation-from-strings "$R\harness\run-phase0a.mjs" simulation
   "Code de sortie : $LASTEXITCODE"
   ```
4. **Deux lectures des résultats** (lecture seule) : liste des fichiers, contenu de `resultat-simulation.json` et journaux de SIM-16 et SIM-17.

## 3. Résultat des 17 scénarios : tous réussis

| Scénario | Attendu = obtenu | Détail observé |
|---|---|---|
| SIM-01 | `OBJECTIF_ATTEINT` | — |
| SIM-02 | `OBJECTIF_ATTEINT` | correction appelée une fois |
| SIM-03 | `SUPERVISEUR_A_ACCEPTE_UN_ECHEC` | P3 : `uvre-d-art-murale` au lieu de `oeuvre-d-art-murale` |
| SIM-04 | `CRITERES_INCOMPLETS` | A4 manquant |
| SIM-05 | `PREUVE_MANQUANTE` | `champs_inchanges` et `slugs_corrects` manquants |
| SIM-06 | `PREUVE_NON_PERTINENTE` | A3 renvoie vers `temoin_intact` |
| SIM-07 | `SCHEMA_SUPERVISEUR_INVALIDE` | `$.steps: manquant` |
| SIM-08 | `EVENEMENT_INTERDIT_SUPERVISEUR` | `ELEMENT_INTERDIT:command_execution` |
| SIM-09 | `OUTILS_NON_AUTORISES` | `Bash` |
| SIM-10 | `MODIFICATION_HORS_PERIMETRE` | `projet/REGLES.md` modifié |
| SIM-11 | `MODIFICATION_PENDANT_SUPERVISEUR` | `projet/data/intrus.txt` ajouté |
| SIM-12 | `QUOTA_SUPERVISEUR` | message « usage limit » |
| SIM-13 | `ESCALADE_DEMANDEE` | — |
| SIM-14 | `NON_TERMINE_APRES_CORRECTION_UNIQUE` | — |
| SIM-15 | `LIMITE_APPELS_SUPERVISEUR` | refus à l'appel 9 |
| SIM-16 | `OBJECTIF_ATTEINT` après interruption | Le journal montre l'interruption à `6-evaluation`, la reprise, le verrou `reprise-1.verrou`, puis un seul appel à chacune des étapes 2, 4 et 6 |
| SIM-17 | `REPRISE_IMPOSSIBLE_ETAPE_ECRITURE` | Le journal montre l'interruption à `4-execution`, puis la reprise refusée sans appel à l'exécutant (aucun `APPEL_EXECUTANT`) |

## 4. Résultat des 10 auto-tests : tous réussis

Aucun auto-test n'a renvoyé de détail d'erreur.

| Test | Résultat |
|---|---|
| T-01 modèle de permissions actif | réussi |
| T-02 écriture limitée à `sim` (y compris refus sur `ROOT`, `ROOT\x.txt`, `sim-voisin` et `simx`) | réussi |
| T-03 génération de code interdite | réussi |
| T-04 lancement refusé par le script | réussi |
| T-05 lancement refusé par Node | réussi |
| T-06 11 chemins refusés | réussi |
| T-07 aucun écrasement | réussi |
| T-08 `fetch`, `WebSocket` et `EventSource` neutralisés (protection partielle) | réussi |
| T-09 schémas et données valides | réussi |
| T-10 fichier en trop détecté sur les copies | réussi |

Pour T-10, les quatre copies existent bien sur le disque : la copie conforme contient 9 fichiers, les trois autres en contiennent 10.

## 5. Code de sortie

**0**, obtenu par `$LASTEXITCODE`.

## 6. stdout et stderr

- **stdout** : les deux tableaux `console.table` (auto-tests et scénarios), avec `ok = true` sur toutes les lignes, puis « Code de sortie : 0 ».
- **stderr** : vide. Aucun avertissement de Node n'est apparu, y compris sur le modèle de permissions.

## 7. Emplacement des résultats

- **Résultat global** : `...\orch-ia-phase0a\sim\resultat-simulation.json` (`all_ok: true`, Node v22.23.4).
- **Par scénario** : `...\sim\SIM-xx-...\out\` contient `journal.jsonl` et `resultat-final-*.json`.
- **Volume** : `sim\` contient 146 fichiers au total.
- **Racine** : elle contient seulement `harness` et `sim`.

## 8. Tests échoués, non exécutés ou bloqués

- **Échoués** : aucun.
- **Bloqués** : aucun.
- **Non vérifiés**, car hors du périmètre de cette simulation (déjà signalés dans le rapport v5) :
  - le code réel de `run()`, les adaptateurs Codex et Claude, et `taskkill` ;
  - plusieurs protections de reprise : après fin, harnais modifié, reprise simultanée, disque divergent ;
  - la détection des liens et jonctions ;
  - l'échappement des données dans les messages ;
  - l'absence de capacité réseau au niveau système, qui n'est pas assurée.

## 9. Écarts entre le prévu et l'observé

Je n'ai constaté aucun écart. Les points incertains du rapport v5 sont maintenant établis par l'exécution sur votre machine :
- Node 22.23.4 accepte `--permission` et les motifs `R\*` et `R\sim\*`, et autorise la création de `R\sim`.
- Il refuse l'écriture sur les noms qui partagent le préfixe `sim`.
- `spawn` est refusé avec `ERR_ACCESS_DENIED`.
- `fetch` peut être remplacé.
- Le module `.mjs` démarre sans lecture hors de `R`.
- `Get-Command node` renvoie un seul `node.exe`.

**Pour relancer la simulation**, il faut d'abord que vous déplaciez ou supprimiez vous-même le dossier `sim`. Je ne l'ai pas supprimé.

Je m'arrête ici. Je n'ai commencé ni la Phase 0A.2 ni la Phase 0B, et j'attends une nouvelle autorisation explicite.
