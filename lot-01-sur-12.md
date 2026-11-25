# Bridge v1 — correction de provenance — lot 01 sur 12

Référence : commit ffc0e3b (docs/REFERENCE.md) et livrable 1 (fichiers non suivis). Diff unifié à contexte complet : chaque diff contient le fichier entier ; les lignes « - » et « » donnent le contenu initial, les lignes « + » et « » le contenu final.

## Fichier 01 — docs/REFERENCE.md

- Statut : modifié
- SHA-256 initial : d2c6ed53df8176e671eefd5fbf2ac667ecd20beb48bdf535ea1ee4a325ad8174
- SHA-256 final : 0f3b32638447a6d08d18f9551c32f3752b5226a18970e6f9842ef7b523d342e7
- Taille finale : 11525 octets, 150 lignes

```diff
--- a/docs/REFERENCE.md
+++ b/docs/REFERENCE.md
@@ -1,89 +1,150 @@
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
+| D-03 | Classification des missions : élévation déclenchée uniquement par les chemins d'écriture | Approuvée | 2026-11-23 |
+| D-04 | Provenance des entrées du noyau : texte JSON strict, jeton de configuration validée, plancher de règles immuable | Approuvée | 2026-11-23 |
 
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
 
+## D-03 — Classification des missions
+
+- La classe effective est le maximum de la classe demandée et de la classe détectée ; elle n'est **jamais abaissée**.
+- Seule une **écriture** sur un chemin sensible (fichier sensible, dossier sensible ou préfixe sensible) déclenche une élévation de classe.
+- Les chemins de **lecture** restent soumis à tous les contrôles de sécurité et exclusions (syntaxe, jokers, segments interdits, secrets, racine autorisée) :
+  - une lecture d'un chemin sensible ne provoque **aucune élévation** ;
+  - une lecture d'un chemin secret ou interdit provoque un **refus de sécurité** (`CHEMIN_SECRET`, `CHEMIN_INTERDIT`), jamais une élévation de classe.
+- La classification est calculée à l'intérieur du calcul de la politique, sur les seules entrées d'écriture acceptées. Aucune fonction publique ne classe un tableau de chemins fourni par l'appelant.
+
+---
+
+## D-04 — Provenance des entrées du noyau
+
+### API publique (réexportée par `src/mission/index.ts`)
+
+- `validerConfigurationTexte(texteProfils, texteReglesChemins)` : seule source du jeton `ConfigurationValidee`.
+- `calculerPolitiqueTexte(texteMission, texteContexte, configuration)` : politique gelée.
+- `verifierReglesPolitiqueTexte(textePolitique, configuration)` : vérification des **exclusions seulement**.
+- `evaluerChemin(cheminRelatif, configuration)` : évaluation d'un chemin relatif.
+- `estConfigurationValidee(valeur)` et `CODES`.
+
+La mission, le contexte, la configuration et toute politique à vérifier entrent **uniquement sous forme de texte JSON** analysé strictement (clés dupliquées refusées, limites de taille, de profondeur et de nœuds). Les valeurs analysées sont gelées en profondeur.
+
+### Jeton de configuration
+
+- Le jeton est **opaque** : un objet vide et gelé. Les règles ne sont pas portées par le jeton ; elles sont associées au jeton dans un **registre privé** du noyau, alimenté uniquement par `validerConfigurationTexte`, après validation complète des deux fichiers de configuration.
+- Toute fonction qui applique des règles exige le jeton enregistré, vérifié par identité **avant toute lecture**. Copies, objets de même forme, objets construits en mémoire, valeurs issues de l'analyseur strict et contenu associé à un jeton sont refusés à la place du jeton (`PROVENANCE_NON_GARANTIE`).
+- Aucune fonction n'accepte de règles en paramètre ni n'enregistre de règles. La classification et la construction des exclusions sont internes au calcul de la politique.
+- Le jeton est gelé et réutilisable sans revalidation.
+- Aucune configuration implicite : aucun paramètre de configuration n'a de valeur par défaut, et le noyau ne lit aucun fichier.
+
+### Plancher de règles immuable
+
+- `validerConfigurationTexte` refuse (`PLANCHER_SECURITE_NON_RESPECTE`) toute configuration qui retire, renomme ou modifie une entrée du plancher figé dans le code : la règle `INT-FASTCLIP`, les 31 règles de secrets, les 11 fichiers sensibles et les 5 dossiers sensibles de la configuration de référence.
+- La **définition** des règles est comparée strictement (forme canonique : identifiant, type et valeur identiques au caractère près ; chaînes identiques pour la classification), en position indifférente. Les ajouts sont permis.
+- La comparaison des **chemins** reste insensible à la casse : `fastclip`, `Fastclip`, `FastClip` et `FASTCLIP` désignent le même nom.
+- Toute modification du plancher exige une modification du code et une revue humaine du diff.
+- Le plancher ne prouve pas que la configuration provient des fichiers officiels de Bridge.
+
+### Vérification et usage des politiques
+
+- `verifierReglesPolitiqueTexte` ne vérifie **que les exclusions** d'une politique. Son résultat positif ne constitue **jamais** une validation complète de la politique ni une autorisation de l'utiliser.
+- L'orchestrateur utilise **exclusivement** le résultat de son propre appel à `calculerPolitiqueTexte`, calculé à partir de la mission approuvée, du contexte et d'un jeton de configuration valide.
+- Une politique reçue d'une autre source n'est **jamais** utilisée comme autorité.
+
+### Volume
+
+- Plafond structurel : au plus 4 000 raisons d'élévation (`RAISONS_ELEVATION_TROP_NOMBREUSES`).
+- Une politique n'est produite que si sa forme JSON compacte respecte les limites de l'analyseur strict (1 048 576 unités UTF-16, profondeur 32, 10 000 nœuds) ; sinon `POLITIQUE_TROP_VOLUMINEUSE`. La politique renvoyée est la valeur relue par l'analyseur strict, revalidée et gelée. L'orchestrateur transmet la politique sous cette forme compacte.
+
+### Garantie et limites
+
+- La garantie est assurée **à l'exécution par le noyau** (registres privés alimentés uniquement par des objets créés dans le noyau), et non par les types TypeScript ni par `index.ts`, qui n'est **pas une barrière** : tout module reste importable par son chemin. Les exports techniques des modules ne sont pas des points d'entrée autorisés.
+- Obligations de l'orchestrateur : charger les fichiers de configuration officiels depuis le dossier de Bridge et contrôler leur empreinte ; contrôler l'empreinte de la mission approuvée ; n'utiliser que les politiques qu'il a lui-même calculées.
+- La capture de quelques fonctions natives de JavaScript protège le seul mécanisme de provenance contre leur modification ultérieure ; ce n'est pas une protection générale. Le gel des constantes et des schémas protège contre les modifications accidentelles. Le noyau **n'est pas isolé** d'un code hostile exécuté dans le même processus, avant ou après son chargement.
+- Les contrôles de chemins restent lexicaux : aucune protection propre à NTFS (liens, jonctions, noms courts réels). Une isolation plus forte relève de R1.
+
+---
+
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
```

