<!-- Rapport extrait de la session Claude « Orchestrateur IA », 2026-11-16 22:58 UTC -->

# Rapport Phase 0B v2 : réévaluation de l'isolation

Cette mission est restée documentaire. Je n'ai créé aucun fichier, lancé aucune commande locale, rien installé ni rien configuré.

Légende :
- **[DOC]** : documentation officielle lue aujourd'hui.
- **[CONSTATÉ]** : vérifié sur votre machine lors des phases précédentes.
- **[SUPPOSÉ]** : non vérifié.

**Vous avez raison, et ma recommandation précédente était fausse sur un point fondamental.**

**Nouvelle recommandation en une phrase :** commencer par mettre l'hôte à jour, avec l'ESU actif ou Windows 11. Ensuite, faire travailler les agents dans **une machine virtuelle sous VirtualBox ou VMware Workstation**, dépourvue de toute intégration avec l'hôte. Son trafic sort par **une seconde petite machine virtuelle servant de passerelle réseau**. Les échanges de fichiers passent par **SSH, toujours à l'initiative de l'hôte**, avec des commandes imposées.

---

## A. Erreurs et imprécisions du rapport précédent

1. **J'ai présenté WSL2 comme une « frontière d'hyperviseur » à « isolation forte ». C'est faux.** Microsoft écrit [DOC] :
   - WSL « n'est pas un bac à sable de sécurité pour exécuter du code non fiable » ;
   - une distribution « n'est pas une frontière de sécurité » vis-à-vis de l'hôte Windows ni des autres distributions du même utilisateur ;
   - le code qui tourne dans WSL doit être considéré comme ayant **le même niveau de confiance que le compte Windows** qui l'a lancé.
2. **J'ai présenté `automount=false` et `interop=false` comme des protections.** Microsoft précise que ces réglages, comme ceux de `.wslconfig`, « ne transforment pas une distribution en bac à sable ». Il ajoute qu'un réglage qui n'est pas explicitement documenté comme contrôle de sécurité ne doit pas servir de confinement [DOC].
3. **J'ai omis plusieurs propriétés de WSL :**
   - toutes les distributions d'un même utilisateur partagent la même machine virtuelle ;
   - le root Linux contrôle entièrement sa distribution ;
   - l'utilisateur Windows, et donc n'importe quel processus qui tourne sous son compte, a un accès complet aux distributions [DOC, FAQ].
4. **J'ai décrit la collecte par `\\wsl.localhost` comme « en sens unique ».** C'est un partage de fichiers servi depuis la machine virtuelle de WSL, pas une frontière. Des outils Windows liraient des fichiers fabriqués par l'agent.
5. **Le filtrage réseau était placé du côté de l'agent.** Des règles nftables à l'intérieur de la même machine virtuelle que l'agent ne résistent pas à un agent devenu root dans cette machine.
6. **J'ai sous-estimé l'exfiltration vers les domaines autorisés.** Sans inspection TLS, un proxy ne voit que le nom de domaine. Un agent détourné peut donc envoyer des données vers `api.anthropic.com` avec **la clé d'un attaquant** (point I.3).
7. **Je n'ai pas tenu compte de la fin de support de Windows 10.** Recommander une infrastructure d'agents sur un hôte peut-être non corrigé était une faute de méthode.
8. **Je n'ai pas étudié de vraies machines virtuelles**, ni leurs conflits avec la plateforme de virtualisation utilisée par WSL.
9. **Je me suis appuyé sur des sources non officielles pour le sandbox de Codex.** Je l'avais signalé, mais je ne leur accorde plus aucun poids dans la conception.

**Ce que je retiens :**
- **WSL** reste un environnement de développement. Il ne sert plus à protéger quoi que ce soit dans ce projet.
- **bubblewrap** est un confinement *à l'intérieur* de Linux. C'est une couche supplémentaire, pas une frontière.
- **Une véritable machine virtuelle**, sans intégration avec l'hôte, est la frontière principale. Le filtrage réseau se fait *en dehors* de la machine virtuelle de l'agent.

---

## B. Solutions de virtualisation comparées

