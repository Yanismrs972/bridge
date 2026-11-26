# Bridge v1 — Document de référence

Révision 8 — version finale de T0 (clôture documentaire). Base : révision 7, corrections C1 à C12 intégrées.

**Statut.** T0 est documentairement clôturé. Cela NE valide PAS la sécurité technique, ne tranche aucun
arbitrage (A1 à A21), n'accepte aucun risque et n'autorise ni T1 à T9 (dont T6, T6b, T6c), ni canaris,
ni mission jetable ou réelle, ni commit, ni push. Chaque tâche demande une autorisation humaine distincte.
L'usage réel reste NO-GO (§ 17). Les incertitudes techniques restantes sont rattachées à la tâche qui
doit les vérifier ; elles ne justifient pas de nouvelle révision documentaire.

## 0. Étiquettes
- **[PR]** Protection préventive assurée par la logique de Bridge, pour une action possible UNIQUEMENT dans
  un processus contrôlé par Bridge.
- **[PV]** Protection visée, dépendant de Node, de Windows ou d'un composant non démontré.
- **[CLI]** Restriction appliquée par une CLI (Codex ou Claude). Ce n'est pas une frontière de sécurité.
- **[DET]** Détection après coup ; peut survenir après le début de l'action ; n'empêche rien.
- **[HUM]** Contrôle humain.
- **[NT]** Comportement non testé.
- **[RA]** Risque accepté, uniquement après l'arbitrage humain correspondant.

Une preuve (T6, T6b, canari) ne vaut que pour la version exacte et le scénario testés ; toute mise à jour
l'annule.

## 1. Objectif
Bridge est un orchestrateur local. Il fait réaliser une mission sur un projet par Claude Code (exécutant),
sous la supervision de Codex CLI (superviseur en lecture seule). Un humain approuve le périmètre, les
paramètres et chaque écriture, puis valide le résultat. Bridge encadre, mesure, bloque, suspend et demande ;
il ne décide jamais à la place de l'humain face à l'incertain.

## 2. Niveau de sécurité
- Tout s'exécute sous le compte Windows de l'utilisateur, sans isolation système. Le niveau d'isolation est
  inférieur à celui étudié en v19 / v19.1 (`docs/rapports/27-*`, `28-*`), dont les constats NO-GO sur
  l'isolation restent valables (A6).
- Tout processus de ce compte, agents compris, peut techniquement lire, écrire, lancer des processus,
  falsifier les données de Bridge et communiquer sur le réseau, sauf restriction de sa propre CLI.
  Aucun mécanisme de ce document ne l'empêche indépendamment.
- Les permissions Node ne sont ni un pare-feu ni une ACL Windows. Elles ne sont pas héritées par les autres
  processus. Codex et Claude, exécutables natifs, n'y sont pas soumis.

## 3. Décisions acquises, mécanismes et vérifications
Décisions de l'utilisateur (message « T0 » et consignes antérieures). Les mécanismes sont des propositions ;
les vérifications sont rattachées à une tâche.

| Décision acquise | Mécanisme proposé | Vérification |
|---|---|---|
| D1 Bridge fonctionne sur Windows | `bridge.cmd` | T2 |
| D2 Codex sur le PC, compte ChatGPT | Indicateur d'abonnement (§ 11.3) | T6 [NT] |
| D3 Codex lit directement les fichiers du projet, sans transfert manuel | Serveur de lecture ; interprétation I1/I2 (§ 6) | A15 |
| D4 Codex superviseur, lecture seule | Serveur sans écriture ; voies désactivées (§ 8.6, § 12) | T6, T9 [NT] |
| D5 Claude exécutant ; consigne « Claude seul agent autorisé à modifier le projet » | E1/E2 ; applicateur (§ 6, § 7) | A15, A16 |
| D6 Bridge gère permissions, états, budgets, approbations | § 14 à § 16 | T4, T5 |
| D7 Codex indisponible, hors quota ou verdict invalide ⇒ SUSPENDUE | S1 (§ 14) | T4 |
| D8 Aucune relance automatique | § 14.4 | T4 |
| D9 Aucun sous-agent | Voies de délégation désactivées (§ 12) [CLI] | T6, T9 [NT] |
| D10 Aucun commit ni push automatique | Aucun outil Git ; voies d'exécution désactivées (§ 12) [CLI] | T6, T9 [NT] |
| D11 Pas d'accès à Fastclip sans autorisation explicite (principe) | Refus par chemin résolu ; aucun mécanisme d'exception tant que A7 n'est pas tranché | T6 [NT] |
| D12 Aucune exécution du code des projets orchestrés | § 12 | T6, T9 [NT] |
| Interface sur 127.0.0.1 | Écoute locale, contrôle Host/Origin/Content-Type, jeton | [PR] code actuel ; jeton : T5 |
| Simulation par défaut ; mode réel seulement via `--real` | `--real` refusé dans le code actuel | [PR] |
| Aucun fallback API payant | Liste blanche de variables + indicateur d'abonnement (§ 11.3) | T6 [NT] |
| TypeScript 6.0.3 | — | En place |