## Fichier 02 — src/mission/erreurs.ts

- Statut : modifié
- SHA-256 initial : cf2a3113aecd5cbec0958d8954fdbf8a0eecd9588ad3b936e17dc4affa92ac3c
- SHA-256 final : 74f430e0b64c8f7ea8c196dc3a69b7484b9c263b438fa0c5098f94b0eacc79a4
- Taille finale : 2106 octets, 49 lignes

```diff
--- a/src/mission/erreurs.ts
+++ b/src/mission/erreurs.ts
@@ -1,44 +1,49 @@
 // Codes de refus du noyau de mission Bridge v1.
 // Principe : tout refus est explicite. Le noyau ne corrige, ne tronque et ne plafonne jamais
 // silencieusement une entrée.
+// CODES est gelé au chargement : aucun module ne peut modifier un code par accident.
 
-export const CODES = {
+export const CODES = Object.freeze({
   CONFIGURATION_INVALIDE: "CONFIGURATION_INVALIDE",
   CONTEXTE_INVALIDE: "CONTEXTE_INVALIDE",
   RACINE_INTERDITE: "RACINE_INTERDITE",
   RACINE_SECRET: "RACINE_SECRET",
   CHEVAUCHEMENT_BRIDGE: "CHEVAUCHEMENT_BRIDGE",
   MISSION_INVALIDE: "MISSION_INVALIDE",
   CHAMP_NON_PREVU: "CHAMP_NON_PREVU",
   CHAMP_MANQUANT: "CHAMP_MANQUANT",
   VALEUR_HORS_LISTE: "VALEUR_HORS_LISTE",
   CRITERE_EN_DOUBLE: "CRITERE_EN_DOUBLE",
   LIMITE_INVALIDE: "LIMITE_INVALIDE",
   PERIMETRE_ECRITURE_VIDE: "PERIMETRE_ECRITURE_VIDE",
   CHEMIN_INVALIDE: "CHEMIN_INVALIDE",
   JOKER_RACINE_INTERDIT: "JOKER_RACINE_INTERDIT",
   JOKER_NON_AUTORISE: "JOKER_NON_AUTORISE",
   CHEMIN_INTERDIT: "CHEMIN_INTERDIT",
   MOTIF_PEUT_COUVRIR_CHEMIN_INTERDIT: "MOTIF_PEUT_COUVRIR_CHEMIN_INTERDIT",
   CHEMIN_SECRET: "CHEMIN_SECRET",
   HORS_RACINE: "HORS_RACINE",
   LIMITE_SUPERIEURE_AU_PLAFOND: "LIMITE_SUPERIEURE_AU_PLAFOND",
   REGLES_EXCLUSION_ABSENTES: "REGLES_EXCLUSION_ABSENTES",
   REGLES_EXCLUSION_INVALIDES: "REGLES_EXCLUSION_INVALIDES",
   REGLES_EXCLUSION_DIFFERENTES: "REGLES_EXCLUSION_DIFFERENTES",
   POLITIQUE_JSON_INVALIDE: "POLITIQUE_JSON_INVALIDE",
+  PROVENANCE_NON_GARANTIE: "PROVENANCE_NON_GARANTIE",
+  PLANCHER_SECURITE_NON_RESPECTE: "PLANCHER_SECURITE_NON_RESPECTE",
+  RAISONS_ELEVATION_TROP_NOMBREUSES: "RAISONS_ELEVATION_TROP_NOMBREUSES",
+  POLITIQUE_TROP_VOLUMINEUSE: "POLITIQUE_TROP_VOLUMINEUSE",
   ERREUR_INTERNE: "ERREUR_INTERNE",
-} as const;
+} as const);
 
 export type CodeRefus = (typeof CODES)[keyof typeof CODES];
 
 export interface Refus {
   readonly ok: false;
   readonly code: CodeRefus;
   readonly chemin: string | null;
   readonly detail: Readonly<Record<string, unknown>>;
 }
 
 export function refus(code: CodeRefus, chemin: string | null, detail: Record<string, unknown> = {}): Refus {
   return { ok: false, code, chemin, detail };
 }
```