### 1. VirtualBox 7.x (recommandé par défaut)
- **Compatibilité :** fonctionne sur les versions 64 bits de Windows, y compris l'édition Famille.
- **Licence :** le cœur est libre (GPLv3) [DOC]. Le pack d'extension, sous licence séparée, est **inutile ici**.
- **Snapshots :** possibles, même pendant que la machine tourne, avec retour arrière et branches [DOC]. Les clones liés sont possibles avec `VBoxManage clonevm --options link` [SUPPOSÉ : syntaxe exacte à vérifier].
- **Réseau :** modes NAT, réseau interne, hôte seul (host-only), pont et « non connecté » [SUPPOSÉ pour la liste exacte, car la page lue ne les détaille pas].
- **Intégration avec l'hôte :** dossiers partagés, presse-papiers et glisser-déposer viennent tous des Guest Additions [DOC]. **Il suffit de ne pas installer les Guest Additions** pour supprimer ces trois canaux.
- **Limites :**
  - Oracle conseille de ne pas faire tourner en même temps des machines de plusieurs hyperviseurs, et signale des performances médiocres quand Hyper-V ou la Plateforme de machine virtuelle est actif sur l'hôte [DOC Known Limitations].
  - Des sorties de machine virtuelle ont été démontrées par le passé, notamment via des périphériques virtuels.
- **Automatisation :** `VBoxManage` permet de tout piloter en ligne de commande, en mode sans affichage.

### 2. VMware Workstation Pro 17.x
- **Coût :** gratuit pour tous les usages depuis le 11 novembre 2024, selon Broadcom [DOC, base de connaissances Broadcom]. **Le téléchargement exige un compte Broadcom.**
- **Fonctionnalités :** snapshots et clones liés ; réseaux virtuels personnalisés (host-only, segments LAN) ; pilotage avec `vmrun`.
- **Intégration avec l'hôte :** passe par les VMware Tools. Elle peut se couper par des réglages `isolation.tools.*` dans le fichier `.vmx` [SUPPOSÉ : noms des clés à confirmer].
- **Coexistence avec Hyper-V et WSL2 :** ces dernières années, VMware peut fonctionner au-dessus de la plateforme de virtualisation Windows, au prix d'une baisse de performances [SUPPOSÉ : non confirmé par les sources lues aujourd'hui].
- **Limites :** logiciel propriétaire ; historique de sorties de machine virtuelle démontrées, notamment par le contrôleur USB.

### 3. QEMU (avec l'accélérateur WHPX)
- **Prérequis :** activer la fonctionnalité « Windows Hypervisor Platform ». QEMU ne teste son fonctionnement qu'à partir de Windows 10 version 2004 [DOC].
- **Limites :** plusieurs problèmes connus (interruptions sous Windows 10, accès mémoire SSE/AVX) [DOC]. L'outillage est moins intégré sous Windows et les snapshots se gèrent à la main.
- **Verdict :** solution techniquement crédible, mais **trop coûteuse à maintenir** pour vous. Non recommandée.

### 4. Hyper-V (demande Windows Pro)
- **Disponibilité :** **impossible sur Windows 10 Famille et Windows 11 Famille** [DOC]. Il faut Windows 10 ou 11 Pro ou Entreprise.
- **Matériel :** processeur avec SLAT et au moins 4 Go de mémoire [DOC].
- **Avantages :**
  - hyperviseur de type 1 fourni par Microsoft ;
  - checkpoints ;
  - commutateurs virtuels privés et internes ;
  - très bonne intégration avec PowerShell.
- **Pièges :**
  - le mode de session avancée (RDP) peut partager le presse-papiers et les lecteurs, il faut le désactiver ;
  - les services d'intégration sont à limiter.
- **Coût :** licence de mise à niveau vers Pro (point J).

### 5. Machine physique dédiée
- **Avantage réel :** aucune sortie de machine virtuelle ne peut atteindre votre PC principal. La séparation réseau peut être physique, par exemple un réseau invité.
- **Inconvénients :**
  - coût matériel ;
  - administration d'un second système ;
  - il faut quand même des snapshots ou une réinstallation entre les tâches.
- **Verdict :** pertinent plus tard, si les agents deviennent très autonomes ou tournent longtemps. **Pas nécessaire au départ.**

### Risques communs à toute machine virtuelle
Il faut les fermer explicitement :
- dossiers partagés ;
- presse-papiers ;
- glisser-déposer ;
- USB ;
- son ;
- accélération 3D ;
- ports série et parallèle ;
- bureau à distance (VRDE / RDP) ;
- mode réseau « pont » ;
- outils d'intégration (Guest Additions, VMware Tools, session avancée Hyper-V) ;
- copie de fichiers et exécution de commandes depuis l'hôte (`guestcontrol`).

Chaque périphérique virtuel conservé augmente la surface d'attaque contre l'hyperviseur.

### Tableau comparatif

