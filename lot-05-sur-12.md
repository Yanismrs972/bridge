# Bridge v1 — correction de provenance — lot 05 sur 12

Référence : commit ffc0e3b (docs/REFERENCE.md) et livrable 1 (fichiers non suivis). Diff unifié à contexte complet : chaque diff contient le fichier entier ; les lignes « - » et « » donnent le contenu initial, les lignes « + » et « » le contenu final.

## Fichier 10 — src/mission/politique.ts

- Statut : modifié
- SHA-256 initial : e871cd7964e97398bb163790b3398c920b0b0f209816e71450f6fe47de8b2717
- SHA-256 final : b639786c5723aef304850069a596cd99512d511194d39c2668ca25ec42e174b1
- Taille finale : 23548 octets, 467 lignes

```diff
--- a/src/mission/politique.ts
+++ b/src/mission/politique.ts
@@ -1,315 +1,467 @@
 // Calcul de la politique effective d'une mission Bridge v1 (bibliothèque pure).
 //
+// Point d'entrée UNIQUE : calculerPolitiqueTexte(texteMission, texteContexte, configuration).
+// Provenance (D-04) : le jeton de configuration validée est vérifié en première instruction ; la
+// mission et le contexte ne sont acceptés que sous forme de TEXTE, analysé par analyserJsonStrict.
+// Tout le parcours (contexte, périmètre, classification, limites, exclusions, volume) est INTERNE
+// à ce module : aucune fonction exportée ne contrôle une entrée, ne classe des chemins ou ne
+// construit des exclusions à partir de données fournies par l'appelant.
+//
 // Ordre de calcul :
-//   1. configuration (profils et règles de chemins) et schémas internes ;
-//   2. contexte (racine autorisée et racine de Bridge, saisies par l'utilisateur) ;
+//   1. jeton (registre privé), puis analyse stricte du contexte et de la mission ;
+//   2. contexte (racine autorisée et racine de Bridge, saisies par l'utilisateur) ; la racine est
+//      évaluée par evaluerChemin avec le jeton ;
 //   3. mission (schéma fermé ; donnée non fiable) ;
-//   4. entrées du périmètre (écriture puis lecture), voir perimetre.ts ;
-//   5. classification (jamais d'abaissement) ;
+//   4. entrées du périmètre (écriture puis lecture) : syntaxe des jokers, evaluerChemin avec le
+//      jeton, longueur assemblée, inclusion dans la racine ;
+//   5. classification sur les seules entrées d'écriture acceptées (D-03), plafond structurel de
+//      4 000 raisons d'élévation ;
 //   6. limites, APRÈS la classification : absente → plafond ; demandée ≤ plafond → valeur demandée ;
 //      demandée > plafond → refus explicite. Aucun plafonnement silencieux ;
-//   7. sortie déterministe, validée contre politique.schema.json.
+//   7. sortie validée contre politique.schema.json, puis contrôle du volume réel : la forme JSON
+//      compacte est relue par analyserJsonStrict (mêmes limites que le vérificateur), revalidée,
+//      et c'est cette valeur relue et gelée qui est renvoyée.
 // Les champs textuels de la mission (objectif, descriptions, notes) ne sont jamais lus par le calcul.
+//
+// L'orchestrateur utilise exclusivement le résultat de son propre appel à calculerPolitiqueTexte ;
+// une politique reçue d'une autre source n'est jamais une autorité (voir regles-politique.ts).
 
 import schemaContexte from "./schemas/contexte.schema.json" with { type: "json" };
-import schemaExclusionsLecture from "./schemas/exclusions-lecture.schema.json" with { type: "json" };
 import schemaMission from "./schemas/mission.schema.json" with { type: "json" };
 import schemaPolitique from "./schemas/politique.schema.json" with { type: "json" };
-import schemaProfils from "./schemas/profils.schema.json" with { type: "json" };
-import schemaReglesChemins from "./schemas/regles-chemins.schema.json" with { type: "json" };
-import schemaReglesExclusion from "./schemas/regles-exclusion.schema.json" with { type: "json" };
-import {
-  analyserRacine,
-  correspondancesSegments,
-  verifierReglesExclusion,
-  type RacineAnalysee,
-  type ReglesExclusion,
-} from "./chemins.ts";
-import {
-  classeMax,
-  detecterSensibilite,
-  verifierReglesClassification,
-  type Classe,
-  type RaisonElevation,
-  type ReglesClassification,
-} from "./classification.ts";
+import { evaluerChemin } from "./chemins.ts";
+import { classeMax, type Classe, type RaisonElevation } from "./classification.ts";
+import { contenuDuJeton, type ReglesExclusion } from "./configuration.ts";
 import { CODES, refus, type Refus } from "./erreurs.ts";
-import { controlerEntree, type EntreeAcceptee } from "./perimetre.ts";
-import { construireExclusions, type ExclusionsLecture } from "./regles-politique.ts";
-import { estObjetSimple, valider, verifierSchema, type ErreurValidation } from "./validation.ts";
+import {
+  analyserJsonStrict,
+  estIssuDuParseurStrict,
+  gelerProfondement,
+  NOEUDS_MAX_JSON,
+  PROFONDEUR_MAX_JSON,
+  TAILLE_TEXTE_MAX,
+  type EchecJson,
+} from "./json-strict.ts";
+import { analyserEntreePerimetre } from "./perimetre.ts";
+import { VALEURS_FIXES_EXCLUSIONS, type ExclusionsLecture } from "./regles-politique.ts";
+import { analyserRacine, LONGUEUR_MAX_CHEMIN, type RacineAnalysee } from "./syntaxe-chemins.ts";
+import { estObjetSimple, valider, type ErreurValidation } from "./validation.ts";
+
+gelerProfondement(schemaContexte);
+gelerProfondement(schemaMission);
+gelerProfondement(schemaPolitique);
 
-export const CLES_PLAFONDS = [
+export const CLES_PLAFONDS = gelerProfondement([
   "tours_claude_par_appel",
   "appels_claude",
   "appels_codex",
   "corrections",
   "duree_max_min",
   "delai_appel_claude_min",
   "delai_appel_codex_min",
-] as const;
+] as const);
 export type ClePlafond = (typeof CLES_PLAFONDS)[number];
 
-export const CLES_INDICATEURS = ["budget_claude_usd_par_appel", "tokens_codex", "budget_global_usd"] as const;
+export const CLES_INDICATEURS = gelerProfondement(["budget_claude_usd_par_appel", "tokens_codex", "budget_global_usd"] as const);
 export type CleIndicateur = (typeof CLES_INDICATEURS)[number];
 
 export type ValidationHumaine = "lancement" | "plan" | "fin";
 
-export interface ProfilValide {
-  readonly classe: Classe;
-  readonly provisoire: boolean;
-  readonly plafonds: Readonly<Record<ClePlafond, number>>;
-  readonly indicateurs: Readonly<Record<CleIndicateur, number>>;
-  readonly validations_humaines: readonly ValidationHumaine[];
-}
-
-export interface ConfigurationValidee {
-  readonly profils: { readonly version: "1"; readonly profils: readonly ProfilValide[] };
-  readonly regles_chemins: {
-    readonly version: "1";
-    readonly exclusion: ReglesExclusion;
-    readonly classification: ReglesClassification;
-  };
-}
-
 export interface Politique {
   readonly version: "1";
   readonly mission_id: string;
   readonly classe_demandee: Classe;
   readonly classe_effective: Classe;
   readonly raisons_elevation: readonly RaisonElevation[];
   readonly limites: Readonly<Record<ClePlafond, number>>;
   readonly indicateurs: Readonly<Record<CleIndicateur, number>>;
   readonly indicateurs_statut: "non_bloquant";
   readonly validations_humaines: readonly ValidationHumaine[];
   readonly valeurs_provisoires: boolean;
   readonly perimetre_ecriture: readonly string[];
   readonly perimetre_lecture: readonly string[];
   readonly exclusions_lecture_obligatoires: ExclusionsLecture;
 }
 
 export type ResultatPolitique = { readonly ok: true; readonly politique: Politique } | Refus;
 
+/** Plafond structurel du nombre de raisons d'élévation (égal au maxItems du schéma de la politique). */
+const LIMITE_RAISONS_ELEVATION = 4000;
+
+const gelerNatif: <T>(valeur: T) => Readonly<T> = Object.freeze;
+
 interface MissionValide {
   readonly version: "1";
   readonly id: string;
   readonly criteres_acceptation: ReadonlyArray<{ readonly id: string; readonly description: string }>;
   readonly perimetre: { readonly ecriture: readonly string[]; readonly lecture?: readonly string[] };
   readonly classe_demandee: Classe;
   readonly limites_demandees?: Readonly<Partial<Record<ClePlafond, number>>>;
 }
 
-const SCHEMAS_INTERNES: ReadonlyArray<readonly [string, unknown]> = [
-  ["mission", schemaMission],
-  ["contexte", schemaContexte],
-  ["profils", schemaProfils],
-  ["regles-chemins", schemaReglesChemins],
-  ["regles-exclusion", schemaReglesExclusion],
-  ["exclusions-lecture", schemaExclusionsLecture],
-  ["politique", schemaPolitique],
-];
-
-/** Vérifie que tous les schémas du noyau respectent le sous-ensemble fermé. */
-export function verifierSchemasInternes(): Refus | null {
-  for (const [nom, schema] of SCHEMAS_INTERNES) {
-    const e = verifierSchema(schema);
-    if (e !== null) return refus(CODES.CONFIGURATION_INVALIDE, null, { schema: nom, raison: e.raison, pointeur: e.pointeur });
-  }
-  return null;
-}
-
-function refusConfiguration(raison: string, pointeur: string): Refus {
-  return refus(CODES.CONFIGURATION_INVALIDE, null, { raison, pointeur });
-}
-
-/** Valide la configuration complète { profils, regles_chemins }. */
-export function validerConfiguration(configuration: unknown): { readonly ok: true; readonly configuration: ConfigurationValidee } | Refus {
-  const interne = verifierSchemasInternes();
-  if (interne !== null) return interne;
-  if (!estObjetSimple(configuration)) return refusConfiguration("TYPE", "");
-  for (const cle of Object.keys(configuration)) {
-    if (cle !== "profils" && cle !== "regles_chemins") return refusConfiguration("CHAMP_NON_PREVU", `/${cle}`);
-  }
-  for (const cle of ["profils", "regles_chemins"]) {
-    if (!Object.hasOwn(configuration, cle)) return refusConfiguration("CHAMP_MANQUANT", `/${cle}`);
-  }
-
-  const ep = valider(schemaProfils, configuration["profils"]);
-  if (ep !== null) return refusConfiguration(ep.raison, `/profils${ep.pointeur}`);
-  const profils = configuration["profils"] as ConfigurationValidee["profils"];
-  const classes = new Set<Classe>();
-  for (let i = 0; i < profils.profils.length; i++) {
-    const p = profils.profils[i];
-    if (p === undefined) continue;
-    const base = `/profils/profils/${i}`;
-    if (classes.has(p.classe)) return refusConfiguration("CLASSE_EN_DOUBLE", `${base}/classe`);
-    classes.add(p.classe);
-    if (p.plafonds.delai_appel_claude_min > p.plafonds.duree_max_min) {
-      return refusConfiguration("DELAI_SUPERIEUR_A_LA_DUREE", `${base}/plafonds/delai_appel_claude_min`);
-    }
-    if (p.plafonds.delai_appel_codex_min > p.plafonds.duree_max_min) {
-      return refusConfiguration("DELAI_SUPERIEUR_A_LA_DUREE", `${base}/plafonds/delai_appel_codex_min`);
-    }
-    const validations = new Set(p.validations_humaines);
-    if (validations.size !== p.validations_humaines.length) return refusConfiguration("VALIDATION_EN_DOUBLE", `${base}/validations_humaines`);
-    if (!validations.has("lancement") || !validations.has("fin")) {
-      return refusConfiguration("VALIDATIONS_INCOMPLETES", `${base}/validations_humaines`);
-    }
-    if (p.classe === "sensible" && !validations.has("plan")) return refusConfiguration("VALIDATION_PLAN_ABSENTE", `${base}/validations_humaines`);
-  }
-  if (classes.size !== 3) return refusConfiguration("CLASSES_INCOMPLETES", "/profils/profils");
-
-  const er = valider(schemaReglesChemins, configuration["regles_chemins"]);
-  if (er !== null) return refusConfiguration(er.raison, `/regles_chemins${er.pointeur}`);
-  const reglesChemins = configuration["regles_chemins"] as ConfigurationValidee["regles_chemins"];
-  const ve = verifierReglesExclusion(reglesChemins.exclusion);
-  if (!ve.ok) return refusConfiguration(ve.raison, `/regles_chemins/exclusion${ve.pointeur}`);
-  const vc = verifierReglesClassification(reglesChemins.classification);
-  if (vc !== null) return refusConfiguration(vc.raison, `/regles_chemins/classification${vc.pointeur}`);
-
-  return { ok: true, configuration: { profils, regles_chemins: reglesChemins } };
+interface EntreeAcceptee {
+  readonly ok: true;
+  readonly relatif: string;
+  readonly segments: readonly string[];
+  readonly absolu: string;
 }
 
+// ---------------------------------------------------------------------------------------------
+// Contexte (interne)
+// ---------------------------------------------------------------------------------------------
+
 function segmentsMajuscules(r: RacineAnalysee): string[] {
   return [r.lecteur.toUpperCase(), ...r.segments.map((s) => s.toUpperCase())];
 }
 
 function chevauchement(a: RacineAnalysee, b: RacineAnalysee): boolean {
   const sa = segmentsMajuscules(a);
   const sb = segmentsMajuscules(b);
   const n = Math.min(sa.length, sb.length);
   for (let i = 0; i < n; i++) if (sa[i] !== sb[i]) return false;
   return true;
 }
 
-function validerContexte(contexte: unknown, regles: ReglesExclusion): { readonly ok: true; readonly racine: RacineAnalysee } | Refus {
+/** Interne. La racine autorisée est évaluée par evaluerChemin avec le JETON (jamais des règles). */
+function validerContexte(contexte: unknown, configuration: unknown): { readonly ok: true; readonly racine: RacineAnalysee } | Refus {
   const e = valider(schemaContexte, contexte);
   if (e !== null) return refus(CODES.CONTEXTE_INVALIDE, null, { raison: e.raison, pointeur: e.pointeur });
   const c = contexte as { readonly racine_autorisee: string; readonly racine_bridge: string };
   const autorisee = analyserRacine(c.racine_autorisee);
   if (!autorisee.ok) return refus(CODES.CONTEXTE_INVALIDE, c.racine_autorisee, { champ: "racine_autorisee", raison: autorisee.raison });
   const bridge = analyserRacine(c.racine_bridge);
   if (!bridge.ok) return refus(CODES.CONTEXTE_INVALIDE, c.racine_bridge, { champ: "racine_bridge", raison: bridge.raison });
-  const correspondances = correspondancesSegments(autorisee.racine.segments, regles);
-  if (correspondances.some((x) => x.categorie === "interdit")) {
-    return refus(CODES.RACINE_INTERDITE, c.racine_autorisee, { correspondances });
+  const evaluation = evaluerChemin(autorisee.racine.segments.join("/"), configuration);
+  if (evaluation.statut === "erreur_configuration") return refus(CODES.PROVENANCE_NON_GARANTIE, null, {});
+  if (evaluation.statut === "invalide") {
+    return refus(CODES.CONTEXTE_INVALIDE, c.racine_autorisee, { champ: "racine_autorisee", raison: `RACINE_${evaluation.sous_regle}` });
+  }
+  if (evaluation.statut === "exclu") {
+    const correspondances = evaluation.correspondances;
+    if (correspondances.some((x) => x.categorie === "interdit")) {
+      return refus(CODES.RACINE_INTERDITE, c.racine_autorisee, { correspondances });
+    }
+    return refus(CODES.RACINE_SECRET, c.racine_autorisee, { correspondances });
   }
-  if (correspondances.length > 0) return refus(CODES.RACINE_SECRET, c.racine_autorisee, { correspondances });
   if (chevauchement(autorisee.racine, bridge.racine)) return refus(CODES.CHEVAUCHEMENT_BRIDGE, c.racine_autorisee, {});
   return { ok: true, racine: autorisee.racine };
 }
 
+// ---------------------------------------------------------------------------------------------
+// Mission et périmètre (internes)
+// ---------------------------------------------------------------------------------------------
+
 function lireEcriture(mission: unknown): unknown {
   if (!estObjetSimple(mission)) return undefined;
   const perimetre = mission["perimetre"];
   return estObjetSimple(perimetre) ? perimetre["ecriture"] : undefined;
 }
 
 function refusMission(e: ErreurValidation, mission: unknown): Refus {
   const p = e.pointeur;
   if (p.startsWith("/limites_demandees/") && e.raison !== "CHAMP_NON_PREVU") {
     return refus(CODES.LIMITE_INVALIDE, null, { pointeur: p, raison: e.raison });
   }
   if (p === "/perimetre/ecriture") {
     const ecriture = lireEcriture(mission);
     if (e.raison === "CHAMP_MANQUANT" || (e.raison === "TAILLE_TABLEAU" && Array.isArray(ecriture) && ecriture.length === 0)) {
       return refus(CODES.PERIMETRE_ECRITURE_VIDE, null, { pointeur: p });
     }
   }
   if (e.raison === "CHAMP_NON_PREVU") return refus(CODES.CHAMP_NON_PREVU, null, { pointeur: p });
   if (e.raison === "CHAMP_MANQUANT") return refus(CODES.CHAMP_MANQUANT, null, { pointeur: p });
   if (e.raison === "VALEUR_HORS_LISTE") return refus(CODES.VALEUR_HORS_LISTE, null, { pointeur: p });
   return refus(CODES.MISSION_INVALIDE, null, { pointeur: p, raison: e.raison });
 }
 
 function comparerChemins(a: string, b: string): number {
   const ma = a.toUpperCase();
   const mb = b.toUpperCase();
   if (ma !== mb) return ma < mb ? -1 : 1;
   return a < b ? -1 : a > b ? 1 : 0;
 }
 
-/** Calcule la politique effective, ou renvoie un refus explicite. */
-export function calculerPolitique(mission: unknown, contexte: unknown, configuration: unknown): ResultatPolitique {
-  const conf = validerConfiguration(configuration);
-  if (!conf.ok) return conf;
-  const { profils, regles_chemins: reglesChemins } = conf.configuration;
-  const regles = reglesChemins.exclusion;
+/**
+ * Interne. Contrôle d'une entrée du périmètre (lecture ou écriture), avec le JETON :
+ *   1. syntaxe des jokers (analyserEntreePerimetre) ;
+ *   2. evaluerChemin sur la partie littérale, dont le code est repris tel quel ;
+ *   3. joker final présent → MOTIF_PEUT_COUVRIR_CHEMIN_INTERDIT (tout joker est refusé en v1) ;
+ *   4. longueur assemblée avec la racine, puis inclusion structurelle (HORS_RACINE).
+ * Chaque entrée désigne UN FICHIER. Le futur orchestrateur devra refuser une entrée qui correspond
+ * en réalité à un dossier ou à un lien (contrôle physique, hors du noyau).
+ */
+function controlerEntree(entree: string, racine: RacineAnalysee, configuration: unknown): EntreeAcceptee | Refus {
+  const syntaxe = analyserEntreePerimetre(entree);
+  if (!syntaxe.ok) return refus(CODES[syntaxe.code], entree);
+
+  const evaluation = evaluerChemin(syntaxe.litteral, configuration);
+  if (evaluation.statut === "erreur_configuration") return refus(CODES.PROVENANCE_NON_GARANTIE, entree);
+  if (evaluation.statut === "invalide") {
+    return refus(CODES.CHEMIN_INVALIDE, entree, { sous_regle: evaluation.sous_regle, index_segment: evaluation.index_segment });
+  }
+  if (evaluation.statut === "exclu") {
+    return refus(evaluation.code === "CHEMIN_INTERDIT" ? CODES.CHEMIN_INTERDIT : CODES.CHEMIN_SECRET, entree, {
+      racine_exclusion: evaluation.racine_exclusion,
+      regle_racine: evaluation.regle_racine,
+      regle_code: evaluation.regle_code,
+    });
+  }
+  if (syntaxe.jokerFinal) return refus(CODES.MOTIF_PEUT_COUVRIR_CHEMIN_INTERDIT, entree);
+
+  const segments = evaluation.chemin_normalise.split("/");
+  const absolus = [...racine.segments, ...segments];
+  const absolu = `${racine.lecteur}:\\${absolus.join("\\")}`;
+  if (absolu.length > LONGUEUR_MAX_CHEMIN) return refus(CODES.CHEMIN_INVALIDE, entree, { sous_regle: "CHEMIN_TROP_LONG", index_segment: null });
+
+  // Défense supplémentaire : inclusion structurelle segment par segment, sans tenir compte de la casse.
+  for (let i = 0; i < racine.segments.length; i++) {
+    if ((absolus[i] ?? "").toUpperCase() !== (racine.segments[i] ?? "").toUpperCase()) return refus(CODES.HORS_RACINE, entree);
+  }
+  return { ok: true, relatif: evaluation.chemin_normalise, segments, absolu };
+}
+
+// ---------------------------------------------------------------------------------------------
+// Classification (interne, D-03)
+// ---------------------------------------------------------------------------------------------
+
+function majuscules(liste: readonly string[]): string[] {
+  return liste.map((s) => s.toUpperCase());
+}
+
+/**
+ * Interne. Raisons d'élévation pour les entrées d'ÉCRITURE ACCEPTÉES (construites par
+ * controlerEntree dans ce module), triées de façon déterministe. Les règles de classification
+ * sont lues dans le registre privé à partir du jeton. Un chemin d'écriture est sensible s'il
+ * contient, à n'importe quelle profondeur, un nom de fichier sensible (dernier segment) ou un nom
+ * de dossier sensible (n'importe quel segment), ou s'il touche un préfixe sensible (dedans, égal
+ * ou parent, en segments entiers). Comparaisons en majuscules. null : jeton non enregistré.
+ */
+function detecterSensibilite(ecritures: readonly EntreeAcceptee[], configuration: unknown): RaisonElevation[] | null {
+  const contenu = contenuDuJeton(configuration);
+  if (contenu === undefined) return null;
+  const regles = contenu.regles_chemins.classification;
+  const fichiers = new Map(regles.fichiers_sensibles.map((f) => [f.toUpperCase(), f] as const));
+  const dossiers = new Map(regles.dossiers_sensibles.map((d) => [d.toUpperCase(), d] as const));
+  const prefixes = regles.prefixes_sensibles.map((p) => ({ texte: p, segments: majuscules(p.replace(/\\/g, "/").split("/")) }));
+  const raisons: RaisonElevation[] = [];
+
+  for (const ecriture of ecritures) {
+    const segments = majuscules(ecriture.segments);
+    const dernier = segments[segments.length - 1] ?? "";
+    const fichier = fichiers.get(dernier);
+    if (fichier !== undefined) raisons.push({ chemin: ecriture.relatif, regle: "fichier_sensible", valeur: fichier });
+    const dossiersVus = new Set<string>();
+    for (const segment of segments) {
+      const dossier = dossiers.get(segment);
+      if (dossier !== undefined && !dossiersVus.has(dossier)) {
+        dossiersVus.add(dossier);
+        raisons.push({ chemin: ecriture.relatif, regle: "dossier_sensible", valeur: dossier });
+      }
+    }
+    for (const prefixe of prefixes) {
+      const n = Math.min(prefixe.segments.length, segments.length);
+      let egaux = n > 0;
+      for (let i = 0; i < n && egaux; i++) egaux = segments[i] === prefixe.segments[i];
+      // Dedans (chemin plus long), égal, ou parent (chemin plus court) : sensible.
+      if (egaux) raisons.push({ chemin: ecriture.relatif, regle: "prefixe_sensible", valeur: prefixe.texte });
+    }
+  }
+
+  return raisons.sort((a, b) => {
+    const ca = a.chemin.toUpperCase();
+    const cb = b.chemin.toUpperCase();
+    if (ca !== cb) return ca < cb ? -1 : 1;
+    if (a.chemin !== b.chemin) return a.chemin < b.chemin ? -1 : 1;
+    if (a.regle !== b.regle) return a.regle < b.regle ? -1 : 1;
+    return a.valeur < b.valeur ? -1 : a.valeur > b.valeur ? 1 : 0;
+  });
+}
+
+// ---------------------------------------------------------------------------------------------
+// Exclusions déclarées (internes)
+// ---------------------------------------------------------------------------------------------
+
+/** Interne. Copie profonde exacte des règles : même ordre, mêmes chaînes, aucune transformation. */
+function copierRegles(r: ReglesExclusion): ReglesExclusion {
+  return {
+    version: r.version,
+    segments_interdits: r.segments_interdits.map((x) => ({ id: x.id, type: x.type, valeur: x.valeur })),
+    secrets: r.secrets.map((x) => ({ id: x.id, type: x.type, valeur: x.valeur })),
+  };
+}
+
+/** Interne. Objet fermé de neuf propriétés, règles lues dans le registre privé à partir du jeton. */
+function construireExclusions(configuration: unknown): ExclusionsLecture | null {
+  const contenu = contenuDuJeton(configuration);
+  if (contenu === undefined) return null;
+  const f = VALEURS_FIXES_EXCLUSIONS;
+  return {
+    version: f.version,
+    portee: f.portee,
+    semantique: f.semantique,
+    regles: copierRegles(contenu.regles_chemins.exclusion),
+    forme_canonique_regles: f.forme_canonique_regles,
+    type_entree_indetermine: f.type_entree_indetermine,
+    comportement_si_inapplicable: f.comportement_si_inapplicable,
+    appliquee_par: f.appliquee_par,
+    statut_dans_le_noyau: f.statut_dans_le_noyau,
+  };
+}
+
+// ---------------------------------------------------------------------------------------------
+// Volume réel et sortie (internes)
+// ---------------------------------------------------------------------------------------------
+
+/**
+ * Interne. Contrôle du document réellement produit, avec les limites mêmes du vérificateur :
+ * forme JSON compacte ≤ TAILLE_TEXTE_MAX unités UTF-16, puis relecture par analyserJsonStrict
+ * (profondeur, nœuds), puis revalidation du schéma sur la VALEUR RELUE. C'est cette valeur, gelée
+ * en profondeur par l'analyseur, qui est renvoyée (jamais l'objet initial).
+ */
+function verifierVolumeEtRelire(politique: Politique): ResultatPolitique {
+  const texte = JSON.stringify(politique);
+  if (texte.length > TAILLE_TEXTE_MAX) {
+    return refus(CODES.POLITIQUE_TROP_VOLUMINEUSE, null, { sous_raison: "TAILLE_TEXTE", taille: texte.length, limite: TAILLE_TEXTE_MAX });
+  }
+  const relue = analyserJsonStrict(texte);
+  if (!relue.ok) return refusRelecture(relue, texte.length);
+  const e = valider(schemaPolitique, relue.valeur);
+  if (e !== null) return refus(CODES.ERREUR_INTERNE, null, { raison: "RELECTURE_NON_CONFORME", detail: e.raison, pointeur: e.pointeur });
+  const resultat: ResultatPolitique = { ok: true, politique: relue.valeur as Politique };
+  return gelerNatif(resultat);
+}
+
+function refusRelecture(echec: EchecJson, taille: number): Refus {
+  if (echec.sous_raison === "TAILLE") {
+    return refus(CODES.POLITIQUE_TROP_VOLUMINEUSE, null, { sous_raison: "NOEUDS", taille, limite: NOEUDS_MAX_JSON });
+  }
+  if (echec.sous_raison === "PROFONDEUR") {
+    return refus(CODES.POLITIQUE_TROP_VOLUMINEUSE, null, { sous_raison: "PROFONDEUR", taille, limite: PROFONDEUR_MAX_JSON });
+  }
+  if (echec.sous_raison === "TAILLE_TEXTE") {
+    return refus(CODES.POLITIQUE_TROP_VOLUMINEUSE, null, { sous_raison: "TAILLE_TEXTE", taille, limite: TAILLE_TEXTE_MAX });
+  }
+  return refus(CODES.ERREUR_INTERNE, null, { raison: "RELECTURE_IMPOSSIBLE", sous_raison: echec.sous_raison });
+}
+
+// ---------------------------------------------------------------------------------------------
+// Calcul (interne) et point d'entrée (public)
+// ---------------------------------------------------------------------------------------------
+
+/**
+ * Interne. N'est appelée que par calculerPolitiqueTexte, avec des valeurs que analyserJsonStrict
+ * vient de créer et de geler (assertion défensive), et avec le jeton déjà vérifié.
+ */
+function calculerPolitique(mission: unknown, contexte: unknown, configuration: unknown): ResultatPolitique {
+  const contenu = contenuDuJeton(configuration);
+  if (contenu === undefined) return refus(CODES.PROVENANCE_NON_GARANTIE, null, {});
+  for (const valeur of [mission, contexte]) {
+    if (typeof valeur === "object" && valeur !== null && !estIssuDuParseurStrict(valeur)) {
+      return refus(CODES.ERREUR_INTERNE, null, { raison: "PROVENANCE_INTERNE" });
+    }
+  }
 
-  const ctx = validerContexte(contexte, regles);
+  const ctx = validerContexte(contexte, configuration);
   if (!ctx.ok) return ctx;
 
   const em = valider(schemaMission, mission);
   if (em !== null) return refusMission(em, mission);
   const m = mission as MissionValide;
   const identifiants = new Set<string>();
   for (const critere of m.criteres_acceptation) {
     if (identifiants.has(critere.id)) return refus(CODES.CRITERE_EN_DOUBLE, null, { id: critere.id });
     identifiants.add(critere.id);
   }
 
   const ecritures: EntreeAcceptee[] = [];
   for (const entree of m.perimetre.ecriture) {
-    const r = controlerEntree(entree, ctx.racine, regles);
+    const r = controlerEntree(entree, ctx.racine, configuration);
     if (!r.ok) return r;
     ecritures.push(r);
   }
   const lectures: EntreeAcceptee[] = [];
   for (const entree of m.perimetre.lecture ?? []) {
-    const r = controlerEntree(entree, ctx.racine, regles);
+    const r = controlerEntree(entree, ctx.racine, configuration);
     if (!r.ok) return r;
     lectures.push(r);
   }
 
-  const raisons = detecterSensibilite(
-    ecritures.map((e) => ({ relatif: e.relatif, segments: e.segments })),
-    reglesChemins.classification,
-  );
+  // D-03 : seules les écritures acceptées sont classées. Les lectures ont déjà subi tous les
+  // contrôles de sécurité ci-dessus (refus CHEMIN_SECRET ou CHEMIN_INTERDIT, jamais d'élévation).
+  const raisons = detecterSensibilite(ecritures, configuration);
+  if (raisons === null) return refus(CODES.PROVENANCE_NON_GARANTIE, null, {});
+  if (raisons.length > LIMITE_RAISONS_ELEVATION) {
+    return refus(CODES.RAISONS_ELEVATION_TROP_NOMBREUSES, null, { nombre: raisons.length, limite: LIMITE_RAISONS_ELEVATION });
+  }
   const classeDetectee: Classe = raisons.length > 0 ? "sensible" : "simple";
   const classeEffective = classeMax(m.classe_demandee, classeDetectee);
-  const profil = profils.profils.find((p) => p.classe === classeEffective);
+  const profil = contenu.profils.profils.find((p) => p.classe === classeEffective);
   if (profil === undefined) return refus(CODES.ERREUR_INTERNE, null, { raison: "PROFIL_INTROUVABLE", classe: classeEffective });
 
   const demandes: Readonly<Partial<Record<ClePlafond, number>>> = m.limites_demandees ?? {};
   const limites = {} as Record<ClePlafond, number>;
   for (const cle of CLES_PLAFONDS) {
     const plafond = profil.plafonds[cle];
     const demande = demandes[cle];
     if (demande === undefined) {
       limites[cle] = plafond;
       continue;
     }
     if (demande > plafond) {
       return refus(CODES.LIMITE_SUPERIEURE_AU_PLAFOND, null, {
         cle,
         demande,
         plafond,
         classe_effective: classeEffective,
         apres_elevation: classeEffective !== m.classe_demandee,
       });
     }
     limites[cle] = demande;
   }
 
   const indicateurs = {} as Record<CleIndicateur, number>;
   for (const cle of CLES_INDICATEURS) indicateurs[cle] = profil.indicateurs[cle];
 
+  const exclusions = construireExclusions(configuration);
+  if (exclusions === null) return refus(CODES.PROVENANCE_NON_GARANTIE, null, {});
+
   const politique: Politique = {
     version: "1",
     mission_id: m.id,
     classe_demandee: m.classe_demandee,
     classe_effective: classeEffective,
     raisons_elevation: raisons,
     limites,
     indicateurs,
     indicateurs_statut: "non_bloquant",
     validations_humaines: [...profil.validations_humaines],
     valeurs_provisoires: profil.provisoire,
     perimetre_ecriture: ecritures.map((e) => e.absolu).sort(comparerChemins),
     perimetre_lecture: lectures.map((e) => e.absolu).sort(comparerChemins),
-    exclusions_lecture_obligatoires: construireExclusions(regles),
+    exclusions_lecture_obligatoires: exclusions,
   };
 
   const auto = valider(schemaPolitique, politique);
   if (auto !== null) return refus(CODES.ERREUR_INTERNE, null, { raison: auto.raison, pointeur: auto.pointeur });
-  return { ok: true, politique };
+  return verifierVolumeEtRelire(politique);
+}
+
+/**
+ * API publique. Calcule la politique effective d'une mission, ou renvoie un refus explicite.
+ * Ordre : jeton (avant toute lecture), type et analyse stricte du contexte, puis de la mission,
+ * puis calcul interne. La politique renvoyée est gelée en profondeur.
+ */
+export function calculerPolitiqueTexte(texteMission: unknown, texteContexte: unknown, configuration: unknown): ResultatPolitique {
+  if (contenuDuJeton(configuration) === undefined) return refus(CODES.PROVENANCE_NON_GARANTIE, null, {});
+  if (typeof texteContexte !== "string") return refus(CODES.CONTEXTE_INVALIDE, null, { raison: "JSON_INVALIDE", sous_raison: "TYPE" });
+  const contexte = analyserJsonStrict(texteContexte);
+  if (!contexte.ok) return refus(CODES.CONTEXTE_INVALIDE, null, refusTexte(contexte));
+  if (typeof texteMission !== "string") return refus(CODES.MISSION_INVALIDE, null, { raison: "JSON_INVALIDE", sous_raison: "TYPE" });
+  const mission = analyserJsonStrict(texteMission);
+  if (!mission.ok) return refus(CODES.MISSION_INVALIDE, null, refusTexte(mission));
+  return calculerPolitique(mission.valeur, contexte.valeur, configuration);
+}
+
+function refusTexte(echec: EchecJson): Record<string, unknown> {
+  return { raison: "JSON_INVALIDE", sous_raison: echec.sous_raison, position: echec.position, pointeur: echec.pointeur, detail: echec.detail };
 }
```

