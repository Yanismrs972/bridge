<!-- Rapport extrait de la session Claude « Orchestrateur IA », 2026-11-16 22:49 UTC -->

# Rapport Phase 0B : étude et conception de l'isolation (aucune exécution)

**Je n'ai rien créé, rien installé et lancé aucune commande locale.** Pour ce rapport, je me suis limité à lire de la documentation publique.

Légende :
- **[DOC]** : documentation officielle consultée aujourd'hui.
- **[CONSTATÉ]** : vérifié sur votre machine lors des phases précédentes.
- **[SUPPOSÉ]** : non vérifié, à tester.

**Recommandation en une phrase :** faire travailler les agents dans **WSL2, avec une distribution Linux dédiée et durcie**, sans accès aux disques Windows ni aux programmes Windows. À l'intérieur, chaque agent a son propre compte Linux sans droits d'administration, est enfermé par bubblewrap dans le dossier de sa tâche, est limité en ressources, et ne sort sur le réseau que par un proxy qui n'accepte qu'une liste de domaines. L'orchestrateur reste du côté Windows et ne passe que des commandes fixes.

---

## A. État réel de la machine

**Éléments vérifiés lors des phases précédentes [CONSTATÉ] :**
- Windows 10 Famille 22H2, build 19045, avec PowerShell 5.1 ;
- Node 22.23.4 ;
- WSL présent, sans aucune distribution ;
- Docker absent ;
- Codex CLI 0.169.0-alpha.11.1 et Claude Code 2.1.325 installés côté Windows ;
- sandbox Windows de Codex désactivé ;
- `TEMP` pointe vers `%LOCALAPPDATA%\Temp`.

**Éléments non vérifiés :**
- les 32 Go de RAM ;
- l'activation de la virtualisation dans le BIOS ;
- la présence de la fonctionnalité « Plateforme de machine virtuelle » ;
- la version de WSL (version inbox ou version Microsoft Store) ;
- l'espace disque libre.

**Commandes de vérification à lancer à l'étape 0B.1.** Elles sont en lecture seule et je ne les ai pas exécutées :
```powershell
Get-CimInstance Win32_OperatingSystem | Select-Object Caption, Version, BuildNumber, TotalVisibleMemorySize
(Get-CimInstance Win32_Processor).VirtualizationFirmwareEnabled
Get-PSDrive C | Select-Object Used, Free
wsl --status
wsl --version
wsl -l -v
Get-Command docker -ErrorAction SilentlyContinue
```

Deux autres vérifications demandent une console administrateur. Je les mentionne seulement, elles ne sont pas nécessaires :
```powershell
Get-WindowsOptionalFeature -Online -FeatureName VirtualMachinePlatform
Get-WindowsOptionalFeature -Online -FeatureName Containers-DisposableClientVM
```
La seconde devrait montrer que Windows Sandbox est absent sur l'édition Famille.

---

## B. Comparaison des solutions

