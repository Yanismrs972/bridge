# Bridge v1 — correction de provenance — lot 11 sur 12

Référence : commit ffc0e3b (docs/REFERENCE.md) et livrable 1 (fichiers non suivis). Diff unifié à contexte complet : chaque diff contient le fichier entier ; les lignes « - » et « » donnent le contenu initial, les lignes « + » et « » le contenu final.

## Fichier 23 — test/vecteurs/chemins.json

- Statut : modifié
- SHA-256 initial : 0cc2a5970f703d30675e9cead6ac4341c26946588ca65ac03a73b47ca84dd42f
- SHA-256 final : 2760cd25abd9d7f5573e8ef24fe375f4cbf0eeed7b085f5bae0d52bb6069f73e
- Taille finale : 25358 octets, 304 lignes

```diff
--- a/test/vecteurs/chemins.json
+++ b/test/vecteurs/chemins.json
@@ -1,275 +1,304 @@
 {
   "description": "Vecteurs purs de evaluerChemin, du contrôle du périmètre et des règles d'exclusion. Racine de test : C:\\Users\\demo\\projets\\exemple.",
   "evaluation": [
     { "nom": "fichier ordinaire", "chemin": "src/application.ts", "attendu": { "statut": "autorise", "chemin_normalise": "src/application.ts" } },
     { "nom": "barres inverses normalisées", "chemin": "src\\win\\style.ts", "attendu": { "statut": "autorise", "chemin_normalise": "src/win/style.ts" } },
     { "nom": "témoin key.ts", "chemin": "src/key.ts", "attendu": { "statut": "autorise" } },
     { "nom": "témoin environment.ts", "chemin": "src/environment.ts", "attendu": { "statut": "autorise" } },
     { "nom": "témoin pem-guide", "chemin": "docs/pem-guide.md", "attendu": { "statut": "autorise" } },
     { "nom": "témoin id_rs", "chemin": "src/id_rs.ts", "attendu": { "statut": "autorise" } },
     { "nom": "témoin monkey.keys", "chemin": "src/monkey.keys/x", "attendu": { "statut": "autorise" } },
     { "nom": "témoin .envrc", "chemin": "env/.envrc", "attendu": { "statut": "autorise" } },
     { "nom": "crochets ordinaires", "chemin": "src/[id].tsx", "attendu": { "statut": "autorise" } },
     { "nom": "accolades ordinaires", "chemin": "src/{a}.ts", "attendu": { "statut": "autorise" } },
     { "nom": "point d'exclamation ordinaire", "chemin": "src/!x.ts", "attendu": { "statut": "autorise" } },
 
     { "nom": ".env.local dossier", "chemin": ".env.local/credentials.txt", "attendu": { "statut": "exclu", "code": "CHEMIN_SECRET", "racine_exclusion": ".env.local", "regle_racine": "SEC-PRE-ENV" } },
     { "nom": ".env.production dossier", "chemin": ".env.production/private-key", "attendu": { "statut": "exclu", "code": "CHEMIN_SECRET", "racine_exclusion": ".env.production", "regle_racine": "SEC-PRE-ENV" } },
     { "nom": "id_rsa_backup dossier", "chemin": "id_rsa_backup/key.txt", "attendu": { "statut": "exclu", "code": "CHEMIN_SECRET", "racine_exclusion": "id_rsa_backup", "regle_racine": "SEC-PRE-ID-RSA" } },
     { "nom": "server.pem dossier", "chemin": "certificates/server.pem/private", "attendu": { "statut": "exclu", "code": "CHEMIN_SECRET", "racine_exclusion": "certificates/server.pem", "regle_racine": "SEC-SUF-PEM" } },
     { "nom": "credentials.json fichier", "chemin": "src/credentials.json", "attendu": { "statut": "exclu", "code": "CHEMIN_SECRET", "racine_exclusion": "src/credentials.json", "regle_racine": "SEC-EXACT-CREDENTIALS-JSON" } },
     { "nom": ".SSH casse indifférente", "chemin": "a/.SSH/b/c/d/known_hosts", "attendu": { "statut": "exclu", "code": "CHEMIN_SECRET", "racine_exclusion": "a/.SSH", "regle_racine": "SEC-EXACT-SSH" } },
     { "nom": ".git profond", "chemin": ".git/objects/ab/cdef", "attendu": { "statut": "exclu", "code": "CHEMIN_SECRET", "racine_exclusion": ".git", "regle_racine": "SEC-EXACT-GIT" } },
     { "nom": "secrets profond", "chemin": "secrets/prod/db/pass.txt", "attendu": { "statut": "exclu", "code": "CHEMIN_SECRET", "racine_exclusion": "secrets", "regle_racine": "SEC-EXACT-SECRETS" } },
     { "nom": "premier segment correspondant", "chemin": ".env.local/.ssh/id_rsa", "attendu": { "statut": "exclu", "code": "CHEMIN_SECRET", "racine_exclusion": ".env.local", "regle_racine": "SEC-PRE-ENV" } },
     { "nom": ".env", "chemin": ".env", "attendu": { "statut": "exclu", "code": "CHEMIN_SECRET", "racine_exclusion": ".env", "regle_racine": "SEC-EXACT-ENV" } },
     { "nom": ".ENV majuscules", "chemin": ".ENV", "attendu": { "statut": "exclu", "code": "CHEMIN_SECRET", "racine_exclusion": ".ENV", "regle_racine": "SEC-EXACT-ENV" } },
     { "nom": "config/.env.local", "chemin": "config/.env.local", "attendu": { "statut": "exclu", "code": "CHEMIN_SECRET", "racine_exclusion": "config/.env.local", "regle_racine": "SEC-PRE-ENV" } },
     { "nom": ".env.example (faux positif assumé)", "chemin": ".env.example", "attendu": { "statut": "exclu", "code": "CHEMIN_SECRET", "racine_exclusion": ".env.example", "regle_racine": "SEC-PRE-ENV" } },
     { "nom": ".PEM majuscules", "chemin": "certs/server.PEM", "attendu": { "statut": "exclu", "code": "CHEMIN_SECRET", "racine_exclusion": "certs/server.PEM", "regle_racine": "SEC-SUF-PEM" } },
     { "nom": ".key", "chemin": "keys/api.key", "attendu": { "statut": "exclu", "code": "CHEMIN_SECRET", "racine_exclusion": "keys/api.key", "regle_racine": "SEC-SUF-KEY" } },
     { "nom": "id_ed25519.pub", "chemin": "id_ed25519.pub", "attendu": { "statut": "exclu", "code": "CHEMIN_SECRET", "racine_exclusion": "id_ed25519.pub", "regle_racine": "SEC-PRE-ID-ED25519" } },
     { "nom": ".ssh/known_hosts", "chemin": ".ssh/known_hosts", "attendu": { "statut": "exclu", "code": "CHEMIN_SECRET", "racine_exclusion": ".ssh", "regle_racine": "SEC-EXACT-SSH" } },
     { "nom": "home/.AWS/config", "chemin": "home/.AWS/config", "attendu": { "statut": "exclu", "code": "CHEMIN_SECRET", "racine_exclusion": "home/.AWS", "regle_racine": "SEC-EXACT-AWS" } },
     { "nom": ".git/config", "chemin": ".git/config", "attendu": { "statut": "exclu", "code": "CHEMIN_SECRET", "racine_exclusion": ".git", "regle_racine": "SEC-EXACT-GIT" } },
 
     { "nom": "Fastclip puis .env", "chemin": "src/Fastclip/.env", "attendu": { "statut": "exclu", "code": "CHEMIN_INTERDIT", "racine_exclusion": "src/Fastclip", "regle_racine": "INT-FASTCLIP" } },
     { "nom": "fastclip.ts", "chemin": "src/fastclip.ts", "attendu": { "statut": "exclu", "code": "CHEMIN_INTERDIT", "racine_exclusion": "src/fastclip.ts", "regle_racine": "INT-FASTCLIP" } },
     { "nom": "Old-FASTCLIP", "chemin": "src/Old-FASTCLIP/x.ts", "attendu": { "statut": "exclu", "code": "CHEMIN_INTERDIT", "racine_exclusion": "src/Old-FASTCLIP", "regle_racine": "INT-FASTCLIP" } },
     { "nom": "notfastclipper (faux positif assumé)", "chemin": "notfastclipper/x.ts", "attendu": { "statut": "exclu", "code": "CHEMIN_INTERDIT", "racine_exclusion": "notfastclipper", "regle_racine": "INT-FASTCLIP" } },
 
     { "nom": "chemin vide", "chemin": "", "attendu": { "statut": "invalide", "sous_regle": "CHEMIN_VIDE" } },
     { "nom": "séparateur au début", "chemin": "/a", "attendu": { "statut": "invalide", "sous_regle": "SEPARATEUR_DEBUT" } },
     { "nom": "séparateur à la fin", "chemin": "a/", "attendu": { "statut": "invalide", "sous_regle": "SEPARATEUR_FIN" } },
     { "nom": "segment vide", "chemin": "a//b", "attendu": { "statut": "invalide", "sous_regle": "SEGMENT_VIDE", "index_segment": 1 } },
     { "nom": "segment point", "chemin": "./a", "attendu": { "statut": "invalide", "sous_regle": "SEGMENT_POINT", "index_segment": 0 } },
     { "nom": "segment point-point", "chemin": "a/../b", "attendu": { "statut": "invalide", "sous_regle": "SEGMENT_POINT", "index_segment": 1 } },
     { "nom": "x/../.env", "chemin": "x/../.env", "attendu": { "statut": "invalide", "sous_regle": "SEGMENT_POINT", "index_segment": 1 } },
     { "nom": "lettre de lecteur", "chemin": "C:a", "attendu": { "statut": "invalide", "sous_regle": "CARACTERE_INTERDIT" } },
     { "nom": "flux alternatif", "chemin": "a:b", "attendu": { "statut": "invalide", "sous_regle": "CARACTERE_INTERDIT" } },
     { "nom": "astérisque littéral", "chemin": "src/a*.ts", "attendu": { "statut": "invalide", "sous_regle": "CARACTERE_INTERDIT" } },
     { "nom": "NUL", "chemin": "NUL", "attendu": { "statut": "invalide", "sous_regle": "NOM_RESERVE" } },
     { "nom": "nul.txt", "chemin": "nul.txt", "attendu": { "statut": "invalide", "sous_regle": "NOM_RESERVE" } },
     { "nom": "CON.tar.gz", "chemin": "CON.tar.gz", "attendu": { "statut": "invalide", "sous_regle": "NOM_RESERVE" } },
     { "nom": "COM exposant 1", "chemin": "COM\u00b9", "attendu": { "statut": "invalide", "sous_regle": "NOM_RESERVE" } },
     { "nom": "CONIN$", "chemin": "CONIN$", "attendu": { "statut": "invalide", "sous_regle": "NOM_RESERVE" } },
     { "nom": "LPT9.log", "chemin": "logs/LPT9.log", "attendu": { "statut": "invalide", "sous_regle": "NOM_RESERVE", "index_segment": 1 } },
     { "nom": "point final", "chemin": "a.", "attendu": { "statut": "invalide", "sous_regle": "POINT_FINAL" } },
     { "nom": "espace finale", "chemin": "a ", "attendu": { "statut": "invalide", "sous_regle": "ESPACE_FIN" } },
     { "nom": "espace initiale", "chemin": " a", "attendu": { "statut": "invalide", "sous_regle": "ESPACE_DEBUT" } },
     { "nom": "nom court 8.3", "chemin": "PROGRA~1", "attendu": { "statut": "invalide", "sous_regle": "NOM_COURT_8_3" } },
     { "nom": "contrôle C0", "chemin": "a\u0007b", "attendu": { "statut": "invalide", "sous_regle": "CARACTERE_CONTROLE" } },
     { "nom": "contrôle C1", "chemin": "a\u0085b", "attendu": { "statut": "invalide", "sous_regle": "CARACTERE_CONTROLE" } },
     { "nom": "non NFC", "chemin": "e\u0301.txt", "attendu": { "statut": "invalide", "sous_regle": "NON_NFC" } },
     { "nom": "surrogate isolée", "chemin": "a\ud800b", "attendu": { "statut": "invalide", "sous_regle": "UNICODE_INVALIDE" } },
     { "nom": "invalide avant exclusion", "chemin": "Fastclip/a:b", "attendu": { "statut": "invalide", "sous_regle": "CARACTERE_INTERDIT", "index_segment": 1 } },
     { "nom": "point final sous .env", "chemin": ".env/x.", "attendu": { "statut": "invalide", "sous_regle": "POINT_FINAL", "index_segment": 1 } }
   ],
   "correspondances_completes": [
     {
       "chemin": ".env.local/Fastclip/fichier.ts",
       "code": "CHEMIN_INTERDIT",
       "racine_exclusion": ".env.local",
       "regle_racine": { "categorie": "secret", "id": "SEC-PRE-ENV" },
       "regle_code": { "categorie": "interdit", "id": "INT-FASTCLIP" },
       "correspondances": [
         { "index_segment": 0, "categorie": "secret", "id": "SEC-PRE-ENV" },
         { "index_segment": 1, "categorie": "interdit", "id": "INT-FASTCLIP" }
       ]
     },
     {
       "chemin": "Fastclip/.env.local/fichier.ts",
       "code": "CHEMIN_INTERDIT",
       "racine_exclusion": "Fastclip",
       "regle_racine": { "categorie": "interdit", "id": "INT-FASTCLIP" },
       "regle_code": { "categorie": "interdit", "id": "INT-FASTCLIP" },
       "correspondances": [
         { "index_segment": 0, "categorie": "interdit", "id": "INT-FASTCLIP" },
         { "index_segment": 1, "categorie": "secret", "id": "SEC-PRE-ENV" }
       ]
     },
     {
       "chemin": "src/Fastclip/.env",
       "code": "CHEMIN_INTERDIT",
       "racine_exclusion": "src/Fastclip",
       "regle_racine": { "categorie": "interdit", "id": "INT-FASTCLIP" },
       "regle_code": { "categorie": "interdit", "id": "INT-FASTCLIP" },
       "correspondances": [
         { "index_segment": 1, "categorie": "interdit", "id": "INT-FASTCLIP" },
         { "index_segment": 2, "categorie": "secret", "id": "SEC-EXACT-ENV" }
       ]
     },
     {
       "chemin": "src/.env.local/Fastclip/fichier.ts",
       "code": "CHEMIN_INTERDIT",
       "racine_exclusion": "src/.env.local",
       "regle_racine": { "categorie": "secret", "id": "SEC-PRE-ENV" },
       "regle_code": { "categorie": "interdit", "id": "INT-FASTCLIP" },
       "correspondances": [
         { "index_segment": 1, "categorie": "secret", "id": "SEC-PRE-ENV" },
         { "index_segment": 2, "categorie": "interdit", "id": "INT-FASTCLIP" }
       ]
     },
     {
       "chemin": "secrets/.ssh/id_rsa",
       "code": "CHEMIN_SECRET",
       "racine_exclusion": "secrets",
       "regle_racine": { "categorie": "secret", "id": "SEC-EXACT-SECRETS" },
       "regle_code": { "categorie": "secret", "id": "SEC-EXACT-SECRETS" },
       "correspondances": [
         { "index_segment": 0, "categorie": "secret", "id": "SEC-EXACT-SECRETS" },
         { "index_segment": 1, "categorie": "secret", "id": "SEC-EXACT-SSH" },
         { "index_segment": 2, "categorie": "secret", "id": "SEC-PRE-ID-RSA" }
       ]
     },
     {
       "chemin": "src/fastclip-old/.git/config",
       "code": "CHEMIN_INTERDIT",
       "racine_exclusion": "src/fastclip-old",
       "regle_racine": { "categorie": "interdit", "id": "INT-FASTCLIP" },
       "regle_code": { "categorie": "interdit", "id": "INT-FASTCLIP" },
       "correspondances": [
         { "index_segment": 1, "categorie": "interdit", "id": "INT-FASTCLIP" },
         { "index_segment": 2, "categorie": "secret", "id": "SEC-EXACT-GIT" }
       ]
     },
     {
       "chemin": "id_rsa.key",
       "code": "CHEMIN_SECRET",
       "racine_exclusion": "id_rsa.key",
       "regle_racine": { "categorie": "secret", "id": "SEC-PRE-ID-RSA" },
       "regle_code": { "categorie": "secret", "id": "SEC-PRE-ID-RSA" },
       "correspondances": [
         { "index_segment": 0, "categorie": "secret", "id": "SEC-PRE-ID-RSA" },
         { "index_segment": 0, "categorie": "secret", "id": "SEC-SUF-KEY" }
       ]
     },
     {
       "chemin": "config/.env.key",
       "code": "CHEMIN_SECRET",
       "racine_exclusion": "config/.env.key",
       "regle_racine": { "categorie": "secret", "id": "SEC-PRE-ENV" },
       "regle_code": { "categorie": "secret", "id": "SEC-PRE-ENV" },
       "correspondances": [
         { "index_segment": 1, "categorie": "secret", "id": "SEC-PRE-ENV" },
         { "index_segment": 1, "categorie": "secret", "id": "SEC-SUF-KEY" }
       ]
     },
     {
       "chemin": "fastclip.pem",
       "code": "CHEMIN_INTERDIT",
       "racine_exclusion": "fastclip.pem",
       "regle_racine": { "categorie": "interdit", "id": "INT-FASTCLIP" },
       "regle_code": { "categorie": "interdit", "id": "INT-FASTCLIP" },
       "correspondances": [
         { "index_segment": 0, "categorie": "interdit", "id": "INT-FASTCLIP" },
         { "index_segment": 0, "categorie": "secret", "id": "SEC-SUF-PEM" }
       ]
     },
     {
       "chemin": "a/b/.env.local/c/d.txt",
       "code": "CHEMIN_SECRET",
       "racine_exclusion": "a/b/.env.local",
       "regle_racine": { "categorie": "secret", "id": "SEC-PRE-ENV" },
       "regle_code": { "categorie": "secret", "id": "SEC-PRE-ENV" },
       "correspondances": [
         { "index_segment": 2, "categorie": "secret", "id": "SEC-PRE-ENV" }
       ]
     },
     {
       "chemin": "x/server.pem/y",
       "code": "CHEMIN_SECRET",
       "racine_exclusion": "x/server.pem",
       "regle_racine": { "categorie": "secret", "id": "SEC-SUF-PEM" },
       "regle_code": { "categorie": "secret", "id": "SEC-SUF-PEM" },
       "correspondances": [
         { "index_segment": 1, "categorie": "secret", "id": "SEC-SUF-PEM" }
       ]
     }
   ],
   "prefixes": [
     ".env.local/Fastclip/fichier.ts",
     "Fastclip/.env.local/fichier.ts",
     "src/Fastclip/.env",
     "src/.env.local/Fastclip/fichier.ts",
     "secrets/.ssh/id_rsa",
     "a/b/.env.local/c/d.txt",
     "x/server.pem/y",
     "src/fastclip-old/.git/config",
     "a/.SSH/b/c/d/known_hosts",
     "certificates/server.pem/private"
   ],
   "prefixes_explicites": [
     { "chemin": ".env.local", "statut": "exclu", "racine_exclusion": ".env.local", "code": "CHEMIN_SECRET" },
     { "chemin": ".env.local/Fastclip", "statut": "exclu", "racine_exclusion": ".env.local", "code": "CHEMIN_INTERDIT" },
     { "chemin": ".env.local/Fastclip/fichier.ts", "statut": "exclu", "racine_exclusion": ".env.local", "code": "CHEMIN_INTERDIT" },
     { "chemin": "src", "statut": "autorise" },
     { "chemin": "src/.env.local", "statut": "exclu", "racine_exclusion": "src/.env.local", "code": "CHEMIN_SECRET" },
     { "chemin": "src/.env.local/Fastclip", "statut": "exclu", "racine_exclusion": "src/.env.local", "code": "CHEMIN_INTERDIT" },
     { "chemin": "src/.env.local/Fastclip/fichier.ts", "statut": "exclu", "racine_exclusion": "src/.env.local", "code": "CHEMIN_INTERDIT" },
     { "chemin": "Fastclip", "statut": "exclu", "racine_exclusion": "Fastclip", "code": "CHEMIN_INTERDIT" },
     { "chemin": "Fastclip/.env.local", "statut": "exclu", "racine_exclusion": "Fastclip", "code": "CHEMIN_INTERDIT" },
     { "chemin": "Fastclip/.env.local/fichier.ts", "statut": "exclu", "racine_exclusion": "Fastclip", "code": "CHEMIN_INTERDIT" },
     { "chemin": ".env", "statut": "exclu", "racine_exclusion": ".env", "code": "CHEMIN_SECRET" },
     { "chemin": ".env/x.", "statut": "invalide" }
   ],
   "perimetre": [
     { "nom": "joker seul *", "entree": "*", "attendu": { "ok": false, "code": "JOKER_RACINE_INTERDIT" } },
     { "nom": "joker seul **", "entree": "**", "attendu": { "ok": false, "code": "JOKER_RACINE_INTERDIT" } },
     { "nom": "src/**", "entree": "src/**", "attendu": { "ok": false, "code": "MOTIF_PEUT_COUVRIR_CHEMIN_INTERDIT" } },
     { "nom": "src/*", "entree": "src/*", "attendu": { "ok": false, "code": "MOTIF_PEUT_COUVRIR_CHEMIN_INTERDIT" } },
     { "nom": "docs/**", "entree": "docs/**", "attendu": { "ok": false, "code": "MOTIF_PEUT_COUVRIR_CHEMIN_INTERDIT" } },
     { "nom": "a/b/c/*", "entree": "a/b/c/*", "attendu": { "ok": false, "code": "MOTIF_PEUT_COUVRIR_CHEMIN_INTERDIT" } },
     { "nom": "joker partiel", "entree": "src/*.ts", "attendu": { "ok": false, "code": "JOKER_NON_AUTORISE" } },
     { "nom": "point d'interrogation", "entree": "src/a?.ts", "attendu": { "ok": false, "code": "JOKER_NON_AUTORISE" } },
     { "nom": "joker au milieu", "entree": "a/*/b", "attendu": { "ok": false, "code": "JOKER_NON_AUTORISE" } },
     { "nom": "joker récursif au milieu", "entree": "a/**/b", "attendu": { "ok": false, "code": "JOKER_NON_AUTORISE" } },
     { "nom": "joker suivi d'un séparateur", "entree": "src/**/", "attendu": { "ok": false, "code": "JOKER_NON_AUTORISE" } },
     { "nom": "Fastclip littéral avant joker", "entree": "src/FastClip/**", "attendu": { "ok": false, "code": "CHEMIN_INTERDIT" } },
     { "nom": "secret littéral avant joker", "entree": ".ssh/**", "attendu": { "ok": false, "code": "CHEMIN_SECRET" } },
     { "nom": "joker après séparateur initial", "entree": "/**", "attendu": { "ok": false, "code": "CHEMIN_INVALIDE" } },
     { "nom": "point-point", "entree": "x/../.env", "attendu": { "ok": false, "code": "CHEMIN_INVALIDE" } },
     { "nom": "Fastclip et secret", "entree": "src/Fastclip/.env", "attendu": { "ok": false, "code": "CHEMIN_INTERDIT" } },
     { "nom": "crochets acceptés", "entree": "src/[id].tsx", "attendu": { "ok": true, "absolu": "C:\\Users\\demo\\projets\\exemple\\src\\[id].tsx" } },
     { "nom": "barres inverses", "entree": "src\\a\\b.ts", "attendu": { "ok": true, "absolu": "C:\\Users\\demo\\projets\\exemple\\src\\a\\b.ts" } }
   ],
   "regles_invalides": [
     { "nom": "champ cible", "operations": [{ "type": "definir", "chemin": ["secrets", 0, "cible"], "valeur": "segment_final" }] },
     { "nom": "champ inconnu", "operations": [{ "type": "definir", "chemin": ["secrets", 0, "commentaire"], "valeur": "x" }] },
     { "nom": "id vide", "operations": [{ "type": "definir", "chemin": ["secrets", 0, "id"], "valeur": "" }] },
     { "nom": "id de 33 caractères", "operations": [{ "type": "definir", "chemin": ["secrets", 0, "id"], "valeur": "SEC-ABCDEFGHIJKLMNOPQRSTUVWXYZ012" }] },
     { "nom": "id en minuscules", "operations": [{ "type": "definir", "chemin": ["secrets", 0, "id"], "valeur": "sec-ssh" }] },
     { "nom": "préfixe d'id incorrect", "operations": [{ "type": "definir", "chemin": ["segments_interdits", 0, "id"], "valeur": "SEC-FASTCLIP" }] },
     { "nom": "id en double", "operations": [{ "type": "pousser", "chemin": ["secrets"], "valeur": { "id": "SEC-EXACT-SSH", "type": "nom_exact", "valeur": ".autre" } }] },
     { "nom": "type glob", "operations": [{ "type": "definir", "chemin": ["secrets", 0, "type"], "valeur": "glob" }] },
     { "nom": "contient dans les secrets", "operations": [{ "type": "definir", "chemin": ["secrets", 0, "type"], "valeur": "contient" }] },
     { "nom": "valeur vide", "operations": [{ "type": "definir", "chemin": ["secrets", 0, "valeur"], "valeur": "" }] },
     { "nom": "valeur de 65 caractères", "operations": [{ "type": "definir", "chemin": ["secrets", 0, "valeur"], "valeur": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" }] },
     { "nom": "valeur non NFC", "operations": [{ "type": "definir", "chemin": ["secrets", 0, "valeur"], "valeur": "e\u0301" }] },
     { "nom": "valeur avec contrôle C0", "operations": [{ "type": "definir", "chemin": ["secrets", 0, "valeur"], "valeur": "a\u0007b" }] },
     { "nom": "valeur avec contrôle C1", "operations": [{ "type": "definir", "chemin": ["secrets", 0, "valeur"], "valeur": "a\u0085b" }] },
     { "nom": "valeur avec barre oblique", "operations": [{ "type": "definir", "chemin": ["secrets", 0, "valeur"], "valeur": "a/b" }] },
     { "nom": "valeur avec deux-points", "operations": [{ "type": "definir", "chemin": ["secrets", 0, "valeur"], "valeur": "a:b" }] },
     { "nom": "valeur avec joker", "operations": [{ "type": "definir", "chemin": ["secrets", 23, "valeur"], "valeur": "*.pem" }] },
     { "nom": "valeur point-point", "operations": [{ "type": "definir", "chemin": ["secrets", 0, "valeur"], "valeur": ".." }] },
     { "nom": "valeur point", "operations": [{ "type": "definir", "chemin": ["secrets", 0, "valeur"], "valeur": "." }] },
     { "nom": "nom_exact avec point final", "operations": [{ "type": "definir", "chemin": ["secrets", 0, "valeur"], "valeur": ".foo." }] },
     { "nom": "nom_exact avec espace finale", "operations": [{ "type": "definir", "chemin": ["secrets", 0, "valeur"], "valeur": "abc " }] },
     { "nom": "nom_exact nom réservé", "operations": [{ "type": "definir", "chemin": ["secrets", 0, "valeur"], "valeur": "NUL" }] },
     { "nom": "suffixe avec point final", "operations": [{ "type": "definir", "chemin": ["secrets", 23, "valeur"], "valeur": ".pem." }] },
     { "nom": "préfixe avec espace initiale", "operations": [{ "type": "definir", "chemin": ["secrets", 18, "valeur"], "valeur": " .env." }] },
     { "nom": "contient avec espace finale", "operations": [{ "type": "pousser", "chemin": ["segments_interdits"], "valeur": { "id": "INT-AUTRE", "type": "contient", "valeur": "autre " } }] },
     { "nom": "doublon .PEM et .pem", "operations": [{ "type": "pousser", "chemin": ["secrets"], "valeur": { "id": "SEC-SUF-PEM-MAJ", "type": "suffixe", "valeur": ".PEM" } }] },
     { "nom": "fastclip absente", "operations": [{ "type": "definir", "chemin": ["segments_interdits", 0, "valeur"], "valeur": "autre" }] },
     { "nom": "segments interdits vides", "operations": [{ "type": "definir", "chemin": ["segments_interdits"], "valeur": [] }] },
     { "nom": "version 2", "operations": [{ "type": "definir", "chemin": ["version"], "valeur": "2" }] },
     { "nom": "secrets absent", "operations": [{ "type": "supprimer", "chemin": ["secrets"] }] },
     { "nom": "propriété racine en plus", "operations": [{ "type": "definir", "chemin": ["regles_secrets"], "valeur": [] }] }
   ],
   "regles_valides": [
     { "nom": "configuration par défaut", "operations": [] },
-    { "nom": "id de 32 caractères", "operations": [{ "type": "definir", "chemin": ["secrets", 0, "id"], "valeur": "SEC-ABCDEFGHIJKLMNOPQRSTUVWXYZ01" }] },
-    { "nom": "valeur de 64 caractères", "operations": [{ "type": "definir", "chemin": ["secrets", 0, "valeur"], "valeur": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" }] },
-    { "nom": "FastClip en casse mixte", "operations": [{ "type": "definir", "chemin": ["segments_interdits", 0, "valeur"], "valeur": "FastClip" }] }
+    { "nom": "id de 32 caractères (règle ajoutée)", "operations": [{ "type": "pousser", "chemin": ["secrets"], "valeur": { "id": "SEC-ABCDEFGHIJKLMNOPQRSTUVWXYZ01", "type": "nom_exact", "valeur": ".exemple" } }] },
+    { "nom": "valeur de 64 caractères (règle ajoutée)", "operations": [{ "type": "pousser", "chemin": ["secrets"], "valeur": { "id": "SEC-EXACT-LONGUE", "type": "nom_exact", "valeur": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" } }] },
+    { "nom": "casse mixte acceptée sur une règle ajoutée", "operations": [{ "type": "pousser", "chemin": ["segments_interdits"], "valeur": { "id": "INT-AUTRE", "type": "contient", "valeur": "AutreMot" } }] }
+  ],
+  "regles_sous_plancher": [
+    {
+      "nom": "FastClip en casse mixte (définition du plancher modifiée)",
+      "operations": [{ "type": "definir", "chemin": ["segments_interdits", 0, "valeur"], "valeur": "FastClip" }],
+      "attendu": { "categorie": "segments_interdits", "id": "INT-FASTCLIP", "raison": "MODIFIEE" }
+    },
+    {
+      "nom": "id d'une règle de secret renommé",
+      "operations": [{ "type": "definir", "chemin": ["secrets", 0, "id"], "valeur": "SEC-ABCDEFGHIJKLMNOPQRSTUVWXYZ01" }],
+      "attendu": { "categorie": "secrets", "id": "SEC-EXACT-SSH", "raison": "ABSENTE" }
+    },
+    {
+      "nom": "valeur d'une règle de secret modifiée",
+      "operations": [{ "type": "definir", "chemin": ["secrets", 0, "valeur"], "valeur": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" }],
+      "attendu": { "categorie": "secrets", "id": "SEC-EXACT-SSH", "raison": "MODIFIEE" }
+    }
+  ],
+  "jokers": [
+    { "nom": "point d'interrogation seul", "entree": "?", "attendu": { "ok": false, "code": "JOKER_NON_AUTORISE" } },
+    { "nom": "deux points d'interrogation", "entree": "??", "attendu": { "ok": false, "code": "JOKER_NON_AUTORISE" } },
+    { "nom": "trois étoiles", "entree": "***", "attendu": { "ok": false, "code": "JOKER_NON_AUTORISE" } },
+    { "nom": "point d'interrogation final", "entree": "src/?", "attendu": { "ok": false, "code": "JOKER_NON_AUTORISE" } },
+    { "nom": "étoile seule", "entree": "*", "attendu": { "ok": false, "code": "JOKER_RACINE_INTERDIT" } },
+    { "nom": "double étoile seule", "entree": "**", "attendu": { "ok": false, "code": "JOKER_RACINE_INTERDIT" } },
+    { "nom": "joker final simple", "entree": "src/*", "attendu": { "ok": true, "litteral": "src", "jokerFinal": true } },
+    { "nom": "joker final récursif, barres inverses", "entree": "src\\a\\**", "attendu": { "ok": true, "litteral": "src/a", "jokerFinal": true } },
+    { "nom": "sans joker", "entree": "src/a.ts", "attendu": { "ok": true, "litteral": "src/a.ts", "jokerFinal": false } },
+    { "nom": "joker après séparateur initial", "entree": "/**", "attendu": { "ok": true, "litteral": "", "jokerFinal": true } }
   ]
 }
```