## Fichier 03 — src/mission/syntaxe-chemins.ts

- Statut : créé
- SHA-256 initial : (sans objet)
- SHA-256 final : 259cee02148f340a45110a1546b5bada7da391552a422a207a61e2221c310e09
- Taille finale : 5577 octets, 135 lignes

```diff
--- /dev/null
+++ b/src/mission/syntaxe-chemins.ts
@@ -0,0 +1,135 @@
+// Syntaxe lexicale des chemins de Bridge v1 : segments, chemins relatifs et racines Windows.
+//
+// Ce module ne travaille que sur des chaînes. Il ne consulte AUCUNE règle d'exclusion ni de
+// classification et ne dit jamais qu'un chemin est autorisé : il dit seulement si sa syntaxe est
+// valide. La décision sur un chemin appartient à evaluerChemin (chemins.ts), qui exige un jeton
+// de configuration validée.
+//
+// Toutes les règles de ce module sont LEXICALES. Elles ne détectent ni les liens symboliques, ni
+// les jonctions, ni les noms courts 8.3 réels, ni aucune redirection physique : ces contrôles
+// relèvent du futur orchestrateur, avant tout accès réel aux fichiers.
+//
+// Les ensembles de caractères interdits et de noms réservés restent internes (non exportés) :
+// une collection modifiable n'est jamais exposée comme constante de sécurité.
+
+import { contientSurrogateIsolee } from "./canonique.ts";
+
+export const LONGUEUR_MAX_CHEMIN = 240;
+export const LONGUEUR_MAX_SEGMENT = 255;
+
+const CARACTERES_INTERDITS: ReadonlySet<string> = new Set(["<", ">", ":", '"', "|", "?", "*", "/", "\\"]);
+
+const NOMS_RESERVES: ReadonlySet<string> = new Set([
+  "CON",
+  "PRN",
+  "AUX",
+  "NUL",
+  "COM0",
+  "COM1",
+  "COM2",
+  "COM3",
+  "COM4",
+  "COM5",
+  "COM6",
+  "COM7",
+  "COM8",
+  "COM9",
+  "LPT0",
+  "LPT1",
+  "LPT2",
+  "LPT3",
+  "LPT4",
+  "LPT5",
+  "LPT6",
+  "LPT7",
+  "LPT8",
+  "LPT9",
+  "COM\u00b9",
+  "COM\u00b2",
+  "COM\u00b3",
+  "LPT\u00b9",
+  "LPT\u00b2",
+  "LPT\u00b3",
+  "CONIN$",
+  "CONOUT$",
+]);
+
+/** Caractère de contrôle C0, DEL ou C1. */
+export function estCaractereControle(code: number): boolean {
+  return code <= 0x1f || code === 0x7f || (code >= 0x80 && code <= 0x9f);
+}
+
+/** Caractère interdit dans un nom Windows (y compris les séparateurs et les jokers). */
+export function estCaractereInterdit(caractere: string): boolean {
+  return CARACTERES_INTERDITS.has(caractere);
+}
+
+function estNomReserve(segment: string): boolean {
+  const base = (segment.split(".")[0] ?? "").replace(/ +$/u, "").toUpperCase();
+  return NOMS_RESERVES.has(base);
+}
+
+/** Renvoie la sous-règle violée par un segment, ou null si le segment est valide. */
+export function validerSegment(segment: string): string | null {
+  if (segment.length === 0) return "SEGMENT_VIDE";
+  if (segment === "." || segment === "..") return "SEGMENT_POINT";
+  if (segment.length > LONGUEUR_MAX_SEGMENT) return "SEGMENT_TROP_LONG";
+  if (contientSurrogateIsolee(segment)) return "UNICODE_INVALIDE";
+  if (segment.normalize("NFC") !== segment) return "NON_NFC";
+  for (let i = 0; i < segment.length; i++) {
+    if (estCaractereControle(segment.charCodeAt(i))) return "CARACTERE_CONTROLE";
+    if (CARACTERES_INTERDITS.has(segment.charAt(i))) return "CARACTERE_INTERDIT";
+  }
+  if (segment.startsWith(" ")) return "ESPACE_DEBUT";
+  if (segment.endsWith(" ")) return "ESPACE_FIN";
+  if (segment.endsWith(".")) return "POINT_FINAL";
+  if (/~[0-9]/u.test(segment)) return "NOM_COURT_8_3";
+  if (estNomReserve(segment)) return "NOM_RESERVE";
+  return null;
+}
+
+export type AnalyseChemin =
+  | { readonly ok: true; readonly segments: readonly string[]; readonly normalise: string }
+  | { readonly ok: false; readonly sous_regle: string; readonly index_segment: number | null };
+
+/** Analyse lexicale d'un chemin relatif. « \ » est normalisé en « / ». Rien n'est résolu. */
+export function analyserCheminRelatif(chemin: string): AnalyseChemin {
+  if (chemin.length === 0) return { ok: false, sous_regle: "CHEMIN_VIDE", index_segment: null };
+  const normalise = chemin.replace(/\\/g, "/");
+  if (normalise.startsWith("/")) return { ok: false, sous_regle: "SEPARATEUR_DEBUT", index_segment: null };
+  if (normalise.endsWith("/")) return { ok: false, sous_regle: "SEPARATEUR_FIN", index_segment: null };
+  const segments = normalise.split("/");
+  for (let i = 0; i < segments.length; i++) {
+    const e = validerSegment(segments[i] ?? "");
+    if (e !== null) return { ok: false, sous_regle: e, index_segment: i };
+  }
+  if (normalise.length > LONGUEUR_MAX_CHEMIN) return { ok: false, sous_regle: "CHEMIN_TROP_LONG", index_segment: null };
+  return { ok: true, segments, normalise };
+}
+
+// ---------------------------------------------------------------------------------------------
+// Racines Windows absolues
+// ---------------------------------------------------------------------------------------------
+
+export interface RacineAnalysee {
+  readonly lecteur: string;
+  readonly segments: readonly string[];
+}
+
+export type AnalyseRacine = { readonly ok: true; readonly racine: RacineAnalysee } | { readonly ok: false; readonly raison: string };
+
+/** Racine de la forme X:\seg\seg… uniquement. UNC, \\?\, \\.\, racine nue, « . » et « .. » refusés. */
+export function analyserRacine(racine: string): AnalyseRacine {
+  if (racine.length > LONGUEUR_MAX_CHEMIN) return { ok: false, raison: "RACINE_TROP_LONGUE" };
+  if (racine.startsWith("\\\\")) return { ok: false, raison: "RACINE_UNC_OU_PREFIXE" };
+  if (!/^[A-Za-z]:\\/u.test(racine)) return { ok: false, raison: "RACINE_FORME_INVALIDE" };
+  if (racine.includes("/")) return { ok: false, raison: "RACINE_SEPARATEUR_INVALIDE" };
+  const reste = racine.slice(3);
+  if (reste.length === 0) return { ok: false, raison: "RACINE_LECTEUR_NUE" };
+  const segments = reste.split("\\");
+  for (const segment of segments) {
+    const e = validerSegment(segment);
+    if (e !== null) return { ok: false, raison: `RACINE_SEGMENT_INVALIDE:${e}` };
+  }
+  return { ok: true, racine: { lecteur: racine.charAt(0), segments } };
+}
```

