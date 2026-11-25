# Bridge v1 — correction de provenance — lot 12 sur 12

Référence : commit ffc0e3b (docs/REFERENCE.md) et livrable 1 (fichiers non suivis). Diff unifié à contexte complet : chaque diff contient le fichier entier ; les lignes « - » et « » donnent le contenu initial, les lignes « + » et « » le contenu final.

## Fichier 24 — test/vecteurs/exclusions.json

- Statut : modifié
- SHA-256 initial : 3caee21391e40bef60ce86c99fd17f71f6a9f79f9ffdad1a6536dd9393e828db
- SHA-256 final : 6f740092b2bae85d429edce8206de75ccdaa1a18b2ce418593d02664a8b06203
- Taille finale : 5281 octets, 30 lignes

```diff
--- a/test/vecteurs/exclusions.json
+++ b/test/vecteurs/exclusions.json
@@ -1,30 +1,30 @@
 {
   "description": "Mutations de la politique de référence (mission de base) avant vérification par verifierReglesPolitiqueTexte. Les chemins des opérations partent de la politique. Les neuf suppressions et les huit modifications de valeurs fixes sont aussi générées par les tests.",
   "vecteurs": [
     { "nom": "politique conforme", "operations": [], "attendu": "ok" },
     { "nom": "propriétés réordonnées", "operations": [{ "type": "reordonner", "chemin": ["exclusions_lecture_obligatoires"] }], "attendu": "ok" },
     { "nom": "objet absent", "operations": [{ "type": "supprimer", "chemin": ["exclusions_lecture_obligatoires"] }], "attendu": "REGLES_EXCLUSION_ABSENTES" },
     { "nom": "propriété commentaire en plus", "operations": [{ "type": "definir", "chemin": ["exclusions_lecture_obligatoires", "commentaire"], "valeur": "x" }], "attendu": "REGLES_EXCLUSION_INVALIDES" },
     { "nom": "ancien format regles_secrets", "operations": [{ "type": "definir", "chemin": ["exclusions_lecture_obligatoires", "regles_secrets"], "valeur": [] }], "attendu": "REGLES_EXCLUSION_INVALIDES" },
     { "nom": "regles absente", "operations": [{ "type": "supprimer", "chemin": ["exclusions_lecture_obligatoires", "regles"] }], "attendu": "REGLES_EXCLUSION_INVALIDES" },
     { "nom": "version 1", "operations": [{ "type": "definir", "chemin": ["exclusions_lecture_obligatoires", "version"], "valeur": "1" }], "attendu": "REGLES_EXCLUSION_INVALIDES" },
     { "nom": "type_entree_indetermine IGNORER", "operations": [{ "type": "definir", "chemin": ["exclusions_lecture_obligatoires", "type_entree_indetermine"], "valeur": "IGNORER" }], "attendu": "REGLES_EXCLUSION_INVALIDES" },
     { "nom": "statut appliquee", "operations": [{ "type": "definir", "chemin": ["exclusions_lecture_obligatoires", "statut_dans_le_noyau"], "valeur": "appliquee" }], "attendu": "REGLES_EXCLUSION_INVALIDES" },
     { "nom": "forme jcs", "operations": [{ "type": "definir", "chemin": ["exclusions_lecture_obligatoires", "forme_canonique_regles"], "valeur": "jcs" }], "attendu": "REGLES_EXCLUSION_INVALIDES" },
     { "nom": "portée modifiée", "operations": [{ "type": "definir", "chemin": ["exclusions_lecture_obligatoires", "portee"], "valeur": "perimetre_mission" }], "attendu": "REGLES_EXCLUSION_INVALIDES" },
     { "nom": "sémantique modifiée", "operations": [{ "type": "definir", "chemin": ["exclusions_lecture_obligatoires", "semantique"], "valeur": "segment_final" }], "attendu": "REGLES_EXCLUSION_INVALIDES" },
     { "nom": "valeur fixe en tableau", "operations": [{ "type": "definir", "chemin": ["exclusions_lecture_obligatoires", "type_entree_indetermine"], "valeur": ["REFUS"] }], "attendu": "REGLES_EXCLUSION_INVALIDES" },
     { "nom": "valeur fixe en nombre", "operations": [{ "type": "definir", "chemin": ["exclusions_lecture_obligatoires", "version"], "valeur": 2 }], "attendu": "REGLES_EXCLUSION_INVALIDES" },
     { "nom": "regles avec propriété en plus", "operations": [{ "type": "definir", "chemin": ["exclusions_lecture_obligatoires", "regles", "autre"], "valeur": [] }], "attendu": "REGLES_EXCLUSION_INVALIDES" },
     { "nom": "regles sans secrets", "operations": [{ "type": "supprimer", "chemin": ["exclusions_lecture_obligatoires", "regles", "secrets"] }], "attendu": "REGLES_EXCLUSION_INVALIDES" },
     { "nom": "segments interdits vides", "operations": [{ "type": "definir", "chemin": ["exclusions_lecture_obligatoires", "regles", "segments_interdits"], "valeur": [] }], "attendu": "REGLES_EXCLUSION_INVALIDES" },
     { "nom": "champ cible dans une règle", "operations": [{ "type": "definir", "chemin": ["exclusions_lecture_obligatoires", "regles", "secrets", 0, "cible"], "valeur": "segment_final" }], "attendu": "REGLES_EXCLUSION_INVALIDES" },
     { "nom": "regles en version 2", "operations": [{ "type": "definir", "chemin": ["exclusions_lecture_obligatoires", "regles", "version"], "valeur": "2" }], "attendu": "REGLES_EXCLUSION_INVALIDES" },
-    { "nom": "fastclip retirée", "operations": [{ "type": "definir", "chemin": ["exclusions_lecture_obligatoires", "regles", "segments_interdits", 0, "valeur"], "valeur": "autre" }], "attendu": "REGLES_EXCLUSION_INVALIDES" },
+    { "nom": "fastclip retirée", "operations": [{ "type": "definir", "chemin": ["exclusions_lecture_obligatoires", "regles", "segments_interdits", 0, "valeur"], "valeur": "autre" }], "attendu": "REGLES_EXCLUSION_DIFFERENTES" },
     { "nom": "règle secrète retirée", "operations": [{ "type": "supprimer", "chemin": ["exclusions_lecture_obligatoires", "regles", "secrets", 0] }], "attendu": "REGLES_EXCLUSION_DIFFERENTES" },
     { "nom": "valeur FASTCLIP en majuscules", "operations": [{ "type": "definir", "chemin": ["exclusions_lecture_obligatoires", "regles", "segments_interdits", 0, "valeur"], "valeur": "FASTCLIP" }], "attendu": "REGLES_EXCLUSION_DIFFERENTES" },
     { "nom": "deux secrets inversés", "operations": [{ "type": "echanger", "chemin": ["exclusions_lecture_obligatoires", "regles", "secrets"], "i": 0, "j": 1 }], "attendu": "REGLES_EXCLUSION_DIFFERENTES" },
     { "nom": "règle secrète ajoutée", "operations": [{ "type": "pousser", "chemin": ["exclusions_lecture_obligatoires", "regles", "secrets"], "valeur": { "id": "SEC-EXACT-AUTRE", "type": "nom_exact", "valeur": ".autre" } }], "attendu": "REGLES_EXCLUSION_DIFFERENTES" },
     { "nom": "politique qui n'est pas un objet", "operations": [{ "type": "remplacer_racine", "chemin": [], "valeur": ["x"] }], "attendu": "REGLES_EXCLUSION_ABSENTES" }
   ]
 }
```

