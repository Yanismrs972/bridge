# Bridge v1 — correction de provenance — lot 03 sur 12

Référence : commit ffc0e3b (docs/REFERENCE.md) et livrable 1 (fichiers non suivis). Diff unifié à contexte complet : chaque diff contient le fichier entier ; les lignes « - » et « » donnent le contenu initial, les lignes « + » et « » le contenu final.

## Fichier 06 — src/mission/chemins.ts

- Statut : modifié
- SHA-256 initial : 82c02a080d879b69fe549be7bbed3ca5131a47b68bcdd7797740230467fde13b
- SHA-256 final : 73699b4ad93ed82fd8dcf36e57baa73657733ae61d98f0335fc0523277cd3bb9
- Taille finale : 5690 octets, 124 lignes

```diff
--- a/src/mission/chemins.ts
+++ b/src/mission/chemins.ts
@@ -1,336 +1,124 @@
-// Règles de chemins de Bridge v1 : syntaxe lexicale, règles d'exclusion et evaluerChemin.
+// Évaluation d'un chemin relatif de Bridge v1 (règles d'exclusion).
 //
-// Toutes les règles de ce module sont LEXICALES. Elles ne détectent ni les liens symboliques, ni
-// les jonctions, ni les noms courts 8.3 réels, ni aucune redirection physique : ces contrôles
-// relèvent du futur orchestrateur, avant tout accès réel aux fichiers.
+// evaluerChemin est la fonction UNIQUE d'évaluation : le calcul de la politique (contrôle du
+// périmètre et de la racine) et le futur orchestrateur (énumération et copie) l'utilisent telle
+// quelle, sans réimplémentation.
 //
-// evaluerChemin est la fonction UNIQUE d'évaluation : le noyau (contrôle du périmètre) et le futur
-// orchestrateur (énumération et copie) l'importent telle quelle, sans réimplémentation.
-
-import schemaReglesExclusion from "./schemas/regles-exclusion.schema.json" with { type: "json" };
-import { contientSurrogateIsolee } from "./canonique.ts";
-import { valider, verifierSchema } from "./validation.ts";
-
-export const LONGUEUR_MAX_CHEMIN = 240;
-export const LONGUEUR_MAX_SEGMENT = 255;
-
-const CARACTERES_INTERDITS: ReadonlySet<string> = new Set(["<", ">", ":", '"', "|", "?", "*", "/", "\\"]);
-
-const NOMS_RESERVES: ReadonlySet<string> = new Set([
-  "CON",
-  "PRN",
-  "AUX",
-  "NUL",
-  "COM0",
-  "COM1",
-  "COM2",
-  "COM3",
-  "COM4",
-  "COM5",
-  "COM6",
-  "COM7",
-  "COM8",
-  "COM9",
-  "LPT0",
-  "LPT1",
-  "LPT2",
-  "LPT3",
-  "LPT4",
-  "LPT5",
-  "LPT6",
-  "LPT7",
-  "LPT8",
-  "LPT9",
-  "COM\u00b9",
-  "COM\u00b2",
-  "COM\u00b3",
-  "LPT\u00b9",
-  "LPT\u00b2",
-  "LPT\u00b3",
-  "CONIN$",
-  "CONOUT$",
-]);
-
-// ---------------------------------------------------------------------------------------------
-// Types des règles d'exclusion
-// ---------------------------------------------------------------------------------------------
-
-export type TypeRegleSecret = "nom_exact" | "prefixe" | "suffixe";
-
-export interface RegleInterdite {
-  readonly id: string;
-  readonly type: "contient";
-  readonly valeur: string;
-}
+// Provenance (D-04) : evaluerChemin reçoit le JETON de configuration validée, jamais des règles.
+// Sa première instruction lit, dans le registre privé, le contenu associé au jeton. Tout autre
+// argument (règles, configuration analysée, contenu d'un jeton, copie du jeton, absence
+// d'argument) produit erreur_configuration / PROVENANCE_NON_GARANTIE, sans évaluation.
+//
+// Les règles sont LEXICALES et comparées sans tenir compte de la casse (les deux côtés sont mis
+// en majuscules) : fastclip, Fastclip, FastClip et FASTCLIP désignent le même nom. Elles ne
+// détectent ni les liens symboliques, ni les jonctions, ni les noms courts 8.3 réels.
 
-export interface RegleSecret {
-  readonly id: string;
-  readonly type: TypeRegleSecret;
-  readonly valeur: string;
-}
+import { contenuDuJeton, type ReglesExclusion } from "./configuration.ts";
+import { analyserCheminRelatif } from "./syntaxe-chemins.ts";
 
-export interface ReglesExclusion {
-  readonly version: "1";
-  readonly segments_interdits: readonly RegleInterdite[];
-  readonly secrets: readonly RegleSecret[];
-}
+export type { RegleInterdite, RegleSecret, ReglesExclusion, TypeRegleSecret } from "./configuration.ts";
 
 export type CategorieExclusion = "interdit" | "secret";
 
 export interface Correspondance {
   readonly index_segment: number;
   readonly categorie: CategorieExclusion;
   readonly id: string;
 }
 
 export interface RegleDesignee {
   readonly categorie: CategorieExclusion;
   readonly id: string;
 }
 
 export type ResultatEvaluation =
   | { readonly statut: "autorise"; readonly chemin_normalise: string }
   | {
       readonly statut: "invalide";
       readonly code: "CHEMIN_INVALIDE";
       readonly sous_regle: string;
       readonly index_segment: number | null;
     }
   | {
-      readonly statut: "erreur_regles";
-      readonly code: "REGLES_EXCLUSION_INVALIDES";
-      readonly detail: { readonly raison: string; readonly pointeur: string };
+      readonly statut: "erreur_configuration";
+      readonly code: "PROVENANCE_NON_GARANTIE";
     }
   | {
       readonly statut: "exclu";
       readonly code: "CHEMIN_INTERDIT" | "CHEMIN_SECRET";
       readonly categorie: CategorieExclusion;
       readonly racine_exclusion: string;
       readonly index_racine: number;
       readonly regle_racine: RegleDesignee;
       readonly regle_code: RegleDesignee;
       readonly correspondances: readonly Correspondance[];
     };
 
-// ---------------------------------------------------------------------------------------------
-// Syntaxe des segments et des chemins relatifs
-// ---------------------------------------------------------------------------------------------
-
-function estCaractereControle(code: number): boolean {
-  return code <= 0x1f || code === 0x7f || (code >= 0x80 && code <= 0x9f);
-}
-
-function estNomReserve(segment: string): boolean {
-  const base = (segment.split(".")[0] ?? "").replace(/ +$/u, "").toUpperCase();
-  return NOMS_RESERVES.has(base);
-}
-
-/** Renvoie la sous-règle violée par un segment, ou null si le segment est valide. */
-export function validerSegment(segment: string): string | null {
-  if (segment.length === 0) return "SEGMENT_VIDE";
-  if (segment === "." || segment === "..") return "SEGMENT_POINT";
-  if (segment.length > LONGUEUR_MAX_SEGMENT) return "SEGMENT_TROP_LONG";
-  if (contientSurrogateIsolee(segment)) return "UNICODE_INVALIDE";
-  if (segment.normalize("NFC") !== segment) return "NON_NFC";
-  for (let i = 0; i < segment.length; i++) {
-    if (estCaractereControle(segment.charCodeAt(i))) return "CARACTERE_CONTROLE";
-    if (CARACTERES_INTERDITS.has(segment.charAt(i))) return "CARACTERE_INTERDIT";
-  }
-  if (segment.startsWith(" ")) return "ESPACE_DEBUT";
-  if (segment.endsWith(" ")) return "ESPACE_FIN";
-  if (segment.endsWith(".")) return "POINT_FINAL";
-  if (/~[0-9]/u.test(segment)) return "NOM_COURT_8_3";
-  if (estNomReserve(segment)) return "NOM_RESERVE";
-  return null;
-}
-
-export type AnalyseChemin =
-  | { readonly ok: true; readonly segments: readonly string[]; readonly normalise: string }
-  | { readonly ok: false; readonly sous_regle: string; readonly index_segment: number | null };
-
-/** Analyse lexicale d'un chemin relatif. « \ » est normalisé en « / ». Rien n'est résolu. */
-export function analyserCheminRelatif(chemin: string): AnalyseChemin {
-  if (chemin.length === 0) return { ok: false, sous_regle: "CHEMIN_VIDE", index_segment: null };
-  const normalise = chemin.replace(/\\/g, "/");
-  if (normalise.startsWith("/")) return { ok: false, sous_regle: "SEPARATEUR_DEBUT", index_segment: null };
-  if (normalise.endsWith("/")) return { ok: false, sous_regle: "SEPARATEUR_FIN", index_segment: null };
-  const segments = normalise.split("/");
-  for (let i = 0; i < segments.length; i++) {
-    const e = validerSegment(segments[i] ?? "");
-    if (e !== null) return { ok: false, sous_regle: e, index_segment: i };
-  }
-  if (normalise.length > LONGUEUR_MAX_CHEMIN) return { ok: false, sous_regle: "CHEMIN_TROP_LONG", index_segment: null };
-  return { ok: true, segments, normalise };
-}
-
-// ---------------------------------------------------------------------------------------------
-// Racines Windows absolues
-// ---------------------------------------------------------------------------------------------
-
-export interface RacineAnalysee {
-  readonly lecteur: string;
-  readonly segments: readonly string[];
-}
-
-export type AnalyseRacine = { readonly ok: true; readonly racine: RacineAnalysee } | { readonly ok: false; readonly raison: string };
-
-/** Racine de la forme X:\seg\seg… uniquement. UNC, \\?\, \\.\, racine nue, « . » et « .. » refusés. */
-export function analyserRacine(racine: string): AnalyseRacine {
-  if (racine.length > LONGUEUR_MAX_CHEMIN) return { ok: false, raison: "RACINE_TROP_LONGUE" };
-  if (racine.startsWith("\\\\")) return { ok: false, raison: "RACINE_UNC_OU_PREFIXE" };
-  if (!/^[A-Za-z]:\\/u.test(racine)) return { ok: false, raison: "RACINE_FORME_INVALIDE" };
-  if (racine.includes("/")) return { ok: false, raison: "RACINE_SEPARATEUR_INVALIDE" };
-  const reste = racine.slice(3);
-  if (reste.length === 0) return { ok: false, raison: "RACINE_LECTEUR_NUE" };
-  const segments = reste.split("\\");
-  for (const segment of segments) {
-    const e = validerSegment(segment);
-    if (e !== null) return { ok: false, raison: `RACINE_SEGMENT_INVALIDE:${e}` };
-  }
-  return { ok: true, racine: { lecteur: racine.charAt(0), segments } };
-}
-
-// ---------------------------------------------------------------------------------------------
-// Validation des règles d'exclusion (format fermé)
-// ---------------------------------------------------------------------------------------------
-
-export type VerificationRegles =
-  | { readonly ok: true; readonly regles: ReglesExclusion }
-  | { readonly ok: false; readonly raison: string; readonly pointeur: string };
-
-function verifierValeurRegle(type: string, valeur: string): string | null {
-  if (contientSurrogateIsolee(valeur)) return "VALEUR_UNICODE_INVALIDE";
-  if (valeur.normalize("NFC") !== valeur) return "VALEUR_NON_NFC";
-  if (valeur === "." || valeur === "..") return "VALEUR_POINT";
-  for (let i = 0; i < valeur.length; i++) {
-    if (estCaractereControle(valeur.charCodeAt(i))) return "VALEUR_CARACTERE_CONTROLE";
-    if (CARACTERES_INTERDITS.has(valeur.charAt(i))) return "VALEUR_CARACTERE_INTERDIT";
-  }
-  if (type === "nom_exact") {
-    const e = validerSegment(valeur);
-    return e === null ? null : `VALEUR_SEGMENT_INVALIDE:${e}`;
-  }
-  if (type === "prefixe") return valeur.startsWith(" ") ? "VALEUR_ESPACE_DEBUT" : null;
-  if (type === "suffixe") {
-    if (valeur.endsWith(".")) return "VALEUR_POINT_FINAL";
-    if (valeur.endsWith(" ")) return "VALEUR_ESPACE_FIN";
-    return null;
-  }
-  if (type === "contient") {
-    if (valeur.startsWith(" ")) return "VALEUR_ESPACE_DEBUT";
-    if (valeur.endsWith(" ")) return "VALEUR_ESPACE_FIN";
-    return null;
-  }
-  return "TYPE_INCONNU";
-}
-
-/** Valide un objet de règles d'exclusion. Aucune valeur par défaut, aucune reconstruction. */
-export function verifierReglesExclusion(regles: unknown): VerificationRegles {
-  const meta = verifierSchema(schemaReglesExclusion);
-  if (meta !== null) return { ok: false, raison: `SCHEMA_INTERNE:${meta.raison}`, pointeur: meta.pointeur };
-  const e = valider(schemaReglesExclusion, regles);
-  if (e !== null) return { ok: false, raison: e.raison, pointeur: e.pointeur };
-  const r = regles as ReglesExclusion;
-  const ids = new Set<string>();
-  const couples = new Set<string>();
-  const parcours: ReadonlyArray<readonly [string, readonly (RegleInterdite | RegleSecret)[]]> = [
-    ["segments_interdits", r.segments_interdits],
-    ["secrets", r.secrets],
-  ];
-  for (const [categorie, liste] of parcours) {
-    for (let i = 0; i < liste.length; i++) {
-      const regle = liste[i];
-      if (regle === undefined) continue;
-      const pointeur = `/${categorie}/${i}`;
-      if (ids.has(regle.id)) return { ok: false, raison: "ID_EN_DOUBLE", pointeur: `${pointeur}/id` };
-      ids.add(regle.id);
-      const v = verifierValeurRegle(regle.type, regle.valeur);
-      if (v !== null) return { ok: false, raison: v, pointeur: `${pointeur}/valeur` };
-      const couple = `${regle.type}\u0000${regle.valeur.toUpperCase()}`;
-      if (couples.has(couple)) return { ok: false, raison: "REGLE_EN_DOUBLE", pointeur };
-      couples.add(couple);
-    }
-  }
-  if (!r.segments_interdits.some((x) => x.valeur.toUpperCase() === "FASTCLIP")) {
-    return { ok: false, raison: "REGLE_FASTCLIP_ABSENTE", pointeur: "/segments_interdits" };
-  }
-  return { ok: true, regles: r };
-}
-
-// ---------------------------------------------------------------------------------------------
-// Correspondances et evaluerChemin
-// ---------------------------------------------------------------------------------------------
-
 function rangCategorie(c: CategorieExclusion): number {
   return c === "interdit" ? 0 : 1;
 }
 
 function comparerCorrespondances(a: Correspondance, b: Correspondance): number {
   if (a.index_segment !== b.index_segment) return a.index_segment - b.index_segment;
   const r = rangCategorie(a.categorie) - rangCategorie(b.categorie);
   if (r !== 0) return r;
   return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
 }
 
 /**
- * Toutes les correspondances des segments avec les règles (comparaison en majuscules), triées
- * par index de segment, puis catégorie (interdit avant secret), puis id.
+ * Interne. Toutes les correspondances des segments avec les règles (comparaison en majuscules),
+ * triées par index de segment, puis catégorie (interdit avant secret), puis id. N'est appelée que
+ * par evaluerChemin, avec les règles qu'elle vient de lire dans le registre privé.
  */
-export function correspondancesSegments(segments: readonly string[], regles: ReglesExclusion): Correspondance[] {
+function correspondancesSegments(segments: readonly string[], regles: ReglesExclusion): Correspondance[] {
   const resultat: Correspondance[] = [];
   for (let i = 0; i < segments.length; i++) {
     const segment = (segments[i] ?? "").toUpperCase();
     for (const r of regles.segments_interdits) {
       if (segment.includes(r.valeur.toUpperCase())) resultat.push({ index_segment: i, categorie: "interdit", id: r.id });
     }
     for (const r of regles.secrets) {
       const valeur = r.valeur.toUpperCase();
       const correspond =
         r.type === "nom_exact" ? segment === valeur : r.type === "prefixe" ? segment.startsWith(valeur) : segment.endsWith(valeur);
       if (correspond) resultat.push({ index_segment: i, categorie: "secret", id: r.id });
     }
   }
   return resultat.sort(comparerCorrespondances);
 }
 
 /**
- * Évaluation unique d'un chemin relatif.
- * 1. Règles invalides ou incomplètes : erreur_regles, sans évaluation du chemin.
+ * API publique. Évaluation unique d'un chemin relatif.
+ * 1. Jeton non enregistré : erreur_configuration / PROVENANCE_NON_GARANTIE, sans évaluation.
  * 2. Syntaxe invalide : invalide.
  * 3. Aucune correspondance : autorise.
  * 4. Sinon : code CHEMIN_INTERDIT si une correspondance « interdit » existe n'importe où, sinon
  *    CHEMIN_SECRET ; racine d'exclusion = préfixe qui s'arrête au segment le moins profond ayant
  *    une correspondance, quelle que soit sa catégorie.
  */
-export function evaluerChemin(cheminRelatif: unknown, regles: unknown): ResultatEvaluation {
-  const verification = verifierReglesExclusion(regles);
-  if (!verification.ok) {
-    return {
-      statut: "erreur_regles",
-      code: "REGLES_EXCLUSION_INVALIDES",
-      detail: { raison: verification.raison, pointeur: verification.pointeur },
-    };
-  }
+export function evaluerChemin(cheminRelatif: unknown, configuration: unknown): ResultatEvaluation {
+  const contenu = contenuDuJeton(configuration);
+  if (contenu === undefined) return { statut: "erreur_configuration", code: "PROVENANCE_NON_GARANTIE" };
   if (typeof cheminRelatif !== "string") {
     return { statut: "invalide", code: "CHEMIN_INVALIDE", sous_regle: "TYPE", index_segment: null };
   }
   const analyse = analyserCheminRelatif(cheminRelatif);
   if (!analyse.ok) {
     return { statut: "invalide", code: "CHEMIN_INVALIDE", sous_regle: analyse.sous_regle, index_segment: analyse.index_segment };
   }
-  const correspondances = correspondancesSegments(analyse.segments, verification.regles);
+  const correspondances = correspondancesSegments(analyse.segments, contenu.regles_chemins.exclusion);
   const premiere = correspondances[0];
   if (premiere === undefined) return { statut: "autorise", chemin_normalise: analyse.normalise };
   const interdite = correspondances.find((c) => c.categorie === "interdit");
   const regleCode = interdite ?? premiere;
   return {
     statut: "exclu",
     code: interdite !== undefined ? "CHEMIN_INTERDIT" : "CHEMIN_SECRET",
     categorie: regleCode.categorie,
     racine_exclusion: analyse.segments.slice(0, premiere.index_segment + 1).join("/"),
     index_racine: premiere.index_segment,
     regle_racine: { categorie: premiere.categorie, id: premiere.id },
     regle_code: { categorie: regleCode.categorie, id: regleCode.id },
     correspondances,
   };
 }
```

