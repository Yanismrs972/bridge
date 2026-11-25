# Bridge v1 — correction de provenance — lot 06 sur 12

Référence : commit ffc0e3b (docs/REFERENCE.md) et livrable 1 (fichiers non suivis). Diff unifié à contexte complet : chaque diff contient le fichier entier ; les lignes « - » et « » donnent le contenu initial, les lignes « + » et « » le contenu final.

## Fichier 11 — src/mission/index.ts

- Statut : créé
- SHA-256 initial : (sans objet)
- SHA-256 final : d3cdf6541b7158329c73ad9f52dc9d6754ecacf15417063a6e00b3abfc56118c
- Taille finale : 1890 octets, 27 lignes

```diff
--- /dev/null
+++ b/src/mission/index.ts
@@ -0,0 +1,27 @@
+// API publique du noyau de mission Bridge v1 (D-04), destinée au futur orchestrateur.
+//
+// Ce module réexporte EXACTEMENT six éléments à l'exécution. Ce n'est PAS une barrière de
+// sécurité : tout module du noyau reste importable directement par son chemin. La sécurité repose
+// sur les contrôles faits à l'exécution par les fonctions elles-mêmes (texte JSON strict, jeton
+// opaque vérifié par identité dans un registre privé). Les autres exports des modules sont des
+// exports techniques : ils ne constituent pas des points d'entrée autorisés.
+//
+//   validerConfigurationTexte(texteProfils, texteReglesChemins) → jeton ou refus (seule source)
+//   estConfigurationValidee(valeur)                             → booléen (identité, sans lecture)
+//   calculerPolitiqueTexte(texteMission, texteContexte, jeton)  → politique gelée ou refus
+//   verifierReglesPolitiqueTexte(textePolitique, jeton)         → exclusions SEULEMENT ; jamais
+//                                                                 une validation complète
+//   evaluerChemin(cheminRelatif, jeton)                         → évaluation d'un chemin
+//   CODES                                                       → codes de refus (gelés)
+
+export { CODES } from "./erreurs.ts";
+export { estConfigurationValidee, validerConfigurationTexte } from "./configuration.ts";
+export { calculerPolitiqueTexte } from "./politique.ts";
+export { verifierReglesPolitiqueTexte } from "./regles-politique.ts";
+export { evaluerChemin } from "./chemins.ts";
+
+export type { CodeRefus, Refus } from "./erreurs.ts";
+export type { ConfigurationValidee, ResultatConfiguration } from "./configuration.ts";
+export type { Politique, ResultatPolitique } from "./politique.ts";
+export type { ResultatVerificationRegles } from "./regles-politique.ts";
+export type { ResultatEvaluation } from "./chemins.ts";
```

## Fichier 12 — src/mission/canonique.ts

- Statut : modifié
- SHA-256 initial : 21ee8fc0700ee8bfd274001abeb6e98a32639d0536df7b1c6c65480a2823c66e
- SHA-256 final : 04330dd56af308bbbbc049e88abbd688d59bb6f23a1ecd04f34e63eb0f72e836
- Taille finale : 9769 octets, 224 lignes

