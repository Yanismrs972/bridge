# Bridge v1 — décisions en vigueur

## Statut de ce document

- Ce document est l'**unique référence faisant autorité** pour Bridge v1.
- Les rapports de `docs/rapports/` sont des **archives historiques**, conservées sans modification. En cas de divergence entre un rapport et ce document, ce document prévaut pour Bridge v1.
- Les décisions ci-dessous définissent le **périmètre de développement de Bridge v1**. Elles ne constituent **pas** une autorisation de réaliser les travaux d'isolation avancée (R1), ni une autorisation d'installation ou d'appel réel aux agents.
- Une décision ne figure ici qu'après approbation explicite de l'utilisateur. Toute modification de ce document est soumise à la même approbation.

## Registre des décisions

| ID | Décision | Statut | Date |
|---|---|---|---|
| D-01 | Architecture de Bridge v1 | Approuvée | 2026-11-23 |
| D-02 | Exécution du code de l'orchestrateur Bridge pendant son développement (option B) | Approuvée | 2026-11-23 |

---

## D-01 — Architecture de Bridge v1

- Bridge est un **orchestrateur local** sur PC Windows, écrit en **Node.js / TypeScript**.
- Interface web locale accessible uniquement en **HTTP sur 127.0.0.1**.
- **Simulation par défaut.** Le mode réel **R0** n'est activé qu'explicitement, via `--real`.
- **Codex CLI** : superviseur, en **lecture seule**.
- **Claude Code** : **seul agent autorisé à écrire** dans le périmètre de travail.
- **Sous-agents interdits** en v1.
- L'orchestrateur contrôle les permissions, les états, les budgets et les autorisations.
- Les projets orchestrés : **contrôles statiques uniquement** en v1. Bridge n'exécute jamais automatiquement le code de ces projets.
- Communication avec ChatGPT : interface locale et dossier de mission. MCP hors périmètre v1.
- **Aucun commit** sans approbation humaine explicite. **Aucun push automatique.**
- **Aucune relance automatique** d'une opération après une interruption dont l'issue est incertaine.
- **Aucun basculement automatique** vers une API ou un modèle payant.
- Sécurité **fail-closed** : en cas de doute ou d'anomalie de sécurité, arrêt.
- **Aucun accès à Fastclip**, ni lecture ni modification.
- **R1** et l'isolation avancée du système sont **hors périmètre** de Bridge v1.

---

## D-02 — Exécution du code de l'orchestrateur Bridge (option B)

### Portée

- S'applique **uniquement** au code de l'orchestrateur Bridge (ce dépôt), écrit par Claude Code **pendant le développement de Bridge**.
- Ne concerne **en aucun cas** le code des projets que Bridge orchestrera.
- Ne permet **jamais** à Bridge d'exécuter automatiquement du code produit par les agents pour les projets orchestrés.
- Le principe « aucune exécution de code produit par un agent » (rapport 05, Phase 0A) reste en vigueur pour les projets orchestrés. D-02 en est la seule exception, limitée au développement de l'orchestrateur.

### Conditions préalables à chaque exécution

1. Revue humaine préalable du diff concerné.
2. Approbation explicite de l'exécution par l'utilisateur.
3. Toute modification du code après approbation impose une **nouvelle revue** avant exécution. Le code approuvé doit être identifiable (empreinte ou commit).

### Restrictions obligatoires

Avant toute exécution autorisée :

- utiliser les permissions Node adaptées pour limiter les accès ;
- limiter les accès en lecture et en écriture aux chemins nécessaires ;
- retirer les secrets et clés API de l'environnement d'exécution ;
- interdire les processus enfants ;
- contrôler et figer les dépendances utilisées ;
- effectuer les vérifications statiques prévues.

### Limites de sécurité

Ces restrictions **ne constituent pas une isolation complète** :

- les permissions Node ne bloquent pas nécessairement tous les accès réseau ;
- Bridge et Claude Code fonctionnent sous le **même compte Windows** ;
- les protections applicatives ne remplacent pas une isolation par compte distinct ou machine virtuelle ;
- la **détection** d'une modification non autorisée ne garantit ni sa **prévention** ni sa **restauration**.

Une isolation plus forte reste hors périmètre de Bridge v1 et relève d'une éventuelle version R1.

---

## Points ouverts (non décidés)

Ces points ne sont **pas** des décisions. Ils seront traités au moment indiqué, avec approbation de l'utilisateur.

| Point | Échéance |
|---|---|
| Mécanisme d'exécution des tests de Bridge compatible avec l'interdiction des processus enfants (le lanceur de tests de Node isole par défaut chaque fichier dans un processus séparé). À choisir après vérification sur la version locale de Node. | Premier livrable |
| Méthode d'exécution du TypeScript : suppression native des types par Node (selon la version locale), compilation préalable par le compilateur TypeScript (dépendance à installer), ou autre. Toute installation de dépendance sera présentée pour approbation préalable. | Premier livrable |
| Lieu d'exécution des tests de Bridge (PC Windows ou environnement de développement cloud), avec retrait des secrets de l'environnement. | Premier livrable |
| Méthode de neutralisation des instructions du projet orchestré (`CLAUDE.md`, `.claude/**`, etc.). | Avant R0 |
| Valeurs des profils de mission Simple / Complexe / Sensible (provisoires). | Avant R0 |
| Critères de sécurité à remplir avant R0. | Avant R0 |