## Fichier 25 — test/vecteurs/missions.json

- Statut : modifié
- SHA-256 initial : 167ffbe9351c2b4d5e410dbe33278da22590f7bec329ab7542d63b621bea73be
- SHA-256 final : e308767b6ccafce1a542f7d8d6f013ff7d5498c36c36995136a8d4b7aef6b850
- Taille finale : 16310 octets, 170 lignes

```diff
--- a/test/vecteurs/missions.json
+++ b/test/vecteurs/missions.json
@@ -1,153 +1,170 @@
 {
   "description": "Vecteurs purs de calculerPolitique : missions, contextes, configurations et préfixes sensibles. Les valeurs de profils sont provisoires.",
   "contexte": {
     "racine_autorisee": "C:\\Users\\demo\\projets\\exemple",
     "racine_bridge": "C:\\Outils\\bridge"
   },
   "base": {
     "version": "1",
     "id": "M-exemple-01",
     "objectif": "Corriger un libellé.",
     "criteres_acceptation": [{ "id": "A1", "description": "Le libellé est corrigé." }],
     "perimetre": { "ecriture": ["src/libelle.ts"], "lecture": ["docs/guide.md"] },
     "classe_demandee": "simple"
   },
   "missions": [
     {
       "nom": "nominale simple",
       "attendu": {
         "ok": true,
         "classe_effective": "simple",
         "limites": {
           "tours_claude_par_appel": 30,
           "appels_claude": 4,
           "appels_codex": 4,
           "corrections": 2,
           "duree_max_min": 30,
           "delai_appel_claude_min": 10,
           "delai_appel_codex_min": 5
         },
         "validations_humaines": ["lancement", "fin"],
         "regles_elevation": [],
         "perimetre_ecriture": ["C:\\Users\\demo\\projets\\exemple\\src\\libelle.ts"],
         "perimetre_lecture": ["C:\\Users\\demo\\projets\\exemple\\docs\\guide.md"]
       }
     },
     { "nom": "classe complexe", "fusion": { "classe_demandee": "complexe" }, "attendu": { "ok": true, "classe_effective": "complexe", "limites": { "appels_claude": 10, "duree_max_min": 90 }, "validations_humaines": ["lancement", "fin"] } },
     { "nom": "classe sensible demandée sans motif", "fusion": { "classe_demandee": "sensible" }, "attendu": { "ok": true, "classe_effective": "sensible", "limites": { "appels_claude": 4, "corrections": 1 }, "validations_humaines": ["lancement", "plan", "fin"], "regles_elevation": [] } },
     { "nom": "limite inférieure au plafond", "fusion": { "limites_demandees": { "appels_claude": 3 } }, "attendu": { "ok": true, "classe_effective": "simple", "limites": { "appels_claude": 3, "appels_codex": 4 } } },
     { "nom": "limite égale au plafond", "fusion": { "limites_demandees": { "appels_claude": 4 } }, "attendu": { "ok": true, "classe_effective": "simple", "limites": { "appels_claude": 4 } } },
     {
       "nom": "limite plafond plus un",
       "fusion": { "limites_demandees": { "appels_claude": 5 } },
       "attendu": { "ok": false, "code": "LIMITE_SUPERIEURE_AU_PLAFOND", "detail": { "cle": "appels_claude", "demande": 5, "plafond": 4, "classe_effective": "simple", "apres_elevation": false } }
     },
     {
       "nom": "limite valide en complexe mais refusée après élévation",
       "fusion": { "classe_demandee": "complexe", "limites_demandees": { "appels_claude": 8 }, "perimetre": { "ecriture": ["package.json"] } },
       "attendu": { "ok": false, "code": "LIMITE_SUPERIEURE_AU_PLAFOND", "detail": { "cle": "appels_claude", "demande": 8, "plafond": 4, "classe_effective": "sensible", "apres_elevation": true } }
     },
     {
       "nom": "limite valide après élévation",
       "fusion": { "classe_demandee": "complexe", "limites_demandees": { "appels_claude": 3 }, "perimetre": { "ecriture": ["package.json"] } },
       "attendu": { "ok": true, "classe_effective": "sensible", "limites": { "appels_claude": 3, "corrections": 1 } }
     },
     { "nom": "indicateur demandé", "fusion": { "limites_demandees": { "budget_global_usd": 1 } }, "attendu": { "ok": false, "code": "CHAMP_NON_PREVU" } },
     { "nom": "limite nulle", "fusion": { "limites_demandees": { "appels_claude": 0 } }, "attendu": { "ok": false, "code": "LIMITE_INVALIDE" } },
     { "nom": "limite décimale", "fusion": { "limites_demandees": { "appels_claude": 1.5 } }, "attendu": { "ok": false, "code": "LIMITE_INVALIDE" } },
     { "nom": "limite négative", "fusion": { "limites_demandees": { "corrections": -1 } }, "attendu": { "ok": false, "code": "LIMITE_INVALIDE" } },
     { "nom": "limite en chaîne", "fusion": { "limites_demandees": { "appels_claude": "3" } }, "attendu": { "ok": false, "code": "LIMITE_INVALIDE" } },
     { "nom": "champ outils", "fusion": { "outils": ["Bash"] }, "attendu": { "ok": false, "code": "CHAMP_NON_PREVU" } },
     { "nom": "champ permissions", "fusion": { "permissions": { "allow": ["Bash"] } }, "attendu": { "ok": false, "code": "CHAMP_NON_PREVU" } },
     { "nom": "critères absents", "supprimer": ["criteres_acceptation"], "attendu": { "ok": false, "code": "CHAMP_MANQUANT" } },
     {
       "nom": "critère en double",
       "fusion": { "criteres_acceptation": [{ "id": "A1", "description": "un" }, { "id": "A1", "description": "deux" }] },
       "attendu": { "ok": false, "code": "CRITERE_EN_DOUBLE" }
     },
     { "nom": "critères vides", "fusion": { "criteres_acceptation": [] }, "attendu": { "ok": false, "code": "MISSION_INVALIDE" } },
     { "nom": "classe inconnue", "fusion": { "classe_demandee": "urgente" }, "attendu": { "ok": false, "code": "VALEUR_HORS_LISTE" } },
     { "nom": "périmètre d'écriture vide", "fusion": { "perimetre": { "ecriture": [] } }, "attendu": { "ok": false, "code": "PERIMETRE_ECRITURE_VIDE" } },
     { "nom": "périmètre sans écriture", "fusion": { "perimetre": { "lecture": ["docs/guide.md"] } }, "attendu": { "ok": false, "code": "PERIMETRE_ECRITURE_VIDE" } },
     { "nom": "version de mission", "fusion": { "version": "2" }, "attendu": { "ok": false, "code": "MISSION_INVALIDE" } },
     { "nom": "identifiant invalide", "fusion": { "id": "mission 1" }, "attendu": { "ok": false, "code": "MISSION_INVALIDE" } },
     {
       "nom": "package.json",
       "fusion": { "perimetre": { "ecriture": ["package.json"] } },
       "attendu": { "ok": true, "classe_effective": "sensible", "regles_elevation": ["fichier_sensible"], "validations_humaines": ["lancement", "plan", "fin"] }
     },
     { "nom": "workflow GitHub", "fusion": { "perimetre": { "ecriture": [".github/workflows/ci.yml"] } }, "attendu": { "ok": true, "classe_effective": "sensible", "regles_elevation": ["dossier_sensible"] } },
     { "nom": "CLAUDE.md", "fusion": { "perimetre": { "ecriture": ["CLAUDE.md"] } }, "attendu": { "ok": true, "classe_effective": "sensible", "regles_elevation": ["fichier_sensible"] } },
     { "nom": "réglages .claude", "fusion": { "perimetre": { "ecriture": [".claude/settings.json"] } }, "attendu": { "ok": true, "classe_effective": "sensible", "regles_elevation": ["dossier_sensible"] } },
     { "nom": "migrations", "fusion": { "perimetre": { "ecriture": ["src/migrations/001.sql"] } }, "attendu": { "ok": true, "classe_effective": "sensible", "regles_elevation": ["dossier_sensible"] } },
     { "nom": "AGENTS.md profond", "fusion": { "perimetre": { "ecriture": ["docs/AGENTS.md"] } }, "attendu": { "ok": true, "classe_effective": "sensible", "regles_elevation": ["fichier_sensible"] } },
     { "nom": "joker d'écriture", "fusion": { "perimetre": { "ecriture": ["src/**"] } }, "attendu": { "ok": false, "code": "MOTIF_PEUT_COUVRIR_CHEMIN_INTERDIT" } },
     { "nom": "joker de lecture", "fusion": { "perimetre": { "ecriture": ["src/libelle.ts"], "lecture": ["docs/**"] } }, "attendu": { "ok": false, "code": "MOTIF_PEUT_COUVRIR_CHEMIN_INTERDIT" } },
     { "nom": "joker seul", "fusion": { "perimetre": { "ecriture": ["**"] } }, "attendu": { "ok": false, "code": "JOKER_RACINE_INTERDIT" } },
     { "nom": "secret en écriture", "fusion": { "perimetre": { "ecriture": [".env"] } }, "attendu": { "ok": false, "code": "CHEMIN_SECRET" } },
     { "nom": "secret en lecture", "fusion": { "perimetre": { "ecriture": ["src/libelle.ts"], "lecture": [".env.local/x"] } }, "attendu": { "ok": false, "code": "CHEMIN_SECRET" } },
     { "nom": "Fastclip en écriture", "fusion": { "perimetre": { "ecriture": ["src/Fastclip/a.ts"] } }, "attendu": { "ok": false, "code": "CHEMIN_INTERDIT" } },
+    {
+      "nom": "D-03 lectures sensibles sans élévation",
+      "fusion": { "perimetre": { "ecriture": ["src/libelle.ts"], "lecture": ["package.json", ".github/x"] } },
+      "attendu": { "ok": true, "classe_effective": "simple", "regles_elevation": [], "validations_humaines": ["lancement", "fin"] }
+    },
+    {
+      "nom": "D-03 écriture sensible avec lecture ordinaire",
+      "fusion": { "perimetre": { "ecriture": ["package.json"], "lecture": ["docs/guide.md"] } },
+      "attendu": { "ok": true, "classe_effective": "sensible", "regles_elevation": ["fichier_sensible"] }
+    },
+    { "nom": "D-03 lecture secrète refusée sans élévation", "fusion": { "perimetre": { "ecriture": ["src/libelle.ts"], "lecture": [".env"] } }, "attendu": { "ok": false, "code": "CHEMIN_SECRET" } },
+    { "nom": "D-03 lecture interdite refusée", "fusion": { "perimetre": { "ecriture": ["src/libelle.ts"], "lecture": ["outils/FastClip/x"] } }, "attendu": { "ok": false, "code": "CHEMIN_INTERDIT" } },
+    { "nom": "Fastclip en majuscules", "fusion": { "perimetre": { "ecriture": ["FASTCLIP/a.ts"] } }, "attendu": { "ok": false, "code": "CHEMIN_INTERDIT" } },
+    { "nom": "Fastclip en minuscules dans un nom", "fusion": { "perimetre": { "ecriture": ["src/monfastclip.ts"] } }, "attendu": { "ok": false, "code": "CHEMIN_INTERDIT" } },
+    { "nom": "secret en casse différente", "fusion": { "perimetre": { "ecriture": [".SSH/config"] } }, "attendu": { "ok": false, "code": "CHEMIN_SECRET" } },
+    { "nom": "fichier sensible en casse différente", "fusion": { "perimetre": { "ecriture": ["Package.JSON"] } }, "attendu": { "ok": true, "classe_effective": "sensible", "regles_elevation": ["fichier_sensible"] } },
     { "nom": "chemin invalide", "fusion": { "perimetre": { "ecriture": ["a/../b"] } }, "attendu": { "ok": false, "code": "CHEMIN_INVALIDE" } },
     {
       "nom": "tri déterministe du périmètre",
       "fusion": { "perimetre": { "ecriture": ["src/b.ts", "SRC/a.ts", "src/A.ts"] } },
       "attendu": {
         "ok": true,
         "classe_effective": "simple",
         "perimetre_ecriture": [
           "C:\\Users\\demo\\projets\\exemple\\SRC\\a.ts",
           "C:\\Users\\demo\\projets\\exemple\\src\\A.ts",
           "C:\\Users\\demo\\projets\\exemple\\src\\b.ts"
         ]
       }
     }
   ],
   "contextes": [
     { "nom": "racine Fastclip", "contexte": { "racine_autorisee": "C:\\work\\fastclip-demo", "racine_bridge": "C:\\Outils\\bridge" }, "attendu": "RACINE_INTERDITE" },
     { "nom": "racine sous .ssh", "contexte": { "racine_autorisee": "C:\\Users\\x\\.ssh\\projet", "racine_bridge": "C:\\Outils\\bridge" }, "attendu": "RACINE_SECRET" },
     { "nom": "racine nue", "contexte": { "racine_autorisee": "C:\\", "racine_bridge": "C:\\Outils\\bridge" }, "attendu": "CONTEXTE_INVALIDE" },
     { "nom": "UNC", "contexte": { "racine_autorisee": "\\\\serveur\\partage\\p", "racine_bridge": "C:\\Outils\\bridge" }, "attendu": "CONTEXTE_INVALIDE" },
     { "nom": "préfixe \\\\?\\", "contexte": { "racine_autorisee": "\\\\?\\C:\\x", "racine_bridge": "C:\\Outils\\bridge" }, "attendu": "CONTEXTE_INVALIDE" },
     { "nom": "préfixe \\\\.\\", "contexte": { "racine_autorisee": "\\\\.\\C:\\x", "racine_bridge": "C:\\Outils\\bridge" }, "attendu": "CONTEXTE_INVALIDE" },
     { "nom": "racine relative", "contexte": { "racine_autorisee": "projets\\x", "racine_bridge": "C:\\Outils\\bridge" }, "attendu": "CONTEXTE_INVALIDE" },
     { "nom": "racine avec ..", "contexte": { "racine_autorisee": "C:\\a\\..\\b", "racine_bridge": "C:\\Outils\\bridge" }, "attendu": "CONTEXTE_INVALIDE" },
     { "nom": "racine avec séparateur final", "contexte": { "racine_autorisee": "C:\\a\\", "racine_bridge": "C:\\Outils\\bridge" }, "attendu": "CONTEXTE_INVALIDE" },
     { "nom": "racine avec barre oblique", "contexte": { "racine_autorisee": "C:/a/b", "racine_bridge": "C:\\Outils\\bridge" }, "attendu": "CONTEXTE_INVALIDE" },
     { "nom": "Bridge dans la racine", "contexte": { "racine_autorisee": "C:\\Outils", "racine_bridge": "C:\\Outils\\bridge" }, "attendu": "CHEVAUCHEMENT_BRIDGE" },
     { "nom": "racine dans Bridge", "contexte": { "racine_autorisee": "C:\\Outils\\bridge\\projets\\x", "racine_bridge": "C:\\Outils\\bridge" }, "attendu": "CHEVAUCHEMENT_BRIDGE" },
     { "nom": "chevauchement casse différente", "contexte": { "racine_autorisee": "c:\\outils\\BRIDGE\\x", "racine_bridge": "C:\\Outils\\bridge" }, "attendu": "CHEVAUCHEMENT_BRIDGE" },
     { "nom": "racine identique à Bridge", "contexte": { "racine_autorisee": "C:\\Outils\\bridge", "racine_bridge": "C:\\Outils\\bridge" }, "attendu": "CHEVAUCHEMENT_BRIDGE" },
     { "nom": "C:\\a et C:\\ab ne se chevauchent pas", "contexte": { "racine_autorisee": "C:\\a", "racine_bridge": "C:\\ab" }, "attendu": "ok" },
     { "nom": "lecteurs différents", "contexte": { "racine_autorisee": "D:\\Outils\\bridge\\x", "racine_bridge": "C:\\Outils\\bridge" }, "attendu": "ok" },
     { "nom": "champ de contexte inconnu", "contexte": { "racine_autorisee": "C:\\a", "racine_bridge": "C:\\b", "autre": "x" }, "attendu": "CONTEXTE_INVALIDE" }
   ],
   "configurations": [
     { "nom": "configuration par défaut", "operations": [], "attendu": "ok" },
     { "nom": "provisoire à false accepté", "operations": [{ "type": "definir", "chemin": ["profils", "profils", 0, "provisoire"], "valeur": false }], "attendu": "ok" },
     { "nom": "profil retiré", "operations": [{ "type": "supprimer", "chemin": ["profils", "profils", 2] }], "attendu": "CONFIGURATION_INVALIDE" },
     { "nom": "provisoire absent", "operations": [{ "type": "supprimer", "chemin": ["profils", "profils", 0, "provisoire"] }], "attendu": "CONFIGURATION_INVALIDE" },
     { "nom": "délai supérieur à la durée", "operations": [{ "type": "definir", "chemin": ["profils", "profils", 0, "plafonds", "delai_appel_claude_min"], "valeur": 31 }], "attendu": "CONFIGURATION_INVALIDE" },
     { "nom": "sensible sans plan", "operations": [{ "type": "definir", "chemin": ["profils", "profils", 2, "validations_humaines"], "valeur": ["lancement", "fin"] }], "attendu": "CONFIGURATION_INVALIDE" },
     { "nom": "fin absente", "operations": [{ "type": "definir", "chemin": ["profils", "profils", 0, "validations_humaines"], "valeur": ["lancement"] }], "attendu": "CONFIGURATION_INVALIDE" },
     { "nom": "classe en double", "operations": [{ "type": "definir", "chemin": ["profils", "profils", 1, "classe"], "valeur": "simple" }], "attendu": "CONFIGURATION_INVALIDE" },
     { "nom": "plafond nul", "operations": [{ "type": "definir", "chemin": ["profils", "profils", 0, "plafonds", "corrections"], "valeur": 0 }], "attendu": "CONFIGURATION_INVALIDE" },
     { "nom": "champ inconnu dans un profil", "operations": [{ "type": "definir", "chemin": ["profils", "profils", 0, "outils"], "valeur": ["Bash"] }], "attendu": "CONFIGURATION_INVALIDE" },
     { "nom": "version des profils", "operations": [{ "type": "definir", "chemin": ["profils", "version"], "valeur": "2" }], "attendu": "CONFIGURATION_INVALIDE" },
-    { "nom": "champ inconnu dans la configuration", "operations": [{ "type": "definir", "chemin": ["autre"], "valeur": "x" }], "attendu": "CONFIGURATION_INVALIDE" },
+    { "nom": "champ inconnu à la racine des règles de chemins", "operations": [{ "type": "definir", "chemin": ["regles_chemins", "autre"], "valeur": "x" }], "attendu": "CONFIGURATION_INVALIDE" },
+    { "nom": "champ inconnu à la racine des profils", "operations": [{ "type": "definir", "chemin": ["profils", "autre"], "valeur": "x" }], "attendu": "CONFIGURATION_INVALIDE" },
     { "nom": "règle fastclip absente", "operations": [{ "type": "definir", "chemin": ["regles_chemins", "exclusion", "segments_interdits", 0, "valeur"], "valeur": "autre" }], "attendu": "CONFIGURATION_INVALIDE" },
     { "nom": "dossier sensible invalide", "operations": [{ "type": "pousser", "chemin": ["regles_chemins", "classification", "dossiers_sensibles"], "valeur": "a/b" }], "attendu": "CONFIGURATION_INVALIDE" },
     { "nom": "préfixe sensible avec joker", "operations": [{ "type": "pousser", "chemin": ["regles_chemins", "classification", "prefixes_sensibles"], "valeur": "src/*" }], "attendu": "CONFIGURATION_INVALIDE" }
   ],
   "prefixes_sensibles": {
     "prefixes": ["src/auth"],
     "cas": [
       { "ecriture": "src/auth/x.ts", "classe_effective": "sensible" },
       { "ecriture": "src/auth", "classe_effective": "sensible" },
       { "ecriture": "src", "classe_effective": "sensible" },
       { "ecriture": "SRC/Auth/x.ts", "classe_effective": "sensible" },
       { "ecriture": "src/au/x.ts", "classe_effective": "simple" },
       { "ecriture": "src/authx/y.ts", "classe_effective": "simple" },
       { "ecriture": "lib/auth/x.ts", "classe_effective": "simple" }
     ]
   }
 }
```

