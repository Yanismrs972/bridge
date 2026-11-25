# Bridge v1 — correction de provenance — lot 09 sur 12

Référence : commit ffc0e3b (docs/REFERENCE.md) et livrable 1 (fichiers non suivis). Diff unifié à contexte complet : chaque diff contient le fichier entier ; les lignes « - » et « » donnent le contenu initial, les lignes « + » et « » le contenu final.

## Fichier 19 — test/mission/provenance.test.ts

- Statut : créé
- SHA-256 initial : (sans objet)
- SHA-256 final : 739d75c7ad71b55a2715ebef004baf0548a0312ef434957f66f719d656060222
- Taille finale : 11225 octets, 217 lignes

```diff
--- /dev/null
+++ b/test/mission/provenance.test.ts
@@ -0,0 +1,217 @@
+// Tests de provenance (D-04) : jeton opaque, registre privé, entrées en texte seulement.
+//
+// Fonctions qui exigent une provenance (le jeton enregistré, vérifié par identité en première
+// instruction, avant toute autre lecture) :
+//   1. calculerPolitiqueTexte(texteMission, texteContexte, configuration): ResultatPolitique
+//      — API publique : calcule la politique d'une mission.
+//   2. verifierReglesPolitiqueTexte(textePolitique, configuration): ResultatVerificationRegles
+//      — API publique : vérifie les EXCLUSIONS SEULEMENT d'une politique en texte.
+//   3. evaluerChemin(cheminRelatif, configuration): ResultatEvaluation
+//      — API publique : évalue un chemin relatif.
+//   4. contenuDuJeton(valeur): ContenuConfiguration | undefined
+//      — export technique : contenu gelé associé à un jeton enregistré, sinon undefined.
+// Aucune ne lit de propriété de l'argument « configuration » pour décider : seule l'identité compte.
+
+import { test } from "node:test";
+import assert from "node:assert/strict";
+import profils from "../../config/profils.json" with { type: "json" };
+import reglesChemins from "../../config/regles-chemins.json" with { type: "json" };
+import vecteursMissions from "../vecteurs/missions.json" with { type: "json" };
+import { evaluerChemin } from "../../src/mission/chemins.ts";
+import {
+  contenuDuJeton,
+  estConfigurationValidee,
+  validerConfigurationTexte,
+  type ConfigurationValidee,
+} from "../../src/mission/configuration.ts";
+import { analyserJsonStrict } from "../../src/mission/json-strict.ts";
+import { calculerPolitiqueTexte } from "../../src/mission/politique.ts";
+import { verifierReglesPolitiqueTexte } from "../../src/mission/regles-politique.ts";
+
+const TEXTE_PROFILS = JSON.stringify(profils);
+const TEXTE_REGLES = JSON.stringify(reglesChemins);
+const TEXTE_MISSION = JSON.stringify(vecteursMissions.base);
+const TEXTE_CONTEXTE = JSON.stringify(vecteursMissions.contexte);
+
+function jetonDeReference(): ConfigurationValidee {
+  const r = validerConfigurationTexte(TEXTE_PROFILS, TEXTE_REGLES);
+  if (!r.ok) throw new Error(`configuration de référence refusée : ${r.code}`);
+  return r.configuration;
+}
+
+const JETON = jetonDeReference();
+
+function textePolitiqueDeReference(): string {
+  const r = calculerPolitiqueTexte(TEXTE_MISSION, TEXTE_CONTEXTE, JETON);
+  if (!r.ok) throw new Error(`politique de référence refusée : ${r.code}`);
+  return JSON.stringify(r.politique);
+}
+
+const TEXTE_POLITIQUE = textePolitiqueDeReference();
+
+function analyse(texte: string): unknown {
+  const r = analyserJsonStrict(texte);
+  if (!r.ok) throw new Error("texte refusé");
+  return r.valeur;
+}
+
+/** Vérifie que la valeur est refusée, sans évaluation, par les quatre fonctions à provenance. */
+function refuseePartout(valeur: unknown, nom: string): void {
+  const e = evaluerChemin("src/a.ts", valeur);
+  assert.equal(e.statut, "erreur_configuration", `${nom} : evaluerChemin`);
+  if (e.statut === "erreur_configuration") assert.equal(e.code, "PROVENANCE_NON_GARANTIE", nom);
+  const p = calculerPolitiqueTexte(TEXTE_MISSION, TEXTE_CONTEXTE, valeur);
+  assert.equal(p.ok ? "ok" : p.code, "PROVENANCE_NON_GARANTIE", `${nom} : calculerPolitiqueTexte`);
+  const v = verifierReglesPolitiqueTexte(TEXTE_POLITIQUE, valeur);
+  assert.equal(v.ok ? "ok" : v.code, "PROVENANCE_NON_GARANTIE", `${nom} : verifierReglesPolitiqueTexte`);
+  assert.equal(contenuDuJeton(valeur), undefined, `${nom} : contenuDuJeton`);
+  assert.equal(estConfigurationValidee(valeur), false, `${nom} : estConfigurationValidee`);
+}
+
+test("provenance : le jeton de référence est accepté par les quatre fonctions", () => {
+  assert.equal(estConfigurationValidee(JETON), true);
+  assert.notEqual(contenuDuJeton(JETON), undefined);
+  assert.equal(evaluerChemin("src/a.ts", JETON).statut, "autorise");
+  assert.equal(calculerPolitiqueTexte(TEXTE_MISSION, TEXTE_CONTEXTE, JETON).ok, true);
+  assert.equal(verifierReglesPolitiqueTexte(TEXTE_POLITIQUE, JETON).ok, true);
+});
+
+test("provenance : des règles ou une configuration issues de analyserJsonStrict ne deviennent pas officielles", () => {
+  refuseePartout(analyse(JSON.stringify(reglesChemins.exclusion)), "règles d'exclusion analysées");
+  refuseePartout(analyse(TEXTE_REGLES), "regles-chemins analysées");
+  refuseePartout(analyse(TEXTE_PROFILS), "profils analysés");
+  refuseePartout(analyse(`{"profils":${TEXTE_PROFILS},"regles_chemins":${TEXTE_REGLES}}`), "configuration complète analysée");
+});
+
+test("provenance : le contenu associé à un jeton ne remplace jamais le jeton", () => {
+  const contenu = contenuDuJeton(JETON);
+  if (contenu === undefined) throw new Error("jeton de référence non enregistré");
+  refuseePartout(contenu, "contenu du jeton");
+  refuseePartout(contenu.regles_chemins, "règles de chemins du contenu");
+  refuseePartout(contenu.regles_chemins.exclusion, "règles d'exclusion du contenu");
+  refuseePartout(contenu.profils, "profils du contenu");
+});
+
+test("provenance : contrefaçons et copies du jeton refusées", () => {
+  const resultat = validerConfigurationTexte(TEXTE_PROFILS, TEXTE_REGLES);
+  const contrefacons: ReadonlyArray<readonly [string, unknown]> = [
+    ["objet vide", {}],
+    ["objet vide gelé", Object.freeze({})],
+    ["copie par décomposition", { ...(JETON as unknown as Record<string, unknown>) }],
+    ["aller-retour JSON", JSON.parse(JSON.stringify(JETON))],
+    ["objet dérivé du jeton", Object.create(JETON as unknown as object)],
+    ["jeton imbriqué dans un objet", { configuration: JETON }],
+    ["jeton dans un tableau", [JETON]],
+    ["résultat complet de validerConfigurationTexte", resultat],
+    ["configuration en objets", { profils, regles_chemins: reglesChemins }],
+    ["texte de la configuration", TEXTE_REGLES],
+    ["null", null],
+    ["undefined", undefined],
+    ["nombre", 0],
+    ["booléen", true],
+  ];
+  for (const [nom, valeur] of contrefacons) refuseePartout(valeur, nom);
+});
+
+test("provenance : le contrôle du jeton ne lit aucune propriété de l'argument", () => {
+  // Objet piégé : chaque lecture d'une propriété connue incrémente le compteur. (Les objets
+  // d'interception dynamique sont interdits par la règle lexicale L1, y compris dans les tests.)
+  let lectures = 0;
+  const piege: Record<string, unknown> = {};
+  for (const cle of ["profils", "regles_chemins", "exclusion", "classification", "segments_interdits", "secrets", "version", "configuration", "ok", "then"]) {
+    Object.defineProperty(piege, cle, {
+      get: () => {
+        lectures += 1;
+        return undefined;
+      },
+      enumerable: true,
+    });
+  }
+  refuseePartout(piege, "objet piégé");
+  assert.equal(lectures, 0, "aucune lecture de propriété pendant le contrôle de provenance");
+});
+
+test("provenance : jeton opaque et gelé", () => {
+  assert.deepEqual(Object.keys(JETON), []);
+  assert.equal(Object.isFrozen(JETON), true);
+  const r = validerConfigurationTexte(TEXTE_PROFILS, TEXTE_REGLES);
+  assert.equal(Object.isFrozen(r), true, "résultat gelé");
+  let modifie = false;
+  try {
+    (JETON as unknown as Record<string, unknown>)["regles"] = {};
+    modifie = true;
+  } catch {
+    modifie = false;
+  }
+  assert.equal(modifie, false, "affectation refusée sur le jeton");
+});
+
+test("provenance : chaque validation produit un nouveau jeton (aucune configuration implicite ni cache)", () => {
+  const a = validerConfigurationTexte(TEXTE_PROFILS, TEXTE_REGLES);
+  const b = validerConfigurationTexte(TEXTE_PROFILS, TEXTE_REGLES);
+  if (!a.ok || !b.ok) throw new Error("configuration de référence refusée");
+  assert.notEqual(a.configuration, b.configuration);
+  assert.equal(estConfigurationValidee(a.configuration), true);
+  assert.equal(estConfigurationValidee(b.configuration), true);
+});
+
+test("provenance : un jeton est réutilisable sans revalidation (50 missions, 500 évaluations)", () => {
+  // L'absence de revalidation se vérifie à la revue du diff : aucune fonction qui reçoit le jeton
+  // n'appelle de fonction de validation de la configuration.
+  const reference = calculerPolitiqueTexte(TEXTE_MISSION, TEXTE_CONTEXTE, JETON);
+  for (let i = 0; i < 50; i++) {
+    const r = calculerPolitiqueTexte(TEXTE_MISSION, TEXTE_CONTEXTE, JETON);
+    assert.deepEqual(r, reference, `mission ${i}`);
+  }
+  const chemins = ["src/a.ts", ".env", "src/FastClip/x", "a/../b", "docs/guide.md"];
+  const attendus = chemins.map((c) => evaluerChemin(c, JETON));
+  for (let i = 0; i < 100; i++) {
+    for (let j = 0; j < chemins.length; j++) assert.deepEqual(evaluerChemin(chemins[j], JETON), attendus[j]);
+  }
+  assert.equal(Object.isFrozen(JETON), true);
+  assert.equal(estConfigurationValidee(JETON), true);
+});
+
+test("provenance : les entrées objets sont refusées (texte strict seulement)", () => {
+  const c = validerConfigurationTexte(profils as unknown, reglesChemins as unknown);
+  assert.equal(c.ok ? "ok" : c.code, "CONFIGURATION_INVALIDE", "configuration en objets");
+  if (!c.ok) assert.equal(c.detail["raison"], "TYPE");
+  const p = calculerPolitiqueTexte(vecteursMissions.base as unknown, TEXTE_CONTEXTE, JETON);
+  assert.equal(p.ok ? "ok" : p.code, "MISSION_INVALIDE", "mission en objet");
+  const q = calculerPolitiqueTexte(analyse(TEXTE_MISSION), TEXTE_CONTEXTE, JETON);
+  assert.equal(q.ok ? "ok" : q.code, "MISSION_INVALIDE", "mission déjà analysée passée en objet");
+});
+
+test("provenance : clés dupliquées refusées dans la mission, le contexte et la configuration", () => {
+  const missionRacine = TEXTE_MISSION.replace('"version":"1"', '"version":"1","version":"1"');
+  const missionPerimetre = TEXTE_MISSION.replace('"perimetre":{', '"perimetre":{"lecture":[],');
+  const missionCritere = TEXTE_MISSION.replace('{"id":"A1"', '{"id":"A1","id":"A1"');
+  for (const [nom, texte] of [
+    ["mission (racine)", missionRacine],
+    ["mission (périmètre)", missionPerimetre],
+    ["mission (critère)", missionCritere],
+  ] as const) {
+    assert.notEqual(texte, TEXTE_MISSION, nom);
+    const r = calculerPolitiqueTexte(texte, TEXTE_CONTEXTE, JETON);
+    assert.equal(r.ok ? "ok" : r.code, "MISSION_INVALIDE", nom);
+    if (!r.ok) assert.equal(r.detail["sous_raison"], "CLE_DUPLIQUEE", nom);
+  }
+
+  const contexte = TEXTE_CONTEXTE.replace('{"racine_autorisee":', '{"racine_bridge":"C:\\\\x","racine_autorisee":');
+  assert.notEqual(contexte, TEXTE_CONTEXTE);
+  const rc = calculerPolitiqueTexte(TEXTE_MISSION, contexte, JETON);
+  assert.equal(rc.ok ? "ok" : rc.code, "CONTEXTE_INVALIDE", "contexte");
+  if (!rc.ok) assert.equal(rc.detail["sous_raison"], "CLE_DUPLIQUEE", "contexte");
+
+  const profilsDoubles = TEXTE_PROFILS.replace('"version":"1"', '"version":"1","version":"1"');
+  const reglesDoubles = TEXTE_REGLES.replace('"version":"1"', '"version":"1","version":"1"');
+  for (const [nom, tp, tr] of [
+    ["profils", profilsDoubles, TEXTE_REGLES],
+    ["regles-chemins", TEXTE_PROFILS, reglesDoubles],
+  ] as const) {
+    assert.notEqual(tp + tr, TEXTE_PROFILS + TEXTE_REGLES, nom);
+    const r = validerConfigurationTexte(tp, tr);
+    assert.equal(r.ok ? "ok" : r.code, "CONFIGURATION_INVALIDE", nom);
+    if (!r.ok) assert.equal(r.detail["sous_raison"], "CLE_DUPLIQUEE", nom);
+  }
+});
```