## Fichier 04 — src/mission/json-strict.ts

- Statut : modifié
- SHA-256 initial : d8e6714e17f70271a5dab0094119b2e2944b11f577155cb01d77050ac3373145
- SHA-256 final : f3778c8b5c80c66b94fd9ac49b7d65117469b5f0c51348e46dd40fa798582587
- Taille finale : 12157 octets, 298 lignes

```diff
--- a/src/mission/json-strict.ts
+++ b/src/mission/json-strict.ts
@@ -1,225 +1,298 @@
 // Analyse JSON stricte (Bridge v1).
 //
 // JSON.parse ne signale pas les clés dupliquées : il conserve la dernière valeur. Il ne peut donc
 // pas détecter seul les doublons. Ce module parcourt d'abord le texte selon la grammaire JSON
 // (RFC 8259), sans construire aucun objet, sans dépendance et sans exécution dynamique de code :
 //   1. limites préalables (taille du texte, marque d'ordre des octets refusée) ;
 //   2. grammaire stricte (virgules finales, commentaires, guillemets simples, NaN, Infinity,
 //      hexadécimal, échappements invalides, contrôles non échappés, contenu après la racine) ;
 //   3. clés dupliquées refusées dans chaque objet, à tous les niveaux, après décodage des
 //      échappements, même si les deux valeurs sont identiques (comparaison exacte des unités
 //      de code, sans pliage de casse ni normalisation) ;
 //   4. profondeur maximale 32 (racine au niveau 1) et 10 000 nœuds au plus (chaque valeur JSON
 //      compte : objet, tableau, chaîne, nombre, true, false, null ; les noms de clés ne comptent pas).
 // Seulement si tout réussit, JSON.parse construit la valeur. Tout désaccord aboutit à un refus.
+//
+// Provenance (D-04) :
+//   - la valeur construite est gelée en profondeur, puis chaque objet et chaque tableau est
+//     enregistré dans le registre privé ISSUS_DU_PARSEUR ;
+//   - seule analyserJsonStrict alimente ce registre, et uniquement avec des objets que JSON.parse
+//     vient de créer à partir de la chaîne reçue : aucun objet fourni par un appelant n'y entre ;
+//   - ce registre signifie « analysé strictement et gelé », JAMAIS « digne de confiance » : aucune
+//     fonction du noyau n'accepte un objet parce qu'il y figure ;
+//   - JSON.parse, Object.freeze et les méthodes du registre sont capturés au chargement du module.
+//     Cette capture protège le seul mécanisme de provenance contre une modification ultérieure de
+//     ces fonctions ; ce n'est pas une protection générale des fonctions natives, et le noyau
+//     n'est pas isolé d'un code hostile exécuté dans le même processus.
 
 import { pointeurEnfant } from "./validation.ts";
 
+// Fonctions natives capturées au chargement (ni JSON.parse ni Object.freeze n'utilisent this).
+const parseNatif: (texte: string) => unknown = JSON.parse;
+const gelerNatif: <T>(valeur: T) => Readonly<T> = Object.freeze;
+
+// Registre privé, non exporté. Ses méthodes sont liées à l'instance au chargement.
+const ISSUS_DU_PARSEUR = new WeakSet<object>();
+const ajouterIssu = WeakSet.prototype.add.bind(ISSUS_DU_PARSEUR) as (valeur: object) => unknown;
+const contientIssu = WeakSet.prototype.has.bind(ISSUS_DU_PARSEUR) as (valeur: object) => boolean;
+
 export const TAILLE_TEXTE_MAX = 1_048_576;
 export const PROFONDEUR_MAX_JSON = 32;
 export const NOEUDS_MAX_JSON = 10_000;
 
 export type SousRaisonJson = "TYPE" | "SYNTAXE" | "CLE_DUPLIQUEE" | "PROFONDEUR" | "TAILLE" | "TAILLE_TEXTE";
 
 export interface EchecJson {
   readonly ok: false;
   readonly code: "JSON_INVALIDE";
   readonly sous_raison: SousRaisonJson;
   readonly position: number | null;
   readonly pointeur: string | null;
   readonly detail: string | null;
 }
 
 export type ResultatJson = { readonly ok: true; readonly valeur: unknown } | EchecJson;
 
 interface Curseur {
   readonly texte: string;
   pos: number;
   noeuds: number;
 }
 
 type LectureChaine = { readonly ok: true; readonly valeur: string } | { readonly ok: false; readonly echec: EchecJson };
 
 function echec(sous_raison: SousRaisonJson, position: number | null, pointeur: string | null, detail: string | null): EchecJson {
   return { ok: false, code: "JSON_INVALIDE", sous_raison, position, pointeur, detail };
 }
 
 function estChiffre(c: string): boolean {
   return c.length === 1 && c >= "0" && c <= "9";
 }
 
 function sauterEspaces(c: Curseur): void {
   for (;;) {
     const car = c.texte.charAt(c.pos);
     if (car === " " || car === "\t" || car === "\n" || car === "\r") c.pos += 1;
     else return;
   }
 }
 
 /** Analyse un texte JSON strict. Le paramètre n'est accepté que s'il est une chaîne. */
 export function analyserJsonStrict(texte: unknown): ResultatJson {
   if (typeof texte !== "string") return echec("TYPE", null, null, null);
   if (texte.length > TAILLE_TEXTE_MAX) return echec("TAILLE_TEXTE", null, null, null);
   if (texte.charCodeAt(0) === 0xfeff) return echec("SYNTAXE", 0, null, "BOM");
   const c: Curseur = { texte, pos: 0, noeuds: 0 };
   const e = analyserValeur(c, 1, "");
   if (e !== null) return e;
   sauterEspaces(c);
   if (c.pos !== texte.length) return echec("SYNTAXE", c.pos, null, "CONTENU_APRES_RACINE");
   let valeur: unknown;
   try {
-    valeur = JSON.parse(texte);
+    valeur = parseNatif(texte);
   } catch {
     return echec("SYNTAXE", null, null, "DESACCORD_ANALYSEUR");
   }
-  return { ok: true, valeur };
+  // La valeur vient d'être créée par JSON.parse dans cet appel : elle est gelée puis enregistrée.
+  // Une racine primitive n'est ni gelée ni enregistrée (inutile : elle est immuable).
+  parcourirObjets(valeur, (objet) => {
+    gelerNatif(objet);
+    ajouterIssu(objet);
+  });
+  const resultat: ResultatJson = { ok: true, valeur };
+  return gelerNatif(resultat);
+}
+
+/**
+ * Vrai si la valeur est un objet ou un tableau produit et gelé par analyserJsonStrict. Lecture
+ * seule du registre, sans lecture d'aucune propriété de la valeur. Ne vaut jamais autorisation.
+ */
+export function estIssuDuParseurStrict(valeur: unknown): boolean {
+  if (typeof valeur !== "object" || valeur === null) return false;
+  return contientIssu(valeur);
+}
+
+/**
+ * Gèle en profondeur une donnée inerte (constantes, schémas, données JSON) avec la fonction
+ * Object.freeze capturée. Seules les propriétés de données sont parcourues (lecture par
+ * descripteur : aucun accesseur n'est déclenché). N'enregistre rien et ne confère aucune
+ * provenance. Renvoie la valeur reçue.
+ */
+export function gelerProfondement<T>(valeur: T): T {
+  parcourirObjets(valeur, (objet) => {
+    gelerNatif(objet);
+  });
+  return valeur;
+}
+
+/**
+ * Parcours itératif (sans récursion) des objets et tableaux d'une donnée inerte. Chaque objet
+ * n'est traité qu'une fois (protection contre les références circulaires). L'action est appliquée
+ * à un objet avant ses enfants.
+ */
+function parcourirObjets(valeur: unknown, action: (objet: object) => void): void {
+  if (typeof valeur !== "object" || valeur === null) return;
+  const vus = new Set<object>();
+  const pile: object[] = [valeur];
+  while (pile.length > 0) {
+    const objet = pile.pop();
+    if (objet === undefined || vus.has(objet)) continue;
+    vus.add(objet);
+    action(objet);
+    for (const cle of Object.keys(objet)) {
+      const descripteur = Object.getOwnPropertyDescriptor(objet, cle);
+      if (descripteur === undefined || !Object.hasOwn(descripteur, "value")) continue;
+      const enfant: unknown = descripteur.value;
+      if (typeof enfant === "object" && enfant !== null) pile.push(enfant);
+    }
+  }
 }
 
 function analyserValeur(c: Curseur, profondeur: number, pointeur: string): EchecJson | null {
   sauterEspaces(c);
   if (c.pos >= c.texte.length) return echec("SYNTAXE", c.pos, pointeur, "FIN_INATTENDUE");
   if (profondeur > PROFONDEUR_MAX_JSON) return echec("PROFONDEUR", c.pos, pointeur, null);
   c.noeuds += 1;
   if (c.noeuds > NOEUDS_MAX_JSON) return echec("TAILLE", c.pos, pointeur, null);
   const car = c.texte.charAt(c.pos);
   if (car === "{") return analyserObjet(c, profondeur, pointeur);
   if (car === "[") return analyserTableau(c, profondeur, pointeur);
   if (car === '"') {
     const lecture = lireChaine(c, pointeur);
     return lecture.ok ? null : lecture.echec;
   }
   if (car === "t") return lireLitteral(c, "true", pointeur);
   if (car === "f") return lireLitteral(c, "false", pointeur);
   if (car === "n") return lireLitteral(c, "null", pointeur);
   if (car === "-" || estChiffre(car)) return lireNombre(c, pointeur);
   return echec("SYNTAXE", c.pos, pointeur, "CARACTERE_INATTENDU");
 }
 
 function analyserObjet(c: Curseur, profondeur: number, pointeur: string): EchecJson | null {
   c.pos += 1;
   const cles = new Set<string>();
   sauterEspaces(c);
   if (c.texte.charAt(c.pos) === "}") {
     c.pos += 1;
     return null;
   }
   for (;;) {
     sauterEspaces(c);
     if (c.texte.charAt(c.pos) !== '"') return echec("SYNTAXE", c.pos, pointeur, "CLE_ATTENDUE");
     const cle = lireChaine(c, pointeur);
     if (!cle.ok) return cle.echec;
     const pointeurCle = pointeurEnfant(pointeur, cle.valeur);
     if (cles.has(cle.valeur)) return echec("CLE_DUPLIQUEE", c.pos, pointeurCle, null);
     cles.add(cle.valeur);
     sauterEspaces(c);
     if (c.texte.charAt(c.pos) !== ":") return echec("SYNTAXE", c.pos, pointeurCle, "DEUX_POINTS_ATTENDUS");
     c.pos += 1;
     const e = analyserValeur(c, profondeur + 1, pointeurCle);
     if (e !== null) return e;
     sauterEspaces(c);
     const separateur = c.texte.charAt(c.pos);
     if (separateur === ",") {
       c.pos += 1;
       continue;
     }
     if (separateur === "}") {
       c.pos += 1;
       return null;
     }
     return echec("SYNTAXE", c.pos, pointeur, "SEPARATEUR_ATTENDU");
   }
 }
 
 function analyserTableau(c: Curseur, profondeur: number, pointeur: string): EchecJson | null {
   c.pos += 1;
   sauterEspaces(c);
   if (c.texte.charAt(c.pos) === "]") {
     c.pos += 1;
     return null;
   }
   let index = 0;
   for (;;) {
     const e = analyserValeur(c, profondeur + 1, pointeurEnfant(pointeur, index));
     if (e !== null) return e;
     index += 1;
     sauterEspaces(c);
     const separateur = c.texte.charAt(c.pos);
     if (separateur === ",") {
       c.pos += 1;
       continue;
     }
     if (separateur === "]") {
       c.pos += 1;
       return null;
     }
     return echec("SYNTAXE", c.pos, pointeur, "SEPARATEUR_ATTENDU");
   }
 }
 
 function lireChaine(c: Curseur, pointeur: string): LectureChaine {
   const t = c.texte;
   let p = c.pos + 1;
   let resultat = "";
   for (;;) {
     if (p >= t.length) return { ok: false, echec: echec("SYNTAXE", p, pointeur, "CHAINE_NON_TERMINEE") };
     const code = t.charCodeAt(p);
     if (code === 0x22) {
       c.pos = p + 1;
       return { ok: true, valeur: resultat };
     }
     if (code < 0x20) return { ok: false, echec: echec("SYNTAXE", p, pointeur, "CONTROLE_NON_ECHAPPE") };
     if (code === 0x5c) {
       const e = t.charAt(p + 1);
       if (e === '"') resultat += '"';
       else if (e === "\\") resultat += "\\";
       else if (e === "/") resultat += "/";
       else if (e === "b") resultat += "\b";
       else if (e === "f") resultat += "\f";
       else if (e === "n") resultat += "\n";
       else if (e === "r") resultat += "\r";
       else if (e === "t") resultat += "\t";
       else if (e === "u") {
         const hex = t.slice(p + 2, p + 6);
         if (!/^[0-9A-Fa-f]{4}$/u.test(hex)) return { ok: false, echec: echec("SYNTAXE", p, pointeur, "ECHAPPEMENT_INVALIDE") };
         resultat += String.fromCharCode(Number.parseInt(hex, 16));
         p += 6;
         continue;
       } else return { ok: false, echec: echec("SYNTAXE", p, pointeur, "ECHAPPEMENT_INVALIDE") };
       p += 2;
       continue;
     }
     resultat += t.charAt(p);
     p += 1;
   }
 }
 
 function lireLitteral(c: Curseur, mot: string, pointeur: string): EchecJson | null {
   if (c.texte.startsWith(mot, c.pos)) {
     c.pos += mot.length;
     return null;
   }
   return echec("SYNTAXE", c.pos, pointeur, "LITTERAL_INVALIDE");
 }
 
 function lireNombre(c: Curseur, pointeur: string): EchecJson | null {
   const t = c.texte;
   let p = c.pos;
   if (t.charAt(p) === "-") p += 1;
   if (t.charAt(p) === "0") p += 1;
   else if (estChiffre(t.charAt(p)) && t.charAt(p) !== "0") {
     while (estChiffre(t.charAt(p))) p += 1;
   } else return echec("SYNTAXE", p, pointeur, "NOMBRE_INVALIDE");
   if (t.charAt(p) === ".") {
     p += 1;
     if (!estChiffre(t.charAt(p))) return echec("SYNTAXE", p, pointeur, "NOMBRE_INVALIDE");
     while (estChiffre(t.charAt(p))) p += 1;
   }
   if (t.charAt(p) === "e" || t.charAt(p) === "E") {
     p += 1;
     if (t.charAt(p) === "+" || t.charAt(p) === "-") p += 1;
     if (!estChiffre(t.charAt(p))) return echec("SYNTAXE", p, pointeur, "NOMBRE_INVALIDE");
     while (estChiffre(t.charAt(p))) p += 1;
   }
   c.pos = p;
   return null;
 }
```

