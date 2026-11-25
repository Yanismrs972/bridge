# Bridge v1 — correction de provenance — lot 04 sur 12

Référence : commit ffc0e3b (docs/REFERENCE.md) et livrable 1 (fichiers non suivis). Diff unifié à contexte complet : chaque diff contient le fichier entier ; les lignes « - » et « » donnent le contenu initial, les lignes « + » et « » le contenu final.

## Fichier 09 — src/mission/regles-politique.ts

- Statut : modifié
- SHA-256 initial : 053bacbe3f6f4fb2545dae1296fb1efe99790c4c54bd5aa7d4a877a1dc1e1237
- SHA-256 final : 075e1266677caa567ade2e5f3a0f5c19b4dd2af95f172ea2c27f30e93960fc41
- Taille finale : 6025 octets, 107 lignes

```diff
--- a/src/mission/regles-politique.ts
+++ b/src/mission/regles-politique.ts
@@ -1,127 +1,107 @@
-// Objet exclusions_lecture_obligatoires et vérification des règles d'une politique (Bridge v1).
+// Vérification des règles d'exclusion d'une politique (Bridge v1).
 //
-// Point d'entrée OBLIGATOIRE du futur orchestrateur : verifierReglesPolitiqueTexte, qui reçoit le
-// TEXTE de la politique, l'analyse avec analyserJsonStrict (clés dupliquées refusées), puis
-// applique verifierReglesPolitique. Toute réponse autre que { ok: true } impose le refus. Aucune
-// configuration partielle n'est utilisée et aucune règle manquante n'est reconstruite.
+// PORTÉE LIMITÉE (D-04) : verifierReglesPolitiqueTexte ne vérifie QUE l'objet
+// exclusions_lecture_obligatoires d'une politique (objet fermé, valeurs fixes, règles identiques
+// à celles associées au jeton). Un résultat { ok: true } ne constitue JAMAIS une validation
+// complète de la politique ni une autorisation de l'utiliser : le périmètre, la classe, les
+// limites et les validations humaines ne sont pas vérifiés ici. L'orchestrateur utilise
+// exclusivement le résultat de son propre calculerPolitiqueTexte (mission approuvée, contexte,
+// jeton valide) ; une politique reçue d'une autre source n'est jamais une autorité.
+//
+// Provenance : le jeton est vérifié en première instruction ; la politique n'est acceptée que
+// sous forme de TEXTE, analysé par analyserJsonStrict (clés dupliquées refusées).
 // Le noyau DÉCLARE les exclusions ; il ne les applique jamais physiquement.
 
 import schemaExclusionsLecture from "./schemas/exclusions-lecture.schema.json" with { type: "json" };
 import { serialiserCanonique } from "./canonique.ts";
-import { verifierReglesExclusion, type ReglesExclusion } from "./chemins.ts";
+import { contenuDuJeton, type ContenuConfiguration, type ReglesExclusion } from "./configuration.ts";
 import { CODES, refus, type Refus } from "./erreurs.ts";
-import { analyserJsonStrict } from "./json-strict.ts";
+import { analyserJsonStrict, estIssuDuParseurStrict, gelerProfondement } from "./json-strict.ts";
 import { estObjetSimple, valider, verifierSchema } from "./validation.ts";
 
-export const VALEURS_FIXES_EXCLUSIONS = {
+gelerProfondement(schemaExclusionsLecture);
+
+export const VALEURS_FIXES_EXCLUSIONS = gelerProfondement({
   version: "2",
   portee: "arborescence_complete_racine_autorisee",
   semantique: "tout_segment_exclusion_sous_arbre",
   forme_canonique_regles: "jcs-restreint-v1",
   type_entree_indetermine: "REFUS",
   comportement_si_inapplicable: "REFUS",
   appliquee_par: "orchestrateur",
   statut_dans_le_noyau: "declaree_non_appliquee",
-} as const;
+} as const);
 
 export interface ExclusionsLecture {
   readonly version: "2";
   readonly portee: "arborescence_complete_racine_autorisee";
   readonly semantique: "tout_segment_exclusion_sous_arbre";
   readonly regles: ReglesExclusion;
   readonly forme_canonique_regles: "jcs-restreint-v1";
   readonly type_entree_indetermine: "REFUS";
   readonly comportement_si_inapplicable: "REFUS";
   readonly appliquee_par: "orchestrateur";
   readonly statut_dans_le_noyau: "declaree_non_appliquee";
 }
 
 export type ResultatVerificationRegles = { readonly ok: true } | Refus;
 
-/** Copie profonde exacte des règles : même ordre, mêmes chaînes, aucune transformation. */
-export function copierRegles(r: ReglesExclusion): ReglesExclusion {
-  return {
-    version: r.version,
-    segments_interdits: r.segments_interdits.map((x) => ({ id: x.id, type: x.type, valeur: x.valeur })),
-    secrets: r.secrets.map((x) => ({ id: x.id, type: x.type, valeur: x.valeur })),
-  };
-}
-
-/** Construit l'objet fermé de neuf propriétés à partir des règles validées de la configuration. */
-export function construireExclusions(regles: ReglesExclusion): ExclusionsLecture {
-  const f = VALEURS_FIXES_EXCLUSIONS;
-  return {
-    version: f.version,
-    portee: f.portee,
-    semantique: f.semantique,
-    regles: copierRegles(regles),
-    forme_canonique_regles: f.forme_canonique_regles,
-    type_entree_indetermine: f.type_entree_indetermine,
-    comportement_si_inapplicable: f.comportement_si_inapplicable,
-    appliquee_par: f.appliquee_par,
-    statut_dans_le_noyau: f.statut_dans_le_noyau,
-  };
-}
-
-function lireExclusionConfiguration(configuration: unknown): { readonly ok: true; readonly regles: ReglesExclusion } | Refus {
-  if (!estObjetSimple(configuration)) return refus(CODES.CONFIGURATION_INVALIDE, null, { raison: "CONFIGURATION_NON_OBJET" });
-  const reglesChemins = configuration["regles_chemins"];
-  if (!estObjetSimple(reglesChemins)) return refus(CODES.CONFIGURATION_INVALIDE, null, { raison: "REGLES_CHEMINS_ABSENTES" });
-  const v = verifierReglesExclusion(reglesChemins["exclusion"]);
-  if (!v.ok) return refus(CODES.CONFIGURATION_INVALIDE, null, { raison: v.raison, pointeur: `/regles_chemins/exclusion${v.pointeur}` });
-  return { ok: true, regles: v.regles };
-}
-
 /**
- * Vérifie les règles d'exclusion d'une politique DÉJÀ ANALYSÉE par analyserJsonStrict.
- * Réservée aux tests et à verifierReglesPolitiqueTexte : ne jamais l'appeler avec un objet
- * construit en mémoire (voir le contrat de serialiserCanonique).
+ * Interne. Vérifie les exclusions d'une politique que analyserJsonStrict vient de créer
+ * (assertion défensive), contre les règles associées au jeton (contenu lu par l'appelant dans le
+ * registre privé). Les règles reçues ne sont jamais validées isolément : seule leur égalité
+ * canonique avec les règles du jeton compte.
  */
-export function verifierReglesPolitique(politique: unknown, configurationValidee: unknown): ResultatVerificationRegles {
-  const attendue = lireExclusionConfiguration(configurationValidee);
-  if (!attendue.ok) return attendue;
-
+function verifierReglesPolitique(politique: unknown, contenu: ContenuConfiguration): ResultatVerificationRegles {
+  if (typeof politique === "object" && politique !== null && !estIssuDuParseurStrict(politique)) {
+    return refus(CODES.ERREUR_INTERNE, null, { raison: "PROVENANCE_INTERNE" });
+  }
   if (!estObjetSimple(politique)) return refus(CODES.REGLES_EXCLUSION_ABSENTES, null, { raison: "POLITIQUE_NON_OBJET" });
   const descripteur = Object.getOwnPropertyDescriptor(politique, "exclusions_lecture_obligatoires");
   if (descripteur === undefined) return refus(CODES.REGLES_EXCLUSION_ABSENTES, null, {});
   if (!Object.hasOwn(descripteur, "value")) return refus(CODES.REGLES_EXCLUSION_INVALIDES, null, { sous_raison: "ACCESSEUR" });
   const objet: unknown = descripteur.value;
 
   // Structure : arbre de données strict (accesseurs, prototypes, symboles, trous… refusés).
   const canon = serialiserCanonique(objet);
   if (!canon.ok) {
     return refus(CODES.REGLES_EXCLUSION_INVALIDES, null, { sous_raison: canon.sous_raison, pointeur: canon.pointeur });
   }
 
-  // Objet fermé : exactement neuf propriétés, valeurs fixes en const, règles conformes.
+  // Objet fermé : exactement neuf propriétés, valeurs fixes en const, règles de forme conforme.
   const meta = verifierSchema(schemaExclusionsLecture);
   if (meta !== null) return refus(CODES.ERREUR_INTERNE, null, { raison: meta.raison, pointeur: meta.pointeur });
   const e = valider(schemaExclusionsLecture, objet);
   if (e !== null) return refus(CODES.REGLES_EXCLUSION_INVALIDES, null, { raison: e.raison, pointeur: e.pointeur });
   const regles = (objet as Record<string, unknown>)["regles"];
-  const v = verifierReglesExclusion(regles);
-  if (!v.ok) return refus(CODES.REGLES_EXCLUSION_INVALIDES, null, { raison: v.raison, pointeur: `/regles${v.pointeur}` });
 
-  // Égalité exacte avec la configuration validée (forme canonique : l'ordre des propriétés est
-  // indifférent, l'ordre des tableaux est significatif).
+  // Égalité exacte avec les règles associées au jeton (forme canonique : l'ordre des propriétés
+  // est indifférent, l'ordre des tableaux est significatif).
   const recu = serialiserCanonique(regles);
-  const attendu = serialiserCanonique(attendue.regles);
+  const attendu = serialiserCanonique(contenu.regles_chemins.exclusion);
   if (!recu.ok || !attendu.ok) return refus(CODES.REGLES_EXCLUSION_INVALIDES, null, { raison: "NON_CANONISABLE" });
   if (recu.texte !== attendu.texte) return refus(CODES.REGLES_EXCLUSION_DIFFERENTES, null, {});
   return { ok: true };
 }
 
-/** Point d'entrée obligatoire du futur orchestrateur : la politique est fournie sous forme de TEXTE. */
-export function verifierReglesPolitiqueTexte(textePolitique: unknown, configurationValidee: unknown): ResultatVerificationRegles {
+/**
+ * API publique. Vérifie les EXCLUSIONS SEULEMENT d'une politique fournie sous forme de TEXTE,
+ * contre les règles associées au jeton de configuration validée. Ordre : jeton (avant toute
+ * lecture), type du texte, analyse stricte, vérification. Toute réponse autre que { ok: true }
+ * impose le refus ; une réponse { ok: true } n'autorise pas pour autant l'usage de la politique.
+ */
+export function verifierReglesPolitiqueTexte(textePolitique: unknown, configuration: unknown): ResultatVerificationRegles {
+  const contenu = contenuDuJeton(configuration);
+  if (contenu === undefined) return refus(CODES.PROVENANCE_NON_GARANTIE, null, {});
   if (typeof textePolitique !== "string") return refus(CODES.POLITIQUE_JSON_INVALIDE, null, { sous_raison: "TYPE" });
   const analyse = analyserJsonStrict(textePolitique);
   if (!analyse.ok) {
     return refus(CODES.POLITIQUE_JSON_INVALIDE, null, {
       sous_raison: analyse.sous_raison,
       position: analyse.position,
       pointeur: analyse.pointeur,
       detail: analyse.detail,
     });
   }
-  return verifierReglesPolitique(analyse.valeur, configurationValidee);
+  return verifierReglesPolitique(analyse.valeur, contenu);
 }
```