```diff
--- a/src/mission/canonique.ts
+++ b/src/mission/canonique.ts
@@ -1,222 +1,224 @@
 /* CONTRAT-DEBUT
  * Contrat de serialiserCanonique (forme « jcs-restreint-v1 », inspirée de RFC 8785).
  *
  * Garantie : le comportement n'est garanti que pour des ARBRES DE DONNÉES INERTES conformes
  * au domaine suivant :
  *  - chaînes primitives sans surrogate UTF-16 isolée (un objet String est refusé) ;
  *  - objets dont le prototype est exactement Object.prototype ou null, dont toutes les clés
  *    propres (Reflect.ownKeys) sont des chaînes, et dont chaque propriété est une propriété
  *    de données énumérable, sans accesseur ;
  *  - tableaux dont le prototype est exactement Array.prototype, denses, dont les clés propres
  *    sont exactement "0" à "length-1" puis "length", sans clé symbolique ni propriété
  *    supplémentaire, chaque élément étant une propriété de données énumérable ;
  *  - structure en arbre : aucune référence circulaire ni partagée ;
  *  - profondeur maximale 32 (racine au niveau 1) et 10 000 nœuds au plus.
  *
  * Comptage des nœuds : chaque objet (vide compris), chaque tableau (vide compris) et chaque
  * valeur chaîne compte pour un nœud ; la racine compte ; les noms de propriétés ne comptent
  * pas. Parcours en profondeur, préfixe : propriétés dans l'ordre canonique, éléments par index
  * croissant. Pour un même nœud, les contrôles de type, de prototype et de descripteurs passent
  * avant son comptage ; une référence circulaire ou partagée est détectée avant tout nouveau
  * comptage. Le refus TAILLE intervient dès que le 10 001e nœud est rencontré.
  *
  * Entrées hors contrat : les objets Proxy, et tout objet dont les opérations de réflexion
  * (Reflect.ownKeys, Object.getOwnPropertyDescriptor, Object.getPrototypeOf, Array.isArray)
  * déclenchent des effets de bord ou peuvent renvoyer des résultats incohérents. Le noyau ne
  * peut pas détecter tous les Proxy de façon fiable et ne le prétend pas.
  *
  * Précondition : les appelants, en particulier le futur orchestrateur, ne transmettent que
  * des données issues d'un texte JSON analysé et validé par analyserJsonStrict, jamais un objet
- * arbitraire construit en mémoire.
+ * arbitraire construit en mémoire. Cette fonction est un export technique (voir D-04 dans
+ * docs/REFERENCE.md) : son résultat ne vaut jamais autorisation ; les décisions du noyau exigent
+ * des textes et un jeton de configuration validée.
  *
  * Les valeurs sont lues par leur descripteur (jamais par objet[cle]) : aucun accesseur n'est
  * déclenché. Toute non-conformité produit NON_CANONISABLE avec une sous-raison et un pointeur
  * JSON ; aucune sérialisation partielle n'est jamais renvoyée.
  *
  * Sérialisation : propriétés triées par unités de code UTF-16 ; ordre des tableaux conservé ;
  * aucun espace ; dans les chaînes, seuls les guillemets, la barre oblique inverse et U+0000 à
  * U+001F sont échappés (formes courtes b t n f r, sinon u00xx en hexadécimal minuscule) ;
  * aucune normalisation Unicode. Encodage attendu par l'appelant : UTF-8 sans BOM.
  * L'empreinte SHA-256 est calculée par l'orchestrateur, hors du noyau.
 CONTRAT-FIN */
 
 import { pointeurEnfant } from "./validation.ts";
 
 export const PROFONDEUR_MAX_CANONIQUE = 32;
 export const NOEUDS_MAX_CANONIQUE = 10_000;
 export const FORME_CANONIQUE = "jcs-restreint-v1";
 
 export type SousRaisonCanonique =
   | "TYPE"
   | "PROTOTYPE"
   | "SYMBOLE"
   | "ACCESSEUR"
   | "NON_ENUMERABLE"
   | "TROU"
   | "PROPRIETE_TABLEAU"
   | "CIRCULAIRE"
   | "PARTAGE"
   | "PROFONDEUR"
   | "TAILLE"
   | "SURROGATE";
 
 export type ResultatCanonique =
   | { readonly ok: true; readonly texte: string }
   | { readonly ok: false; readonly code: "NON_CANONISABLE"; readonly sous_raison: SousRaisonCanonique; readonly pointeur: string };
 
 class RefusCanonique extends Error {
   readonly sousRaison: SousRaisonCanonique;
   readonly pointeur: string;
   constructor(sousRaison: SousRaisonCanonique, pointeur: string) {
     super(sousRaison);
     this.sousRaison = sousRaison;
     this.pointeur = pointeur;
   }
 }
 
 interface Etat {
   noeuds: number;
   readonly vus: Set<object>;
   readonly ancetres: Set<object>;
 }
 
 const HEXADECIMAL = "0123456789abcdef";
 const INDEX_TABLEAU = /^(?:0|[1-9][0-9]*)$/u;
 
 export function serialiserCanonique(valeur: unknown): ResultatCanonique {
   const etat: Etat = { noeuds: 0, vus: new Set(), ancetres: new Set() };
   try {
     return { ok: true, texte: serialiserNoeud(valeur, 1, "", etat) };
   } catch (e) {
     if (e instanceof RefusCanonique) {
       return { ok: false, code: "NON_CANONISABLE", sous_raison: e.sousRaison, pointeur: e.pointeur };
     }
     throw e;
   }
 }
 
 /** Vrai si la chaîne contient une surrogate UTF-16 isolée. */
 export function contientSurrogateIsolee(s: string): boolean {
   for (let i = 0; i < s.length; i++) {
     const c = s.charCodeAt(i);
     if (c >= 0xd800 && c <= 0xdbff) {
       const suivant = i + 1 < s.length ? s.charCodeAt(i + 1) : -1;
       if (suivant < 0xdc00 || suivant > 0xdfff) return true;
       i += 1;
     } else if (c >= 0xdc00 && c <= 0xdfff) {
       return true;
     }
   }
   return false;
 }
 
 /** Représentation canonique d'une chaîne (sans contrôle des surrogates). */
 export function chaineCanonique(s: string): string {
   let r = '"';
   for (let i = 0; i < s.length; i++) {
     const c = s.charCodeAt(i);
     if (c === 0x22) r += '\\"';
     else if (c === 0x5c) r += "\\\\";
     else if (c === 0x08) r += "\\b";
     else if (c === 0x09) r += "\\t";
     else if (c === 0x0a) r += "\\n";
     else if (c === 0x0c) r += "\\f";
     else if (c === 0x0d) r += "\\r";
     else if (c < 0x20) r += "\\u00" + HEXADECIMAL.charAt(c >> 4) + HEXADECIMAL.charAt(c & 0xf);
     else r += s.charAt(i);
   }
   return r + '"';
 }
 
 function compter(profondeur: number, pointeur: string, etat: Etat): void {
   if (profondeur > PROFONDEUR_MAX_CANONIQUE) throw new RefusCanonique("PROFONDEUR", pointeur);
   etat.noeuds += 1;
   if (etat.noeuds > NOEUDS_MAX_CANONIQUE) throw new RefusCanonique("TAILLE", pointeur);
 }
 
 function lireDonnee(cible: object, cle: string, pointeur: string, absence: SousRaisonCanonique): unknown {
   const d = Object.getOwnPropertyDescriptor(cible, cle);
   if (d === undefined) throw new RefusCanonique(absence, pointeur);
   if (!Object.hasOwn(d, "value")) throw new RefusCanonique("ACCESSEUR", pointeur);
   if (d.enumerable !== true) throw new RefusCanonique("NON_ENUMERABLE", pointeur);
   return d.value;
 }
 
 function serialiserNoeud(v: unknown, profondeur: number, pointeur: string, etat: Etat): string {
   if (typeof v === "string") {
     if (contientSurrogateIsolee(v)) throw new RefusCanonique("SURROGATE", pointeur);
     compter(profondeur, pointeur, etat);
     return chaineCanonique(v);
   }
   if (typeof v !== "object" || v === null) throw new RefusCanonique("TYPE", pointeur);
   if (etat.vus.has(v)) throw new RefusCanonique(etat.ancetres.has(v) ? "CIRCULAIRE" : "PARTAGE", pointeur);
 
   if (Array.isArray(v)) {
     if (Object.getPrototypeOf(v) !== Array.prototype) throw new RefusCanonique("PROTOTYPE", pointeur);
     const cles = Reflect.ownKeys(v);
     const descripteurLongueur = Object.getOwnPropertyDescriptor(v, "length");
     if (
       descripteurLongueur === undefined ||
       !Object.hasOwn(descripteurLongueur, "value") ||
       typeof descripteurLongueur.value !== "number"
     ) {
       throw new RefusCanonique("TYPE", pointeur);
     }
     const longueur: number = descripteurLongueur.value;
     let indices = 0;
     for (const cle of cles) {
       if (typeof cle !== "string") throw new RefusCanonique("SYMBOLE", pointeur);
       if (cle === "length") continue;
       if (!INDEX_TABLEAU.test(cle) || Number(cle) >= longueur) {
         throw new RefusCanonique("PROPRIETE_TABLEAU", pointeurEnfant(pointeur, cle));
       }
       indices += 1;
     }
     if (indices !== longueur) {
       // Premier index manquant : il est forcément inférieur ou égal au nombre d'indices présents.
       let manquant = 0;
       while (manquant < longueur && Object.hasOwn(v, String(manquant))) manquant += 1;
       throw new RefusCanonique("TROU", pointeurEnfant(pointeur, manquant));
     }
     const elements: unknown[] = [];
     for (let i = 0; i < longueur; i++) elements.push(lireDonnee(v, String(i), pointeurEnfant(pointeur, i), "TROU"));
     compter(profondeur, pointeur, etat);
     etat.vus.add(v);
     etat.ancetres.add(v);
     const parties: string[] = [];
     for (let i = 0; i < elements.length; i++) {
       parties.push(serialiserNoeud(elements[i], profondeur + 1, pointeurEnfant(pointeur, i), etat));
     }
     etat.ancetres.delete(v);
     return "[" + parties.join(",") + "]";
   }
 
   const prototype: unknown = Object.getPrototypeOf(v);
   if (prototype === String.prototype || prototype === Number.prototype || prototype === Boolean.prototype) {
     throw new RefusCanonique("TYPE", pointeur);
   }
   if (prototype !== Object.prototype && prototype !== null) throw new RefusCanonique("PROTOTYPE", pointeur);
   const cles = Reflect.ownKeys(v);
   const noms: string[] = [];
   for (const cle of cles) {
     if (typeof cle !== "string") throw new RefusCanonique("SYMBOLE", pointeur);
     noms.push(cle);
   }
   const valeurs = new Map<string, unknown>();
   for (const nom of noms) {
     const pointeurNom = pointeurEnfant(pointeur, nom);
     if (contientSurrogateIsolee(nom)) throw new RefusCanonique("SURROGATE", pointeurNom);
     valeurs.set(nom, lireDonnee(v, nom, pointeurNom, "TYPE"));
   }
   compter(profondeur, pointeur, etat);
   etat.vus.add(v);
   etat.ancetres.add(v);
   noms.sort();
   const parties: string[] = [];
   for (const nom of noms) {
     const texte = serialiserNoeud(valeurs.get(nom), profondeur + 1, pointeurEnfant(pointeur, nom), etat);
     parties.push(chaineCanonique(nom) + ":" + texte);
   }
   etat.ancetres.delete(v);
   return "{" + parties.join(",") + "}";
 }
```

