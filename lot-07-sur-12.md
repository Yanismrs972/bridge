# Bridge v1 — correction de provenance — lot 07 sur 12

Référence : commit ffc0e3b (docs/REFERENCE.md) et livrable 1 (fichiers non suivis). Diff unifié à contexte complet : chaque diff contient le fichier entier ; les lignes « - » et « » donnent le contenu initial, les lignes « + » et « » le contenu final.

## Fichier 16 — test/mission/chemins.test.ts

- Statut : modifié
- SHA-256 initial : 5e1b54cae4be0705c4d6b521a7b053d3280b4500b9b2654cddb36e7f5a0302d8
- SHA-256 final : 8459785a6b8a93103a75a77ac21195fdb2c8c7e247a044ddd8706f58e24db753
- Taille finale : 14031 octets, 324 lignes

```diff
--- a/test/mission/chemins.test.ts
+++ b/test/mission/chemins.test.ts
@@ -1,262 +1,324 @@
-// Tests de evaluerChemin, des règles d'exclusion, des propriétés P1 à P4 et du contrôle du périmètre.
+// Tests de evaluerChemin (avec jeton), des règles d'exclusion (par la configuration en texte),
+// des propriétés P1 à P4, de la syntaxe des jokers et du contrôle du périmètre (par
+// calculerPolitiqueTexte, seul point d'entrée du contrôle complet).
 
 import { test } from "node:test";
 import assert from "node:assert/strict";
+import profils from "../../config/profils.json" with { type: "json" };
 import reglesChemins from "../../config/regles-chemins.json" with { type: "json" };
 import vecteurs from "../vecteurs/chemins.json" with { type: "json" };
-import {
-  analyserRacine,
-  evaluerChemin,
-  verifierReglesExclusion,
-  type RacineAnalysee,
-  type ReglesExclusion,
-  type ResultatEvaluation,
-} from "../../src/mission/chemins.ts";
-import { controlerEntree } from "../../src/mission/perimetre.ts";
+import { evaluerChemin, type ResultatEvaluation } from "../../src/mission/chemins.ts";
+import { validerConfigurationTexte, type ConfigurationValidee } from "../../src/mission/configuration.ts";
+import { analyserEntreePerimetre } from "../../src/mission/perimetre.ts";
+import { calculerPolitiqueTexte, type ResultatPolitique } from "../../src/mission/politique.ts";
 
 type Cle = string | number;
 
 interface Operation {
   readonly type: "definir" | "supprimer" | "pousser" | "echanger";
   readonly chemin: readonly Cle[];
   readonly valeur?: unknown;
   readonly i?: number;
   readonly j?: number;
 }
 
 interface Designee {
   readonly categorie: string;
   readonly id: string;
 }
 
 interface VecteursChemins {
   readonly evaluation: ReadonlyArray<{
     readonly nom: string;
     readonly chemin: string;
     readonly attendu: {
       readonly statut: string;
       readonly code?: string;
       readonly racine_exclusion?: string;
       readonly regle_racine?: string;
       readonly sous_regle?: string;
       readonly index_segment?: number;
       readonly chemin_normalise?: string;
     };
   }>;
   readonly correspondances_completes: ReadonlyArray<{
     readonly chemin: string;
     readonly code: string;
     readonly racine_exclusion: string;
     readonly regle_racine: Designee;
     readonly regle_code: Designee;
     readonly correspondances: ReadonlyArray<{ readonly index_segment: number; readonly categorie: string; readonly id: string }>;
   }>;
   readonly prefixes: readonly string[];
   readonly prefixes_explicites: ReadonlyArray<{
     readonly chemin: string;
     readonly statut: string;
     readonly racine_exclusion?: string;
     readonly code?: string;
   }>;
   readonly perimetre: ReadonlyArray<{
     readonly nom: string;
     readonly entree: string;
     readonly attendu: { readonly ok: boolean; readonly code?: string; readonly absolu?: string };
   }>;
   readonly regles_invalides: ReadonlyArray<{ readonly nom: string; readonly operations: readonly Operation[] }>;
   readonly regles_valides: ReadonlyArray<{ readonly nom: string; readonly operations: readonly Operation[] }>;
+  readonly regles_sous_plancher: ReadonlyArray<{
+    readonly nom: string;
+    readonly operations: readonly Operation[];
+    readonly attendu: { readonly categorie: string; readonly id: string; readonly raison: string };
+  }>;
+  readonly jokers: ReadonlyArray<{
+    readonly nom: string;
+    readonly entree: string;
+    readonly attendu: { readonly ok: boolean; readonly code?: string; readonly litteral?: string; readonly jokerFinal?: boolean };
+  }>;
 }
 
 const V = vecteurs as unknown as VecteursChemins;
 
+const CONTEXTE = { racine_autorisee: "C:\\Users\\demo\\projets\\exemple", racine_bridge: "C:\\Outils\\bridge" };
+
 function copie<T>(v: T): T {
   return JSON.parse(JSON.stringify(v)) as T;
 }
 
 function naviguer(racine: unknown, chemin: readonly Cle[]): Record<string, unknown> {
   let cible: unknown = racine;
   for (const cle of chemin) cible = (cible as Record<string, unknown>)[String(cle)];
   return cible as Record<string, unknown>;
 }
 
 function appliquer(racine: unknown, op: Operation): void {
   if (op.type === "pousser") {
     (naviguer(racine, op.chemin) as unknown as unknown[]).push(op.valeur);
     return;
   }
   if (op.type === "echanger") {
     const t = naviguer(racine, op.chemin) as unknown as unknown[];
     const i = op.i ?? 0;
     const j = op.j ?? 1;
     const x = t[i];
     t[i] = t[j];
     t[j] = x;
     return;
   }
   const parent = naviguer(racine, op.chemin.slice(0, -1));
   const derniere = String(op.chemin[op.chemin.length - 1]);
   if (op.type === "definir") {
     parent[derniere] = op.valeur;
     return;
   }
   if (Array.isArray(parent)) parent.splice(Number(derniere), 1);
   else delete parent[derniere];
 }
 
-function reglesParDefaut(): ReglesExclusion {
-  const v = verifierReglesExclusion(copie(reglesChemins.exclusion));
-  if (!v.ok) throw new Error(`règles par défaut invalides : ${v.raison} ${v.pointeur}`);
-  return v.regles;
+/** Texte de regles-chemins dont la partie « exclusion » a subi les opérations. */
+function texteReglesAvecExclusion(operations: readonly Operation[]): string {
+  const rc = copie(reglesChemins) as unknown as Record<string, unknown>;
+  for (const op of operations) appliquer(rc["exclusion"], op);
+  return JSON.stringify(rc);
 }
 
-function racineDeTest(): RacineAnalysee {
-  const r = analyserRacine("C:\\Users\\demo\\projets\\exemple");
-  if (!r.ok) throw new Error(`racine de test invalide : ${r.raison}`);
-  return r.racine;
+function jetonDeReference(): ConfigurationValidee {
+  const r = validerConfigurationTexte(JSON.stringify(profils), JSON.stringify(reglesChemins));
+  if (!r.ok) throw new Error(`configuration de référence refusée : ${r.code} ${JSON.stringify(r.detail)}`);
+  return r.configuration;
 }
 
-const REGLES = reglesParDefaut();
-const RACINE = racineDeTest();
+const JETON = jetonDeReference();
 
 function exclu(r: ResultatEvaluation, message: string): Extract<ResultatEvaluation, { statut: "exclu" }> {
   if (r.statut !== "exclu") throw new Error(`${message} : statut ${r.statut} au lieu de exclu`);
   return r;
 }
 
-test("chemins : les règles par défaut sont valides", () => {
-  assert.equal(verifierReglesExclusion(copie(reglesChemins.exclusion)).ok, true);
+function politiqueUneEcriture(entree: string): ResultatPolitique {
+  const mission = {
+    version: "1",
+    id: "M-chemins-01",
+    objectif: "Test du périmètre.",
+    criteres_acceptation: [{ id: "A1", description: "x" }],
+    perimetre: { ecriture: [entree] },
+    classe_demandee: "simple",
+  };
+  return calculerPolitiqueTexte(JSON.stringify(mission), JSON.stringify(CONTEXTE), JETON);
+}
+
+test("chemins : la configuration de référence est acceptée", () => {
+  const r = validerConfigurationTexte(JSON.stringify(profils), JSON.stringify(reglesChemins));
+  assert.equal(r.ok, true);
 });
 
 test("chemins : vecteurs d'évaluation", () => {
   for (const v of V.evaluation) {
-    const r = evaluerChemin(v.chemin, REGLES);
+    const r = evaluerChemin(v.chemin, JETON);
     assert.equal(r.statut, v.attendu.statut, v.nom);
     if (r.statut === "exclu") {
       if (v.attendu.code !== undefined) assert.equal(r.code, v.attendu.code, v.nom);
       if (v.attendu.racine_exclusion !== undefined) assert.equal(r.racine_exclusion, v.attendu.racine_exclusion, v.nom);
       if (v.attendu.regle_racine !== undefined) assert.equal(r.regle_racine.id, v.attendu.regle_racine, v.nom);
     }
     if (r.statut === "invalide") {
       assert.equal(r.code, "CHEMIN_INVALIDE", v.nom);
       if (v.attendu.sous_regle !== undefined) assert.equal(r.sous_regle, v.attendu.sous_regle, v.nom);
       if (v.attendu.index_segment !== undefined) assert.equal(r.index_segment, v.attendu.index_segment, v.nom);
     }
     if (r.statut === "autorise" && v.attendu.chemin_normalise !== undefined) {
       assert.equal(r.chemin_normalise, v.attendu.chemin_normalise, v.nom);
     }
   }
 });
 
 test("chemins : limites de longueur", () => {
-  assert.equal(evaluerChemin("a".repeat(255), REGLES).statut, "autorise");
-  const segmentTropLong = evaluerChemin("a".repeat(256), REGLES);
+  assert.equal(evaluerChemin("a".repeat(255), JETON).statut, "autorise");
+  const segmentTropLong = evaluerChemin("a".repeat(256), JETON);
   assert.equal(segmentTropLong.statut === "invalide" ? segmentTropLong.sous_regle : null, "SEGMENT_TROP_LONG");
   const chemin240 = "abcdefghi/".repeat(23) + "abcdefghij";
   assert.equal(chemin240.length, 240);
-  assert.equal(evaluerChemin(chemin240, REGLES).statut, "autorise");
+  assert.equal(evaluerChemin(chemin240, JETON).statut, "autorise");
   const chemin241 = chemin240 + "k";
-  const r = evaluerChemin(chemin241, REGLES);
+  const r = evaluerChemin(chemin241, JETON);
   assert.equal(r.statut === "invalide" ? r.sous_regle : null, "CHEMIN_TROP_LONG");
 });
 
 test("chemins : correspondances complètes et priorités", () => {
   for (const v of V.correspondances_completes) {
-    const r = exclu(evaluerChemin(v.chemin, REGLES), v.chemin);
+    const r = exclu(evaluerChemin(v.chemin, JETON), v.chemin);
     assert.equal(r.code, v.code, v.chemin);
     assert.equal(r.racine_exclusion, v.racine_exclusion, v.chemin);
     assert.deepEqual(r.regle_racine, v.regle_racine, v.chemin);
     assert.deepEqual(r.regle_code, v.regle_code, v.chemin);
     assert.deepEqual(r.correspondances, v.correspondances, v.chemin);
   }
 });
 
 test("chemins : propriétés P1 à P4 du préfixe", () => {
   for (const chemin of V.prefixes) {
-    const complet = exclu(evaluerChemin(chemin, REGLES), chemin);
+    const complet = exclu(evaluerChemin(chemin, JETON), chemin);
     const k = complet.index_racine;
     const segments = chemin.split("/");
     for (let n = 1; n <= segments.length; n++) {
       const q = segments.slice(0, n).join("/");
-      const r = evaluerChemin(q, REGLES);
+      const r = evaluerChemin(q, JETON);
       if (r.statut === "invalide") continue;
       if (n <= k) {
         assert.equal(r.statut, "autorise", `P2 ${q}`);
         continue;
       }
       const e = exclu(r, `P1 ${q}`);
       assert.equal(e.racine_exclusion, complet.racine_exclusion, `P1 racine ${q}`);
       assert.equal(e.index_racine, complet.index_racine, `P1 index ${q}`);
       assert.deepEqual(e.regle_racine, complet.regle_racine, `P1 règle ${q}`);
       const interditAvant = complet.correspondances.some((c) => c.categorie === "interdit" && c.index_segment < n);
       assert.equal(e.code, interditAvant ? "CHEMIN_INTERDIT" : "CHEMIN_SECRET", `P3 ${q}`);
       assert.deepEqual(
         e.correspondances,
         complet.correspondances.filter((c) => c.index_segment < n),
         `P4 ${q}`,
       );
     }
   }
 });
 
 test("chemins : exemples explicites de la propriété du préfixe", () => {
   for (const v of V.prefixes_explicites) {
-    const r = evaluerChemin(v.chemin, REGLES);
+    const r = evaluerChemin(v.chemin, JETON);
     assert.equal(r.statut, v.statut, v.chemin);
     if (r.statut === "exclu") {
       assert.equal(r.racine_exclusion, v.racine_exclusion, v.chemin);
       assert.equal(r.code, v.code, v.chemin);
     }
   }
 });
 
-test("chemins : règles mal formées", () => {
+test("chemins : règles mal formées refusées par validerConfigurationTexte", () => {
   for (const v of V.regles_invalides) {
+    const r = validerConfigurationTexte(JSON.stringify(profils), texteReglesAvecExclusion(v.operations));
+    assert.equal(r.ok ? "ok" : r.code, "CONFIGURATION_INVALIDE", v.nom);
+    // Les mêmes règles, passées directement à la place du jeton, ne sont jamais évaluées.
     const regles = copie(reglesChemins.exclusion) as unknown;
     for (const op of v.operations) appliquer(regles, op);
-    assert.equal(verifierReglesExclusion(regles).ok, false, v.nom);
-    const r = evaluerChemin("src/application.ts", regles);
-    assert.equal(r.statut, "erreur_regles", `${v.nom} : aucune évaluation avec des règles invalides`);
+    const e = evaluerChemin("src/application.ts", regles);
+    assert.equal(e.statut, "erreur_configuration", `${v.nom} : aucune évaluation avec des règles fournies directement`);
   }
 });
 
-test("chemins : règles valides aux limites", () => {
+test("chemins : règles valides aux limites (règles ajoutées)", () => {
   for (const v of V.regles_valides) {
-    const regles = copie(reglesChemins.exclusion) as unknown;
-    for (const op of v.operations) appliquer(regles, op);
-    const r = verifierReglesExclusion(regles);
-    assert.equal(r.ok, true, `${v.nom} ${r.ok ? "" : `${r.raison} ${r.pointeur}`}`);
+    const r = validerConfigurationTexte(JSON.stringify(profils), texteReglesAvecExclusion(v.operations));
+    assert.equal(r.ok, true, `${v.nom} ${r.ok ? "" : `${r.code} ${JSON.stringify(r.detail)}`}`);
   }
 });
 
-test("chemins : règles partielles refusées par evaluerChemin", () => {
+test("chemins : définitions du plancher modifiées refusées", () => {
+  for (const v of V.regles_sous_plancher) {
+    const r = validerConfigurationTexte(JSON.stringify(profils), texteReglesAvecExclusion(v.operations));
+    assert.equal(r.ok ? "ok" : r.code, "PLANCHER_SECURITE_NON_RESPECTE", v.nom);
+    if (!r.ok) {
+      assert.equal(r.detail["categorie"], v.attendu.categorie, v.nom);
+      assert.equal(r.detail["id"], v.attendu.id, v.nom);
+      assert.equal(r.detail["raison"], v.attendu.raison, v.nom);
+    }
+  }
+});
+
+test("chemins : règles partielles, absentes ou forgées refusées par evaluerChemin", () => {
   const sansSecrets = copie(reglesChemins.exclusion) as unknown as Record<string, unknown>;
   delete sansSecrets["secrets"];
-  assert.equal(evaluerChemin("src/a.ts", sansSecrets).statut, "erreur_regles");
-  assert.equal(evaluerChemin("src/a.ts", null).statut, "erreur_regles");
+  for (const [nom, valeur] of [
+    ["règles sans secrets", sansSecrets],
+    ["règles complètes", copie(reglesChemins.exclusion)],
+    ["null", null],
+    ["undefined", undefined],
+  ] as const) {
+    const r = evaluerChemin("src/a.ts", valeur);
+    assert.equal(r.statut, "erreur_configuration", nom);
+    if (r.statut === "erreur_configuration") assert.equal(r.code, "PROVENANCE_NON_GARANTIE", nom);
+  }
 });
 
-test("chemins : contrôle du périmètre", () => {
-  for (const v of V.perimetre) {
-    const r = controlerEntree(v.entree, RACINE, REGLES);
+test("chemins : syntaxe des jokers (analyserEntreePerimetre)", () => {
+  for (const v of V.jokers) {
+    const r = analyserEntreePerimetre(v.entree);
     assert.equal(r.ok, v.attendu.ok, v.nom);
+    if (!r.ok) assert.equal(r.code, v.attendu.code, v.nom);
+    else {
+      assert.equal(r.litteral, v.attendu.litteral, v.nom);
+      assert.equal(r.jokerFinal, v.attendu.jokerFinal, v.nom);
+      // La syntaxe ne dit jamais qu'une entrée est autorisée.
+      assert.deepEqual(Object.keys(r).sort(), ["jokerFinal", "litteral", "ok"], v.nom);
+    }
+  }
+  assert.equal(analyserEntreePerimetre(42).ok, false, "entrée qui n'est pas une chaîne");
+});
+
+test("chemins : contrôle du périmètre (par calculerPolitiqueTexte)", () => {
+  for (const v of V.perimetre) {
+    const r = politiqueUneEcriture(v.entree);
+    assert.equal(r.ok, v.attendu.ok, `${v.nom} ${r.ok ? "" : `${r.code} ${JSON.stringify(r.detail)}`}`);
     if (!r.ok && v.attendu.code !== undefined) assert.equal(r.code, v.attendu.code, v.nom);
-    if (r.ok && v.attendu.absolu !== undefined) assert.equal(r.absolu, v.attendu.absolu, v.nom);
+    if (r.ok && v.attendu.absolu !== undefined) assert.deepEqual(r.politique.perimetre_ecriture, [v.attendu.absolu], v.nom);
   }
   // Racine de 29 caractères + séparateur + 211 caractères = 241 caractères.
   const limite = "abcdefghi/".repeat(20) + "abcdefghij";
-  assert.equal(controlerEntree(limite, RACINE, REGLES).ok, true, "longueur assemblée de 240 acceptée");
+  assert.equal(politiqueUneEcriture(limite).ok, true, "longueur assemblée de 240 acceptée");
   const long = limite + "k";
-  const r = controlerEntree(long, RACINE, REGLES);
+  const r = politiqueUneEcriture(long);
   assert.equal(r.ok ? null : r.code, "CHEMIN_INVALIDE", "longueur assemblée avec la racine supérieure à 240");
 });
 
 test("chemins : cohérence entre le contrôle du périmètre et evaluerChemin", () => {
   for (const v of V.evaluation) {
     if (/[*?]/u.test(v.chemin)) continue;
-    const e = evaluerChemin(v.chemin, REGLES);
-    const p = controlerEntree(v.chemin, RACINE, REGLES);
-    if (e.statut === "autorise") assert.equal(p.ok, true, v.nom);
+    // Exception documentée : le chemin vide est refusé plus tôt par le schéma de la mission
+    // (MISSION_INVALIDE) ; il reste couvert par les vecteurs d'évaluation.
+    if (v.chemin.length === 0) continue;
+    const e = evaluerChemin(v.chemin, JETON);
+    const p = politiqueUneEcriture(v.chemin);
+    if (e.statut === "autorise") assert.equal(p.ok, true, `${v.nom} ${p.ok ? "" : p.code}`);
     else if (e.statut === "invalide") assert.equal(p.ok ? null : p.code, "CHEMIN_INVALIDE", v.nom);
     else if (e.statut === "exclu") assert.equal(p.ok ? null : p.code, e.code, v.nom);
+    else assert.fail(`${v.nom} : statut inattendu ${e.statut}`);
   }
 });
```