L'exécution du code de Bridge lui-même pendant les sessions de développement relève d'autorisations
distinctes : ce n'est pas du code de projet orchestré.

## 4. Composants
| Composant | Nature | Rôle |
|---|---|---|
| Serveur Bridge | Processus Node lancé par l'utilisateur (`bridge.cmd`) | Interface, états, limites, approbations, journal, copie de travail, vérification |
| Serveur de lecture | Processus Node distinct, lancé par Bridge | `list`, `read`, `search` pour Codex |
| Applicateur | Processus Node distinct, lancé par Bridge après approbation | Remplacements approuvés et restaurations dans le projet réel |
| Gardien | Utilitaire Windows dédié (A13) | Job Object, lancement, surveillance et arrêt des processus |
| Codex CLI, Claude Code | Exécutables natifs, lancés via le gardien | Superviseur, exécutant |

## 5. Racines et zones (A14)
Deux racines placées hors de tout projet orchestré, du dossier d'installation de Bridge et des emplacements
interdits. Défaut proposé : `%LOCALAPPDATA%\Bridge\donnees\` et `%LOCALAPPDATA%\Bridge\travail\` (le code
actuel utilise `<Bridge>\.bridge-data`).
- Données internes : `etat\` (configuration locale, projets autorisés, emplacements interdits, verrou,
  identité du gardien), `missions\<id>\journal\`, `missions\<id>\sauvegardes\`, `missions\<id>\resultats\`.
- Travail : `<id>\copie\` (option E1), `<id>\codex-<aléa>\` (dossier vide de Codex, un par appel).

Accès visés [PV] : Bridge lit les projets autorisés et lit et écrit dans ses racines, jamais dans les
projets ; le serveur de lecture lit sa seule racine lisible ; l'applicateur lit et écrit les seuls fichiers
de son ordre. Toutes les zones restent accessibles au compte de l'utilisateur, donc aux agents.

## 6. D3, copie de travail et options d'écriture (A15, A20)
### 6.1 Deux interprétations de D3
- **I1** : Codex lit le projet réel via le serveur. Information fraîche à chaque lecture, mais qui peut
  changer entre deux lectures.
- **I2** : Codex lit la copie de travail (E1). Information figée au moment de la copie, à laquelle
  s'ajoutent les modifications de Claude ; elle peut différer du projet réel. Chaque réponse du serveur
  indique sa provenance : copie, mission, empreinte d'origine du fichier réel.

Le choix appartient à l'utilisateur (A15). E1 n'est compatible avec D3 que si l'utilisateur retient I2.

### 6.2 Options d'écriture (aucune choisie)
- **E1 — copie de travail + applicateur.** Simple réduction de risque [CLI][DET][HUM] : Claude peut atteindre
  le projet réel par chemin absolu ; aucune prévention.
- **E2 — Claude écrit dans le projet réel.** Restriction CLI [CLI][NT] et empreintes [DET].
- **ISO — isolation système** (compte distinct avec ACL, conteneur, VM…). À étudier en T6c si A20 le décide.

### 6.3 Copie E1 : « copie cohérente selon les critères vérifiés »
1. Passe 1 : inventaire et empreintes du projet réel.
2. Copie. Exclusions N1 à N4 appliquées (§ 11.1). Liens, jonctions, points de réanalyse et fichiers à liens
   physiques multiples : non copiés, listés.
3. Passe 2 : nouvelles empreintes du projet réel et empreintes de la copie, comparées au manifeste.
4. Tout écart ou fichier manquant ⇒ mission refusée. L'humain peut relancer la préparation : c'est une
   lecture par Bridge, pas une écriture incertaine.

Ce n'est PAS un instantané atomique. Les deux passes ne prouvent pas que tous les fichiers ont coexisté dans
le même état du projet, et une modification annulée entre les passes n'est pas vue [DET]. L'avis de Codex et
l'approbation humaine portent donc sur une copie cohérente selon ces seuls critères ; l'écran d'approbation
le rappelle.

### 6.4 Péremption de l'avis de Codex
Juste avant l'application, toute empreinte du projet réel différente du manifeste entraîne :
- pour un fichier à modifier : conflit, application refusée ;
- pour un fichier lu par Codex (selon le journal du serveur) : recopie du fichier, nouvelle évaluation par
  Codex et nouvelle approbation ;
- pour un autre fichier du périmètre : avertissement ; décision humaine entre réévaluation et poursuite.

## 7. Applicateur
Composant de confiance de Bridge, mais pas une frontière de sécurité. Il garantit seulement que LUI n'écrit
que ce qui a été approuvé [PR pour ses propres écritures ; PV pour ses permissions Node]. Il n'empêche pas
les écritures directes d'un autre processus du compte, qu'il soit agent ou non. Celles-ci sont seulement
détectées par empreintes [DET].

### 7.1 Lancement
Uniquement après approbation, par Bridge via le gardien. Lancement par `node --permission` : lecture des
seuls fichiers sources et cibles de l'ordre, écriture des seules cibles, aucun processus enfant, aucun
worker, aucun module natif [PV][NT]. Avant le lancement, Bridge vérifie le chemin, la version et
l'empreinte de Node, ainsi que l'empreinte du script de l'applicateur, qui n'a aucune dépendance externe.
Une course subsiste entre cette vérification et le chargement [PV].

### 7.2 Canal et authentification
- Canal aller-retour : entrée standard (Bridge vers applicateur) et sortie standard (applicateur vers
  Bridge), créées au lancement. Ce canal n'est pas sécurisé par nature.
- Premier message : une clé aléatoire propre à ce lancement. Chaque message porte ensuite un numéro de
  séquence strictement croissant et un code d'authentification calculé avec cette clé.
- Ordre initial : identifiant de mission, empreinte du manifeste, empreinte de l'approbation, numéro unique,
  date d'expiration, liste exacte des opérations (chemin, empreinte avant, empreinte de la source, empreinte
  attendue après).
- Portée réelle : cette authentification protège contre les erreurs, les mélanges d'ordres et les
  altérations accidentelles. Elle NE protège PAS contre un processus hostile du même compte Windows, qui peut
  lancer sa propre copie de l'applicateur, lire la mémoire ou forger un canal. Ce risque n'est que détecté
  [DET], et son acceptation relève de A6.

### 7.3 Autorisation unique par fichier et par opération
1. L'applicateur pré-vérifie TOUTE la liste (§ 7.4, étape 3). Un seul écart : il n'écrit rien.
2. Pour chaque fichier, il envoie une INTENTION : fichier, opération, empreintes, séquence.
3. Bridge compare l'intention à l'ordre approuvé, la journalise, synchronise le journal sur disque, puis
   répond par une AUTORISATION à usage unique, liée à la séquence et au fichier.
4. L'applicateur n'écrit qu'après une autorisation valide. Une autorisation déjà utilisée, une séquence
   inattendue ou un code invalide sont refusés.
5. Rejeu : clé, numéros et ordre sont propres à un seul lancement. Un ordre expiré ou déjà consommé est
   refusé.
6. Perte du canal :
   - aucune nouvelle écriture n'est commencée ;
   - un fichier en cours d'écriture est en état incertain ⇒ S2 ;
   - si aucune écriture n'était en cours, l'étape d'application reste incertaine ⇒ S3. Aucune relance
     (§ 14.4).

### 7.4 Remplacement d'un fichier existant (seule écriture prévue en v1)
| Étape | Action | Interruption à cette étape |
|---|---|---|
| 1 | Bridge sauvegarde la cible ; empreinte inscrite au manifeste et au journal | Application arrêtée ; état incertain sauf preuve positive (§ 14.4) |
| 2 | Relecture de la sauvegarde ; comparaison d'empreinte | Idem |
| 3 | Pré-vérification : chemin (§ 10), un seul lien physique, attribut lecture seule absent, cible = empreinte attendue, source = empreinte approuvée | Idem ; aucun écart toléré |
| 4 | Intention, journalisation et synchronisation, autorisation (§ 7.3) | Sans autorisation : aucune écriture par l'applicateur |
| 5 | Ouverture ; contrôle d'identité du descripteur ; écriture en place, NON atomique ; synchronisation | S2 : fichier peut-être partiel |
| 6 | Relecture et empreinte | S3 si l'empreinte diffère |
| 7 | Fin journalisée ; fichier suivant | Liste terminée ⇒ ATTENTE_VALIDATION |

- Prévention : l'applicateur n'écrit qu'après les étapes 3 et 4 [PR].
- Détection : une modification concurrente par un autre processus, entre l'étape 3 et l'étape 6, est
  visible par l'empreinte finale [DET].
- Renommage et suppression : interdits.

### 7.5 Propriétés NTFS
Aucune propriété n'est promise au-delà du contenu du flux principal.
- **ACL et attributs.** L'écriture en place devrait les conserver et ne modifie que les dates [NT] ; à vérifier
  en T6b. Un fichier en lecture seule est refusé à la pré-vérification.
- **Flux alternatifs NTFS.** Node ne sait pas les énumérer [NT]. Ils ne sont ni sauvegardés ni restaurés.
- **Fichiers chiffrés ou compressés.** Comportement [NT] ; ils sont refusés si T6b ne démontre pas un
  traitement correct.
- **Sauvegarde.** Elle ne contient que le flux principal. Elle est incomplète au regard des ACL, des
  attributs, des flux alternatifs et des dates : une restauration ne les rétablit pas.
- **Modifications concurrentes.** Détectées seulement par empreintes [DET].

### 7.6 Création de fichiers (A18 non tranché : non autorisée)
Conditions minimales avant de pouvoir l'autoriser :
- création exclusive (échec si le fichier existe) ;
- dossier parent existant, vérifié et sans point de réanalyse ;
- nom validé, sans flux alternatif ;
- intention et autorisation selon le § 7.3 ;
- empreinte finale ;
- aucune annulation par Bridge, qui serait une suppression ;
- comportement des permissions Node sur un chemin inexistant démontré en T6b.

## 8. Serveur de lecture (A1(d), A11)
### 8.1 Rôle
Trois outils : `list`, `read`, `search`. Ni écriture, ni commande, ni réseau [PR]. Lancé par Bridge sans
permission d'écriture [PV].

### 8.2 Transport
- **R (cible)** : relais de Bridge sur 127.0.0.1, jeton propre à l'appel, chaque requête relayée et
  journalisée.
- **R′** : relais minimal lancé par Codex, à étudier.
- **S** : serveur lancé par Codex ; expérimental, jamais activé automatiquement.

À relever en T6 :
- transport accepté par la version installée ;
- déclaration du serveur ;
- transmission du jeton et authentification ;
- connexions persistantes ;
- fermeture et invalidation du jeton ;
- arrêt du serveur ;
- comportement en cas de perte du relais.

### 8.3 Unités de comptage
| Unité | Définition |
|---|---|
| Lus | Octets lus sur disque par le serveur ; chaque lecture compte, même répétée |
| Analysés | Octets examinés par `search` (inclus dans les lus) |
| Retournés | Contenu utile des réponses du serveur, messages d'erreur compris |
| Transmis | Octets envoyés à Codex par le relais, enveloppe MCP et messages d'erreur compris |
| Conservés | Octets écrits par Bridge : journaux, résultats, sauvegardes, copie de travail |

### 8.4 Limites (valeurs provisoires, A9)
| Périmètre | Limite |
|---|---|
| Par requête | arguments ≤ 4 Ko ; chemin ≤ 1 024 caractères ; retournés ≤ 64 Ko ; message MCP ≤ 512 Ko, enveloppe comprise ; délai 10 s |
| `list` | non récursif ; pagination ; 500 entrées par réponse |
| `read` | plage ≤ 64 Ko ; fichier ≤ 1 Mo ; binaires refusés |
| `search` | texte littéral ; analysés ≤ 20 Mo ; profondeur 12 ; 5 000 fichiers ; 200 résultats |
| Par appel Codex | 500 requêtes ; transmis ≤ 8 Mo ; lus ≤ 64 Mo |
| Par mission | transmis ≤ 32 Mo ; lus ≤ 256 Mo |
| Concurrence | une requête traitée à la fois ; file d'attente de 4 ; au-delà, erreur |

Comportements :
- **Dépassement** : réponse d'erreur « limite atteinte » ; les requêtes suivantes concernées sont refusées.
- **Requête interrompue** : parcours arrêté au bloc suivant ; journalisation des octets déjà transmis.
- **Fichier modifié pendant sa lecture** (taille ou identité différentes entre deux blocs) : erreur
  « fichier instable ».

### 8.5 Mémoire : trois niveaux distincts
- **Limites de conception.** Le serveur lit par blocs de 64 Ko et vérifie la taille de la réponse avant chaque
  ajout. Le relais garde au plus 512 Ko par message ; au-delà, il arrête le serveur et passe en S1.
- **Limites imposées par le code.** Celles qui seront effectivement codées en T7a. Les listes intermédiaires
  (entrées de `list`, résultats de `search`), la construction des chaînes, la sérialisation JSON et les
  tampons du relais créent des copies supplémentaires. Le pic mémoire est donc un multiple de la taille de
  réponse, sans valeur garantie. Le ramasse-miettes et le moteur Node ne sont pas bornés par Bridge.
- **Limites vérifiées.** Aucune à ce jour. À mesurer en T7a, puis lors des canaris de T9.

### 8.6 Exclusivité de l'accès de Codex
Méthode :
- **T6** (sans appel de modèle) : relevé documentaire de la version installée.
- **T9** (canaris) : vérification de la désactivation de chaque voie.

Chaque voie reçoit un statut : identifiée, désactivée et vérifiée, accessible, ou non vérifiable. Une voie
accessible ou non vérifiable ⇒ A1(d) NO-GO. La surveillance des événements reste une détection [DET].

## 9. Journalisation (contenu jamais conservé par défaut)
- Chaque transmission ou lecture servie est journalisée : provenance (fichier, racine, copie ou projet),
  taille, ordre (numéro de séquence), empreinte du contenu, résultat et horodatage.
- Le contenu transmis n'est PAS conservé dans le journal, sauf décision ultérieure explicite de
  l'utilisateur. Le « journal exact » de Codex (option R) signifie : chaque transmission identifiée,
  mesurée et identifiable par son empreinte, sans copie de son contenu.
- Le journal est chaîné : chaque ligne contient l'empreinte de la précédente. Cela détecte une corruption
  accidentelle, pas une falsification, puisque le journal est accessible au compte de l'utilisateur.
- Masquage des motifs de secrets connus, sans garantie d'exhaustivité.

## 10. Chemins Windows
Contrôles logiques [PR], dont l'efficacité dépend de Node et de Windows [NT] :
- liens symboliques et jonctions ;
- autres points de réanalyse, dont les fichiers OneDrive à la demande, dont la lecture peut déclencher un
  téléchargement ;
- volumes montés ;
- lecteurs réseau ou substitués ;
- noms courts 8.3 ;
- liens physiques (refus au-delà d'un lien) ;
- identité du descripteur ouvert.

Node n'expose a priori ni le type de point de réanalyse, ni le type de lecteur, ni le chemin d'un
descripteur ; un utilitaire Windows serait nécessaire (T6b). Les courses entre résolution, ouverture et
lecture ou écriture sont réduites, pas éliminées. Une information indisponible devient une limite connue.

## 11. Données et authentification
### 11.1 Exclusions (A5)
| Niveau | Contenu | Exception |
|---|---|---|
| N1 | Secrets, clés privées, identifiants, jetons, `.env*`, `auth.json`, `.git/`, fichiers à liens physiques multiples, emplacements interdits | Aucune |
| N2 | `.claude/`, `.codex/`, `.mcp.json`, hooks, réglages d'organisation | Aucune en v1 |
| N3 | `CLAUDE.md`, `AGENTS.md` | Comme données non fiables uniquement, après affichage et approbation spécifique, pour une mission |
| N4 | Fichiers de plus de 1 Mo ; fichiers binaires | Aucune en v1 |

Un filtre de noms ne détecte pas tous les secrets. Un fichier non copié ou refusé par le serveur n'est PAS
inaccessible : aucune inaccessibilité n'est promise sans protection système.

### 11.2 Transmission
- Codex (option R) : chaque transmission journalisée selon le § 9.
- Claude : lectures observées seulement, non exhaustives [DET][NT].
- Contenus chargés automatiquement par les CLI et données non observables : signalés comme tels.
- Les traitements internes des fournisseurs (OpenAI, Anthropic) sont inconnus.

### 11.3 Authentification et abonnement
| État | Valeur |
|---|---|
| Indicateur fourni par la CLI (documenté, fiable, non sensible) | Seule base acceptable [NT] |
| État déduit de fichiers, de variables ou de déclarations d'un agent | Refusé : ne remplace jamais l'indicateur |
| État affiché à l'utilisateur | Information, pas une preuve |
| État vérifiable indépendamment par Bridge | Aucun connu |

- T6 peut ne trouver AUCUN indicateur de ce type. Dans ce cas, la mission réelle reste interdite.
- Une configuration dédiée (A12) ne prouve ni le compte, ni le mode d'abonnement.
- Bridge transmet aux agents un environnement construit par liste blanche, dont les variables de clés d'API
  sont retirées. Ce filtrage ne couvre ni les fichiers de configuration, ni les identifiants enregistrés, ni
  le gestionnaire d'identifiants Windows, ni les réglages d'organisation.
- Bridge ne lit jamais un fichier d'identification ; il peut seulement en constater la présence par son nom.

## 12. Voies d'exécution, de délégation et d'accès (D4, D9, D10, D12)
| Voie | Codex | Claude | Décision concernée |
|---|---|---|---|
| Shell et commandes | shell, exécution unifiée, autres modes d'exécution | Bash, PowerShell, commandes « ! » | D4, D10, D12 |
| Sous-agents et délégation | fonctions de délégation ou multi-agents, si elles existent [NT] | Agent, Task, sous-agents | D9 |
| Tâches en arrière-plan | terminaux ou tâches en arrière-plan, si elles existent [NT] | commandes ou tâches en arrière-plan, planification | D9, D12 |
| Hooks et commandes de configuration | commandes de notification, si elles existent [NT] | hooks, ligne d'état, `apiKeyHelper` | D12 |
| Serveurs MCP | issus de la configuration | `.mcp.json`, configuration | D4, D12 |
| Plugins, applications, extensions, compétences | oui [NT] | oui [NT] | D9, D12 |
| Web et images | recherche web, outils d'image | WebFetch, WebSearch | D4 |
| Git | via shell, MCP ou plugins | idem | D10 |
| Fonctions propres aux versions installées | inconnues | inconnues | toutes |
| Serveur de lecture, applicateur, Bridge | — | — | N'exécutent jamais de fichier de projet [PR] |

Traitement :
- désactivation ou neutralisation avant le démarrage [CLI][NT], relevée en T6 et vérifiée par les canaris
  de T9 ;
- surveillance des événements [DET], qui n'est pas une prévention ;
- toute voie accessible ou non vérifiable ⇒ NO-GO de l'usage réel ;
- les voies inconnues restent un risque à arbitrer (A6).

## 13. Gardien et Job Object (A13), entièrement [PV][NT] jusqu'à T6b et aux canaris
### 13.1 Mécanismes prévus
- Job Object non nommé, configuré AVANT tout rattachement avec `JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE`, sans
  autorisation de sortie (ni `JOB_OBJECT_LIMIT_BREAKAWAY_OK` ni `JOB_OBJECT_LIMIT_SILENT_BREAKAWAY_OK`).
- Processus créé suspendu, rattaché, puis démarré, ou rattaché à la création si cela s'avère disponible.
  Ses enfants héritent du Job Object.
- Seul le gardien détient le descripteur : non héritable, jamais dupliqué. Le gardien n'est pas membre du
  Job Object.

### 13.2 Propriétés à vérifier en T6b
- Lorsque le dernier descripteur se ferme, `KILL_ON_JOB_CLOSE` doit arrêter tous les membres. Cela suppose
  qu'aucun autre descripteur n'existe : ni héritage, ni duplication, ni ouverture par un processus disposant
  des droits nécessaires sur le gardien.
- Refus des tentatives de sortie du Job Object.
- Comportement des Job Objects imbriqués, si une CLI crée les siens.
- Liste des membres disponible ; confirmation qu'aucun processus actif ne subsiste.

### 13.3 Surveillance réciproque
Canal unique entre Bridge et le gardien ; signal de vie toutes les 2 s ; absence au-delà de 10 s.

| Événement | Comportement |
|---|---|
| Perte de Bridge | Le gardien arrête le Job Object puis se termine |
| Perte du gardien | Fermeture du descripteur ⇒ arrêt des membres, sous la condition du § 13.2 ; Bridge ne peut pas le confirmer ⇒ S6 |
| Blocage du gardien | Bridge arrête le gardien ⇒ même condition ⇒ S6 tant que l'arrêt n'est pas confirmé |
| Perte du descripteur | S6 |
| Échec de rattachement | Le processus suspendu est arrêté sans avoir démarré ; aucun lancement ; échec de sécurité |
| Tentative de sortie du Job Object | Refusée si la configuration le permet [NT] ; sinon non détectée |
| Processus créé hors du Job Object (service, WMI, tâche planifiée, serveur COM…) | Ni arrêté ni détecté : limite connue, à arbitrer (A6) |
| Arrêt impossible à confirmer | S6 |

« Arrêt confirmé » signifie seulement : plus aucun processus dans le Job Object. Tant qu'une S6 est ouverte,
aucun agent, serveur de lecture ni applicateur n'est lancé.

## 14. États et suspensions
### 14.1 Portée des preuves
- Des empreintes identiques prouvent seulement l'absence de différence dans le périmètre surveillé.
- « Aucun appel observé » ou « aucune action observée » ne prouve pas l'absence d'action.
- L'absence d'effet externe n'est jamais déduite.

### 14.2 États
EN_COURS · ATTENTE_APPROBATION · SUSPENDUE · ATTENTE_VALIDATION · APPLICATION · TERMINEE · ARRETEE.

### 14.3 Types de suspension
| Type | Situation |
|---|---|
| S1-R | Échec de Codex, relançable (§ 14.4) |
| S1-N | Échec de Codex, non relançable |
| S2 | Interruption pendant une écriture (Claude ou applicateur) |
| S3 | Écriture au résultat incertain, ou étape d'écriture interrompue sans preuve positive |
| S4 | Échec de Claude, relançable (§ 14.4) |
| S5 | Intégrité compromise |
| S6 | Arrêt non confirmé |

Aucune transition automatique ne sort de SUSPENDUE.

### 14.4 Relance (S1-R, S4)
Une relance n'est autorisée que sur preuve POSITIVE et suffisamment fiable que l'opération n'a jamais pu
produire d'effet. Preuves admises, communiquées en direct par le gardien, et non lues dans un fichier du
compte de l'utilisateur :
- (a) le processus n'a jamais été créé ;
- (b) le processus, créé suspendu, a été arrêté sans jamais avoir démarré.

Ces attestations viennent elles-mêmes d'un processus du compte de l'utilisateur [PV][NT]. Une étape non
lancée par Bridge, par exemple une pré-vérification échouée avant le lancement de l'applicateur, ne
constitue pas une opération : rien n'est à relancer.

L'absence d'une entrée dans un journal accessible au même compte Windows n'est JAMAIS une preuve.

Il faut en outre : l'arrêt confirmé, aucune différence constatée et une nouvelle approbation complète.
Dans tous les autres cas (quota, verdict invalide, erreur après démarrage…) : S1-N ou S3, rejeu interdit ;
sorties possibles : inspection ou abandon. Une nouvelle mission après abandon reste à arbitrer (A21).

### 14.5 S2 et S3
Jamais de rejeu. Sorties possibles :
- inspection ;
- abandon ;
- restauration (§ 14.6) ;
- « soumettre l'état actuel à vérification » (A3) : une nouvelle étape, avec nouvelle approbation et
  limites.

### 14.6 Restauration (hors S5)
Uniquement sur demande humaine, fichier par fichier, par l'applicateur (§ 7.3), si les trois conditions
suivantes sont réunies :
- la sauvegarde est conforme ;
- le fichier actuel correspond à la dernière empreinte enregistrée ;
- le fichier n'a qu'un seul lien physique.

Seul le flux principal est restauré (§ 7.5). Un fichier non sauvegardé n'est pas restauré.

### 14.7 S5
Journal, manifeste et sauvegardes peuvent être compromis ensemble.
- Aucune restauration automatisée ni aucun écrasement en v1.
- Bridge affiche les éléments disponibles ; l'humain décide et agit.
- Des empreintes conservées par l'utilisateur hors du PC l'aident à décider ; Bridge peut les comparer, mais
  pas les authentifier.

## 15. Approbations (A17, A8)
- Deux ensembles :
  - « lecture » : appels de Codex, qui transmettent à OpenAI ;
  - « écriture » : appels de Claude, applications, restaurations.
- Contenu figé, si une approbation unique par mission est retenue : périmètre, exclusions et exceptions N3,
  destinataire, modèle demandé, exécutables et leurs empreintes, arguments, configuration, outils et
  serveurs MCP demandés, limites, nombre d'appels.
- Une nouvelle approbation est exigée si : un élément figé change, la CLI annonce au démarrage un élément
  différent, une exception est ajoutée, une relance est demandée (§ 14.4), ou l'avis de Codex est périmé
  (§ 6.4).
- Les éléments inconnus sont affichés comme INCONNUS et ne sont pas approuvés en connaissance de cause :
  modèle réellement servi, sources de configuration non inspectables, consommation des quotas.
- L'écran rappelle les limites de la copie E1 (§ 6.3).
- Validation finale du diff (A8). Sans réponse humaine, Bridge attend.

## 16. Limites et conservation (valeurs provisoires, A9, A19)
Appels :
- 4 au superviseur, 3 à l'exécutant, 1 correction ;
- délais : 5 min par appel Codex, 10 min par appel Claude, 60 min par mission ;
- sorties brutes de chaque appel (stdout, stderr) : 5 Mo et 1 Mo.

Volumes :
- événements de CLI : 20 000 par appel, 60 000 par mission ;
- diffs : 5 Mo ; journal : 50 Mo ;
- copie de travail : 20 000 fichiers et 200 Mo ;
- volume conservé par mission : 500 Mo. Il comprend la copie, les sauvegardes, les journaux, les rapports,
  les diffs, les sorties brutes, les fichiers temporaires et partiels, ainsi que les missions suspendues ou
  abandonnées.

En cas de dépassement :
- pendant un appel : arrêt et suspension ;
- entre deux étapes : refus de l'étape suivante ;
- pendant la copie : mission refusée.

Le budget `--max-budget-usd` est indicatif : ce n'est pas un plafond en mode abonnement [NT]. Aucune
suppression automatique ; une purge n'a lieu que sur demande humaine (A19). Aucun fallback payant, aucune
relance automatique.

## 17. Arbitrages ouverts (aucun n'est tranché)
**1. Décisions de principe (sans relevé) :**
- A3 vérification sans rejeu ;
- A4 échec de Claude ;
- A5 exclusions ;
- A6 isolation inférieure à la v19 et risques connexes ;
- A7 mécanisme Fastclip en v1 ;
- A8 validation finale ;
- A9 limites provisoires ;
- A10 confirmation de l'emplacement Fastclip : `C:\Users\yanis\Desktop\PORJET GLOBAL\Fastclip`, à
  confirmer ; OneDrive et copies inconnus ;
- A14 racines ;
- A15-a interprétation I1 ou I2 de D3 ;
- A16 écriture par l'applicateur ;
- A17 granularité des approbations ;
- A19 purge ;
- A20 lancer ou non l'étude ISO ;
- A21 nouvelle mission après abandon.

**2. Après le relevé T6 :**
- A2 état de Windows ;
- A10 emplacement définitif ;
- A11 transport R ou R′ ;
- A12 configurations dédiées ;
- préparation de A1 (liste des voies).

**3. Après T6b ou T6c :**
- A13 gardien et utilitaire ;
- A15-b choix entre E1, E2 et ISO ;
- A18 création de fichiers.

**4. Après les canaris de T9 :**
- A1(d) définitif ;
- validation des neutralisations (§ 8.6, § 12) ;
- autorisation de la mission jetable, puis de l'usage réel.

Contradictions conservées jusqu'à arbitrage :
1. D3 / E1 ;
2. D5 et « Claude seul à modifier » / A16 ;
3. D11 / A7 ;
4. D2 / indicateur d'abonnement obligatoire ;
5. D3, D4, D12 / échec possible de A1(d) ;
6. N2 / refus des projets contenant des configurations ou des hooks ;
7. absence d'ISO / absence de prévention indépendante ;
8. restauration humaine en S5 ;
9. D7 / relance stricte : une suspension de Codex aboutit à l'abandon, sauf A21.

## 18. Plan, simulation et NO-GO
### 18.1 Plan unique
Chaque tâche demande une autorisation distincte.
- **T1** robustesse.
- **T2** `bridge.cmd` et racines.
- **T3** mission générique, exclusions, chemins, copie E1.
- **T3b** applicateur et restauration.
- **T4** états, relances, limites.
- **T5** jeton local et approbations.
- **T6** relevé en lecture seule (§ 18.2).
- **T6b** expérimentations locales sans agent ni modèle : gardien, Job Object, utilitaire Windows,
  comportement des permissions Node, chemins, NTFS.
- **T6c** étude ISO, si A20.
- **T7a** serveur de lecture et relais.
- **T7** adaptateur Codex.
- **T8** adaptateur Claude.
- **T9** canaris, puis mission jetable, chacun avec son autorisation.

### 18.2 Périmètre de T6 (relevé en lecture seule, sur autorisation)
Autorisé lorsque T6 sera autorisé :
- relever la version et l'édition de Windows et l'état des mises à jour ;
- relever la version de Node ;
- relever les chemins et versions de Codex et de Claude, et leur aide en ligne de commande, sans appel de
  modèle ni connexion ;
- relever les options et fonctions documentées (§ 8.2, § 8.6, § 11.3, § 12) ;
- relever par leur nom les emplacements de configuration (personnels, d'organisation, projet de test) ;
- résoudre le chemin des emplacements interdits, sans lecture de leur contenu.

Interdit en T6 :
- tout appel de modèle ou toute mission ;
- toute écriture hors du rapport de relevé ;
- toute lecture de fichier d'identification ;
- tout accès au contenu de Fastclip ;
- toute modification de configuration ;
- tout essai qui crée des liens, des jonctions ou des processus agents (relève de T6b).

Point de vigilance : lancer une CLI, même pour afficher son aide, peut déclencher des actions propres à la
CLI (vérification de mise à jour, accès réseau). C'est à relever et à signaler [NT].

### 18.3 Simulation autorisée
Bridge sans Codex ni Claude, avec des réponses préenregistrées et des données de test, dans des dossiers
temporaires, sans projet réel.

### 18.4 NO-GO de l'usage réel
L'usage réel reste interdit tant que l'un de ces points est vrai :
- un arbitrage parmi A1 à A21 n'est pas tranché ;
- les tâches T1 à T8 ne sont pas terminées (avec T3b, T6b, T7a, et T6c si A20) ;
- T6 n'a pas été réalisé sur les versions exactes installées ;
- les canaris de T9 ou la mission jetable n'ont pas réussi ;
- un composant a changé depuis sa vérification ;
- une autorisation distincte manque ;
- une voie du § 12 ou du § 8.6 reste accessible ou non vérifiable ;
- l'indicateur d'abonnement est absent (§ 11.3).
