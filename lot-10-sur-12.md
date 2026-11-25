# Bridge v1 — correction de provenance — lot 10 sur 12

Référence : commit ffc0e3b (docs/REFERENCE.md) et livrable 1 (fichiers non suivis). Diff unifié à contexte complet : chaque diff contient le fichier entier ; les lignes « - » et « » donnent le contenu initial, les lignes « + » et « » le contenu final.

## Fichier 21 — test/mission/api.test.ts

- Statut : créé
- SHA-256 initial : (sans objet)
- SHA-256 final : e35708f31e2771d6dabf74028e6a35dbb6b19c97ed5a00c8b80879800bc02ff1
- Taille finale : 9315 octets, 198 lignes

```diff
--- /dev/null
+++ b/test/mission/api.test.ts
@@ -0,0 +1,198 @@
+// Tests de l'API (D-04) : exports effectifs de CHAQUE module, API publique de index.ts limitée à
+// six éléments, absence de toute fonction d'enregistrement, gel des constantes et des schémas.
+// index.ts n'est pas une barrière : ces tests importent chaque module directement par son chemin.
+
+import { test } from "node:test";
+import assert from "node:assert/strict";
+import profils from "../../config/profils.json" with { type: "json" };
+import reglesChemins from "../../config/regles-chemins.json" with { type: "json" };
+import schemaContexte from "../../src/mission/schemas/contexte.schema.json" with { type: "json" };
+import schemaExclusionsLecture from "../../src/mission/schemas/exclusions-lecture.schema.json" with { type: "json" };
+import schemaMission from "../../src/mission/schemas/mission.schema.json" with { type: "json" };
+import schemaPolitique from "../../src/mission/schemas/politique.schema.json" with { type: "json" };
+import schemaProfils from "../../src/mission/schemas/profils.schema.json" with { type: "json" };
+import schemaReglesChemins from "../../src/mission/schemas/regles-chemins.schema.json" with { type: "json" };
+import schemaReglesExclusion from "../../src/mission/schemas/regles-exclusion.schema.json" with { type: "json" };
+import * as canonique from "../../src/mission/canonique.ts";
+import * as chemins from "../../src/mission/chemins.ts";
+import * as classification from "../../src/mission/classification.ts";
+import * as configuration from "../../src/mission/configuration.ts";
+import * as erreurs from "../../src/mission/erreurs.ts";
+import * as index from "../../src/mission/index.ts";
+import * as jsonStrict from "../../src/mission/json-strict.ts";
+import * as perimetre from "../../src/mission/perimetre.ts";
+import * as politique from "../../src/mission/politique.ts";
+import * as reglesPolitique from "../../src/mission/regles-politique.ts";
+import * as syntaxeChemins from "../../src/mission/syntaxe-chemins.ts";
+import * as validation from "../../src/mission/validation.ts";
+
+type EspaceDeNoms = Readonly<Record<string, unknown>>;
+
+/** Vue d'un espace de noms de module comme dictionnaire de ses exports effectifs. */
+function ns(module: object): EspaceDeNoms {
+  return module as EspaceDeNoms;
+}
+
+const MODULES: ReadonlyArray<readonly [string, EspaceDeNoms, readonly string[]]> = [
+  ["erreurs", ns(erreurs), ["CODES", "refus"]],
+  ["validation", ns(validation), ["DIALECTE_SCHEMA", "estObjetSimple", "longueurEnPointsDeCode", "pointeurEnfant", "valider", "verifierSchema"]],
+  [
+    "json-strict",
+    ns(jsonStrict),
+    ["NOEUDS_MAX_JSON", "PROFONDEUR_MAX_JSON", "TAILLE_TEXTE_MAX", "analyserJsonStrict", "estIssuDuParseurStrict", "gelerProfondement"],
+  ],
+  [
+    "canonique",
+    ns(canonique),
+    ["FORME_CANONIQUE", "NOEUDS_MAX_CANONIQUE", "PROFONDEUR_MAX_CANONIQUE", "chaineCanonique", "contientSurrogateIsolee", "serialiserCanonique"],
+  ],
+  [
+    "syntaxe-chemins",
+    ns(syntaxeChemins),
+    ["LONGUEUR_MAX_CHEMIN", "LONGUEUR_MAX_SEGMENT", "analyserCheminRelatif", "analyserRacine", "estCaractereControle", "estCaractereInterdit", "validerSegment"],
+  ],
+  ["configuration", ns(configuration), ["contenuDuJeton", "estConfigurationValidee", "validerConfigurationTexte", "verifierSchemasInternes"]],
+  ["chemins", ns(chemins), ["evaluerChemin"]],
+  ["perimetre", ns(perimetre), ["analyserEntreePerimetre"]],
+  ["classification", ns(classification), ["classeMax"]],
+  ["regles-politique", ns(reglesPolitique), ["VALEURS_FIXES_EXCLUSIONS", "verifierReglesPolitiqueTexte"]],
+  ["politique", ns(politique), ["CLES_INDICATEURS", "CLES_PLAFONDS", "calculerPolitiqueTexte"]],
+];
+
+const API_PUBLIQUE = [
+  "CODES",
+  "calculerPolitiqueTexte",
+  "estConfigurationValidee",
+  "evaluerChemin",
+  "validerConfigurationTexte",
+  "verifierReglesPolitiqueTexte",
+];
+
+const FONCTIONS_INTERNES = [
+  "validerConfiguration",
+  "verifierReglesExclusion",
+  "verifierValeurRegle",
+  "verifierReglesClassification",
+  "verifierPlancher",
+  "correspondancesSegments",
+  "controlerEntree",
+  "validerContexte",
+  "detecterSensibilite",
+  "construireExclusions",
+  "copierRegles",
+  "calculerPolitique",
+  "verifierReglesPolitique",
+  "verifierVolumeEtRelire",
+];
+
+function trie(liste: readonly string[]): string[] {
+  return [...liste].sort();
+}
+
+function geleEnProfondeur(valeur: unknown): boolean {
+  if (typeof valeur !== "object" || valeur === null) return true;
+  if (!Object.isFrozen(valeur)) return false;
+  return Object.values(valeur).every(geleEnProfondeur);
+}
+
+test("api : exports effectifs de chaque module", () => {
+  for (const [nom, module, attendus] of MODULES) assert.deepEqual(trie(Object.keys(module)), trie(attendus), nom);
+});
+
+test("api : index.ts réexporte exactement les six éléments publics", () => {
+  assert.deepEqual(trie(Object.keys(ns(index))), trie(API_PUBLIQUE));
+  assert.equal(index.CODES, erreurs.CODES);
+  assert.equal(index.validerConfigurationTexte, configuration.validerConfigurationTexte);
+  assert.equal(index.estConfigurationValidee, configuration.estConfigurationValidee);
+  assert.equal(index.calculerPolitiqueTexte, politique.calculerPolitiqueTexte);
+  assert.equal(index.verifierReglesPolitiqueTexte, reglesPolitique.verifierReglesPolitiqueTexte);
+  assert.equal(index.evaluerChemin, chemins.evaluerChemin);
+});
+
+test("api : aucune fonction interne ni aucun registre n'est exporté", () => {
+  for (const [nom, module] of MODULES) {
+    const cles = Object.keys(module);
+    for (const interne of FONCTIONS_INTERNES) assert.equal(cles.includes(interne), false, `${nom} : ${interne}`);
+    for (const cle of cles) {
+      assert.equal(/registre|ajouter|enregistr|CONFIGURATIONS_VALIDEES|ISSUS_DU_PARSEUR|PLANCHER/iu.test(cle), false, `${nom} : ${cle}`);
+    }
+  }
+});
+
+test("api : aucune collection modifiable exportée ; constantes gelées en profondeur", () => {
+  for (const [nom, module] of MODULES) {
+    for (const [cle, valeur] of Object.entries(module)) {
+      if (typeof valeur !== "object" || valeur === null) continue;
+      assert.equal(valeur instanceof Set || valeur instanceof Map || valeur instanceof WeakSet || valeur instanceof WeakMap, false, `${nom}.${cle}`);
+      assert.equal(geleEnProfondeur(valeur), true, `${nom}.${cle} gelé en profondeur`);
+    }
+  }
+  assert.equal(geleEnProfondeur(erreurs.CODES), true);
+  assert.equal(geleEnProfondeur(reglesPolitique.VALEURS_FIXES_EXCLUSIONS), true);
+  assert.equal(geleEnProfondeur(politique.CLES_PLAFONDS), true);
+  assert.equal(geleEnProfondeur(politique.CLES_INDICATEURS), true);
+});
+
+test("api : les sept schémas du noyau sont gelés en profondeur", () => {
+  const schemas: ReadonlyArray<readonly [string, unknown]> = [
+    ["contexte", schemaContexte],
+    ["exclusions-lecture", schemaExclusionsLecture],
+    ["mission", schemaMission],
+    ["politique", schemaPolitique],
+    ["profils", schemaProfils],
+    ["regles-chemins", schemaReglesChemins],
+    ["regles-exclusion", schemaReglesExclusion],
+  ];
+  for (const [nom, schema] of schemas) assert.equal(geleEnProfondeur(schema), true, nom);
+  let modifie = false;
+  try {
+    ((schemaMission as unknown as Record<string, Record<string, unknown>>)["properties"] as Record<string, unknown>)["outils"] = {};
+    modifie = true;
+  } catch {
+    modifie = false;
+  }
+  assert.equal(modifie, false, "affectation imbriquée refusée sur un schéma");
+});
+
+test("api : aucun export, public ou technique, ne peut enregistrer un objet comme jeton", () => {
+  // Chaque fonction exportée par chaque module est appelée avec un objet forgé (règles complètes
+  // de même forme qu'une configuration) dans toutes les positions d'argument. Ensuite, l'objet
+  // forgé n'est toujours ni reconnu comme jeton ni associé à un contenu.
+  const forges: object[] = [];
+  const nouvelleForge = (): object => {
+    const forge = { profils: JSON.parse(JSON.stringify(profils)), regles_chemins: JSON.parse(JSON.stringify(reglesChemins)) };
+    forges.push(forge);
+    return forge;
+  };
+  const texteProfils = JSON.stringify(profils);
+  const texteRegles = JSON.stringify(reglesChemins);
+  const tousLesModules: ReadonlyArray<readonly [string, EspaceDeNoms, readonly string[]]> = [...MODULES, ["index", ns(index), API_PUBLIQUE]];
+  for (const [, module] of tousLesModules) {
+    for (const valeur of Object.values(module)) {
+      if (typeof valeur !== "function") continue;
+      const fonction = valeur as (...args: unknown[]) => unknown;
+      const appels: ReadonlyArray<readonly unknown[]> = [
+        [nouvelleForge()],
+        [nouvelleForge(), nouvelleForge()],
+        ["src/a.ts", nouvelleForge()],
+        [texteProfils, texteRegles, nouvelleForge()],
+        ["{}", "{}", nouvelleForge()],
+      ];
+      for (const args of appels) {
+        try {
+          fonction(...args);
+        } catch {
+          // Une fonction technique peut lever une exception sur un argument hors domaine : seul
+          // compte qu'aucun objet forgé ne soit enregistré.
+        }
+      }
+    }
+  }
+  assert.ok(forges.length > 0);
+  for (const forge of forges) {
+    assert.equal(configuration.estConfigurationValidee(forge), false);
+    assert.equal(configuration.contenuDuJeton(forge), undefined);
+    const e = chemins.evaluerChemin("src/a.ts", forge);
+    assert.equal(e.statut, "erreur_configuration");
+  }
+});
```

