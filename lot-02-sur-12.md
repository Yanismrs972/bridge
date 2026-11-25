# Bridge v1 — correction de provenance — lot 02 sur 12

Référence : commit ffc0e3b (docs/REFERENCE.md) et livrable 1 (fichiers non suivis). Diff unifié à contexte complet : chaque diff contient le fichier entier ; les lignes « - » et « » donnent le contenu initial, les lignes « + » et « » le contenu final.

## Fichier 05 — src/mission/configuration.ts

- Statut : créé
- SHA-256 initial : (sans objet)
- SHA-256 final : d927cb525d13fcd7c3cec46e34148529e2366ef2420f555760ccf9e24dd83161
- Taille finale : 22517 octets, 455 lignes

```diff
--- /dev/null
+++ b/src/mission/configuration.ts
@@ -0,0 +1,455 @@
+// Configuration validée de Bridge v1 : jeton opaque, registre privé et plancher immuable (D-04).
+//
+// Flux de confiance :
+//   validerConfigurationTexte(texteProfils, texteReglesChemins)
+//     → deux chaînes exigées → analyse stricte des deux textes (valeurs gelées, créées dans l'appel)
+//     → schémas internes → schémas et contraintes des profils et des règles → plancher immuable
+//     → jeton = objet vide gelé ; contenu = { profils, regles_chemins } gelé
+//     → enregistrement (jeton → contenu) dans CONFIGURATIONS_VALIDEES (seul ajout de tout le code)
+//
+// Le jeton est OPAQUE : il ne porte aucune règle. Les règles sont associées au jeton dans le
+// registre privé. Toute fonction qui applique des règles reçoit le JETON et lit elle-même le
+// contenu associé avec contenuDuJeton, en première instruction, avant toute autre lecture.
+// Ni le contenu renvoyé, ni des règles, ni une valeur issue de l'analyseur strict ne remplacent
+// jamais le jeton : seule l'identité du jeton enregistré compte.
+//
+// Aucune configuration implicite : aucun paramètre de configuration n'a de valeur par défaut et
+// ce module ne lit aucun fichier.
+//
+// Limites : le plancher ne prouve pas que la configuration provient des fichiers officiels (le
+// contrôle de leur empreinte relève de l'orchestrateur) ; le registre n'isole pas le noyau d'un
+// code hostile exécuté dans le même processus.
+
+import schemaContexte from "./schemas/contexte.schema.json" with { type: "json" };
+import schemaExclusionsLecture from "./schemas/exclusions-lecture.schema.json" with { type: "json" };
+import schemaMission from "./schemas/mission.schema.json" with { type: "json" };
+import schemaPolitique from "./schemas/politique.schema.json" with { type: "json" };
+import schemaProfils from "./schemas/profils.schema.json" with { type: "json" };
+import schemaReglesChemins from "./schemas/regles-chemins.schema.json" with { type: "json" };
+import schemaReglesExclusion from "./schemas/regles-exclusion.schema.json" with { type: "json" };
+import { contientSurrogateIsolee, serialiserCanonique } from "./canonique.ts";
+import type { Classe, ReglesClassification } from "./classification.ts";
+import { CODES, refus, type Refus } from "./erreurs.ts";
+import { analyserJsonStrict, estIssuDuParseurStrict, gelerProfondement, type EchecJson } from "./json-strict.ts";
+import type { ClePlafond, CleIndicateur, ValidationHumaine } from "./politique.ts";
+import { analyserCheminRelatif, estCaractereControle, estCaractereInterdit, validerSegment } from "./syntaxe-chemins.ts";
+import { valider, verifierSchema } from "./validation.ts";
+
+// Les sept schémas du noyau sont gelés en profondeur dès le chargement de ce module.
+gelerProfondement(schemaContexte);
+gelerProfondement(schemaExclusionsLecture);
+gelerProfondement(schemaMission);
+gelerProfondement(schemaPolitique);
+gelerProfondement(schemaProfils);
+gelerProfondement(schemaReglesChemins);
+gelerProfondement(schemaReglesExclusion);
+
+// ---------------------------------------------------------------------------------------------
+// Types
+// ---------------------------------------------------------------------------------------------
+
+export type TypeRegleSecret = "nom_exact" | "prefixe" | "suffixe";
+
+export interface RegleInterdite {
+  readonly id: string;
+  readonly type: "contient";
+  readonly valeur: string;
+}
+
+export interface RegleSecret {
+  readonly id: string;
+  readonly type: TypeRegleSecret;
+  readonly valeur: string;
+}
+
+export interface ReglesExclusion {
+  readonly version: "1";
+  readonly segments_interdits: readonly RegleInterdite[];
+  readonly secrets: readonly RegleSecret[];
+}
+
+export interface ProfilValide {
+  readonly classe: Classe;
+  readonly provisoire: boolean;
+  readonly plafonds: Readonly<Record<ClePlafond, number>>;
+  readonly indicateurs: Readonly<Record<CleIndicateur, number>>;
+  readonly validations_humaines: readonly ValidationHumaine[];
+}
+
+/** Contenu associé à un jeton dans le registre privé. Données gelées, jamais une autorisation. */
+export interface ContenuConfiguration {
+  readonly profils: { readonly version: "1"; readonly profils: readonly ProfilValide[] };
+  readonly regles_chemins: {
+    readonly version: "1";
+    readonly exclusion: ReglesExclusion;
+    readonly classification: ReglesClassification;
+  };
+}
+
+declare const marqueJeton: unique symbol;
+
+/** Jeton opaque : objet vide gelé, reconnu uniquement par son identité dans le registre privé. */
+export interface ConfigurationValidee {
+  readonly [marqueJeton]: true;
+}
+
+export type ResultatConfiguration = { readonly ok: true; readonly configuration: ConfigurationValidee } | Refus;
+
+// ---------------------------------------------------------------------------------------------
+// Registre privé (non exporté). Méthodes capturées et liées au chargement.
+// ---------------------------------------------------------------------------------------------
+
+const gelerNatif: <T>(valeur: T) => Readonly<T> = Object.freeze;
+const CONFIGURATIONS_VALIDEES = new WeakMap<object, ContenuConfiguration>();
+const ajouterConfiguration = WeakMap.prototype.set.bind(CONFIGURATIONS_VALIDEES) as (jeton: object, contenu: ContenuConfiguration) => unknown;
+const lireConfiguration = WeakMap.prototype.get.bind(CONFIGURATIONS_VALIDEES) as (jeton: object) => ContenuConfiguration | undefined;
+const contientConfiguration = WeakMap.prototype.has.bind(CONFIGURATIONS_VALIDEES) as (jeton: object) => boolean;
+
+/**
+ * API publique. Vrai si et seulement si la valeur est un jeton enregistré par
+ * validerConfigurationTexte. Contrôle par identité : aucune propriété de la valeur n'est lue.
+ */
+export function estConfigurationValidee(valeur: unknown): valeur is ConfigurationValidee {
+  if (typeof valeur !== "object" || valeur === null) return false;
+  return contientConfiguration(valeur);
+}
+
+/**
+ * Export TECHNIQUE, réservé aux modules du noyau (chemins, regles-politique, politique) : renvoie
+ * le contenu gelé associé à un jeton enregistré, ou undefined. Contrôle par identité : aucune
+ * propriété de la valeur n'est lue. Ce n'est pas un point d'entrée autorisé : le contenu renvoyé
+ * n'est accepté par aucune fonction à la place du jeton.
+ */
+export function contenuDuJeton(valeur: unknown): ContenuConfiguration | undefined {
+  if (typeof valeur !== "object" || valeur === null) return undefined;
+  return lireConfiguration(valeur);
+}
+
+// ---------------------------------------------------------------------------------------------
+// Schémas internes
+// ---------------------------------------------------------------------------------------------
+
+const SCHEMAS_INTERNES: ReadonlyArray<readonly [string, unknown]> = gelerProfondement([
+  ["mission", schemaMission],
+  ["contexte", schemaContexte],
+  ["profils", schemaProfils],
+  ["regles-chemins", schemaReglesChemins],
+  ["regles-exclusion", schemaReglesExclusion],
+  ["exclusions-lecture", schemaExclusionsLecture],
+  ["politique", schemaPolitique],
+] as const);
+
+/** Export technique : vérifie que tous les schémas du noyau respectent le sous-ensemble fermé. */
+export function verifierSchemasInternes(): Refus | null {
+  for (const [nom, schema] of SCHEMAS_INTERNES) {
+    const e = verifierSchema(schema);
+    if (e !== null) return refus(CODES.CONFIGURATION_INVALIDE, null, { schema: nom, raison: e.raison, pointeur: e.pointeur });
+  }
+  return null;
+}
+
+// ---------------------------------------------------------------------------------------------
+// Plancher immuable (interne). Copie exacte de la configuration de référence ; toute modification
+// exige une modification du code et une revue humaine du diff.
+// ---------------------------------------------------------------------------------------------
+
+const PLANCHER_SEGMENTS_INTERDITS: readonly RegleInterdite[] = gelerProfondement<readonly RegleInterdite[]>([
+  { id: "INT-FASTCLIP", type: "contient", valeur: "fastclip" },
+]);
+
+const PLANCHER_SECRETS: readonly RegleSecret[] = gelerProfondement<readonly RegleSecret[]>([
+  { id: "SEC-EXACT-SSH", type: "nom_exact", valeur: ".ssh" },
+  { id: "SEC-EXACT-AWS", type: "nom_exact", valeur: ".aws" },
+  { id: "SEC-EXACT-AZURE", type: "nom_exact", valeur: ".azure" },
+  { id: "SEC-EXACT-GNUPG", type: "nom_exact", valeur: ".gnupg" },
+  { id: "SEC-EXACT-KUBE", type: "nom_exact", valeur: ".kube" },
+  { id: "SEC-EXACT-DOCKER", type: "nom_exact", valeur: ".docker" },
+  { id: "SEC-EXACT-GIT", type: "nom_exact", valeur: ".git" },
+  { id: "SEC-EXACT-ENV", type: "nom_exact", valeur: ".env" },
+  { id: "SEC-EXACT-NPMRC", type: "nom_exact", valeur: ".npmrc" },
+  { id: "SEC-EXACT-PYPIRC", type: "nom_exact", valeur: ".pypirc" },
+  { id: "SEC-EXACT-NETRC", type: "nom_exact", valeur: ".netrc" },
+  { id: "SEC-EXACT-NETRC-WIN", type: "nom_exact", valeur: "_netrc" },
+  { id: "SEC-EXACT-GIT-CREDENTIALS", type: "nom_exact", valeur: ".git-credentials" },
+  { id: "SEC-EXACT-CREDENTIALS", type: "nom_exact", valeur: "credentials" },
+  { id: "SEC-EXACT-CREDENTIALS-JSON", type: "nom_exact", valeur: "credentials.json" },
+  { id: "SEC-EXACT-SECRETS", type: "nom_exact", valeur: "secrets" },
+  { id: "SEC-EXACT-SECRETS-JSON", type: "nom_exact", valeur: "secrets.json" },
+  { id: "SEC-EXACT-AUTH-JSON", type: "nom_exact", valeur: "auth.json" },
+  { id: "SEC-PRE-ENV", type: "prefixe", valeur: ".env." },
+  { id: "SEC-PRE-ID-RSA", type: "prefixe", valeur: "id_rsa" },
+  { id: "SEC-PRE-ID-DSA", type: "prefixe", valeur: "id_dsa" },
+  { id: "SEC-PRE-ID-ECDSA", type: "prefixe", valeur: "id_ecdsa" },
+  { id: "SEC-PRE-ID-ED25519", type: "prefixe", valeur: "id_ed25519" },
+  { id: "SEC-SUF-PEM", type: "suffixe", valeur: ".pem" },
+  { id: "SEC-SUF-KEY", type: "suffixe", valeur: ".key" },
+  { id: "SEC-SUF-P12", type: "suffixe", valeur: ".p12" },
+  { id: "SEC-SUF-PFX", type: "suffixe", valeur: ".pfx" },
+  { id: "SEC-SUF-JKS", type: "suffixe", valeur: ".jks" },
+  { id: "SEC-SUF-KEYSTORE", type: "suffixe", valeur: ".keystore" },
+  { id: "SEC-SUF-KDBX", type: "suffixe", valeur: ".kdbx" },
+  { id: "SEC-SUF-PPK", type: "suffixe", valeur: ".ppk" },
+]);
+
+const PLANCHER_FICHIERS_SENSIBLES: readonly string[] = gelerProfondement([
+  "package.json",
+  "package-lock.json",
+  "npm-shrinkwrap.json",
+  "yarn.lock",
+  "pnpm-lock.yaml",
+  ".npmrc",
+  "tsconfig.json",
+  "CLAUDE.md",
+  "CLAUDE.local.md",
+  "AGENTS.md",
+  ".mcp.json",
+]);
+
+const PLANCHER_DOSSIERS_SENSIBLES: readonly string[] = gelerProfondement([".claude", ".github", ".git", "migrations", ".vscode"]);
+
+function refusPlancher(detail: Record<string, unknown>): Refus {
+  return refus(CODES.PLANCHER_SECURITE_NON_RESPECTE, null, detail);
+}
+
+/**
+ * Comparaison STRICTE des définitions : chaque règle du plancher doit figurer à l'identique
+ * (forme canonique : id, type et valeur identiques au caractère près), en position indifférente.
+ * Même id avec une autre définition : MODIFIEE ; id absent : ABSENTE.
+ */
+function verifierListePlancher(
+  categorie: "segments_interdits" | "secrets",
+  plancher: readonly (RegleInterdite | RegleSecret)[],
+  liste: readonly (RegleInterdite | RegleSecret)[],
+): Refus | null {
+  const canoniques = new Set<string>();
+  const indexParId = new Map<string, number>();
+  for (let i = 0; i < liste.length; i++) {
+    const regle = liste[i];
+    if (regle === undefined) continue;
+    const c = serialiserCanonique(regle);
+    if (!c.ok) return refus(CODES.ERREUR_INTERNE, null, { raison: "PLANCHER_NON_CANONISABLE", categorie, index: i });
+    canoniques.add(c.texte);
+    indexParId.set(regle.id, i);
+  }
+  for (const regle of plancher) {
+    const c = serialiserCanonique(regle);
+    if (!c.ok) return refus(CODES.ERREUR_INTERNE, null, { raison: "PLANCHER_NON_CANONISABLE", categorie, id: regle.id });
+    if (canoniques.has(c.texte)) continue;
+    const index = indexParId.get(regle.id);
+    if (index === undefined) return refusPlancher({ categorie, id: regle.id, raison: "ABSENTE" });
+    return refusPlancher({ categorie, id: regle.id, raison: "MODIFIEE", pointeur: `/regles_chemins/exclusion/${categorie}/${index}` });
+  }
+  return null;
+}
+
+function verifierEntreesPlancher(
+  categorie: "fichiers_sensibles" | "dossiers_sensibles",
+  plancher: readonly string[],
+  liste: readonly string[],
+): Refus | null {
+  for (const valeur of plancher) {
+    if (!liste.includes(valeur)) return refusPlancher({ categorie, valeur, raison: "ABSENTE" });
+  }
+  return null;
+}
+
+function verifierPlancher(reglesChemins: ContenuConfiguration["regles_chemins"]): Refus | null {
+  return (
+    verifierListePlancher("segments_interdits", PLANCHER_SEGMENTS_INTERDITS, reglesChemins.exclusion.segments_interdits) ??
+    verifierListePlancher("secrets", PLANCHER_SECRETS, reglesChemins.exclusion.secrets) ??
+    verifierEntreesPlancher("fichiers_sensibles", PLANCHER_FICHIERS_SENSIBLES, reglesChemins.classification.fichiers_sensibles) ??
+    verifierEntreesPlancher("dossiers_sensibles", PLANCHER_DOSSIERS_SENSIBLES, reglesChemins.classification.dossiers_sensibles)
+  );
+}
+
+// ---------------------------------------------------------------------------------------------
+// Validation des règles d'exclusion et de classification (internes)
+// ---------------------------------------------------------------------------------------------
+
+type VerificationRegles = { readonly ok: true } | { readonly ok: false; readonly raison: string; readonly pointeur: string };
+
+function verifierValeurRegle(type: string, valeur: string): string | null {
+  if (contientSurrogateIsolee(valeur)) return "VALEUR_UNICODE_INVALIDE";
+  if (valeur.normalize("NFC") !== valeur) return "VALEUR_NON_NFC";
+  if (valeur === "." || valeur === "..") return "VALEUR_POINT";
+  for (let i = 0; i < valeur.length; i++) {
+    if (estCaractereControle(valeur.charCodeAt(i))) return "VALEUR_CARACTERE_CONTROLE";
+    if (estCaractereInterdit(valeur.charAt(i))) return "VALEUR_CARACTERE_INTERDIT";
+  }
+  if (type === "nom_exact") {
+    const e = validerSegment(valeur);
+    return e === null ? null : `VALEUR_SEGMENT_INVALIDE:${e}`;
+  }
+  if (type === "prefixe") return valeur.startsWith(" ") ? "VALEUR_ESPACE_DEBUT" : null;
+  if (type === "suffixe") {
+    if (valeur.endsWith(".")) return "VALEUR_POINT_FINAL";
+    if (valeur.endsWith(" ")) return "VALEUR_ESPACE_FIN";
+    return null;
+  }
+  if (type === "contient") {
+    if (valeur.startsWith(" ")) return "VALEUR_ESPACE_DEBUT";
+    if (valeur.endsWith(" ")) return "VALEUR_ESPACE_FIN";
+    return null;
+  }
+  return "TYPE_INCONNU";
+}
+
+/** Valide un objet de règles d'exclusion déjà analysé. Aucune valeur par défaut, aucune reconstruction. */
+function verifierReglesExclusion(regles: unknown): VerificationRegles {
+  const meta = verifierSchema(schemaReglesExclusion);
+  if (meta !== null) return { ok: false, raison: `SCHEMA_INTERNE:${meta.raison}`, pointeur: meta.pointeur };
+  const e = valider(schemaReglesExclusion, regles);
+  if (e !== null) return { ok: false, raison: e.raison, pointeur: e.pointeur };
+  const r = regles as ReglesExclusion;
+  const ids = new Set<string>();
+  const couples = new Set<string>();
+  const parcours: ReadonlyArray<readonly [string, readonly (RegleInterdite | RegleSecret)[]]> = [
+    ["segments_interdits", r.segments_interdits],
+    ["secrets", r.secrets],
+  ];
+  for (const [categorie, liste] of parcours) {
+    for (let i = 0; i < liste.length; i++) {
+      const regle = liste[i];
+      if (regle === undefined) continue;
+      const pointeur = `/${categorie}/${i}`;
+      if (ids.has(regle.id)) return { ok: false, raison: "ID_EN_DOUBLE", pointeur: `${pointeur}/id` };
+      ids.add(regle.id);
+      const v = verifierValeurRegle(regle.type, regle.valeur);
+      if (v !== null) return { ok: false, raison: v, pointeur: `${pointeur}/valeur` };
+      const couple = `${regle.type}\u0000${regle.valeur.toUpperCase()}`;
+      if (couples.has(couple)) return { ok: false, raison: "REGLE_EN_DOUBLE", pointeur };
+      couples.add(couple);
+    }
+  }
+  if (!r.segments_interdits.some((x) => x.valeur.toUpperCase() === "FASTCLIP")) {
+    return { ok: false, raison: "REGLE_FASTCLIP_ABSENTE", pointeur: "/segments_interdits" };
+  }
+  return { ok: true };
+}
+
+/** Contrôle des règles de classification (configuration). */
+function verifierReglesClassification(r: ReglesClassification): { readonly raison: string; readonly pointeur: string } | null {
+  const listes: ReadonlyArray<readonly [string, readonly string[]]> = [
+    ["fichiers_sensibles", r.fichiers_sensibles],
+    ["dossiers_sensibles", r.dossiers_sensibles],
+  ];
+  for (const [nom, liste] of listes) {
+    for (let i = 0; i < liste.length; i++) {
+      const e = validerSegment(liste[i] ?? "");
+      if (e !== null) return { raison: `SEGMENT_INVALIDE:${e}`, pointeur: `/${nom}/${i}` };
+    }
+  }
+  for (let i = 0; i < r.prefixes_sensibles.length; i++) {
+    const a = analyserCheminRelatif(r.prefixes_sensibles[i] ?? "");
+    if (!a.ok) return { raison: `PREFIXE_INVALIDE:${a.sous_regle}`, pointeur: `/prefixes_sensibles/${i}` };
+  }
+  return null;
+}
+
+// ---------------------------------------------------------------------------------------------
+// Validation de la configuration (interne)
+// ---------------------------------------------------------------------------------------------
+
+function refusConfiguration(fichier: "profils" | "regles-chemins", raison: string, pointeur: string): Refus {
+  return refus(CODES.CONFIGURATION_INVALIDE, null, { fichier, raison, pointeur });
+}
+
+/**
+ * Valide les deux valeurs analysées. Interne : n'est appelée que par validerConfigurationTexte,
+ * avec des valeurs que analyserJsonStrict vient de créer et de geler (assertion défensive).
+ */
+function validerConfiguration(
+  profilsAnalyses: unknown,
+  reglesCheminsAnalysees: unknown,
+): { readonly ok: true; readonly contenu: ContenuConfiguration } | Refus {
+  for (const valeur of [profilsAnalyses, reglesCheminsAnalysees]) {
+    if (typeof valeur === "object" && valeur !== null && !estIssuDuParseurStrict(valeur)) {
+      return refus(CODES.ERREUR_INTERNE, null, { raison: "PROVENANCE_INTERNE" });
+    }
+  }
+
+  const ep = valider(schemaProfils, profilsAnalyses);
+  if (ep !== null) return refusConfiguration("profils", ep.raison, `/profils${ep.pointeur}`);
+  const profils = profilsAnalyses as ContenuConfiguration["profils"];
+  const classes = new Set<Classe>();
+  for (let i = 0; i < profils.profils.length; i++) {
+    const p = profils.profils[i];
+    if (p === undefined) continue;
+    const base = `/profils/profils/${i}`;
+    if (classes.has(p.classe)) return refusConfiguration("profils", "CLASSE_EN_DOUBLE", `${base}/classe`);
+    classes.add(p.classe);
+    if (p.plafonds.delai_appel_claude_min > p.plafonds.duree_max_min) {
+      return refusConfiguration("profils", "DELAI_SUPERIEUR_A_LA_DUREE", `${base}/plafonds/delai_appel_claude_min`);
+    }
+    if (p.plafonds.delai_appel_codex_min > p.plafonds.duree_max_min) {
+      return refusConfiguration("profils", "DELAI_SUPERIEUR_A_LA_DUREE", `${base}/plafonds/delai_appel_codex_min`);
+    }
+    const validations = new Set(p.validations_humaines);
+    if (validations.size !== p.validations_humaines.length) {
+      return refusConfiguration("profils", "VALIDATION_EN_DOUBLE", `${base}/validations_humaines`);
+    }
+    if (!validations.has("lancement") || !validations.has("fin")) {
+      return refusConfiguration("profils", "VALIDATIONS_INCOMPLETES", `${base}/validations_humaines`);
+    }
+    if (p.classe === "sensible" && !validations.has("plan")) {
+      return refusConfiguration("profils", "VALIDATION_PLAN_ABSENTE", `${base}/validations_humaines`);
+    }
+  }
+  if (classes.size !== 3) return refusConfiguration("profils", "CLASSES_INCOMPLETES", "/profils/profils");
+
+  const er = valider(schemaReglesChemins, reglesCheminsAnalysees);
+  if (er !== null) return refusConfiguration("regles-chemins", er.raison, `/regles_chemins${er.pointeur}`);
+  const reglesChemins = reglesCheminsAnalysees as ContenuConfiguration["regles_chemins"];
+  const ve = verifierReglesExclusion(reglesChemins.exclusion);
+  if (!ve.ok) return refusConfiguration("regles-chemins", ve.raison, `/regles_chemins/exclusion${ve.pointeur}`);
+  const vc = verifierReglesClassification(reglesChemins.classification);
+  if (vc !== null) return refusConfiguration("regles-chemins", vc.raison, `/regles_chemins/classification${vc.pointeur}`);
+
+  return { ok: true, contenu: { profils, regles_chemins: reglesChemins } };
+}
+
+function refusAnalyse(fichier: "profils" | "regles-chemins", echec: EchecJson): Refus {
+  return refus(CODES.CONFIGURATION_INVALIDE, null, {
+    fichier,
+    raison: "JSON_INVALIDE",
+    sous_raison: echec.sous_raison,
+    position: echec.position,
+    pointeur: echec.pointeur,
+    detail: echec.detail,
+  });
+}
+
+/**
+ * API publique. SEULE source de jetons de configuration validée. Reçoit le TEXTE des deux
+ * fichiers de configuration ; un objet est refusé. Ordre : types, analyse stricte, schémas
+ * internes, validation complète, plancher, puis création et enregistrement du jeton.
+ */
+export function validerConfigurationTexte(texteProfils: unknown, texteReglesChemins: unknown): ResultatConfiguration {
+  if (typeof texteProfils !== "string") return refusConfiguration("profils", "TYPE", "");
+  if (typeof texteReglesChemins !== "string") return refusConfiguration("regles-chemins", "TYPE", "");
+
+  const interne = verifierSchemasInternes();
+  if (interne !== null) return interne;
+
+  const analyseProfils = analyserJsonStrict(texteProfils);
+  if (!analyseProfils.ok) return refusAnalyse("profils", analyseProfils);
+  const analyseRegles = analyserJsonStrict(texteReglesChemins);
+  if (!analyseRegles.ok) return refusAnalyse("regles-chemins", analyseRegles);
+
+  const validation = validerConfiguration(analyseProfils.valeur, analyseRegles.valeur);
+  if (!validation.ok) return validation;
+
+  const plancher = verifierPlancher(validation.contenu.regles_chemins);
+  if (plancher !== null) return plancher;
+
+  // Les deux valeurs sont déjà gelées en profondeur par l'analyseur ; le contenu et le jeton,
+  // créés ici, sont gelés à leur tour. Le jeton est un objet vide : il ne porte aucune règle.
+  const contenu: ContenuConfiguration = gelerNatif({
+    profils: validation.contenu.profils,
+    regles_chemins: validation.contenu.regles_chemins,
+  });
+  const jeton = gelerNatif({}) as unknown as ConfigurationValidee;
+  ajouterConfiguration(jeton, contenu);
+  const resultat: ResultatConfiguration = { ok: true, configuration: jeton };
+  return gelerNatif(resultat);
+}
```