| Critère | **VirtualBox** | **VMware WS Pro** | QEMU/WHPX | Hyper-V | Machine dédiée | WSL2 (référence) |
|---|---|---|---|---|---|---|
| Windows 10 / 11 Famille | Oui | Oui [SUPPOSÉ pour l'édition] | Oui, si WHP activé [SUPPOSÉ] | **Non** [DOC] | Sans objet | Oui [DOC] |
| Frontière de sécurité | Oui, avec des périphériques réduits | Oui, avec des périphériques réduits | Oui | **La meilleure** (type 1) | **Physique** | **Non** [DOC] |
| Coût | 0 | 0 (compte Broadcom) | 0 | Licence Pro | Matériel | 0 |
| Snapshots / clones liés | Oui / oui | Oui / oui | À la main | Checkpoints | Réinstallation | Export et import |
| Réseau isolable | Réseau interne et host-only | vmnet et segments LAN | Oui (complexe) | Commutateur privé | Réseau dédié | NAT partagé |
| Pilotage par l'orchestrateur | `VBoxManage` | `vmrun` | Ligne de commande | PowerShell | SSH | `wsl.exe` |
| Coexistence avec la plateforme Hyper-V | **Lente si elle est active** [DOC] | Possible, plus lente [SUPPOSÉ] | Exige WHP | Native | — | — |
| Complexité | Moyenne | Moyenne | Élevée | Moyenne | Élevée | Faible |

---

## C. Contraintes de votre machine

- **Windows 10 Famille 22H2, build 19045 [CONSTATÉ].**
  - Le support standard a pris fin le **14 octobre 2025** [DOC].
  - Le programme ESU grand public couvre **jusqu'au 12 octobre 2027** selon la page Microsoft lue aujourd'hui [DOC]. Certaines sources tierces donnent encore le 13 octobre 2026 : je retiens la page officielle actuelle.
  - Inscription : synchronisation des paramètres (gratuite), 1 000 points Microsoft Rewards, ou 30 $ une seule fois.
  - Conditions : compte Microsoft **administrateur**, version 22H2. Les conditions diffèrent dans l'Espace économique européen [DOC].
  - **Votre inscription à l'ESU n'est pas vérifiée.** Si elle est absente, l'hôte ne reçoit plus de correctifs depuis octobre 2025, et **je déconseille toute infrastructure d'agents tant que ce n'est pas réglé.**
- **Windows 11 :**
  - mise à niveau gratuite si le PC est éligible ;
  - exigences : TPM 2.0, UEFI avec Secure Boot, processeur compatible, 4 Go de mémoire, 64 Go de disque [DOC] ;
  - éligibilité à vérifier avec « Contrôle d'intégrité du PC ».
- **Indisponibles sur l'édition Famille :** Hyper-V et Windows Sandbox [DOC].
- **Non vérifiés :**
  - la quantité de mémoire (32 Go annoncés) ;
  - le modèle du processeur et la prise en charge de SLAT ;
  - l'activation de la virtualisation ;
  - l'état de la Plateforme de machine virtuelle (WSL est présent [CONSTATÉ], mais sa configuration est inconnue) ;
  - l'**intégrité de la mémoire (VBS)**, qui active elle aussi l'hyperviseur Windows ;
  - l'espace disque ;
  - le TPM et Secure Boot.
- **Conséquence pour VirtualBox :** si l'hyperviseur Windows est actif, à cause de WSL ou de VBS, VirtualBox fonctionnera en mode dégradé [DOC]. **Je ne recommande pas de désactiver l'intégrité de la mémoire** juste pour gagner en performances.

**Commandes de vérification**, à lancer à l'étape 0B.1. Elles sont en lecture seule et je ne les ai **pas** exécutées :
```powershell
Get-CimInstance Win32_OperatingSystem | Select-Object Caption, Version, BuildNumber
Get-HotFix | Sort-Object InstalledOn -Descending | Select-Object -First 5
Get-CimInstance Win32_Processor | Select-Object Name, NumberOfCores, VirtualizationFirmwareEnabled, SecondLevelAddressTranslationExtensions
Get-CimInstance Win32_ComputerSystem | Select-Object TotalPhysicalMemory
Get-CimInstance -Namespace root\Microsoft\Windows\DeviceGuard -ClassName Win32_DeviceGuard | Select-Object VirtualizationBasedSecurityStatus, SecurityServicesRunning
Get-PSDrive C
wsl --status
```

- **`Get-HotFix`** montre si des mises à jour postérieures à octobre 2025 sont installées.
- **`VirtualizationFirmwareEnabled`** renvoie `False` quand l'hyperviseur Windows tourne déjà : il faut donc le lire avec le résultat de la commande DeviceGuard.
- **À faire vous-même :** consulter l'état de l'ESU dans *Paramètres, puis Windows Update*, et l'éligibilité à Windows 11 dans *Contrôle d'intégrité du PC*.
- **En console administrateur, faites par vous :**
  - `Get-Tpm` ;
  - `Confirm-SecureBootUEFI` ;
  - `Get-WindowsOptionalFeature -Online -FeatureName VirtualMachinePlatform`.

**Faut-il mettre Windows à niveau ?**
- **Un hôte corrigé est *nécessaire*.** L'ESU actif suffit jusqu'au 12 octobre 2027.
- **Windows 11 est *préférable*,** et deviendra nécessaire avant cette date.
- **Windows 11 Pro est *facultatif*.** Il n'est utile que si vous voulez Hyper-V, qui n'est pas indispensable à l'architecture recommandée.

---

## D. Architecture recommandée

**0. Prérequis bloquant :** un hôte Windows à jour (ESU actif avec les dernières mises à jour cumulatives, ou Windows 11).

**1. Orchestrateur sur l'hôte**, de confiance. C'est le code de la Phase 0A, avec seulement deux exécutables fixes : `VBoxManage.exe` (ou `vmrun.exe`) et `ssh.exe`. Il ne transmet jamais de commande issue d'un agent.

**2. Machine virtuelle de passerelle**, petite (Debian minimal, 512 Mo à 1 Go de mémoire) :
- carte 1 en NAT vers Internet ;
- carte 2 sur le réseau interne `orch-int` ;
- carte 3 en host-only, réservée à l'administration et à la récupération des journaux.

Elle fait tourner un proxy (squid ou tinyproxy) avec **une liste blanche distincte par port** : un port pour Codex, un port pour Claude. Elle **journalise** l'heure, le nom de domaine, le port et le volume de chaque connexion. Elle ne transfère rien d'autre : pas de routage, pas de DNS pour le réseau interne.

**3. Machine virtuelle des agents** (Debian stable minimal, 4 à 6 Go, 2 à 4 processeurs virtuels) :
- carte 1 sur `orch-int` uniquement, donc **pas d'accès direct à Internet** ;
- carte 2 en host-only, **réservée au SSH de contrôle**.

Réglages :
- **aucun** Guest Additions ;
- presse-papiers et glisser-déposer désactivés ;
- pas d'USB, de son, de 3D, de VRDE, de dossier partagé, de port série ;
- lecteur optique retiré après l'installation.

Comptes Linux :
- `gate` : reçoit le SSH, avec une commande imposée ;
- `sup` : Codex, sans aucun fichier de projet ;
- `exec` : Claude, limité au dossier de la tâche ;
- `sup` et `exec` n'ont **ni sudo ni setuid**.

**4. Une machine virtuelle par projet,** créée comme clone lié d'une image de base, avec un snapshot « propre ». **Avant chaque tâche, la machine revient à ce snapshot.** Une compromission ne persiste donc pas, et deux projets ne se voient jamais.

**5. Couches à l'intérieur de la machine des agents** (défense en profondeur, pas des frontières) :
- systemd-run et cgroups v2 : mémoire, nombre de processus, délai ;
- `setpriv` avec `no_new_privs` ;
- bubblewrap : `/tmp` privé, seul le dossier de la tâche visible ;
- nftables : `sup` ne joint que son port du proxy, `exec` ne joint que le sien.

**6. Transfert des tâches et des résultats**, toujours à l'initiative de l'hôte :
1. Le pare-feu Windows **bloque tout trafic entrant** depuis l'interface host-only : la machine virtuelle ne peut rien ouvrir vers l'hôte.
2. L'hôte se connecte par `ssh -i <clé dédiée> gate@<ip host-only> <verbe>`. Dans `authorized_keys`, la clé est limitée par `command="/usr/local/sbin/orch-gate",no-pty,no-port-forwarding,no-agent-forwarding,no-X11-forwarding`.
3. `orch-gate` n'accepte que des verbes fixes, avec un identifiant de tâche validé :
   - `put-task <id>` : archive tar reçue sur l'entrée standard ;
   - `run-sup <id>` et `run-exec <id>` : instructions reçues sur l'entrée standard, flux JSON renvoyé sur la sortie standard ;
   - `get-result <id>` : archive tar contenant uniquement les fichiers modifiés et le diff ;
   - `kill <id>` ;
   - `status`.
4. Sur l'hôte, l'archive de résultat est **validée avant d'être extraite** :
   - aucun lien symbolique, lien physique ni fichier spécial ;
   - aucun `..` ni chemin absolu ;
   - aucun nom réservé de Windows, aucun `:`, aucun point ou espace final ;
   - aucun conflit de casse ;
   - limites de taille et de nombre de fichiers.

   Elle est ensuite comparée aux fichiers autorisés, avec calcul des empreintes, comme en 0A. **Rien n'est jamais exécuté.**
5. Les opérations sensibles reçoivent une validation humaine, puis l'orchestrateur applique le résultat sur l'hôte. **Fastclip est exclu tant qu'il n'y a pas d'autorisation distincte.**

**7. Arrêt d'un agent bloqué :**
- `kill <id>` arrête le cgroup de la tâche ;
- s'il ne répond pas : `VBoxManage controlvm <vm> poweroff`, puis retour au snapshot.

**8. Journaux :**
- journal de l'orchestrateur sur l'hôte (comme en 0A) ;
- journaux du proxy récupérés depuis la passerelle ;
- journaux de la tâche récupérés avant le retour au snapshot ;
- tous avec empreinte. Les agents ne peuvent rien écrire sur la passerelle ni sur l'hôte.

**9. Secrets :**
- aucune clé API ;
- les identifiants de Codex et de Claude existent seulement dans la machine des agents, chacun dans le dossier personnel de son compte ;
- **les identifiants de l'hôte (`~/.codex`, `~/.claude`) ne sont jamais copiés** ;
- aucun identifiant Git ni clé SSH dans la machine virtuelle.

### Ce qui est garanti et ce qui ne l'est pas (point 6 de votre demande)

| Mécanisme | État |
|---|---|
| **systemd sous WSL** | La documentation dit que la section `[boot]`, qui active systemd, n'est disponible que sur Windows 11 et Server 2022 [DOC]. C'est en contradiction avec d'autres retours d'utilisateurs, donc **non garanti sur Windows 10**. Ce point n'a plus d'importance : dans une vraie machine Debian, systemd est le système standard [SUPPOSÉ : à vérifier en H]. |
| **bubblewrap dans WSL2** | Pris en charge pour le sandbox de Claude [DOC]. Il exige les espaces de noms utilisateur non privilégiés, actifs par défaut sous Debian [SUPPOSÉ] et restreints par AppArmor sous Ubuntu 24.04 [SUPPOSÉ]. C'est un **confinement, pas une frontière**. |
| **cgroups v2** | Limites de mémoire, de nombre de processus et de délai, plus arrêt groupé avec systemd. C'est un fonctionnement standard de Linux, à prouver par les tests H. |
| **Limites de nftables** | La règle `meta skuid` (filtrage par compte) ne s'applique qu'au trafic émis localement. Un root de la machine invitée peut **effacer toutes les règles**. C'est pourquoi **le filtrage qui fait foi est sur la passerelle**. Les règles nftables de la machine des agents ne servent qu'à séparer `sup` et `exec`. |
| **Séparation réseau par compte** | Elle vaut seulement tant que personne ne devient root dans la machine invitée. Au-delà, les deux comptes partagent la même adresse IP. Les deux listes blanches ne contiennent que des domaines légitimes, donc le risque est accepté et documenté. |
| **Proxy à liste blanche** | Il filtre le nom demandé lors de la connexion (CONNECT) **sans déchiffrer le trafic**. Il ne voit pas le contenu. Le « domain fronting » est possible si un domaine autorisé est servi par un CDN partagé. Il faut donc n'autoriser que des domaines d'API propres aux éditeurs. |
| **Exfiltration vers les domaines autorisés** | **Elle ne peut pas être empêchée sans inspection TLS** (risque I.3). Elle est seulement limitée par ce que l'agent voit, c'est-à-dire le dossier de la tâche. |
| **Collecte par `\\wsl.localhost`** | **Abandonnée.** C'est un partage servi par la machine virtuelle de WSL, pas une frontière, et les fichiers fabriqués par l'agent seraient lus par des outils Windows. Elle est remplacée par une archive récupérée par SSH et validée sur l'hôte. |

---

## E. Schéma d'architecture

```
HÔTE WINDOWS (corrigé : ESU actif ou Windows 11) ─ pare-feu : entrant bloqué depuis l'interface host-only
 └─ Orchestrateur Node (de confiance) ─ exécutables fixes : VBoxManage.exe, ssh.exe
      │  (1) restaure le snapshot « propre » et démarre la VM sans affichage
      │  (2) ssh gate@VM put-task / run-* / get-result / kill   (commande imposée, sans terminal, sans tunnel)
      │  (5) valide l'archive, diff et empreintes ─► validation humaine ─► application
      │
      ├──── host-only (contrôle) ────┐                      ┌──── host-only (journaux) ────┐
      ▼                              │                      ▼                              │
┌─ VM AGENTS du projet P (clone lié) ┴──────┐      ┌─ VM PASSERELLE ──────────────────────┴─┐
│ aucun Guest Additions, presse-papiers,    │      │ proxy : port A ► domaines OpenAI       │
│ USB, son, 3D ni dossier partagé           │      │         port B ► domaines Anthropic    │
│ orch-gate ─► systemd-run (cgroup)         │      │ journal par connexion                  │
│   ├─ setpriv ► bwrap ► [sup]  Codex       │─────►│ aucun autre transfert, aucun DNS       │──► NAT ► Internet
│   └─ setpriv ► bwrap ► [exec] Claude      │ int. │ pour le réseau interne                 │
│      /srv/ws/<tâche> uniquement           │      └────────────────────────────────────────┘
│ nftables : sup ► port A, exec ► port B    │
└───────────────────────────────────────────┘
```

---

## F. Composants nécessaires

**Sur l'hôte :**
- mises à jour Windows : ESU ou Windows 11 ;
- VirtualBox 7.x, sans pack d'extension, installé **sans** la prise en charge USB ni le mode réseau « pont » si l'installeur le permet [SUPPOSÉ] ;
- **ou** VMware Workstation Pro ;
- client OpenSSH de Windows, s'il est présent [SUPPOSÉ] ;
- une règle de pare-feu entrante sur l'interface host-only ;
- l'orchestrateur adapté.

**Images :**
- Debian stable en installation minimale (sans bureau) pour la machine des agents et pour la passerelle ;
- vérification de l'empreinte de chaque image téléchargée.

**Machine virtuelle des agents :**
- openssh-server ;
- systemd ;
- `util-linux` (`setpriv`), bubblewrap, nftables ;
- Node LTS et Claude Code ;
- Codex CLI ;
- unattended-upgrades pour les mises à jour de sécurité.

**Passerelle :**
- squid ou tinyproxy ;
- nftables ;
- openssh-server, accessible uniquement depuis le réseau host-only.

**À écrire :**
- `orch-gate` ;
- les règles nftables ;
- les listes blanches ;
- le validateur d'archive côté hôte ;
- l'adaptateur « VM » de l'orchestrateur.

**Comptes :**
- connexion Codex et connexion Claude faites **par vous** dans l'image de base ;
- **crédits payants désactivés** sur les deux comptes, réglage que vous faites vous-même.

---

## G. Plan d'installation et de configuration

Chaque étape demande votre autorisation et se termine par une vérification.

| Étape | Contenu | Vérification |
|---|---|---|
| **P0** | Mettre l'hôte à jour : vous vous inscrivez à l'ESU ou passez à Windows 11 | Dernière mise à jour cumulative installée ; état de l'ESU affiché dans Windows Update |
| **0B.1** | Lancer les commandes de la section C (lecture seule) | Rapport sur la mémoire, le processeur, SLAT, VBS, la plateforme de virtualisation, le disque |
| **0B.2** | Choisir l'hyperviseur selon 0B.1 : VirtualBox si l'hyperviseur Windows est inactif, sinon comparer avec VMware. Vous l'installez, en vérifiant l'empreinte. | Version installée ; aucun pilote USB ni « pont » si l'installeur permet de les exclure |
| **0B.3** | Créer le réseau interne et le réseau host-only, et la règle de pare-feu entrante sur l'hôte | Depuis une machine de test, l'hôte est injoignable (SMB, RDP, ports locaux) |
| **0B.4** | Construire la passerelle : Debian minimal, proxy, nftables, journaux | Le proxy refuse tout par défaut ; ses journaux sont récupérables par SSH depuis l'hôte |
| **0B.5** | Construire l'image de base des agents, durcir ses périphériques, créer les comptes, installer bubblewrap et nftables | `showvminfo` : aucun dossier partagé, presse-papiers, USB ni son ; `sudo -l` refusé pour `sup` et `exec` |
| **0B.6** | Mettre en place `orch-gate` et la clé SSH à commande imposée | `ssh … bash` refusé ; tunnels `-L` et `-R` refusés ; seuls les verbes fixes répondent |
| **0B.7** | Installer les CLI ; **vous** vous connectez ; relevé des domaines en mode « refus et journalisation » ; construction de la liste blanche | Le journal du proxy ne contient que les domaines attendus ; liste figée |
| **0B.8** | Snapshot « propre » et clone lié pour un projet de test (pas Fastclip) | Fichier piégé déposé, retour au snapshot : le fichier a disparu |
| **0B.9** | Batterie de tests de sécurité H | 100 % réussis, ou écarts documentés |
| **0B.10** | Relancer la simulation 0A en mode VM, avec réponses prédéfinies et sans modèle | 10 auto-tests et 17 scénarios réussis |

À vérifier en 0B.7 et 0B.8 : **le retour au snapshot pourrait annuler le renouvellement des jetons de connexion** et casser la connexion des agents [SUPPOSÉ]. Si c'est le cas, une solution de rechange sera étudiée à ce moment-là, par exemple un petit disque virtuel réservé aux identifiants.

---

## H. Tests de sécurité à réaliser avant tout appel réel

**Périphériques de la machine virtuelle :**
- `VBoxManage showvminfo` ne montre aucun dossier partagé, presse-papiers, glisser-déposer, USB, son, VRDE ni port série ;
- les Guest Additions sont absentes.

**Réseau, depuis la machine des agents :**
- l'hôte est injoignable sur tous ses ports, en dehors des réponses aux connexions SSH qu'il a lui-même ouvertes ;
- le réseau local est injoignable ;
- Internet est inaccessible en direct ;
- DNS, UDP, QUIC et ICMP sont refusés ;
- un domaine hors liste, demandé via le proxy, est refusé et journalisé ;
- `sup` ne peut pas utiliser le port de `exec`, et inversement.

**Passerelle :**
- non administrable depuis le réseau interne ;
- journaux impossibles à modifier depuis la machine des agents.

**Machine des agents :**
- pas de `sudo` ni de setuid ;
- bubblewrap ne laisse voir que le dossier de la tâche ;
- une bombe de processus et un épuisement de mémoire sont stoppés ;
- `kill` ne laisse aucun processus orphelin ;
- l'arrêt brutal de la machine suivi du retour au snapshot fonctionne.

**Transfert :**
- archives piégées refusées sur l'hôte : lien symbolique, lien physique, `../`, chemin absolu, noms réservés de Windows, `:`, nom trop long, conflit de casse, archive énorme, milliers de fichiers ;
- impossible de sortir de la commande imposée ;
- aucun tunnel SSH possible.

**Persistance :**
- un fichier ou un service implanté disparaît après le retour au snapshot.

**Secrets :**
- l'environnement ne contient aucune clé ;
- `exec` ne peut pas lire les identifiants de `sup` ;
- aucun identifiant de l'hôte n'est présent dans la machine virtuelle.

**Injection d'instructions :**
- un fichier piège demandant d'atteindre l'hôte ou un site est bloqué par l'architecture, même si l'agent obéit.

**Dépendances :**
- `npm install` ou un script `postinstall` sont impossibles, car le registre npm n'est pas sur la liste blanche ;
- toute installation de dépendances devient une étape séparée, validée par un humain.

---

## I. Risques résiduels

1. **Sortie de machine virtuelle** par une faille de l'hyperviseur, qui s'est déjà produite pour VirtualBox et VMware. Atténuations : périphériques réduits au minimum et mises à jour rapides.
2. **Hôte Windows 10.** Il n'est couvert que jusqu'au 12 octobre 2027, et seulement si l'ESU est actif. Après cette date, migration obligatoire.
3. **Exfiltration vers les domaines autorisés,** y compris avec la clé API d'un attaquant. On ne peut l'éliminer qu'avec une inspection TLS, ce qui serait complexe.
4. **Jetons des agents lisibles par l'agent lui-même** : vol possible, puis révocation par vous.
5. **Code de l'hôte qui traite des données non fiables** : validateur d'archive, analyseur JSON. Ce code doit rester minimal et être testé.
6. **Chaîne d'approvisionnement** de l'image de base (paquets npm des CLI, dépôts apt).
7. **Injection d'instructions** : contenue par l'architecture, mais pas éliminée.
8. **Erreur de configuration humaine** : corrigée par la batterie H, à relancer à chaque modification.

---

## J. Coûts, ressources et complexité

**Coûts :**

| Élément | Coût |
|---|---|
| VirtualBox ou VMware | 0 € |
| ESU | 0 € (synchronisation des paramètres), 1 000 points Rewards, ou 30 $ [DOC] |
| Windows 11 | Gratuit si le PC est éligible |
| Windows 11 Pro | Prix à vérifier dans le Microsoft Store [SUPPOSÉ : de l'ordre de 100 à 150 €], facultatif |
| Machine dédiée | 200 à 500 € [estimation], pas nécessaire maintenant |

**Ressources pendant une tâche :**
- machine des agents : 4 à 6 Go de mémoire, 2 à 4 processeurs virtuels ;
- passerelle : 0,5 à 1 Go ;
- disque : 40 à 60 Go pour les images, les clones et les snapshots.

**Complexité : moyenne à élevée**, environ 2 fois celle de la proposition WSL. Il y a deux machines virtuelles, une passerelle SSH et un validateur à écrire.

**Temps estimé : 5 à 8 séances, soit environ 20 à 35 heures** [estimation] :
- P0 : de 1 heure à une demi-journée si vous passez à Windows 11 ;
- hyperviseur et réseaux : 2 à 3 h ;
- passerelle : 3 à 4 h ;
- image de base : 3 à 4 h ;
- `orch-gate` et SSH : 3 à 4 h ;
- adaptation de l'orchestrateur : 1 à 2 jours ;
- tests H : environ 1 jour.

**Maintenance :**
- mises à jour mensuelles de l'hôte, de l'hyperviseur et des deux machines Debian ;
- reconstruction de l'image de base après chaque mise à jour des CLI ;
- nouvelle batterie de tests H à chaque modification.

---

## K. Critères de validation de la Phase 0B

Chaque critère doit être prouvé par une exécution.

1. **L'hôte est corrigé :** ESU actif ou Windows 11, avec la dernière mise à jour cumulative installée.
2. **WSL n'est utilisé pour aucun agent.**
3. **La machine des agents n'a aucun canal d'intégration avec l'hôte** (prouvé par `showvminfo` et par les tests H).
4. **Réseau :**
   - l'hôte et le réseau local sont injoignables depuis la machine des agents ;
   - tout trafic sortant passe par la passerelle ;
   - 100 % des tentatives hors liste blanche sont refusées et journalisées.
5. **Transfert :**
   - seulement des connexions SSH ouvertes par l'hôte, avec commande imposée ;
   - aucune connexion ouverte depuis la machine virtuelle vers l'hôte ;
   - 100 % des archives piégées refusées.
6. **Non-persistance :** le retour au snapshot efface toute modification.
7. `sup` et `exec` n'ont ni sudo ni setuid. bubblewrap et les cgroups fonctionnent, sans processus orphelin.
8. Aucun secret de l'hôte n'est présent dans la machine virtuelle, et l'environnement de l'agent ne contient aucune clé API.
9. Les journaux de l'orchestrateur et du proxy ont une empreinte, et les agents ne peuvent pas les modifier.
10. La simulation 0A rejouée en mode VM réussit : 10 auto-tests et 17 scénarios.
11. Aucun accès à Fastclip.
12. Vous avez confirmé que les crédits payants sont désactivés.

---

## Sources

- [WSL : documentation de sécurité (« not a security boundary »)](https://github.com/microsoft/WSL/blob/master/doc/docs/technical-documentation/security.md)
- [WSL : FAQ (WSL2 sur l'édition Famille, coexistence avec VirtualBox et VMware, différences avec une VM)](https://learn.microsoft.com/en-us/windows/wsl/faq)
- [WSL : configuration avancée (section `[boot]` et options réservées à Windows 11)](https://learn.microsoft.com/en-us/windows/wsl/wsl-config)
- [Fin du support de Windows 10 (Microsoft, en français)](https://support.microsoft.com/fr-fr/windows/deployment/updates-lifecycle/windows-10-support-has-ended-on-october-14-2025)
- [Programme ESU grand public (dates, options, conditions)](https://www.microsoft.com/en-us/windows/extended-security-updates)
- [ESU : compte Microsoft requis dans l'Espace économique européen (Windows Latest)](https://www.windowslatest.com/2025/09/26/no-youll-still-need-a-microsoft-account-for-windows-10-esu-in-europe)
- [Configuration requise de Windows 11](https://www.microsoft.com/en-us/windows/windows-11-specifications)
- [Hyper-V : prérequis, édition Famille exclue](https://learn.microsoft.com/en-us/virtualization/hyper-v-on-windows/quick-start/enable-hyper-v)
- [Windows Sandbox : édition Famille non prise en charge](https://learn.microsoft.com/en-us/windows/security/application-security/application-isolation/windows-sandbox/)
- [VirtualBox : manuel, introduction](https://www.virtualbox.org/manual/topics/Introduction.html)
- [VirtualBox 7.0 : limitations connues avec Hyper-V](https://docs.oracle.com/en/virtualization/virtualbox/7.0/user/KnownIssues.html)
- [VMware Workstation Pro gratuit pour tous les usages (Broadcom)](https://knowledge.broadcom.com/external/article/368667/vmware-desktop-hypervisor.html)
- [VMware Workstation 17.x : FAQ licences et compatibilité (Broadcom)](https://knowledge.broadcom.com/external/article/315616/vmware-workstation-17x-pro-sales-licensi.html)
- [QEMU : accélérateur WHPX](https://www.qemu.org/docs/master/system/whpx.html)
- [Claude Code : sandbox](https://code.claude.com/docs/en/sandboxing)

Je m'arrête ici. Je ne commence aucune étape, pas même P0 ni 0B.1, sans votre nouvelle autorisation explicite. P0 dépend de vous : l'inscription à l'ESU ou le passage à Windows 11 ne sont pas des actions que je ferai à votre place.