## Fichier 13 — test/run.ts

- Statut : modifié
- SHA-256 initial : 0ea6648dfa91ffef3d49e98fa50e7d57952fa4a3f778a796275a41105f657f49
- SHA-256 final : dd471ffacab023b932a52b73e36852261ca3a23d141081e578fc01d4619d4f8e
- Taille finale : 691 octets, 15 lignes

```diff
--- a/test/run.ts
+++ b/test/run.ts
@@ -1,11 +1,15 @@
 // Point d'entrée unique des tests du noyau Bridge v1.
 // Lancé SANS l'option --test : node:test exécute alors les tests dans le processus courant,
 // sans processus enfant ni thread. La commande exacte et ses permissions sont soumises à
 // approbation avant toute exécution (voir le plan approuvé, section 8).
 
 import "./mission/validation.test.ts";
 import "./mission/json-strict.test.ts";
 import "./mission/canonique.test.ts";
 import "./mission/chemins.test.ts";
 import "./mission/politique.test.ts";
 import "./mission/exclusions.test.ts";
+import "./mission/provenance.test.ts";
+import "./mission/plancher.test.ts";
+import "./mission/api.test.ts";
+import "./mission/volume.test.ts";
```

## Fichier 14 — test/mission/validation.test.ts

- Statut : modifié
- SHA-256 initial : 85c3680ac09c3b77c88592ab15c56707ac62dc70a3ea01c8996b34d54de42491
- SHA-256 final : cbac53fe54094b68fa119dbd826d082036969381865debf27546f64321e5e1a5
- Taille finale : 6140 octets, 108 lignes