## Fichier 07 — src/mission/perimetre.ts

- Statut : modifié
- SHA-256 initial : a55e52742c29754bd08bd6b34822c41e4d9843547887168dbb5ae0edc35b5cd7
- SHA-256 final : 0361b5ef40203ed6cd7a96d47b3d839455c23e4dba271634b0771050ca92d98e
- Taille finale : 2125 octets, 35 lignes

```diff
--- a/src/mission/perimetre.ts
+++ b/src/mission/perimetre.ts
@@ -1,67 +1,35 @@
-// Contrôle d'une entrée du périmètre (lecture ou écriture) d'une mission Bridge v1.
+// Analyse syntaxique des jokers d'une entrée du périmètre d'une mission Bridge v1.
+//
+// Export TECHNIQUE : ce module ne consulte aucune règle ni aucune racine et ne dit JAMAIS qu'une
+// entrée est autorisée. Il sépare seulement la partie littérale d'un éventuel joker final.
+// Le contrôle complet d'une entrée (règles d'exclusion, longueur assemblée avec la racine,
+// inclusion dans la racine) est interne au calcul de la politique (politique.ts), qui exige un
+// jeton de configuration validée.
 //
 // Ordre fixe, le premier refus l'emporte :
 //   1. normalisation des séparateurs ;
 //   2. jokers (* ou ?) : seul → JOKER_RACINE_INTERDIT ; ailleurs que comme dernier segment entier
-//      → JOKER_NON_AUTORISE ; sinon le joker final est retiré ;
-//   3. evaluerChemin sur la partie littérale, dont le code est repris tel quel ;
-//   4. joker final présent → MOTIF_PEUT_COUVRIR_CHEMIN_INTERDIT (tout joker est refusé en v1 : un
-//      joker peut produire n'importe quel nom, y compris un nom contenant un segment interdit) ;
-//   5. longueur assemblée avec la racine, puis inclusion structurelle (HORS_RACINE).
-// Chaque entrée désigne UN FICHIER. Le futur orchestrateur devra refuser une entrée qui correspond
-// en réalité à un dossier ou à un lien (contrôle physique, hors du noyau).
-
-import { evaluerChemin, LONGUEUR_MAX_CHEMIN, type RacineAnalysee, type ReglesExclusion } from "./chemins.ts";
-import { CODES, refus, type Refus } from "./erreurs.ts";
-
-export interface EntreeAcceptee {
-  readonly ok: true;
-  readonly relatif: string;
-  readonly segments: readonly string[];
-  readonly absolu: string;
-}
+//      (* ou **) → JOKER_NON_AUTORISE ; sinon le joker final est retiré et signalé.
+// Tout joker final restant est refusé en v1 par le calcul de la politique
+// (MOTIF_PEUT_COUVRIR_CHEMIN_INTERDIT), après l'évaluation de la partie littérale.
+
+export type AnalyseEntreePerimetre =
+  | { readonly ok: true; readonly litteral: string; readonly jokerFinal: boolean }
+  | { readonly ok: false; readonly code: "JOKER_RACINE_INTERDIT" | "JOKER_NON_AUTORISE" | "CHEMIN_INVALIDE" };
 
 function estJoker(segment: string): boolean {
   return segment.includes("*") || segment.includes("?");
 }
 
-export function controlerEntree(entree: string, racine: RacineAnalysee, regles: ReglesExclusion): EntreeAcceptee | Refus {
+/** Syntaxe des jokers seulement. Une entrée qui n'est pas une chaîne est refusée (CHEMIN_INVALIDE). */
+export function analyserEntreePerimetre(entree: unknown): AnalyseEntreePerimetre {
+  if (typeof entree !== "string") return { ok: false, code: "CHEMIN_INVALIDE" };
   const normalise = entree.replace(/\\/g, "/");
-  let litteral = normalise;
-  let jokerFinal = false;
-
-  if (estJoker(normalise)) {
-    if (normalise === "*" || normalise === "**") return refus(CODES.JOKER_RACINE_INTERDIT, entree);
-    const parties = normalise.split("/");
-    const derniere = parties[parties.length - 1] ?? "";
-    const avant = parties.slice(0, -1);
-    if ((derniere !== "*" && derniere !== "**") || avant.some(estJoker)) return refus(CODES.JOKER_NON_AUTORISE, entree);
-    litteral = avant.join("/");
-    jokerFinal = true;
-  }
-
-  const evaluation = evaluerChemin(litteral, regles);
-  if (evaluation.statut === "erreur_regles") return refus(CODES.CONFIGURATION_INVALIDE, entree, { ...evaluation.detail });
-  if (evaluation.statut === "invalide") {
-    return refus(CODES.CHEMIN_INVALIDE, entree, { sous_regle: evaluation.sous_regle, index_segment: evaluation.index_segment });
-  }
-  if (evaluation.statut === "exclu") {
-    return refus(evaluation.code === "CHEMIN_INTERDIT" ? CODES.CHEMIN_INTERDIT : CODES.CHEMIN_SECRET, entree, {
-      racine_exclusion: evaluation.racine_exclusion,
-      regle_racine: evaluation.regle_racine,
-      regle_code: evaluation.regle_code,
-    });
-  }
-  if (jokerFinal) return refus(CODES.MOTIF_PEUT_COUVRIR_CHEMIN_INTERDIT, entree);
-
-  const segments = evaluation.chemin_normalise.split("/");
-  const absolus = [...racine.segments, ...segments];
-  const absolu = `${racine.lecteur}:\\${absolus.join("\\")}`;
-  if (absolu.length > LONGUEUR_MAX_CHEMIN) return refus(CODES.CHEMIN_INVALIDE, entree, { sous_regle: "CHEMIN_TROP_LONG", index_segment: null });
-
-  // Défense supplémentaire : inclusion structurelle segment par segment, sans tenir compte de la casse.
-  for (let i = 0; i < racine.segments.length; i++) {
-    if ((absolus[i] ?? "").toUpperCase() !== (racine.segments[i] ?? "").toUpperCase()) return refus(CODES.HORS_RACINE, entree);
-  }
-  return { ok: true, relatif: evaluation.chemin_normalise, segments, absolu };
+  if (!estJoker(normalise)) return { ok: true, litteral: normalise, jokerFinal: false };
+  if (normalise === "*" || normalise === "**") return { ok: false, code: "JOKER_RACINE_INTERDIT" };
+  const parties = normalise.split("/");
+  const derniere = parties[parties.length - 1] ?? "";
+  const avant = parties.slice(0, -1);
+  if ((derniere !== "*" && derniere !== "**") || avant.some(estJoker)) return { ok: false, code: "JOKER_NON_AUTORISE" };
+  return { ok: true, litteral: avant.join("/"), jokerFinal: true };
 }
```