## Fichier 20 — test/mission/plancher.test.ts

- Statut : créé
- SHA-256 initial : (sans objet)
- SHA-256 final : b4fba14a98df859111fda4d09be55abdd592fe234f65027882c6d71d1c34222a
- Taille finale : 14762 octets, 290 lignes

```diff
--- /dev/null
+++ b/test/mission/plancher.test.ts
@@ -0,0 +1,290 @@
+// Tests du plancher de sécurité immuable (D-04).
+//
+// Deux comparaisons distinctes :
+//   - DÉFINITION des règles (validation de la configuration) : stricte, au caractère près
+//     (forme canonique : id, type, valeur ; chaîne identique pour la classification) ;
+//   - CHEMINS Windows (évaluation, périmètre, classification) : insensible à la casse.
+
+import { test } from "node:test";
+import assert from "node:assert/strict";
+import profils from "../../config/profils.json" with { type: "json" };
+import reglesChemins from "../../config/regles-chemins.json" with { type: "json" };
+import vecteursMissions from "../vecteurs/missions.json" with { type: "json" };
+import { evaluerChemin } from "../../src/mission/chemins.ts";
+import { validerConfigurationTexte, type ResultatConfiguration } from "../../src/mission/configuration.ts";
+import { calculerPolitiqueTexte } from "../../src/mission/politique.ts";
+import { verifierReglesPolitiqueTexte } from "../../src/mission/regles-politique.ts";
+
+interface Regle {
+  id: string;
+  type: string;
+  valeur: string;
+}
+
+interface ReglesChemins {
+  version: string;
+  exclusion: { version: string; segments_interdits: Regle[]; secrets: Regle[]; [cle: string]: unknown };
+  classification: { fichiers_sensibles: string[]; dossiers_sensibles: string[]; prefixes_sensibles: string[] };
+  [cle: string]: unknown;
+}
+
+// Copie littérale du plancher attendu (48 entrées), indépendante du code du noyau.
+const PLANCHER_FASTCLIP: Regle = { id: "INT-FASTCLIP", type: "contient", valeur: "fastclip" };
+const PLANCHER_SECRETS: readonly Regle[] = [
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
+];
+const PLANCHER_FICHIERS: readonly string[] = [
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
+];
+const PLANCHER_DOSSIERS: readonly string[] = [".claude", ".github", ".git", "migrations", ".vscode"];
+
+function regles(): ReglesChemins {
+  return JSON.parse(JSON.stringify(reglesChemins)) as ReglesChemins;
+}
+
+function valider(rc: ReglesChemins): ResultatConfiguration {
+  return validerConfigurationTexte(JSON.stringify(profils), JSON.stringify(rc));
+}
+
+function code(r: ResultatConfiguration): string {
+  return r.ok ? "ok" : r.code;
+}
+
+function refusPlancher(r: ResultatConfiguration, attendu: Readonly<Record<string, unknown>>, message: string): void {
+  assert.equal(r.ok ? "ok" : r.code, "PLANCHER_SECURITE_NON_RESPECTE", message);
+  if (!r.ok) for (const [cle, valeur] of Object.entries(attendu)) assert.equal(r.detail[cle], valeur, `${message} : ${cle}`);
+}
+
+test("plancher : 48 entrées, identiques à la configuration de référence, qui est acceptée", () => {
+  const rc = regles();
+  assert.deepEqual(rc.exclusion.segments_interdits, [PLANCHER_FASTCLIP]);
+  assert.deepEqual(rc.exclusion.secrets, PLANCHER_SECRETS);
+  assert.deepEqual(rc.classification.fichiers_sensibles, PLANCHER_FICHIERS);
+  assert.deepEqual(rc.classification.dossiers_sensibles, PLANCHER_DOSSIERS);
+  assert.equal(1 + PLANCHER_SECRETS.length + PLANCHER_FICHIERS.length + PLANCHER_DOSSIERS.length, 48);
+  assert.equal(PLANCHER_SECRETS.length, 31);
+  assert.equal(valider(rc).ok, true);
+});
+
+test("plancher : suppression de chacune des 31 règles de secrets", () => {
+  for (let i = 0; i < PLANCHER_SECRETS.length; i++) {
+    const rc = regles();
+    const [retiree] = rc.exclusion.secrets.splice(i, 1);
+    refusPlancher(valider(rc), { categorie: "secrets", id: retiree?.id, raison: "ABSENTE" }, `suppression ${retiree?.id}`);
+  }
+});
+
+test("plancher : suppression ou remplacement de la règle Fastclip", () => {
+  // Suppression seule : la liste devient vide, refus structurel préalable (code inchangé).
+  const vide = regles();
+  vide.exclusion.segments_interdits.splice(0, 1);
+  assert.equal(code(valider(vide)), "CONFIGURATION_INVALIDE", "liste vide");
+  // Remplacement par une règle équivalente d'un autre identifiant : le plancher exige INT-FASTCLIP.
+  const remplacee = regles();
+  remplacee.exclusion.segments_interdits = [{ id: "INT-AUTRE", type: "contient", valeur: "fastclip" }];
+  refusPlancher(valider(remplacee), { categorie: "segments_interdits", id: "INT-FASTCLIP", raison: "ABSENTE" }, "autre identifiant");
+  // Valeur différente : refus structurel préalable (REGLE_FASTCLIP_ABSENTE).
+  const autre = regles();
+  const premiere = autre.exclusion.segments_interdits[0];
+  if (premiere === undefined) throw new Error("règle Fastclip absente de la référence");
+  premiere.valeur = "fastclipx";
+  const r = valider(autre);
+  assert.equal(r.ok ? "ok" : r.code, "CONFIGURATION_INVALIDE", "valeur différente");
+  if (!r.ok) assert.equal(r.detail["raison"], "REGLE_FASTCLIP_ABSENTE");
+});
+
+test("plancher : changement de casse de la définition Fastclip refusé (comparaison stricte)", () => {
+  for (const valeur of ["Fastclip", "FastClip", "FASTCLIP"]) {
+    const rc = regles();
+    const premiere = rc.exclusion.segments_interdits[0];
+    if (premiere === undefined) throw new Error("règle Fastclip absente de la référence");
+    premiere.valeur = valeur;
+    refusPlancher(valider(rc), { categorie: "segments_interdits", id: "INT-FASTCLIP", raison: "MODIFIEE" }, valeur);
+  }
+});
+
+test("plancher : modification de la valeur de chaque règle de secrets", () => {
+  for (let i = 0; i < PLANCHER_SECRETS.length; i++) {
+    const rc = regles();
+    const regle = rc.exclusion.secrets[i];
+    if (regle === undefined) throw new Error("règle absente");
+    regle.valeur = `x${i}y`;
+    refusPlancher(
+      valider(rc),
+      { categorie: "secrets", id: regle.id, raison: "MODIFIEE", pointeur: `/regles_chemins/exclusion/secrets/${i}` },
+      `valeur ${regle.id}`,
+    );
+    // Changement de casse de la définition : également refusé.
+    const casse = regles();
+    const r2 = casse.exclusion.secrets[i];
+    if (r2 === undefined) throw new Error("règle absente");
+    r2.valeur = r2.valeur.toUpperCase();
+    refusPlancher(valider(casse), { categorie: "secrets", id: r2.id, raison: "MODIFIEE" }, `casse ${r2.id}`);
+  }
+});
+
+test("plancher : modification du type de chaque règle de secrets", () => {
+  const autreType: Readonly<Record<string, string>> = { nom_exact: "prefixe", prefixe: "suffixe", suffixe: "prefixe" };
+  for (let i = 0; i < PLANCHER_SECRETS.length; i++) {
+    const rc = regles();
+    const regle = rc.exclusion.secrets[i];
+    if (regle === undefined) throw new Error("règle absente");
+    regle.type = autreType[regle.type] ?? "prefixe";
+    const r = valider(rc);
+    if (regle.id === "SEC-PRE-ENV") {
+      // « .env. » en suffixe se termine par un point : refus structurel préalable.
+      assert.equal(r.ok ? "ok" : r.code, "CONFIGURATION_INVALIDE", regle.id);
+      continue;
+    }
+    refusPlancher(r, { categorie: "secrets", id: regle.id, raison: "MODIFIEE" }, `type ${regle.id}`);
+  }
+});
+
+test("plancher : renommage de l'identifiant d'une règle refusé", () => {
+  const rc = regles();
+  const regle = rc.exclusion.secrets[3];
+  if (regle === undefined) throw new Error("règle absente");
+  const ancien = regle.id;
+  regle.id = "SEC-RENOMMEE";
+  refusPlancher(valider(rc), { categorie: "secrets", id: ancien, raison: "ABSENTE" }, "renommage");
+});
+
+test("plancher : règles contradictoires et champs de désactivation ou de portée refusés", () => {
+  const doublonCasse = regles();
+  doublonCasse.exclusion.secrets.push({ id: "SEC-EXACT-SSH-MAJ", type: "nom_exact", valeur: ".SSH" });
+  const r1 = valider(doublonCasse);
+  assert.equal(r1.ok ? "ok" : r1.code, "CONFIGURATION_INVALIDE", "doublon en casse différente");
+  if (!r1.ok) assert.equal(r1.detail["raison"], "REGLE_EN_DOUBLE");
+
+  const doublonFastclip = regles();
+  doublonFastclip.exclusion.segments_interdits.push({ id: "INT-FASTCLIP-MAJ", type: "contient", valeur: "FASTCLIP" });
+  const r2 = valider(doublonFastclip);
+  assert.equal(r2.ok ? "ok" : r2.code, "CONFIGURATION_INVALIDE", "doublon Fastclip");
+
+  const desactivee = regles();
+  (desactivee.exclusion.secrets[0] as unknown as Record<string, unknown>)["desactive"] = true;
+  assert.equal(code(valider(desactivee)), "CONFIGURATION_INVALIDE", "champ de désactivation");
+
+  const portee = regles();
+  portee.exclusion["portee"] = "segment_final";
+  assert.equal(code(valider(portee)), "CONFIGURATION_INVALIDE", "champ de portée");
+
+  const autoriser = regles();
+  (autoriser.exclusion.secrets as unknown as unknown[]).push({ id: "SEC-AUTORISER", type: "autoriser", valeur: ".ssh" });
+  assert.equal(code(valider(autoriser)), "CONFIGURATION_INVALIDE", "type de règle d'exception");
+});
+
+test("plancher : suppression ou changement de casse de chaque fichier et dossier sensible", () => {
+  for (const [categorie, plancher] of [
+    ["fichiers_sensibles", PLANCHER_FICHIERS],
+    ["dossiers_sensibles", PLANCHER_DOSSIERS],
+  ] as const) {
+    for (let i = 0; i < plancher.length; i++) {
+      const rc = regles();
+      const liste = rc.classification[categorie];
+      const [retiree] = liste.splice(i, 1);
+      refusPlancher(valider(rc), { categorie, valeur: retiree, raison: "ABSENTE" }, `suppression ${retiree}`);
+
+      const casse = regles();
+      const listeCasse = casse.classification[categorie];
+      const valeur = listeCasse[i];
+      if (valeur === undefined) throw new Error("entrée absente");
+      listeCasse[i] = valeur.toUpperCase() === valeur ? valeur.toLowerCase() : valeur.toUpperCase();
+      refusPlancher(valider(casse), { categorie, valeur, raison: "ABSENTE" }, `casse ${valeur}`);
+    }
+  }
+});
+
+test("plancher : ajouts acceptés, position indifférente", () => {
+  const rc = regles();
+  rc.exclusion.secrets.push({ id: "SEC-EXACT-AUTRE", type: "nom_exact", valeur: ".autre" });
+  rc.exclusion.segments_interdits.push({ id: "INT-AUTRE", type: "contient", valeur: "AutreProjet" });
+  rc.exclusion.secrets.reverse();
+  rc.classification.fichiers_sensibles.push("Makefile");
+  rc.classification.fichiers_sensibles.reverse();
+  rc.classification.dossiers_sensibles.push("infra");
+  rc.classification.prefixes_sensibles.push("src/auth");
+  const r = valider(rc);
+  assert.equal(r.ok, true, r.ok ? "" : `${r.code} ${JSON.stringify(r.detail)}`);
+});
+
+test("plancher : le contrôle de structure précède le plancher", () => {
+  const rc = regles();
+  rc.exclusion.secrets.splice(0, 1);
+  rc.exclusion.secrets.push({ id: "SEC-INVALIDE", type: "nom_exact", valeur: "a/b" });
+  const r = valider(rc);
+  assert.equal(r.ok ? "ok" : r.code, "CONFIGURATION_INVALIDE");
+});
+
+test("plancher : de bout en bout, la politique contient le plancher et les ajouts", () => {
+  const rc = regles();
+  rc.exclusion.secrets.push({ id: "SEC-EXACT-AUTRE", type: "nom_exact", valeur: ".autre" });
+  const v = valider(rc);
+  if (!v.ok) throw new Error(`configuration étendue refusée : ${v.code}`);
+  const p = calculerPolitiqueTexte(JSON.stringify(vecteursMissions.base), JSON.stringify(vecteursMissions.contexte), v.configuration);
+  if (!p.ok) throw new Error(`politique refusée : ${p.code}`);
+  const recues = p.politique.exclusions_lecture_obligatoires.regles;
+  assert.deepEqual(recues.segments_interdits, [PLANCHER_FASTCLIP]);
+  for (const regle of PLANCHER_SECRETS) assert.ok(recues.secrets.some((x) => x.id === regle.id && x.type === regle.type && x.valeur === regle.valeur), regle.id);
+  assert.ok(recues.secrets.some((x) => x.id === "SEC-EXACT-AUTRE"));
+  assert.equal(verifierReglesPolitiqueTexte(JSON.stringify(p.politique), v.configuration).ok, true);
+});
+
+test("plancher : les chemins restent comparés sans tenir compte de la casse", () => {
+  const v = valider(regles());
+  if (!v.ok) throw new Error("configuration de référence refusée");
+  const jeton = v.configuration;
+  for (const chemin of ["fastclip/x", "Fastclip/x", "FastClip/x", "FASTCLIP/x", "src/monFastClip.ts", "outils/fastCLIP"]) {
+    const r = evaluerChemin(chemin, jeton);
+    assert.equal(r.statut === "exclu" ? r.code : r.statut, "CHEMIN_INTERDIT", chemin);
+  }
+  for (const chemin of [".SSH/config", ".Env", "cles/ID_RSA.pub", "certificat.PEM"]) {
+    const r = evaluerChemin(chemin, jeton);
+    assert.equal(r.statut === "exclu" ? r.code : r.statut, "CHEMIN_SECRET", chemin);
+  }
+  const mission = { ...vecteursMissions.base, perimetre: { ecriture: ["PACKAGE.JSON", ".GITHUB/workflows/ci.yml", "src/Migrations/1.sql"] } };
+  const p = calculerPolitiqueTexte(JSON.stringify(mission), JSON.stringify(vecteursMissions.contexte), jeton);
+  if (!p.ok) throw new Error(`politique refusée : ${p.code}`);
+  assert.equal(p.politique.classe_effective, "sensible");
+  assert.deepEqual(p.politique.raisons_elevation.map((x) => x.regle).sort(), ["dossier_sensible", "dossier_sensible", "fichier_sensible"]);
+});
```