```diff
--- a/test/mission/validation.test.ts
+++ b/test/mission/validation.test.ts
@@ -1,108 +1,108 @@
 // Tests du validateur fermé et des schémas du noyau.
 
 import { test } from "node:test";
 import assert from "node:assert/strict";
 import schemaContexte from "../../src/mission/schemas/contexte.schema.json" with { type: "json" };
 import schemaExclusionsLecture from "../../src/mission/schemas/exclusions-lecture.schema.json" with { type: "json" };
 import schemaMission from "../../src/mission/schemas/mission.schema.json" with { type: "json" };
 import schemaPolitique from "../../src/mission/schemas/politique.schema.json" with { type: "json" };
 import schemaProfils from "../../src/mission/schemas/profils.schema.json" with { type: "json" };
 import schemaReglesChemins from "../../src/mission/schemas/regles-chemins.schema.json" with { type: "json" };
 import schemaReglesExclusion from "../../src/mission/schemas/regles-exclusion.schema.json" with { type: "json" };
 import { valider, verifierSchema } from "../../src/mission/validation.ts";
-import { verifierSchemasInternes } from "../../src/mission/politique.ts";
+import { verifierSchemasInternes } from "../../src/mission/configuration.ts";
 
 function sansDialecte(schema: unknown): Record<string, unknown> {
   const copie = JSON.parse(JSON.stringify(schema)) as Record<string, unknown>;
   delete copie["$schema"];
   return copie;
 }
 
 function propriete(objet: unknown, ...chemin: string[]): unknown {
   let cible: unknown = objet;
   for (const cle of chemin) cible = (cible as Record<string, unknown>)[cle];
   return cible;
 }
 
 test("validation : tous les schémas du noyau respectent le sous-ensemble fermé", () => {
   const schemas: ReadonlyArray<readonly [string, unknown]> = [
     ["mission", schemaMission],
     ["contexte", schemaContexte],
     ["profils", schemaProfils],
     ["regles-chemins", schemaReglesChemins],
     ["regles-exclusion", schemaReglesExclusion],
     ["exclusions-lecture", schemaExclusionsLecture],
     ["politique", schemaPolitique],
   ];
   for (const [nom, schema] of schemas) assert.equal(verifierSchema(schema), null, nom);
   assert.equal(verifierSchemasInternes(), null);
 });
 
 test("validation : les sous-schémas imbriqués sont des copies exactes des schémas autonomes", () => {
   assert.deepEqual(propriete(schemaReglesChemins, "properties", "exclusion"), sansDialecte(schemaReglesExclusion));
   assert.deepEqual(propriete(schemaExclusionsLecture, "properties", "regles"), sansDialecte(schemaReglesExclusion));
   assert.deepEqual(propriete(schemaPolitique, "properties", "exclusions_lecture_obligatoires"), sansDialecte(schemaExclusionsLecture));
 });
 
 test("validation : tout mot-clé non pris en charge est refusé", () => {
   const motsCles: ReadonlyArray<readonly [string, unknown]> = [
     ["$ref", "#/a"],
     ["anyOf", [{ type: "string", maxLength: 1 }]],
     ["oneOf", [{ type: "string", maxLength: 1 }]],
     ["allOf", [{ type: "string", maxLength: 1 }]],
     ["not", { type: "string", maxLength: 1 }],
     ["if", { type: "string", maxLength: 1 }],
     ["format", "email"],
     ["patternProperties", {}],
     ["default", "x"],
     ["uniqueItems", true],
     ["$id", "x"],
   ];
   for (const [cle, valeur] of motsCles) {
     const schema: Record<string, unknown> = { type: "string", maxLength: 5 };
     schema[cle] = valeur;
     const e = verifierSchema(schema);
     assert.equal(e?.raison, "SCHEMA_MOT_CLE_NON_PRIS_EN_CHARGE", cle);
   }
 });
 
 test("validation : règles imposées aux schémas", () => {
   assert.equal(verifierSchema({ type: "object", properties: {}, additionalProperties: true })?.raison, "SCHEMA_OBJET_NON_FERME");
   assert.equal(verifierSchema({ type: "object", properties: {} })?.raison, "SCHEMA_OBJET_NON_FERME");
   assert.equal(verifierSchema({ type: "string" })?.raison, "SCHEMA_CHAINE_NON_BORNEE");
   assert.equal(verifierSchema({ type: "array", items: { type: "string", maxLength: 1 } })?.raison, "SCHEMA_TABLEAU_NON_BORNE");
   assert.equal(verifierSchema({ type: "array", maxItems: 1 })?.raison, "SCHEMA_ITEMS_ABSENT");
   assert.equal(verifierSchema({ maxLength: 1 })?.raison, "SCHEMA_TYPE_INVALIDE");
   assert.equal(verifierSchema({ type: "string", maxLength: 1, pattern: "(" })?.raison, "SCHEMA_MOTIF_INVALIDE");
   assert.equal(verifierSchema({ $schema: "http://json-schema.org/draft-07/schema#", type: "boolean" })?.raison, "SCHEMA_DIALECTE_INVALIDE");
   assert.equal(verifierSchema({ type: "boolean", maxLength: 1 })?.raison, "SCHEMA_MOT_CLE_INCOHERENT");
   assert.equal(verifierSchema({ type: "object", properties: {}, additionalProperties: false, required: ["x"] })?.raison, "SCHEMA_REQUIRED_INVALIDE");
 });
 
 test("validation : erreurs de valeur", () => {
   const schema = {
     type: "object",
     additionalProperties: false,
     required: ["a"],
     properties: {
       a: { type: "string", minLength: 1, maxLength: 2, pattern: "^[a-z\u{1F600}]+$" },
       n: { type: "integer", minimum: 1, maximum: 3 },
       t: { type: "array", minItems: 1, maxItems: 2, items: { type: "string", maxLength: 1 } },
       e: { type: "string", enum: ["x", "y"], maxLength: 1 },
     },
   };
   assert.equal(verifierSchema(schema), null);
   assert.equal(valider(schema, { a: "ab" }), null);
   assert.equal(valider(schema, { a: "\u{1F600}" }), null, "longueur en points de code");
   assert.deepEqual(valider(schema, { a: "ab", z: 1 }), { pointeur: "/z", raison: "CHAMP_NON_PREVU" });
   assert.deepEqual(valider(schema, {}), { pointeur: "/a", raison: "CHAMP_MANQUANT" });
   assert.deepEqual(valider(schema, { a: 1 }), { pointeur: "/a", raison: "TYPE" });
   assert.deepEqual(valider(schema, { a: "abc" }), { pointeur: "/a", raison: "LONGUEUR" });
   assert.deepEqual(valider(schema, { a: "A" }), { pointeur: "/a", raison: "MOTIF" });
   assert.deepEqual(valider(schema, { a: "a", n: 4 }), { pointeur: "/n", raison: "BORNE" });
   assert.deepEqual(valider(schema, { a: "a", n: 1.5 }), { pointeur: "/n", raison: "TYPE" });
   assert.deepEqual(valider(schema, { a: "a", t: [] }), { pointeur: "/t", raison: "TAILLE_TABLEAU" });
   assert.deepEqual(valider(schema, { a: "a", t: ["xx"] }), { pointeur: "/t/0", raison: "LONGUEUR" });
   assert.deepEqual(valider(schema, { a: "a", e: "z" }), { pointeur: "/e", raison: "VALEUR_HORS_LISTE" });
   assert.deepEqual(valider(schema, []), { pointeur: "", raison: "TYPE" });
 });
```