## Fichier 08 — src/mission/classification.ts

- Statut : modifié
- SHA-256 initial : 42cc7e32fed3c3e5bfde8fd48ef0bc5b552a8b26a16a4049a8153ccb8610fbf4
- SHA-256 final : 197a53efcb6c548b9d011f2a68a7e472ba300c7e144734a26db78be350ef9471
- Taille finale : 1280 octets, 32 lignes

```diff
--- a/src/mission/classification.ts
+++ b/src/mission/classification.ts
@@ -1,98 +1,32 @@
-// Classification des missions Bridge v1.
+// Classes de mission de Bridge v1 (D-03).
 //
-// Classe effective = max(classe demandée, classe détectée). La détection ne produit que
-// « sensible » : un chemin d'écriture est sensible s'il contient, à n'importe quelle profondeur,
-// un nom de fichier sensible (dernier segment) ou un nom de dossier sensible (n'importe quel
-// segment), ou s'il touche un préfixe sensible (dedans, égal ou parent, en segments entiers).
-// Comparaisons en majuscules. La classe n'est jamais abaissée.
-
-import { analyserCheminRelatif, validerSegment } from "./chemins.ts";
+// Ce module ne contient que des types et la comparaison des classes. La DÉTECTION de la
+// sensibilité est interne au calcul de la politique (politique.ts) : elle n'est appliquée qu'aux
+// entrées d'écriture acceptées, avec les règles lues dans le registre privé à partir du jeton de
+// configuration validée. Aucune fonction exportée ne classe un tableau de chemins fourni par
+// l'appelant.
+//
+// Classe effective = max(classe demandée, classe détectée). Seule une écriture sensible déclenche
+// une élévation. La classe n'est jamais abaissée.
 
 export type Classe = "simple" | "complexe" | "sensible";
 
-const RANG: Readonly<Record<Classe, number>> = { simple: 0, complexe: 1, sensible: 2 };
+const RANG: Readonly<Record<Classe, number>> = Object.freeze({ simple: 0, complexe: 1, sensible: 2 });
 
 export function classeMax(a: Classe, b: Classe): Classe {
   return RANG[b] > RANG[a] ? b : a;
 }
 
 export interface ReglesClassification {
   readonly fichiers_sensibles: readonly string[];
   readonly dossiers_sensibles: readonly string[];
   readonly prefixes_sensibles: readonly string[];
 }
 
 export type RegleSensible = "fichier_sensible" | "dossier_sensible" | "prefixe_sensible";
 
 export interface RaisonElevation {
   readonly chemin: string;
   readonly regle: RegleSensible;
   readonly valeur: string;
 }
-
-export interface CheminAnalyse {
-  readonly relatif: string;
-  readonly segments: readonly string[];
-}
-
-/** Contrôle des règles de classification (configuration). */
-export function verifierReglesClassification(r: ReglesClassification): { readonly raison: string; readonly pointeur: string } | null {
-  const listes: ReadonlyArray<readonly [string, readonly string[]]> = [
-    ["fichiers_sensibles", r.fichiers_sensibles],
-    ["dossiers_sensibles", r.dossiers_sensibles],
-  ];
-  for (const [nom, liste] of listes) {
-    for (let i = 0; i < liste.length; i++) {
-      const e = validerSegment(liste[i] ?? "");
-      if (e !== null) return { raison: `SEGMENT_INVALIDE:${e}`, pointeur: `/${nom}/${i}` };
-    }
-  }
-  for (let i = 0; i < r.prefixes_sensibles.length; i++) {
-    const a = analyserCheminRelatif(r.prefixes_sensibles[i] ?? "");
-    if (!a.ok) return { raison: `PREFIXE_INVALIDE:${a.sous_regle}`, pointeur: `/prefixes_sensibles/${i}` };
-  }
-  return null;
-}
-
-function majuscules(liste: readonly string[]): string[] {
-  return liste.map((s) => s.toUpperCase());
-}
-
-/** Raisons d'élévation pour les chemins d'écriture, triées de façon déterministe. */
-export function detecterSensibilite(chemins: readonly CheminAnalyse[], regles: ReglesClassification): RaisonElevation[] {
-  const fichiers = new Map(regles.fichiers_sensibles.map((f) => [f.toUpperCase(), f] as const));
-  const dossiers = new Map(regles.dossiers_sensibles.map((d) => [d.toUpperCase(), d] as const));
-  const prefixes = regles.prefixes_sensibles.map((p) => ({ texte: p, segments: majuscules(p.replace(/\\/g, "/").split("/")) }));
-  const raisons: RaisonElevation[] = [];
-
-  for (const chemin of chemins) {
-    const segments = majuscules(chemin.segments);
-    const dernier = segments[segments.length - 1] ?? "";
-    const fichier = fichiers.get(dernier);
-    if (fichier !== undefined) raisons.push({ chemin: chemin.relatif, regle: "fichier_sensible", valeur: fichier });
-    const dossiersVus = new Set<string>();
-    for (const segment of segments) {
-      const dossier = dossiers.get(segment);
-      if (dossier !== undefined && !dossiersVus.has(dossier)) {
-        dossiersVus.add(dossier);
-        raisons.push({ chemin: chemin.relatif, regle: "dossier_sensible", valeur: dossier });
-      }
-    }
-    for (const prefixe of prefixes) {
-      const n = Math.min(prefixe.segments.length, segments.length);
-      let egaux = n > 0;
-      for (let i = 0; i < n && egaux; i++) egaux = segments[i] === prefixe.segments[i];
-      // Dedans (chemin plus long), égal, ou parent (chemin plus court) : sensible.
-      if (egaux) raisons.push({ chemin: chemin.relatif, regle: "prefixe_sensible", valeur: prefixe.texte });
-    }
-  }
-
-  return raisons.sort((a, b) => {
-    const ca = a.chemin.toUpperCase();
-    const cb = b.chemin.toUpperCase();
-    if (ca !== cb) return ca < cb ? -1 : 1;
-    if (a.chemin !== b.chemin) return a.chemin < b.chemin ? -1 : 1;
-    if (a.regle !== b.regle) return a.regle < b.regle ? -1 : 1;
-    return a.valeur < b.valeur ? -1 : a.valeur > b.valeur ? 1 : 0;
-  });
-}
```