## Fichier 22 — test/mission/volume.test.ts

- Statut : créé
- SHA-256 initial : (sans objet)
- SHA-256 final : 4e447323155f95a5e77444c55b469e965e08920ed60d48d3136cd6f87cd58fb1
- Taille finale : 11872 octets, 240 lignes

```diff
--- /dev/null
+++ b/test/mission/volume.test.ts
@@ -0,0 +1,240 @@
+// Tests du volume de la politique (V1 à V7) : plafond structurel de 4 000 raisons d'élévation et
+// contrôle du document réellement produit (1 048 576 unités UTF-16, 10 000 nœuds), avec les
+// limites mêmes de l'analyseur strict utilisé par le vérificateur.
+//
+// Les bornes exactes sont atteintes par mesure, sans seuil fixe : la taille ou le nombre de nœuds
+// d'une politique de base est mesuré, puis complété au caractère ou au nœud près par des entrées
+// de lecture (une entrée de lecture ajoute exactement un nœud et 10 + n unités, n étant la
+// longueur de son nom ; la première ajoute 9 + n unités).
+
+import { test } from "node:test";
+import assert from "node:assert/strict";
+import profils from "../../config/profils.json" with { type: "json" };
+import reglesChemins from "../../config/regles-chemins.json" with { type: "json" };
+import schemaPolitique from "../../src/mission/schemas/politique.schema.json" with { type: "json" };
+import { validerConfigurationTexte, type ConfigurationValidee } from "../../src/mission/configuration.ts";
+import { NOEUDS_MAX_JSON, TAILLE_TEXTE_MAX } from "../../src/mission/json-strict.ts";
+import { calculerPolitiqueTexte, type ResultatPolitique } from "../../src/mission/politique.ts";
+import { verifierReglesPolitiqueTexte } from "../../src/mission/regles-politique.ts";
+
+// Racine courte : un chemin relatif de 235 caractères donne un chemin absolu de 240 caractères.
+const CONTEXTE = JSON.stringify({ racine_autorisee: "C:\\p", racine_bridge: "C:\\b" });
+
+interface ReglesChemins {
+  classification: { dossiers_sensibles: string[]; prefixes_sensibles: string[] };
+}
+
+function jeton(modifier: (rc: ReglesChemins) => void): ConfigurationValidee {
+  const rc = JSON.parse(JSON.stringify(reglesChemins)) as ReglesChemins;
+  modifier(rc);
+  const r = validerConfigurationTexte(JSON.stringify(profils), JSON.stringify(rc));
+  if (!r.ok) throw new Error(`configuration refusée : ${r.code} ${JSON.stringify(r.detail)}`);
+  return r.configuration;
+}
+
+// Configuration « préfixes longs » : chaîne de 11 préfixes imbriqués de 200 à 220 caractères.
+const SEGMENT_LONG = "d" + "x".repeat(199);
+const CHAINE = [SEGMENT_LONG, "a", "b", "c", "d", "e", "f", "g", "h", "i", "j"];
+const PREFIXES = CHAINE.map((_, i) => CHAINE.slice(0, i + 1).join("/"));
+const DOSSIER_PROFOND = CHAINE.join("/");
+const JETON_PREFIXES = jeton((rc) => {
+  rc.classification.prefixes_sensibles = [...PREFIXES];
+});
+
+// Configuration « dossiers courts » : 59 dossiers sensibles ajoutés (64 au total avec le plancher).
+const DOSSIERS = Array.from({ length: 59 }, (_, i) => `d${i}`);
+const JETON_DOSSIERS = jeton((rc) => {
+  rc.classification.dossiers_sensibles.push(...DOSSIERS);
+});
+
+/** Écriture de 235 caractères sous les 11 préfixes : 11 raisons d'élévation. */
+function ecritureLongue(i: number): string {
+  const nom = `f${i}`;
+  return `${DOSSIER_PROFOND}/${nom}${"z".repeat(14 - nom.length)}`;
+}
+
+/** Écriture traversant r dossiers sensibles courts : r raisons d'élévation. */
+function ecritureDossiers(i: number, r: number): string {
+  return r === 0 ? `g${i}` : `${DOSSIERS.slice(0, r).join("/")}/g${i}`;
+}
+
+function texteMission(ecriture: readonly string[], lecture: readonly string[]): string {
+  return JSON.stringify({
+    version: "1",
+    id: "M-volume",
+    objectif: "Test de volume.",
+    criteres_acceptation: [{ id: "A1", description: "x" }],
+    perimetre: { ecriture, lecture },
+    classe_demandee: "simple",
+  });
+}
+
+function calcul(ecriture: readonly string[], lecture: readonly string[], j: ConfigurationValidee): ResultatPolitique {
+  return calculerPolitiqueTexte(texteMission(ecriture, lecture), CONTEXTE, j);
+}
+
+/** Taille réelle (unités UTF-16) de la forme compacte, acceptée ou refusée pour sa taille. */
+function taille(r: ResultatPolitique): number {
+  if (r.ok) return JSON.stringify(r.politique).length;
+  if (r.code === "POLITIQUE_TROP_VOLUMINEUSE" && r.detail["sous_raison"] === "TAILLE_TEXTE") return r.detail["taille"] as number;
+  throw new Error(`refus inattendu : ${r.code} ${JSON.stringify(r.detail)}`);
+}
+
+/** Nombre de nœuds au sens de l'analyseur strict : chaque valeur JSON compte, racine comprise. */
+function noeuds(valeur: unknown): number {
+  if (typeof valeur !== "object" || valeur === null) return 1;
+  let n = 1;
+  for (const enfant of Object.values(valeur)) n += noeuds(enfant);
+  return n;
+}
+
+/** Entrées de lecture distinctes ajoutant exactement « ajout » unités à une liste vide. */
+function lecturesPour(ajout: number): string[] {
+  let m = Math.ceil((ajout + 1) / 245);
+  let somme = ajout + 1 - 10 * m;
+  while (m > 1 && somme < 5 * m) {
+    m -= 1;
+    somme = ajout + 1 - 10 * m;
+  }
+  if (somme < 5 * m || somme > 235 * m) throw new Error(`ajout impossible : ${ajout}`);
+  const longueurs = new Array<number>(m).fill(5);
+  let reste = somme - 5 * m;
+  for (let i = 0; i < m && reste > 0; i++) {
+    const supplement = Math.min(230, reste);
+    longueurs[i] = (longueurs[i] ?? 5) + supplement;
+    reste -= supplement;
+  }
+  return longueurs.map((n, i) => {
+    const base = `l${i}`;
+    return base + "a".repeat(n - base.length);
+  });
+}
+
+function ecrituresLongues(n: number): string[] {
+  return Array.from({ length: n }, (_, i) => ecritureLongue(i));
+}
+
+test("volume V7 : le calculateur et le vérificateur appliquent les mêmes limites", () => {
+  assert.equal(TAILLE_TEXTE_MAX, 1_048_576);
+  assert.equal(NOEUDS_MAX_JSON, 10_000);
+  const maxItems = (schemaPolitique as unknown as { properties: { raisons_elevation: { maxItems: number } } }).properties.raisons_elevation.maxItems;
+  assert.equal(maxItems, 4000, "plafond structurel du schéma");
+});
+
+test("volume V1 et V2 : plafond structurel de 4 000 raisons", () => {
+  // V2 : 199 écritures × 20 dossiers + 1 écriture × 21 dossiers = 4 001 raisons.
+  const v2 = Array.from({ length: 200 }, (_, i) => ecritureDossiers(i, i === 0 ? 21 : 20));
+  const r2 = calcul(v2, [], JETON_DOSSIERS);
+  assert.equal(r2.ok ? "ok" : r2.code, "RAISONS_ELEVATION_TROP_NOMBREUSES", "4 001 raisons");
+  if (!r2.ok) {
+    assert.equal(r2.detail["nombre"], 4001);
+    assert.equal(r2.detail["limite"], 4000);
+  }
+  // V1 : 200 écritures × 20 dossiers = exactement 4 000 raisons. Le plafond structurel n'est pas
+  // dépassé, mais le document dépasse la limite de nœuds de l'analyseur (4 nœuds par raison) :
+  // une politique de 4 000 raisons ne peut jamais être valide.
+  const v1 = Array.from({ length: 200 }, (_, i) => ecritureDossiers(i, 20));
+  const r1 = calcul(v1, [], JETON_DOSSIERS);
+  assert.equal(r1.ok ? "ok" : r1.code, "POLITIQUE_TROP_VOLUMINEUSE", "4 000 raisons");
+  if (!r1.ok) {
+    assert.equal(r1.detail["sous_raison"], "NOEUDS");
+    assert.equal(r1.detail["limite"], NOEUDS_MAX_JSON);
+  }
+});
+
+test("volume V3 : moins de 4 000 raisons mais document supérieur à 1 MiB", () => {
+  // 200 écritures × 11 préfixes longs = 2 200 raisons (< 4 000), nœuds < 10 000.
+  const r = calcul(ecrituresLongues(200), [], JETON_PREFIXES);
+  assert.equal(r.ok ? "ok" : r.code, "POLITIQUE_TROP_VOLUMINEUSE");
+  if (!r.ok) {
+    assert.equal(r.detail["sous_raison"], "TAILLE_TEXTE");
+    assert.ok((r.detail["taille"] as number) > TAILLE_TEXTE_MAX);
+    assert.equal(r.detail["limite"], TAILLE_TEXTE_MAX);
+  }
+});
+
+test("volume V4 et V5 : juste en dessous (égal) et juste au-dessus de la limite de taille", () => {
+  // Plus grand nombre d'écritures longues laissant au moins 300 unités de marge.
+  let n = 200;
+  let base = taille(calcul(ecrituresLongues(n), [], JETON_PREFIXES));
+  while (base > TAILLE_TEXTE_MAX - 300) {
+    n -= 1;
+    if (n === 0) throw new Error("aucune base sous la limite");
+    base = taille(calcul(ecrituresLongues(n), [], JETON_PREFIXES));
+  }
+  const ecritures = ecrituresLongues(n);
+  const lectures = lecturesPour(TAILLE_TEXTE_MAX - base);
+
+  // V4 : document de exactement 1 048 576 unités, accepté et relisible par le vérificateur.
+  const r4 = calcul(ecritures, lectures, JETON_PREFIXES);
+  assert.equal(r4.ok, true, r4.ok ? "" : `${r4.code} ${JSON.stringify(r4.detail)}`);
+  if (!r4.ok) return;
+  const texte = JSON.stringify(r4.politique);
+  assert.equal(texte.length, TAILLE_TEXTE_MAX, "taille exactement égale à la limite");
+  assert.ok(noeuds(r4.politique) <= NOEUDS_MAX_JSON);
+  assert.equal(verifierReglesPolitiqueTexte(texte, JETON_PREFIXES).ok, true, "relisible par le vérificateur");
+  // Cohérence V7 : un caractère de plus est refusé par le vérificateur.
+  const v = verifierReglesPolitiqueTexte(texte + " ", JETON_PREFIXES);
+  assert.equal(v.ok ? "ok" : v.code, "POLITIQUE_JSON_INVALIDE");
+  if (!v.ok) assert.equal(v.detail["sous_raison"], "TAILLE_TEXTE");
+
+  // V5 : une unité de plus (la dernière lecture s'allonge d'un caractère) : refus explicite.
+  const plus = [...lectures];
+  plus[plus.length - 1] = `${plus[plus.length - 1] ?? ""}a`;
+  const r5 = calcul(ecritures, plus, JETON_PREFIXES);
+  assert.equal(r5.ok ? "ok" : r5.code, "POLITIQUE_TROP_VOLUMINEUSE");
+  if (!r5.ok) {
+    assert.equal(r5.detail["sous_raison"], "TAILLE_TEXTE");
+    assert.equal(r5.detail["taille"], TAILLE_TEXTE_MAX + 1);
+  }
+});
+
+test("volume V6 : juste à la limite et juste au-dessus de la limite de nœuds", () => {
+  const un = calcul([ecritureDossiers(0, 59)], [], JETON_DOSSIERS);
+  if (!un.ok) throw new Error(`refus inattendu : ${un.code}`);
+  const parEcriture = 1 + 4 * 59;
+  const w = Math.floor((NOEUDS_MAX_JSON - noeuds(un.politique)) / parEcriture) + 1;
+  const ecritures = Array.from({ length: w }, (_, i) => ecritureDossiers(i, 59));
+  const rw = calcul(ecritures, [], JETON_DOSSIERS);
+  if (!rw.ok) throw new Error(`refus inattendu : ${rw.code} ${JSON.stringify(rw.detail)}`);
+  let manque = NOEUDS_MAX_JSON - noeuds(rw.politique);
+  assert.ok(manque >= 0 && manque < parEcriture);
+  if (manque >= 1) {
+    const r = Math.floor((manque - 1) / 4);
+    ecritures.push(ecritureDossiers(w, r));
+    manque -= 1 + 4 * r;
+  }
+  const lectures = Array.from({ length: manque }, (_, i) => `h${i}`);
+
+  const r6 = calcul(ecritures, lectures, JETON_DOSSIERS);
+  assert.equal(r6.ok, true, r6.ok ? "" : `${r6.code} ${JSON.stringify(r6.detail)}`);
+  if (!r6.ok) return;
+  assert.equal(noeuds(r6.politique), NOEUDS_MAX_JSON, "exactement 10 000 nœuds");
+  const texte = JSON.stringify(r6.politique);
+  assert.ok(texte.length <= TAILLE_TEXTE_MAX);
+  assert.equal(verifierReglesPolitiqueTexte(texte, JETON_DOSSIERS).ok, true, "relisible par le vérificateur");
+  // Cohérence V7 : un nœud de plus est refusé par le vérificateur.
+  const plusUnNoeud = texte.replace('"perimetre_lecture":[', '"perimetre_lecture":["C:\\\\p\\\\extra",');
+  assert.notEqual(plusUnNoeud, texte);
+  const v = verifierReglesPolitiqueTexte(plusUnNoeud, JETON_DOSSIERS);
+  assert.equal(v.ok ? "ok" : v.code, "POLITIQUE_JSON_INVALIDE");
+  if (!v.ok) assert.equal(v.detail["sous_raison"], "TAILLE");
+
+  // Un nœud de plus côté calculateur : refus explicite.
+  const r7 = calcul(ecritures, [...lectures, `h${lectures.length}`], JETON_DOSSIERS);
+  assert.equal(r7.ok ? "ok" : r7.code, "POLITIQUE_TROP_VOLUMINEUSE");
+  if (!r7.ok) assert.equal(r7.detail["sous_raison"], "NOEUDS");
+});
+
+test("volume V7 : toute politique acceptée ici est relisible par le vérificateur", () => {
+  const cas: ReadonlyArray<readonly [readonly string[], readonly string[], ConfigurationValidee]> = [
+    [[ecritureLongue(0)], [], JETON_PREFIXES],
+    [ecrituresLongues(50), lecturesPour(5000), JETON_PREFIXES],
+    [Array.from({ length: 30 }, (_, i) => ecritureDossiers(i, 59)), [], JETON_DOSSIERS],
+  ];
+  for (const [ecriture, lecture, j] of cas) {
+    const r = calcul(ecriture, lecture, j);
+    if (!r.ok) throw new Error(`refus inattendu : ${r.code} ${JSON.stringify(r.detail)}`);
+    assert.equal(verifierReglesPolitiqueTexte(JSON.stringify(r.politique), j).ok, true);
+  }
+});
```