## Fichier 15 — test/mission/json-strict.test.ts

- Statut : modifié
- SHA-256 initial : 04b2c1ebfb948b76ff8bd2654c9d3d2905d94fbd3f64bdebcdc4c81b733b6425
- SHA-256 final : 2583577f53ae1a9bc1b8723fff60aa91aba34a85032f2868614684ed32f9ba69
- Taille finale : 5699 octets, 139 lignes

```diff
--- a/test/mission/json-strict.test.ts
+++ b/test/mission/json-strict.test.ts
@@ -1,70 +1,139 @@
-// Tests de analyserJsonStrict : grammaire stricte, clés dupliquées, limites.
+// Tests de analyserJsonStrict : grammaire stricte, clés dupliquées, limites, gel profond et
+// registre de provenance du parseur (qui ne vaut jamais autorisation).
 
 import { test } from "node:test";
 import assert from "node:assert/strict";
 import vecteurs from "../vecteurs/json-strict.json" with { type: "json" };
-import { analyserJsonStrict, NOEUDS_MAX_JSON, PROFONDEUR_MAX_JSON, TAILLE_TEXTE_MAX } from "../../src/mission/json-strict.ts";
+import {
+  analyserJsonStrict,
+  estIssuDuParseurStrict,
+  gelerProfondement,
+  NOEUDS_MAX_JSON,
+  PROFONDEUR_MAX_JSON,
+  TAILLE_TEXTE_MAX,
+} from "../../src/mission/json-strict.ts";
 
 interface VecteurJson {
   readonly nom: string;
   readonly texte: string;
   readonly attendu: { readonly ok: boolean; readonly sous_raison?: string; readonly pointeur?: string };
 }
 
 const V = (vecteurs as unknown as { readonly vecteurs: readonly VecteurJson[] }).vecteurs;
 
 test("json-strict : vecteurs", () => {
   for (const v of V) {
     const r = analyserJsonStrict(v.texte);
     assert.equal(r.ok, v.attendu.ok, v.nom);
     if (!r.ok) {
       assert.equal(r.code, "JSON_INVALIDE", v.nom);
       if (v.attendu.sous_raison !== undefined) assert.equal(r.sous_raison, v.attendu.sous_raison, v.nom);
       if (v.attendu.pointeur !== undefined) assert.equal(r.pointeur, v.attendu.pointeur, v.nom);
     }
   }
 });
 
 test("json-strict : la valeur acceptée est celle de JSON.parse", () => {
   const texte = '{"b":[1,"x",{"c":null}],"a":true}';
   const r = analyserJsonStrict(texte);
   if (!r.ok) assert.fail("texte valide refusé");
   else assert.deepEqual(r.valeur, JSON.parse(texte));
 });
 
 test("json-strict : une entrée qui n'est pas une chaîne est refusée", () => {
   const r = analyserJsonStrict({ a: "1" });
   assert.equal(r.ok, false);
   if (!r.ok) assert.equal(r.sous_raison, "TYPE");
 });
 
 test("json-strict : profondeur", () => {
   assert.equal(PROFONDEUR_MAX_JSON, 32);
   const imbrique = (n: number): string => "[".repeat(n - 1) + '"x"' + "]".repeat(n - 1);
   assert.equal(analyserJsonStrict(imbrique(32)).ok, true, "32 niveaux acceptés");
   const r = analyserJsonStrict(imbrique(33));
   assert.equal(r.ok, false);
   if (!r.ok) assert.equal(r.sous_raison, "PROFONDEUR");
 });
 
 test("json-strict : taille du texte", () => {
   assert.equal(TAILLE_TEXTE_MAX, 1_048_576);
   const limite = '"' + "a".repeat(TAILLE_TEXTE_MAX - 2) + '"';
   assert.equal(analyserJsonStrict(limite).ok, true);
   const r = analyserJsonStrict(limite + " ");
   assert.equal(r.ok, false);
   if (!r.ok) assert.equal(r.sous_raison, "TAILLE_TEXTE");
 });
 
 test("json-strict : comptage des nœuds (les nombres comptent)", () => {
   assert.equal(NOEUDS_MAX_JSON, 10_000);
   const tableau = (n: number): string => "[" + new Array<string>(n).fill("1").join(",") + "]";
   assert.equal(analyserJsonStrict(tableau(9_999)).ok, true, "1 + 9 999 = 10 000 nœuds");
   const r = analyserJsonStrict(tableau(10_000));
   assert.equal(r.ok, false);
   if (!r.ok) {
     assert.equal(r.sous_raison, "TAILLE");
     assert.equal(r.pointeur, "/9999");
   }
   assert.equal(analyserJsonStrict("{}").ok, true, "objet vide : 1 nœud");
 });
+
+function objetsImbriques(valeur: unknown): object[] {
+  const resultat: object[] = [];
+  const pile: unknown[] = [valeur];
+  while (pile.length > 0) {
+    const v = pile.pop();
+    if (typeof v !== "object" || v === null) continue;
+    resultat.push(v);
+    for (const enfant of Object.values(v)) pile.push(enfant);
+  }
+  return resultat;
+}
+
+test("json-strict : la valeur analysée est gelée en profondeur et enregistrée", () => {
+  const r = analyserJsonStrict('{"a":{"b":[{"c":"x"},["y",{"d":null}]]},"e":[]}');
+  if (!r.ok) throw new Error("texte valide refusé");
+  assert.equal(Object.isFrozen(r), true, "résultat gelé");
+  const objets = objetsImbriques(r.valeur);
+  assert.equal(objets.length, 7);
+  for (const objet of objets) {
+    assert.equal(Object.isFrozen(objet), true, "chaque objet et chaque tableau est gelé");
+    assert.equal(estIssuDuParseurStrict(objet), true, "chaque objet et chaque tableau est enregistré");
+  }
+  let modifie = false;
+  try {
+    ((r.valeur as Record<string, Record<string, unknown>>)["a"] as Record<string, unknown>)["z"] = 1;
+    modifie = true;
+  } catch {
+    modifie = false;
+  }
+  assert.equal(modifie, false, "affectation imbriquée refusée");
+});
+
+test("json-strict : une racine primitive n'est ni gelée ni enregistrée", () => {
+  for (const texte of ['"x"', "1", "true", "null"]) {
+    const r = analyserJsonStrict(texte);
+    if (!r.ok) throw new Error(`texte valide refusé : ${texte}`);
+    assert.equal(estIssuDuParseurStrict(r.valeur), false, texte);
+  }
+});
+
+test("json-strict : copies et objets construits en mémoire ne sont pas issus du parseur", () => {
+  const texte = '{"a":["b"]}';
+  const r = analyserJsonStrict(texte);
+  if (!r.ok) throw new Error("texte valide refusé");
+  assert.equal(estIssuDuParseurStrict(JSON.parse(texte)), false, "JSON.parse direct");
+  assert.equal(estIssuDuParseurStrict({ ...(r.valeur as Record<string, unknown>) }), false, "copie par décomposition");
+  assert.equal(estIssuDuParseurStrict(JSON.parse(JSON.stringify(r.valeur))), false, "aller-retour JSON");
+  assert.equal(estIssuDuParseurStrict(Object.create(r.valeur as object)), false, "objet dérivé");
+  assert.equal(estIssuDuParseurStrict({ a: ["b"] }), false, "objet construit en mémoire");
+  assert.equal(estIssuDuParseurStrict("x"), false, "chaîne");
+});
+
+test("json-strict : gelerProfondement gèle sans enregistrer", () => {
+  const donnee = { a: { b: [{ c: "x" }] } };
+  assert.equal(gelerProfondement(donnee), donnee, "renvoie la valeur reçue");
+  for (const objet of objetsImbriques(donnee)) {
+    assert.equal(Object.isFrozen(objet), true);
+    assert.equal(estIssuDuParseurStrict(objet), false, "aucune provenance conférée");
+  }
+});
```