### 1. Compte Windows standard dédié
- **Fonctionnement.** Les agents tournent sous un autre compte Windows, sans droits d'administration. Les autorisations NTFS protègent votre profil `C:\Users\<vous>`.
- **Isolation réelle : faible à moyenne.**
  - Le compte peut toujours lire tout ce qui est ouvert au groupe « Utilisateurs » : `C:\` et les dossiers créés à sa racine, `Program Files`, certains dossiers `ProgramData`, et les disques secondaires selon leurs autorisations.
  - Il n'existe pas de filtrage réseau simple par utilisateur dans le pare-feu Windows standard [SUPPOSÉ : la condition « utilisateur local » dépend de l'authentification IPsec].
- **Compatibilité.**
  - Sous Windows natif, Claude Code exécute ses commandes **sans sandbox** [DOC].
  - Le sandbox Windows de Codex est désactivé sur votre machine [CONSTATÉ].
  - Chaque CLI doit être installée et connectée une seconde fois dans ce compte.
- **Coût :** nul. **Ressources :** négligeables.
- **Complexité :** moyenne. Il faut auditer les autorisations de tout le disque, et une erreur d'autorisation passe inaperçue.
- **Contournement :** élévation de privilèges locale, dossiers mal protégés, tâches planifiées.
- **Verdict :** insuffisant seul. Utile seulement en complément.

### 2. WSL2 avec une distribution dédiée (recommandé)
- **Fonctionnement.** Une machine virtuelle légère, sous Hyper-V, exécute un noyau Linux. Windows 10 Famille la permet grâce à la « Plateforme de machine virtuelle ». La distribution se configure par `/etc/wsl.conf` [DOC] :
  - `[automount] enabled=false` : les disques Windows ne sont plus montés sous `/mnt`. Le montage manuel reste possible, mais seulement pour le compte root.
  - `mountFsTab=false` : aucun montage déclaré dans `/etc/fstab`.
  - `[interop] enabled=false` et `appendWindowsPath=false` : il devient impossible de lancer `cmd.exe` ou d'autres programmes Windows, et aucun chemin Windows n'est ajouté au `PATH`.
- **Isolation réelle : forte**, si la configuration est faite correctement :
  - frontière d'hyperviseur avec Windows ;
  - comptes Linux séparés ;
  - bubblewrap (espaces de noms Linux) pour limiter les fichiers visibles ;
  - nftables pour filtrer le réseau ;
  - cgroups v2 pour limiter les ressources.
- **Limites sous Windows 10 [DOC] :**
  - Le réseau en mode « miroir », le pare-feu Hyper-V pour WSL, `dnsTunneling` et `autoProxy` sont réservés à **Windows 11 22H2 ou plus récent**. Vous restez donc en mode **NAT** : la machine virtuelle peut joindre Windows par l'adresse de la passerelle, ainsi que votre réseau local. **Il faudra donc filtrer à l'intérieur de la machine virtuelle.**
  - La documentation indique que la section `[boot]`, qui contient l'option systemd, n'est disponible que sur Windows 11. C'est à vérifier sur votre WSL [SUPPOSÉ], et un plan sans systemd est prévu.
  - Toutes les distributions WSL2 partagent la même machine virtuelle et le même noyau. Il ne faudra donc **aucune autre distribution** que celle des agents.
  - Le fichier `wsl.conf` se trouve **dans** la distribution : il ne protège rien si un agent devient root.
- **Compatibilité.**
  - Claude Code : le sandbox bubblewrap est pris en charge sur WSL2, pas sur WSL1 [DOC]. Il demande les paquets `bubblewrap` et `socat`.
  - Codex : il utilise bubblewrap sous Linux et WSL2, pas sous WSL1 (source non officielle concordante). Un bogue signalé sur `workspace-write` dans WSL2 est à vérifier avec votre version [SUPPOSÉ].
  - Pour le superviseur, le mode `read-only` suffit.
- **Coût :** nul. **Ressources :** mémoire plafonnable dans `.wslconfig` (`memory`, `processors`, `swap`, `defaultVhdSize`) ; disque de 5 à 15 Go.
- **Complexité :** moyenne. Installation unique, puis mises à jour avec `apt`.
- **Contournement :** une faille du noyau Linux, puis l'hyperviseur, ce qui est peu probable. Le risque principal est une **erreur de configuration** : un agent devenu root, l'interopérabilité réactivée, ou un montage de disque Windows.

### 3. Docker
- **Docker Desktop.** Sa page d'installation cite comme minimum Windows 10 Pro, Entreprise ou Éducation 22H2 avec le moteur WSL2. Elle se contredit cependant sur l'édition Famille [DOC]. Il est gratuit pour un usage personnel ou une petite entreprise [DOC].
- **Isolation des conteneurs : bonne.** Elle s'obtient avec `--cap-drop ALL`, `--read-only`, `--network none`, un compte non-root, et en ne montant que le dossier de travail. **Il ne faut jamais monter `docker.sock`**, sinon le conteneur obtient l'équivalent d'un accès root.
- **Inconvénients :**
  - une couche supplémentaire, avec son démon root et 2 à 4 Go de mémoire ;
  - des mises à jour supplémentaires ;
  - une installation non garantie sur l'édition Famille.
- **Variante plus sûre.** Podman en mode sans root, installé **dans** la distribution WSL2, sans Docker Desktop.
- **Verdict :** non nécessaire au départ. Bubblewrap apporte la même séparation des fichiers, du réseau et des processus, avec moins de pièces. C'est une option pour plus tard, si des projets demandent des outils de compilation lourds.

### 4. Windows Sandbox
- **Non disponible.** La documentation de Microsoft l'indique clairement : il n'est « actuellement pas pris en charge sur l'édition Famille » [DOC]. Il est réservé aux éditions Pro, Entreprise et Éducation.
- **De plus**, même sur une autre édition :
  - le réseau y est activé par défaut ;
  - une seule instance peut tourner à la fois ;
  - tout son contenu est supprimé à la fermeture.

  Ce n'est donc pas adapté à des connexions persistantes aux agents.
- **Verdict :** exclu.

### 5. Combinaison
- **WSL2 durci, avec des comptes Linux séparés, bubblewrap, nftables et des cgroups.** C'est la recommandation.
- **Couche facultative :** faire tourner WSL sous un compte Windows standard dédié. En cas de sortie de la machine virtuelle, l'agent arriverait alors dans un compte sans accès à votre profil. Les distributions WSL sont propres à chaque compte Windows, donc il faudrait les installer et les connecter une seconde fois. Lancer WSL depuis un autre compte avec `runas` n'est pas toujours fiable [SUPPOSÉ]. **Je propose de l'évaluer plus tard, sans en faire un prérequis.**

---

## C. Tableau comparatif

| Critère | Compte Windows dédié | **WSL2 durci** | Docker Desktop | Windows Sandbox |
|---|---|---|---|---|
| Disponible sur Windows 10 Famille | Oui | **Oui** [DOC] | Incertain [DOC contradictoire] | **Non** [DOC] |
| Isolation des fichiers | Partielle (autorisations NTFS) | **Forte** (pas de montage Windows, comptes séparés, bubblewrap) | Forte | Forte |
| Isolation des processus | Faible | **Forte** (machine virtuelle, cgroups) | Forte | Forte |
| Contrôle du réseau | Difficile par utilisateur | **nftables par compte, plus un proxy à liste blanche** | Réseaux Docker plus proxy | Réseau coupé ou ouvert, sans nuance |
| Sandbox de Claude Code | **Absent** [DOC] | **Pris en charge** [DOC] | Possible (configuration devcontainer) | — |
| Sandbox de Codex | Désactivé [CONSTATÉ] | **bubblewrap** (à vérifier) | — | — |
| Coût | 0 | 0 | 0 en usage personnel | — |
| Mémoire | Négligeable | 2 à 8 Go, plafonnable | +2 à 4 Go | — |
| Complexité | Moyenne | **Moyenne** | Élevée | — |
| Principal risque | Autorisations NTFS trop larges | Erreur de configuration, agent devenu root | `docker.sock`, démon root | — |

---

## D. Architecture recommandée

1. **L'orchestrateur reste sur Windows.** C'est le code de la Phase 0A, considéré comme de confiance. Il lance uniquement `wsl.exe` avec des arguments fixes, et vide `WSLENV` pour qu'aucune variable d'environnement Windows ne passe dans Linux.
2. **Une distribution dédiée**, par exemple `orch-agents` sous Debian ou Ubuntu :
   - `wsl.conf` durci : pas de montage automatique, pas de `fstab`, pas d'interopérabilité, pas de chemins Windows dans le `PATH` ;
   - **pas de `sudo`** pour les comptes de travail. L'administration se fait uniquement depuis Windows avec `wsl -d orch-agents -u root`.
3. **Comptes Linux séparés.**

   | Compte | Rôle | Accès |
   |---|---|---|
   | `orch` | Journaux et résultats | Propriétaire de `/srv/orch` ; aucun agent ne peut y écrire |
   | `sup` | Codex | Dossier vide ; réseau limité aux domaines OpenAI ; son propre `auth.json` |
   | `exec` | Claude Code | Lecture et écriture **uniquement** dans `/srv/ws/<projet>/<tâche>` ; réseau limité aux domaines Anthropic ; ses propres identifiants |

4. **Lanceur root fixe**, par exemple `/usr/local/sbin/orch-run`, propriété de root et en lecture seule pour les autres comptes. Il est appelé par `wsl -u root -- /usr/local/sbin/orch-run <rôle> <id-tâche>` et, dans l'ordre :
   1. vérifie l'identifiant de la tâche (format strict), sans jamais utiliser de chemin fourni par un agent ;
   2. crée un cgroup avec des limites de mémoire, de processeur, de nombre de processus et de durée ;
   3. abandonne les privilèges root pour ceux du compte de l'agent, avec `setpriv` et `no_new_privs` ;
   4. lance l'agent **dans bubblewrap**. Seuls sont visibles : le système en lecture seule, le dossier de la tâche en lecture et écriture, le dossier personnel de l'agent, et un `/tmp` privé. `/srv` (hors tâche), `/home` (hors agent) et `/root` ne sont pas visibles.
5. **Réseau.**
   - Les règles nftables appartiennent à root et filtrent par compte (`meta skuid`). Les comptes `sup` et `exec` ne peuvent joindre **que** le proxy local.
   - Les plages privées (192.168.0.0/16, 10.0.0.0/8, 172.16.0.0/12, 169.254.0.0/16), la passerelle Windows et le DNS direct sont bloqués.
   - Un proxy local (tinyproxy ou squid) applique une liste de domaines par compte et **journalise toutes les requêtes**. Les domaines exacts seront relevés pendant les tests ; aucun n'est présumé [SUPPOSÉ].
6. **Outils de Claude.**
   - Comme en 0A, seuls `Read`, `Edit`, `Write`, `Glob` et `Grep` sont autorisés, sans Bash ni PowerShell.
   - Le sandbox interne de Claude ne couvre que les commandes shell, pas `Read` ni `Edit` [DOC]. **La vraie limite de fichiers est donc bubblewrap à l'extérieur**, pas les réglages de Claude.
   - Si Bash est autorisé plus tard : sandbox interne activé avec `failIfUnavailable:true` et `allowUnsandboxedCommands:false` [DOC], et aucune entrée dans `excludedCommands`.
7. **Récupération des résultats.** L'orchestrateur ne donne jamais à un agent l'accès à Windows. C'est lui qui lit le dossier de la tâche depuis Windows, en sens unique, par `\\wsl.localhost\orch-agents\srv\ws\...`. Il calcule le diff et les empreintes, puis vérifie le résultat comme en 0A.
8. **Arrêt d'un agent bloqué.** Délai dépassé, puis arrêt du cgroup entier (`cgroup.kill`). En dernier recours : `wsl --terminate orch-agents`.
9. **Projets.** Un projet est **copié** vers `/srv/ws/<projet>` par une action humaine validée, jamais monté depuis Windows. Fastclip n'est pas concerné tant qu'il n'y a pas d'autorisation distincte.

---

## E. Schéma de fonctionnement

```
WINDOWS (hôte de confiance)
 ├─ Utilisateur ──► Orchestrateur Node (0A) ── journaux et validations humaines
 │                     │  wsl.exe -d orch-agents -u root -- orch-run <rôle> <tâche>
 │                     │  (arguments fixes, instructions par l'entrée standard, WSLENV vide)
 │                     ▼
 │   ┌──────────── VM WSL2 (frontière Hyper-V) ── distribution « orch-agents » ────────────┐
 │   │ wsl.conf : automount=false, mountFsTab=false, interop=false, appendWindowsPath=false│
 │   │ orch-run (root) ─► cgroup (mémoire, CPU, nb de processus, délai)                    │
 │   │      ├─► setpriv ─► bwrap ─► [compte sup]  Codex, dossier vide, aucun projet visible│
 │   │      └─► setpriv ─► bwrap ─► [compte exec] Claude, accès à /srv/ws/<p>/<t> seulement│
 │   │ nftables (root) : sup et exec ─► proxy local uniquement ; LAN et hôte bloqués       │
 │   │ proxy (liste blanche par compte, journal) ─► domaines OpenAI / Anthropic            │
 │   └───────────────────────────────────────────────────────────────────────────────────────┘
 │                     ▲
 └─ L'orchestrateur lit les résultats en sens unique (\\wsl.localhost\...), puis diff et vérification
```

---

## F. Composants nécessaires

**Côté Windows :**
- fonctionnalité WSL ou « Plateforme de machine virtuelle », avec redémarrage ;
- WSL à jour (version Microsoft Store) ;
- fichier `%UserProfile%\.wslconfig` (mémoire, processeurs, swap, taille du disque).

**Dans la distribution :**
- `bubblewrap`, `socat` (pour le sandbox de Claude), `nftables`, et `tinyproxy` ou `squid` ;
- Node LTS pour Claude Code, le binaire Codex CLI, `util-linux` (`setpriv`) ;
- systemd **ou** cgroup v2 géré à la main.

**À écrire :**
- `orch-run` ;
- les règles nftables ;
- la configuration du proxy ;
- l'adaptation de l'orchestrateur (une nouvelle cible d'exécution, « WSL »).

**Comptes :**
- `orch`, `sup` et `exec` ;
- une connexion Codex (`sup`) et une connexion Claude (`exec`), faites par vous, avec un abonnement et **sans clé API** ;
- **crédits d'usage payants désactivés** sur les deux comptes, réglage que vous faites vous-même.

---

## G. Plan de mise en œuvre

Chaque étape demande votre autorisation et se termine par une vérification.

| Étape | Contenu | Vérification |
|---|---|---|
| **0B.1** | Lancer les commandes de vérification de la section A (lecture seule) | Virtualisation activée, mémoire, espace disque, version de WSL |
| **0B.2** | Installer WSL et la distribution `orch-agents` (droits administrateur et redémarrage, **faits par vous**) | `wsl -l -v` montre une seule distribution, en version 2 |
| **0B.3** | Durcir `wsl.conf` et `.wslconfig`, puis `wsl --terminate` | `/mnt/c` absent ; `cmd.exe` impossible à lancer ; `PATH` sans chemin Windows |
| **0B.4** | Créer les comptes `orch`, `sup` et `exec`, sans `sudo`, et retirer `sudo` du compte par défaut | `sudo -l` refusé pour chaque compte ; aucun accès croisé aux dossiers personnels |
| **0B.5** | Mettre en place nftables et le proxy, en mode « tout refuser et journaliser » | `curl` direct refusé ; passerelle et réseau local injoignables ; seul le proxy répond |
| **0B.6** | Installer `orch-run`, bubblewrap et les cgroups | Seul le dossier de la tâche est visible ; une bombe de processus est stoppée ; l'arrêt sur délai fonctionne |
| **0B.7** | Installer les CLI et les connecter (par vous), **sans appel de travail** | `--version` uniquement ; identifiants présents dans le dossier personnel du bon compte |
| **0B.8** | Établir la liste blanche : `--version` puis un canari minimal, sur autorisation explicite | Le journal du proxy ne montre que les domaines attendus |
| **0B.9** | Lancer la batterie de tests de sécurité (section H) | 100 % réussis, ou chaque écart documenté |
| **0B.10** | Relancer la simulation 0A en mode WSL, avec des réponses prédéfinies et sans modèle | 10 auto-tests et 17 scénarios réussis |

La Phase 0A.2, c'est-à-dire les vrais appels aux agents, n'est **pas** incluse : elle demandera une autorisation distincte.

---

## H. Tests de sécurité à réaliser avant tout appel réel

**Fichiers :**
- lecture de `/mnt/c`, de `\\wsl$`, ou d'un montage `drvfs` ou `9p` tenté depuis bubblewrap → doit échouer. Un montage dans un espace de noms utilisateur doit être refusé [SUPPOSÉ] ;
- accès à `/home/sup`, `/srv/orch` ou `/root` depuis `exec` → refusé ;
- lien symbolique dans le dossier de la tâche pointant vers `/`, vers `/srv/orch` ou vers le dossier personnel de l'autre agent → bubblewrap ne doit rien laisser voir hors du dossier, et l'orchestrateur refuse les liens au moment de la collecte ;
- liens physiques vers des fichiers hors de la tâche → impossibles, car ils sont sur d'autres montages ;
- traversée de chemin (`../`, chemins absolus, noms Windows réservés) dans les fichiers produits → refusée à la collecte ;
- jonctions NTFS → hors sujet dans ext4, mais refusées à la collecte côté Windows.

**Processus :**
- lancement de `cmd.exe`, `powershell.exe`, `wsl.exe`, ou d'un fichier Windows recopié → doit échouer ;
- `sudo`, `su`, programmes setuid → refusés, grâce à `no_new_privs` et à l'absence de `sudoers` ;
- bombe de processus, consommation de mémoire, boucle infinie → bloquées par le cgroup puis arrêtées ;
- processus orphelins → aucun ne doit rester après `cgroup.kill`.

**Réseau :**
- connexion directe vers Internet, vers la passerelle Windows, vers le réseau local, vers 169.254.169.254 ;
- DNS direct, UDP, ICMP ;
- domaine hors de la liste blanche passant par le proxy ;
- **Tous doivent être refusés et journalisés.**

**Permissions :**
- modification de `wsl.conf`, de nftables, de la configuration du proxy, de `orch-run` ou du réglage `.claude/settings.json` hors de la tâche → refusée ;
- l'agent ne peut pas élargir ses propres droits.

**Secrets :**
- `exec` ne peut pas lire `auth.json` de `sup`, et inversement ;
- aucune clé API dans l'environnement : affichage de `env` dans bubblewrap et `WSLENV` vide ;
- aucun identifiant Git ni clé SSH dans la distribution.

**Injection d'instructions :**
- fichier piège dans le dossier de la tâche demandant de lire `/srv/orch` ou d'aller sur un site → le système doit le bloquer même si l'agent obéit.

**Dépendances et scripts :**
- `npm install` ou un script `postinstall` → impossible par défaut (registre non autorisé, Bash désactivé) ;
- toute installation de dépendances devient une étape séparée, validée par un humain.

**Journaux :**
- les agents ne peuvent pas écrire dans `/srv/orch` ;
- l'orchestrateur Windows recopie et calcule l'empreinte des journaux à la fin de chaque tâche.

---

## I. Risques résiduels

1. **Les identifiants de chaque agent lui restent lisibles.** Une CLI a besoin de son propre jeton, donc un agent détourné peut le lire. Atténuations : abonnement sans crédits payants, réseau limité, possibilité de révoquer le jeton.
2. **Faille du noyau Linux ou de l'hyperviseur.** Peu probable mais non nulle. Les espaces de noms utilisateur nécessaires à bubblewrap élargissent la surface d'attaque du noyau.
3. **Fuite de données vers les domaines autorisés.** Le proxy ne déchiffre pas le trafic HTTPS : un agent peut envoyer des données à `api.anthropic.com` ou aux domaines OpenAI. Par construction, il ne doit donc voir que le dossier de sa tâche.
4. **Windows 10 sans réseau WSL en mode miroir ni pare-feu Hyper-V.** Le filtrage repose entièrement sur les règles nftables gérées par root dans la machine virtuelle.
5. **L'hôte Windows reste le maillon de confiance.** Un programme qui tourne sous votre compte Windows peut modifier la distribution, et la commande `wsl -u root` est accessible depuis votre compte.
6. **Écarts de version des CLI.** Exemple : le bogue signalé sur le sandbox de Codex en `workspace-write` dans WSL2. Il faudra refaire les tests à chaque mise à jour.
7. **Injection d'instructions.** Elle ne peut pas être éliminée, seulement contenue par l'isolation et les validations humaines.

---

## J. Complexité et ressources

- **Complexité : moyenne.** Environ 10 petites étapes, chacune vérifiable.
- **Temps estimé : 3 à 5 séances de travail**, soit environ 12 à 20 heures [estimation] :
  - installation et redémarrage : environ 1 h ;
  - durcissement et comptes : 2 à 3 h ;
  - réseau et proxy : 3 à 4 h ;
  - `orch-run`, bubblewrap et cgroups : 3 à 4 h ;
  - adaptation de l'orchestrateur : environ 1 journée ;
  - tests de sécurité : une demi-journée à une journée.
- **Ressources :**
  - machine virtuelle plafonnée à 6 à 8 Go de mémoire et 4 processeurs, ce qui est raisonnable si vous avez bien 32 Go (à vérifier) ;
  - 5 à 15 Go de disque ;
  - coût : 0 €.
- **Maintenance :** mises à jour mensuelles avec `apt` et des CLI, puis nouvelle batterie de tests H après chaque mise à jour.

---

## K. Critères de validation de la Phase 0B

La Phase 0B sera validée seulement si toutes ces conditions sont réunies, preuves d'exécution à l'appui :
1. Une seule distribution WSL2 existe, avec un `wsl.conf` durci et vérifié : pas de `/mnt/c`, pas de programme Windows lançable, pas de chemin Windows dans le `PATH`.
2. Les comptes `sup` et `exec` n'ont ni `sudo` ni setuid, et ne peuvent pas lire les fichiers l'un de l'autre.
3. bubblewrap ne laisse voir que le dossier de la tâche, et 100 % des tests de fichiers de la section H réussissent.
4. Réseau : 100 % des connexions hors liste blanche sont refusées et journalisées. Le réseau local et l'hôte Windows sont injoignables.
5. Les limites de cgroup et l'arrêt d'un agent fonctionnent, sans aucun processus orphelin.
6. Aucun secret ne se trouve hors du dossier personnel de son agent. Aucune clé API, aucun identifiant Git, aucune clé SSH.
7. Les agents ne peuvent ni modifier ni supprimer les journaux, dont l'empreinte est vérifiée côté Windows.
8. La simulation 0A rejouée en mode WSL réussit : 10 auto-tests et 17 scénarios.
9. Aucun accès à Fastclip ni à aucun autre projet, ce que confirme la liste de ce qui est visible dans bubblewrap.
10. Vous avez désactivé les crédits payants des deux comptes et vous l'avez confirmé.

---

## Sources

- [Claude Code : sandbox (plateformes, couverture, réseau, échappatoires)](https://code.claude.com/docs/en/sandboxing)
- [WSL : configuration avancée (wsl.conf et .wslconfig, limitations de Windows 10)](https://learn.microsoft.com/en-us/windows/wsl/wsl-config)
- [Windows Sandbox : éditions prises en charge, Famille non prise en charge](https://learn.microsoft.com/en-us/windows/security/application-security/application-isolation/windows-sandbox/)
- [Windows Sandbox : prérequis](https://learn.microsoft.com/en-us/windows/security/application-security/application-isolation/windows-sandbox/windows-sandbox-install)
- [Docker Desktop : configuration requise et licence](https://docs.docker.com/desktop/setup/install/windows-install/)
- [Codex : concepts de sandbox (documentation officielle)](https://developers.openai.com/codex/concepts/sandboxing)
- [Codex : fonctionnement du sandbox selon la plateforme (source non officielle)](https://codex.danielvaughan.com/2026/04/08/codex-sandbox-platform-implementation/)
- [Codex : bogue signalé sur workspace-write dans WSL2 avec bubblewrap](https://gh.hhj520.top/openai/codex/issues/14875)

Les détails sur Codex viennent en partie de sources non officielles. Il faudra les confirmer avec la version installée lors des étapes 0B.7 et 0B.8.

Je ne commence pas la Phase 0B opérationnelle : j'attends votre autorisation explicite. Si vous voulez ce rapport en fichier texte pour ChatGPT, il me faut aussi votre accord pour créer ce fichier, puisque cette mission l'interdisait.
