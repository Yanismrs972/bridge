<!-- Rapport extrait de la session Claude « Orchestrateur IA », 2026-11-16 23:14 UTC -->

# Rapport Phase 0B v3 : architecture par machine virtuelle, revue et approfondie

Cette mission est restée documentaire : je n'ai lancé aucune commande locale, rien installé, créé aucun fichier, démarré aucune machine virtuelle et contacté aucun agent.

Légende :
- **[DOC]** : documentation officielle lue.
- **[SUPPOSÉ]** : hypothèse non vérifiée.
- **[TEST]** : sera prouvé par un test de la section H (aucun n'a été exécuté).

**Verdict en bref : l'architecture est faisable, à quatre conditions.**
1. L'hôte doit être à jour.
2. Les performances de VirtualBox doivent être acceptables si VBS est actif.
3. Le pare-feu Windows doit se comporter comme prévu, ce que le test T-NET-03 vérifiera.
4. Les jetons OAuth doivent rester valides avec la stratégie de persistance de la section 3.

Un risque ne peut pas être éliminé : **l'exfiltration de données vers les domaines autorisés.** On ne peut que le contenir, en limitant ce que l'agent voit.

---

## A. Corrections par rapport à la v2

1. **Le réseau host-only n'est pas unidirectionnel.** La documentation d'Oracle est claire : en host-only, la machine virtuelle et l'hôte peuvent chacun ouvrir des connexions vers l'autre [DOC]. Le sens unique ne peut venir que de règles de pare-feu, et ces règles doivent être prouvées par des tests [TEST].
2. **La v2 ne séparait pas les deux réseaux host-only.** Sur un même réseau host-only, la machine des agents aurait pu joindre le SSH d'administration de la passerelle. La v3 utilise deux adaptateurs host-only distincts.
3. **IPv6 n'était pas traité.** Un adaptateur host-only sous Windows reçoit normalement une adresse IPv6 locale au lien (`fe80::`) [SUPPOSÉ]. C'est un chemin vers l'hôte qui échappe à des règles écrites seulement pour IPv4.
4. **La persistance n'était pas définie.** Revenir au snapshot effaçait aussi les modifications validées et pouvait faire revenir en arrière des jetons OAuth déjà renouvelés (section 3).
5. **Les privilèges de `gate` n'étaient pas définis.** Rien n'expliquait comment créer des cgroups et lancer les agents sans donner root à `gate` (section 4).
6. **Le NAT de la passerelle n'était pas analysé.** Dans les anciennes versions de VirtualBox, une machine en NAT peut joindre les services locaux de l'hôte par l'adresse 10.0.2.2. VirtualBox 7 bloquerait cet accès par défaut, d'après une source non officielle [SUPPOSÉ]. Le réseau local reste joignable à travers le NAT.
7. **Les clones liés par projet sont abandonnés.** Ils compliquaient la gestion des identifiants. La v3 utilise une seule machine virtuelle des agents, avec un disque système réinitialisé à chaque tâche. L'isolation entre projets devient temporelle : un seul projet est présent à la fois.
8. **bubblewrap est remplacé** par le confinement natif d'un service systemd par tâche. Les limites de ressources et le filtrage IP par unité sont documentés [DOC]. Les options de confinement des fichiers restent à vérifier [SUPPOSÉ].

---

## B. Les huit points demandés

### 1. Réseau host-only et pare-feu Windows

**Constat [DOC] :** en host-only, la communication est possible de la machine virtuelle vers l'hôte, de l'hôte vers la machine virtuelle et entre machines virtuelles, mais pas vers l'extérieur. Côté hôte, l'interface ressemble à une interface de boucle locale. Un serveur DHCP est actif par défaut. Sous Windows, le nombre de réseaux host-only n'est pas limité.

**Ce que dit la documentation sur le pare-feu Windows [DOC] :**
- une règle de blocage explicite l'emporte sur toute règle d'autorisation contraire ;
- les règles sortantes suivent la même priorité ;
- l'option `OverrideBlockRules` n'existe que pour les règles d'autorisation avec authentification (IPsec) ; elle n'est pas utilisée ici.

**Point non documenté [SUPPOSÉ] :** la page lue ne dit pas explicitement que le pare-feu est à états, c'est-à-dire qu'il laisse passer les réponses à une connexion ouverte par l'hôte malgré un blocage entrant. C'est le comportement attendu de la plateforme de filtrage de Windows (WFP), mais **le test T-NET-03 est décisif**. S'il échoue, la conception devra être revue, sans contournement improvisé.

**Règles prévues.** Elles seront appliquées en 0B.4 seulement, par vous, en console administrateur. Les noms réels des adaptateurs seront relevés avec `Get-NetAdapter`.
```powershell
$ctl = '<nom de l''adaptateur host-only de contrôle>'
$adm = '<nom de l''adaptateur host-only d''administration>'
foreach ($a in @($ctl, $adm)) {
  # 1. Tout trafic entrant initié par une VM est bloqué (IPv4 et IPv6), quel que soit le profil
  New-NetFirewallRule -DisplayName "ORCH-bloque-entrant-$a" -Direction Inbound -InterfaceAlias $a -Action Block -Profile Any
  # 2. Pas d'IPv6, de partage de fichiers ni de client SMB sur ces interfaces
  Disable-NetAdapterBinding -Name $a -ComponentID ms_tcpip6
  Disable-NetAdapterBinding -Name $a -ComponentID ms_server
  Disable-NetAdapterBinding -Name $a -ComponentID ms_msclient
}
# 3. Sortant de l'hôte : uniquement TCP 22 vers la VM concernée
#    (un blocage l'emportant sur une autorisation, on bloque les autres ports au lieu d'autoriser le 22)
foreach ($a in @($ctl, $adm)) {
  New-NetFirewallRule -DisplayName "ORCH-sortant-tcp-hors22-$a" -Direction Outbound -InterfaceAlias $a -Protocol TCP -RemotePort '1-21','23-65535' -Action Block -Profile Any
  New-NetFirewallRule -DisplayName "ORCH-sortant-udp-$a" -Direction Outbound -InterfaceAlias $a -Protocol UDP -Action Block -Profile Any
  New-NetFirewallRule -DisplayName "ORCH-sortant-icmp4-$a" -Direction Outbound -InterfaceAlias $a -Protocol ICMPv4 -Action Block -Profile Any
}
```

Compléments :
- le serveur DHCP de VirtualBox est désactivé sur les deux réseaux, qui utilisent des adresses fixes ;
- l'option NetBIOS est désactivée sur ces deux adaptateurs ;
- le routage IP de Windows doit être **désactivé** (`Forwarding = Disabled`). Sans cela, l'hôte pourrait relier les réseaux entre eux [TEST T-NET-12].

**Limites de ces règles :**
- elles dépendent du **nom** de l'adaptateur : si celui-ci est renommé, elles ne s'appliquent plus [TEST] ;
- elles ne protègent pas contre une faille de l'hyperviseur ;
- les cmdlets sont documentées [DOC], mais leur syntaxe exacte sera revalidée avant d'être appliquée.

**Tests IPv4 et IPv6.** Ils sont détaillés en H, avec les identifiants T-NET-01, 02, 03, 10, 11 et 12.

### 2. Séparation des réseaux

| Réseau | Type VirtualBox | Adresses | Machines reliées |
|---|---|---|---|
| `orch-ctl` | host-only, adaptateur A | 192.168.60.0/24 : hôte .1, agent .10 | **Hôte et VM agents uniquement** |
| `orch-adm` | host-only, adaptateur B | 192.168.61.0/24 : hôte .1, passerelle .10 | **Hôte et passerelle uniquement** |
| `orch-int` | réseau interne | 10.66.0.0/29 : passerelle .1, agent .2 | **VM agents et passerelle uniquement**, invisible de l'hôte [DOC] |
| NAT | NAT (carte 1 de la passerelle) | 10.0.2.0/24 | **Passerelle uniquement** |

Interfaces accessibles depuis chaque machine :
- **VM agents :** seulement `ctl0` (réseau `orch-ctl`) et `int0` (réseau `orch-int`). Elle n'a aucune carte sur `orch-adm` ni en NAT. **C'est une garantie de configuration**, vérifiable avec `showvminfo`. `orch-int` est le seul chemin vers le proxy.
- **Passerelle :** seulement `nat0`, `int0` et `adm0`. Elle n'a aucune carte sur `orch-ctl`.
- **Hôte :** seulement les adaptateurs A et B. Il ne voit pas `orch-int` [DOC].

Aucun réseau en mode pont n'est utilisé, et aucune redirection de port n'est configurée.

### 3. Persistance

| Catégorie | Support | Comportement |
|---|---|---|
| **Disque système de la VM agents** | Disque en mode **immuable** | VirtualBox efface les modifications à chaque démarrage [DOC]. Trois exceptions [DOC] : un état sauvegardé, un snapshot pris machine allumée, et un redémarrage depuis l'intérieur de la machine (seul un démarrage lancé par VirtualBox réinitialise). **Règles :** toujours éteindre la machine avec `VBoxManage controlvm poweroff`, ne jamais sauvegarder son état, ne garder aucun snapshot pris machine allumée. Une tâche n'est terminée qu'après l'extinction. |
| **Données du projet** | **Uniquement sur l'hôte**, par exemple `%LOCALAPPDATA%\orch-ia\projets\<p>\versions\<n>\` (archive, manifeste d'empreintes, journal) | Rien du projet ne persiste dans la machine virtuelle. |
| **Identifiants des agents** | Petit disque séparé en mode **write-through** | Non affecté par les snapshots [DOC]. Sous-dossiers `sup/` et `exec/`, chacun en 0700 pour son compte. Monté avec `nodev,nosuid,noexec`. |

**Réinjecter les modifications validées :**
1. La tâche *n* reçoit la dernière version validée *v* depuis l'hôte, sous forme d'archive.
2. Le résultat revient sous forme d'archive. Il est validé, comparé aux fichiers autorisés, puis soumis à votre validation humaine.
3. S'il est accepté, l'orchestrateur crée la version *v+1* sur l'hôte. Les versions précédentes sont conservées, jamais supprimées.
4. S'il est refusé, il reste en quarantaine et n'est jamais appliqué.
5. La tâche *n+1* reçoit la version *v+1*.

**Neutraliser la persistance par le disque d'identifiants.** C'est un point critique : un dossier de configuration persistant permettrait à un agent d'y déposer des réglages, par exemple des *hooks* dans le `settings.json` de Claude, qui s'exécuteraient à la tâche suivante.

Avant chaque exécution, le compte root :
1. crée un **dossier de configuration neuf**, en mémoire (tmpfs), à partir d'un modèle qui lui appartient ;
2. y copie **uniquement** le fichier d'identifiants autorisé (`.credentials.json` ou `auth.json`), après validation : JSON valide, clés attendues, taille limitée, fichier ordinaire et non un lien.

Après l'exécution, il recopie dans l'autre sens **ce seul fichier**, avec la même validation. Tout autre fichier présent dans ce dossier est ignoré et signalé.

**Risques des jetons OAuth :**
- **Claude.**
  - Les identifiants sont stockés dans `~/.claude/.credentials.json` [DOC].
  - Plusieurs rapports d'utilisateurs, non officiels, décrivent des **jetons de renouvellement à usage unique et renouvelés à chaque usage**, avec des échecs quand plusieurs processus partagent le même fichier.
  - Si ce fichier était sur le disque système réinitialisé, un jeton déjà consommé reviendrait à chaque tâche. La session échouerait, et risquerait même d'être révoquée [SUPPOSÉ].
  - **Option préférée à tester :** `claude setup-token` produit un **jeton de longue durée** à passer dans `CLAUDE_CODE_OAUTH_TOKEN` [DOC]. Il n'y a alors plus de fichier qui se renouvelle.
  - Un ancien rapport signalait une erreur 401 avec cette méthode, et un fichier `.credentials.json` périmé peut masquer la variable. Le dossier de configuration neuf écarte ce second problème [SUPPOSÉ, à tester].
- **Codex.**
  - Le fichier `auth.json` est en clair. Le renouvellement est automatique, mais **sa rotation n'est pas documentée**.
  - La copie de `auth.json` d'une machine à l'autre n'est pas confirmée.
  - La connexion se fait par `codex login --device-auth`, avec un code valable 15 minutes (sources secondaires).
  - Il faut donc le placer sur le disque write-through et **ne jamais lancer deux Codex en même temps**.
- **Risques communs :**
  - l'agent peut lire **son propre** jeton, ce qui est inévitable ;
  - si un agent est arrêté pendant un renouvellement, la connexion peut être perdue, et il faudra vous reconnecter ;
  - les jetons de l'hôte ne sont **jamais** copiés ;
  - le disque d'identifiants n'est jamais attaché à deux machines virtuelles allumées en même temps.

### 4. Privilèges SSH : le compte `gate`

**Compte `gate` :**
- shell `/bin/sh`, car sshd exécute la commande imposée à travers le shell du compte [SUPPOSÉ] ;
- dossier personnel appartenant à root, sauf un dossier de dépôt `/var/spool/orch` en 0700 pour `gate` ;
- membre d'aucun groupe ;
- **aucun accès** à `/srv/ws`, ni au disque d'identifiants ;
- **un seul droit sudo :**
  ```
  gate ALL=(root) NOPASSWD: /usr/local/sbin/orch-priv ""
  ```
  Dans sudoers, `""` signifie « sans aucun argument » [SUPPOSÉ : sémantique à confirmer dans sudoers(5)]. Options par défaut : `env_reset` et `secure_path`.

**Configuration de sshd :**
- `ListenAddress 192.168.60.10` ;
- `AllowUsers gate` ;
- `PasswordAuthentication no` et `KbdInteractiveAuthentication no` ;
- `AuthorizedKeysFile /etc/ssh/authorized_keys/%u`, appartenant à root et non modifiable par `gate` ;
- `Match User gate` avec `ForceCommand /usr/local/sbin/orch-gate`, `DisableForwarding yes`, `PermitTTY no`, `PermitUserEnvironment no`, `PermitTunnel no`.

La clé est déclarée dans `authorized_keys` avec :
```
from="192.168.60.1",restrict,command="/usr/local/sbin/orch-gate"
```

Comme la commande est imposée, `scp`, `sftp` et les sous-systèmes ne fonctionnent pas. Les fichiers passent par l'entrée et la sortie standard. Côté hôte, la clé d'hôte de la VM est fixée (`StrictHostKeyChecking yes`).

**`orch-gate`** (exécuté en tant que `gate`, sans privilège) :
- lit `SSH_ORIGINAL_COMMAND` et le compare à **une seule expression stricte** :
  `^(put-task|run-sup|run-exec|get-result|kill|status)( [a-z0-9]{16})?$`
- refuse tout le reste et le journalise ;
- **ne passe jamais la commande à un shell** ;
- recopie l'entrée standard dans le dossier de dépôt, avec une limite de taille, puis appelle `sudo -n orch-priv` en lui passant une requête JSON fixe sur l'entrée standard.

**`orch-priv`** est le **seul code exécuté en root**. Il est écrit en Python avec `python3 -I`, sans dépendance externe et sans `shell=True`. Son interface est la suivante :

| Verbe | Arguments validés | Effet |
|---|---|---|
| `prepare` | `id` (16 caractères `[a-z0-9]`) | Crée `/srv/ws/<id>` pour `exec` en 0700 (refusé s'il existe déjà). Extrait l'archive du dépôt **en tant que `exec`**, avec `tarfile` et le filtre `data` [DOC], en refusant en plus **tout** lien ou fichier spécial et en limitant le nombre de fichiers et la taille totale. |
| `run` | `role` ∈ {`sup`, `exec`}, `id` | Lance `systemd-run --wait --pipe --collect --unit=orch-<role>-<id>` avec : `User=<role>`, `MemoryMax`, `TasksMax`, `RuntimeMaxSec` (limites de ressources [DOC]) ; `IPAddressDeny=any` et `IPAddressAllow=10.66.0.1` (filtrage IP par unité, inopérant si le noyau n'a pas le support eBPF [DOC]) ; `NoNewPrivileges`, `ProtectSystem=strict`, `ProtectHome`, `PrivateTmp`, `ReadWritePaths=/srv/ws/<id>`, `CapabilityBoundingSet=` (vide) [SUPPOSÉ : à vérifier dans systemd.exec(5)] ; un environnement réduit à des variables fixes. Le jeton est passé par `LoadCredential` plutôt que par `Environment=`, qui pourrait être lisible via `systemctl show` [SUPPOSÉ]. |
| `kill` | `id` | `systemctl kill` puis `stop` sur l'unité `orch-*-<id>`, dont le nom est construit uniquement à partir de l'identifiant validé. |
| `collect` | `id` | Refusé tant que l'unité tourne. Produit une archive des **fichiers ordinaires uniquement**, avec une taille limitée. |
| `status` | aucun | État des unités. |

**Risques d'injection :**
- **`SSH_ORIGINAL_COMMAND`** : il n'est jamais interprété, seulement comparé à l'expression stricte ci-dessus. Point à noter : sshd exécute la commande imposée via le shell de `gate`, mais cette commande est un chemin fixe sans argument.
- **Archives de tâche (de l'hôte vers la VM)** :
  - le programme qui les construit sur l'hôte refuse les liens présents dans les projets ;
  - côté VM : filtre `data`, refus des liens, limites de taille et de nombre ;
  - la documentation Python précise **qu'aucun filtre ne bloque toutes les fonctionnalités dangereuses**, et que le filtre `data` n'empêche pas le déni de service [DOC]. D'où les limites supplémentaires.
- **Archives de résultat (de la VM vers l'hôte)** : ce sont les données les plus hostiles. L'hôte les vérifie **avant** de les extraire :
  - noms : pas de `..`, pas de chemin absolu, pas de `:`, pas de nom réservé de Windows, pas de point ou d'espace final, pas de conflit de casse, longueur limitée ;
  - types : fichiers ordinaires uniquement ;
  - tailles limitées ;
  - liste comparée aux fichiers autorisés.
- **Flux standard** :
  - les instructions envoyées sont limitées en taille ;
  - le flux JSON reçu est limité en taille et en longueur de ligne, et vérifié par schéma comme en 0A ;
  - les caractères de contrôle sont supprimés avant tout affichage, pour neutraliser d'éventuelles séquences d'échappement de terminal.

### 5. Passerelle réseau

Règles nftables de la passerelle, toutes avec politique `drop` par défaut :
- **Entrée :**
  - boucle locale autorisée ; connexions établies autorisées ;
  - `int0` : TCP 3128 et 3129 **depuis 10.66.0.2 uniquement** ;
  - `adm0` : TCP 22 **depuis 192.168.61.1 uniquement** ;
  - tout le reste, y compris SSH sur `int0`, est rejeté et journalisé.
- **Transfert :** `drop`, avec en plus `net.ipv4.ip_forward=0`. **La passerelle ne route rien.**
- **Sortie :**
  - boucle locale ; connexions établies ;
  - sur `nat0`, pour le compte du proxy uniquement : TCP 443 vers les adresses publiques, en excluant 10/8, 172.16/12, 192.168/16, 169.254/16, 100.64/10, 127/8 et 224/4 ;
  - DNS vers le résolveur NAT 10.0.2.3, pour le proxy uniquement ;
  - tout le reste est rejeté et journalisé.
- **IPv6 :** désactivé (sysctl) et rejeté dans la famille `inet`.
- **sshd :** `ListenAddress 192.168.61.10` uniquement.

**Empêcher le rebond vers Windows :**
- pas de routage ;
- l'adresse 10.0.2.2 (services locaux de l'hôte) est rejetée par nftables. VirtualBox 7 la bloquerait aussi par défaut (option `--nat-localhostreachable1`) [SUPPOSÉ, source non officielle] ;
- l'adresse de l'hôte et le réseau local sont rejetés par l'exclusion des plages privées ;
- l'interface `adm0` est bloquée en entrant côté Windows.

Couche facultative à évaluer : une règle sortante Windows sur le processus `VBoxHeadless.exe` vers les plages privées, en supposant que le trafic NAT est attribué à ce processus [SUPPOSÉ].

**Limite :** une passerelle compromise (root) peut effacer ses propres règles. Le pare-feu Windows reste alors la dernière protection pour l'hôte, mais pas pour le réseau local accessible par le NAT.

**Proxy squid** (syntaxe à vérifier dans la documentation squid) [SUPPOSÉ] :
- un port par agent : 3128 pour `sup`, 3129 pour `exec`, distingués par `myportname` ;
- une liste `dstdomain` par port ;
- seules les requêtes `CONNECT` vers le port 443 sont acceptées ; tout le reste est refusé (`deny all`) ;
- aucun cache ;
- le journal enregistre l'heure, le port, le domaine, l'état et les octets échangés.

**Limites d'un proxy HTTPS sans inspection TLS :**
- il ne voit **que le nom de domaine** demandé, jamais le contenu ;
- **exfiltration vers un domaine autorisé :** un agent détourné peut envoyer des données à `api.anthropic.com` ou aux domaines OpenAI, **y compris avec la clé API d'un attaquant**. Les données arrivent alors sur le compte de cet attaquant. Ce risque est **impossible à bloquer sans déchiffrer le trafic** ;
- possible détournement par CDN (« domain fronting ») si un domaine autorisé est servi par une infrastructure partagée ;
- les volumes d'octets journalisés permettent seulement de **détecter** a posteriori, avec des seuils d'alerte, sans rien empêcher.

**Protection réelle :** l'agent ne voit que le dossier de sa tâche, et jamais de secret de l'hôte.

### 6. VirtualBox

**Installation minimale [DOC].** Fonctionnalités de l'installeur : `VBoxApplication` (obligatoire), `VBoxUSB`, `VBoxNetwork`, `VBoxNetworkFlt` (mode pont), `VBoxNetworkAdp` (host-only) et `VBoxPython`. Commande prévue, que vous lancerez en 0B.3 après vérification de l'empreinte SHA-256 du fichier :
```
VirtualBox-<version>-Win.exe -extract
msiexec /i VirtualBox-<version>-Win.msi ADDLOCAL=VBoxApplication,VBoxNetwork,VBoxNetworkAdp VBOX_INSTALLDESKTOPSHORTCUT=0 VBOX_INSTALLQUICKLAUNCHSHORTCUT=0 VBOX_REGISTERFILEEXTENSIONS=0 VBOX_START=0
```
La relation exacte entre `VBoxNetwork` et `VBoxNetworkAdp` reste à vérifier [SUPPOSÉ], de même que le fonctionnement du NAT sans le pilote de pont [SUPPOSÉ].

| Indispensable | Désactivable ou exclu |
|---|---|
| Application de base, pilote host-only, moteur NAT (passerelle uniquement), contrôleur de disque, une carte réseau par réseau | USB (pilote et contrôleurs `--usb-ohci`, `--usb-ehci`, `--usb-xhci` à `off`), mode pont, Python, pack d'extension, **Guest Additions**, son (`--audio-enabled=off`), presse-papiers (`--clipboard-mode=disabled`), glisser-déposer (`--drag-and-drop=disabled`), dossiers partagés, VRDE (`--vrde=off`), ports série (`--uart1=off`), 3D, lecteur optique après l'installation, virtualisation imbriquée [DOC pour les noms des options] |

**Snapshots et clones :**
- un disque write-through n'est pas touché par les snapshots [DOC] ;
- un disque immuable revient à son état à chaque démarrage, avec les exceptions de la section 3 [DOC] ;
- supprimer un snapshot oblige à fusionner les disques, ce qui est lent et demande de l'espace [DOC] ;
- un clone lié ne peut être créé qu'à partir d'un snapshot (`--options=Link`) [DOC]. Il est **abandonné** ici ;
- un disque normal peut être attaché à plusieurs machines, mais une seule peut tourner à la fois [DOC].

**Mise à jour de l'image immuable.** C'est une procédure de maintenance faite par un humain :
1. repasser le disque en mode normal ;
2. démarrer avec une liste blanche de maintenance (dépôts apt) ;
3. mettre à jour, puis éteindre ;
4. remettre le disque en mode immuable ;
5. relancer la batterie H.

Le détail des commandes reste à vérifier [SUPPOSÉ].

**Hyper-V et VBS :** si la plateforme de virtualisation Windows est active, VirtualBox utilise Hyper-V comme moteur. La documentation qualifie ce fonctionnement d'**expérimental**, avec une **dégradation importante possible** des performances. Son conseil officiel est de désactiver Hyper-V, la Plateforme de machine virtuelle et la plateforme d'hyperviseur Windows [DOC].

**Je ne recommande pas de désactiver l'intégrité de la mémoire** sans une décision distincte de votre part. Les performances seront donc mesurées en 0B.6. Si elles sont insuffisantes, il faudra choisir entre VMware et une décision sur VBS.

### 7. Architecture globale : schéma, matrice, contournements

```
                         INTERNET
                            ▲ TCP 443 uniquement (compte proxy), DNS vers 10.0.2.3
                            │ NAT VirtualBox (passerelle seule)
┌──────────────── HÔTE WINDOWS (corrigé) ─────────────────────────────────────────┐
│ Orchestrateur ─ VBoxManage.exe, ssh.exe                                         │
│ Pare-feu : ENTRANT bloqué sur A et B (IPv4) ; IPv6 et SMB retirés de A et B      │
│ Sortant sur A et B : TCP 22 seulement                                           │
│  Adaptateur A 192.168.60.1                    Adaptateur B 192.168.61.1         │
└───────┬──────────────────────────────────────────────┬──────────────────────────┘
        │ orch-ctl (host-only)                         │ orch-adm (host-only)
        │ SSH initié par l'hôte → :22                  │ SSH initié par l'hôte → :22
┌───────▼──────── VM AGENTS ──────────┐        ┌───────▼──────── VM PASSERELLE ───────┐
│ ctl0 192.168.60.10 (sshd → gate)    │        │ adm0 192.168.61.10 (sshd admin)      │
│ int0 10.66.0.2                      │◄──────►│ int0 10.66.0.1 : squid 3128 / 3129   │
│ disque système IMMUABLE             │orch-int│ nat0 10.0.2.15 ──► NAT ──► Internet  │
│ disque identifiants WRITE-THROUGH   │(interne│ pas de routage                       │
│ unités systemd orch-sup / orch-exec │ seul)  │ journaux du proxy                    │
└─────────────────────────────────────┘        └──────────────────────────────────────┘
```

**Matrice des communications :**

| Source → Destination | Réseau | Ports | Autorisé | Assuré par |
|---|---|---|---|---|
| Hôte → agent | orch-ctl | TCP 22 | Oui | nft de l'agent, sshd, clé à commande imposée |
| Agent → hôte | orch-ctl | Tous (IPv4 et IPv6) | **Non** | Pare-feu Windows et retrait d'IPv6 [TEST] ; nft de l'agent |
| Hôte → passerelle | orch-adm | TCP 22 | Oui | nft de la passerelle, sshd |
| Passerelle → hôte | orch-adm | Tous | **Non** | Pare-feu Windows [TEST] ; nft de la passerelle |
| Agent (`sup`) → passerelle | orch-int | TCP 3128 | Oui | nft de l'agent (par compte) et nft de la passerelle |
| Agent (`exec`) → passerelle | orch-int | TCP 3129 | Oui | Idem |
| Agent → passerelle, autres ports (dont 22) | orch-int | — | **Non** | nft de la passerelle, sshd limité à `adm0` |
| Passerelle → agent (connexion initiée) | orch-int | — | **Non** | nft de l'agent (connexions établies uniquement) |
| Agent → orch-adm | — | — | **Impossible** | Aucune carte sur ce réseau (configuration) ; pas de routage Windows [TEST] |
| Passerelle → orch-ctl | — | — | **Impossible** | Aucune carte sur ce réseau (configuration) |
| Agent → Internet en direct | — | — | **Impossible** | Aucune carte NAT ni pont (configuration) |
| Passerelle (proxy) → Internet | NAT | TCP 443, DNS | Oui, liste blanche | squid et nft |
| Passerelle → 10.0.2.2, réseau local, plages privées | NAT | — | **Non** | nft ; défaut de VirtualBox 7 [SUPPOSÉ] |
| Hôte → orch-int | — | — | Impossible | Réseau interne invisible de l'hôte [DOC] |
| Réseau local → VM | — | — | Impossible | Pas de pont, pas de redirection de port (configuration) |

**Chemins de contournement possibles :**
1. Faille de l'hyperviseur, via une carte réseau, un contrôleur de disque ou l'affichage virtuels.
2. IPv6 local au lien vers l'hôte, si le retrait d'IPv6 échoue ou est annulé.
3. Adaptateur renommé, ce qui rend les règles de pare-feu inopérantes.
4. Routage activé sur Windows par un autre logiciel (partage de connexion, client VPN).
5. Compromission de squid, qui donnerait root sur la passerelle puis le réseau local à travers le NAT.
6. Exfiltration vers les domaines autorisés.
7. Disque d'identifiants utilisé pour faire persister une configuration malveillante.
8. Redémarrage depuis l'intérieur de la VM sans extinction, qui conserverait les modifications du disque immuable.
9. Bogues de l'hôte dans la validation des archives et du JSON.
10. Erreur humaine, par exemple installer les Guest Additions ou activer le presse-papiers « pour dépanner ».
11. Usurpation d'adresse ou DHCP pirate : risque faible avec seulement deux machines par réseau et sans DHCP.

**Garanties réelles et hypothèses :**
- **Garanti par la configuration de VirtualBox**, vérifiable avec `showvminfo` et documenté :
  - les réseaux auxquels chaque machine est reliée ;
  - l'invisibilité du réseau interne pour l'hôte ;
  - l'absence de NAT et de pont pour la VM agents ;
  - l'absence des canaux d'intégration si les Guest Additions sont absentes ;
  - le comportement des disques write-through et immuables.
- **Repose sur des règles à prouver par des tests :**
  - pare-feu Windows, y compris son comportement à états ;
  - retrait d'IPv6 ;
  - nftables sur les deux machines ;
  - squid ;
  - sshd et la commande imposée ;
  - sudoers ;
  - confinement systemd ;
  - validation des archives.
- **Hypothèses restantes :**
  - pas de routage Windows ;
  - comportement NAT de VirtualBox 7 ;
  - comportement des jetons OAuth ;
  - noms des fonctionnalités de l'installeur ;
  - performances avec VBS ;
  - sémantique de `""` dans sudoers ;
  - options de confinement de systemd.exec.

### 8. Plan d'exécution

Le plan détaillé est en G. Ses principes :
- la première étape opérationnelle est en **lecture seule** ;
- rien n'est installé ni modifié avant validation de ses résultats ;
- **aucun appel réel** à Codex ou Claude avant la validation complète de la sécurité **et** une autorisation distincte.

---

## C. Contraintes de votre machine

Elles sont inchangées depuis la v2 :
- Windows 10 Famille 22H2, support standard terminé le 14 octobre 2025 ;
- ESU possible jusqu'au 12 octobre 2027 [DOC], **votre inscription n'est pas vérifiée** ;
- Hyper-V et Windows Sandbox indisponibles [DOC] ;
- mémoire, processeur, SLAT, VBS, Plateforme de machine virtuelle, disque, TPM et Secure Boot non vérifiés.

---

## D. Architecture recommandée

C'est celle décrite en B.2 à B.7 :
- **une VM agents** avec un disque système immuable, un disque d'identifiants en write-through, et une unité systemd confinée par tâche ;
- **une VM passerelle** avec squid à liste blanche et sans routage ;
- **deux réseaux host-only séparés** et un réseau interne ;
- **le pare-feu Windows** bloquant les connexions initiées par les machines virtuelles ;
- **SSH initié par l'hôte uniquement**, avec commande imposée ;
- **les données du projet versionnées sur l'hôte.**

---

## E. Schéma

Voir la section B.7 (schéma réseau et matrice des communications).

---

## F. Composants nécessaires

**Sur l'hôte :**
- VirtualBox 7.x, avec les fonctionnalités minimales de B.6 ;
- client OpenSSH ;
- règles de pare-feu ;
- dépôt versionné des projets ;
- validateur d'archives.

**Dans la VM agents :**
- Debian stable minimal ;
- openssh-server, sudo, python3, nftables, systemd ;
- Node LTS avec Claude Code, et Codex CLI ;
- `orch-gate`, `orch-priv` et le modèle de configuration.

**Dans la passerelle :**
- Debian stable minimal ;
- squid, nftables, openssh-server.

**À écrire :**
- `orch-gate` et `orch-priv` ;
- les règles nftables ;
- la configuration de squid ;
- l'adaptateur « VM » de l'orchestrateur ;
- le validateur d'archives ;
- la batterie de tests H.

---

## G. Plan d'exécution

Chaque étape demande votre autorisation, qui est **distincte pour chaque étape**.

| Étape | Contenu | Validation |
|---|---|---|
| **0B.1** | **Lecture seule** : commandes de la section C de la v2 (`Get-CimInstance`, `Get-HotFix`, DeviceGuard, `Get-PSDrive`, `wsl --status`), plus `Get-NetIPInterface \| Select-Object InterfaceAlias, AddressFamily, Forwarding` | Rapport de constats, sans aucune modification |
| **0B.2** | Décisions **écrites**, sans installation : ESU ou Windows 11, hyperviseur, choix sur VBS | Votre validation |
| **P0** | Mise à jour de l'hôte, faite par vous | Dernière mise à jour cumulative installée ; état de l'ESU affiché |
| **0B.3** | Installation de VirtualBox, par vous, avec la ligne `ADDLOCAL` minimale et vérification de l'empreinte | Seules les fonctionnalités prévues sont présentes |
| **0B.4** | Création des adaptateurs A et B (sans DHCP), des règles de pare-feu, retrait d'IPv6 et de SMB | Relecture des règles ; `Get-NetAdapterBinding` |
| **0B.5** | Construction de la passerelle, **sans agent** | T-NET (partie passerelle) |
| **0B.6** | Construction de la VM agents, **sans CLI d'agent** ; mesure des performances | T-NET complet, T-DEV |
| **0B.7** | `orch-gate`, `orch-priv`, unités systemd | T-SSH, T-PRIV, T-TAR, T-DOS |
| **0B.8** | Disque immuable, disque d'identifiants, synchronisation validée | T-PERS, T-CRED (avec de faux identifiants) |
| **0B.9** | Installation des CLI et connexion faites par vous ; relevé des domaines en mode « refus et journalisation », **sans tâche de travail** | Liste blanche figée ; T-CRED réel |
| **0B.10** | Batterie H complète | 100 % réussis, ou écarts documentés |
| **0B.11** | Simulation 0A rejouée en mode VM, sans modèle | 10 auto-tests et 17 scénarios réussis |
| *0A.2* | *Appels réels : **autorisation distincte***, après la validation de la Phase 0B | — |

---

## H. Tests de sécurité prévus

**Aucun de ces tests n'a été exécuté.**

**Réseau :**
- **T-NET-01** : depuis la VM agents, balayage TCP et UDP en IPv4 de 192.168.60.1, du port 1 au port 65535 → aucune réponse.
- **T-NET-02** : IPv6 vers l'hôte, avec et sans réactivation d'IPv6 dans la VM (par root, pour le test) → aucune adresse `fe80::` de l'hôte visible, aucune réponse.
- **T-NET-03** : SSH ouvert par l'hôte vers la VM, **avec** la règle de blocage entrant active → fonctionne. **C'est un test décisif.**
- **T-NET-04 / 05** : VM agents vers 192.168.61.0/24, et passerelle vers 192.168.60.0/24 → injoignables.
- **T-NET-06** : VM agents vers 10.66.0.1, port 22 et autres ports → refusés. `sup` ne peut pas utiliser le port 3129, ni `exec` le port 3128.
- **T-NET-07** : depuis la VM agents, Internet direct, DNS, ICMP et QUIC → impossibles.
- **T-NET-08** : à travers le proxy :
  - domaine hors liste → refusé ;
  - adresse IP littérale → refusée ;
  - domaine autorisé sur le port 22 → refusé ;
  - requête HTTP simple (GET) → refusée ;
  - domaine autorisé sur le port 443 → accepté ;
  - chaque cas est journalisé.
- **T-NET-09** : passerelle vers 10.0.2.2, vers l'adresse de l'hôte sur le réseau local, vers 192.168.0.0/16, et TCP 80 → refusés.
- **T-NET-10** : capture réseau dans la VM agents → aucune annonce NetBIOS, LLMNR ou mDNS venant de l'hôte.
- **T-NET-11** : fausse annonce de routeur IPv6 envoyée depuis la VM → sans effet sur l'hôte.
- **T-NET-12** : `Forwarding = Disabled` sur toutes les interfaces de l'hôte ; règle de pare-feu vérifiée **après** un renommage simulé de l'adaptateur.

**Machines virtuelles :**
- **T-DEV** : `showvminfo` ne montre aucun USB, son, presse-papiers, glisser-déposer, dossier partagé, VRDE ni port série ; Guest Additions absentes.

**Accès SSH :**
- **T-SSH** : tentatives de contournement → toutes refusées et journalisées :
  - `ssh gate@vm bash`, `-t`, `-L`, `-R`, `-D`, `-s sftp`, `scp` ;
  - `SendEnv` ;
  - commandes contenant `;`, `$(…)`, un retour à la ligne, un identifiant trop long ou de l'Unicode.

**Privilèges :**
- **T-PRIV** :
  - `sudo` refusé pour toute autre commande ;
  - `orch-priv` avec des arguments → refusé ;
  - JSON invalide, chemin à la place de l'identifiant, deux exécutions simultanées → refusés ;
  - `kill` vide l'unité, sans processus orphelin.

**Archives :**
- **T-TAR** : dans les deux sens, archives contenant un lien symbolique, un lien physique, `../`, un chemin absolu, un fichier spécial, un nom Windows réservé, `:`, un conflit de casse, un fichier énorme ou des milliers de fichiers → toutes refusées.

**Persistance :**
- **T-PERS** :
  - fichier implanté dans le système, puis extinction et redémarrage → le fichier a disparu ;
  - redémarrage depuis l'intérieur de la VM → l'orchestrateur ne considère la tâche terminée qu'après extinction ;
  - *hook* ou `settings.json` déposé sur le disque d'identifiants → ignoré à la synchronisation.

**Identifiants :**
- **T-CRED** :
  - `exec` ne peut pas lire les identifiants de `sup` ;
  - l'environnement ne contient que les variables prévues ;
  - le jeton n'apparaît dans aucun journal ;
  - comportement du renouvellement sur deux tâches successives (en 0B.9, sans travail réel).

**Ressources :**
- **T-DOS** : bombe de processus, épuisement de mémoire, disque rempli, sortie standard inondée → stoppés par les limites.

**Injection d'instructions :**
- **T-INJ** : un fichier piège demandant d'atteindre l'hôte ou un site est bloqué par l'architecture.

---

## I. Risques résiduels

1. Sortie de machine virtuelle par une faille de l'hyperviseur.
2. Exfiltration vers les domaines autorisés, y compris avec la clé d'un attaquant.
3. Vol du jeton d'un agent par cet agent lui-même : il faudra alors le révoquer. Comme les crédits payants sont désactivés, le préjudice se limite à l'usage de votre abonnement.
4. Compromission de la passerelle, qui donnerait accès au réseau local à travers le NAT.
5. Bogues dans le code de l'hôte qui valide les données venant de la VM.
6. Hôte Windows 10 : une migration sera obligatoire avant le 12 octobre 2027.
7. Comportement non documenté des jetons OAuth : risque de déconnexions répétées.
8. Erreur humaine au cours de la maintenance.
9. Chaîne d'approvisionnement : paquets npm et apt de l'image.

---

## J. Coûts, ressources et complexité

| Élément | Estimation |
|---|---|
| Coût | 0 € (VirtualBox, Debian) ; ESU de 0 € à 30 $ [DOC] |
| Mémoire pendant une tâche | VM agents 4 à 6 Go + passerelle 0,5 à 1 Go |
| Disque | Environ 30 à 50 Go |
| Complexité | **Élevée**, environ 1,5 fois celle de la v2, à cause des deux réseaux host-only, de `orch-priv`, de la persistance validée et de la batterie de tests étendue |
| Temps | **25 à 40 heures**, soit 6 à 10 séances [estimation] |
| Maintenance | Mises à jour mensuelles ; reconstruction de l'image immuable ; batterie H relancée après chaque changement |

---

## K. Critères de validation de la Phase 0B

Chaque critère doit être prouvé par une exécution.

1. L'hôte est corrigé.
2. La configuration est conforme : `showvminfo` correspond exactement au tableau B.2 et à la colonne « Désactivable » de B.6.
3. **Tous** les tests T-NET réussissent, **y compris T-NET-03 en IPv4 et T-NET-02 en IPv6.**
4. T-SSH, T-PRIV et T-TAR réussissent à 100 %.
5. T-PERS : non-persistance prouvée ; disque d'identifiants neutralisé.
6. T-CRED réussit, et le renouvellement des jetons est stable sur au moins deux tâches successives.
7. T-DOS et T-INJ réussissent.
8. Les journaux de l'orchestrateur et du proxy ont une empreinte, et les agents ne peuvent pas les modifier.
9. La simulation 0A rejouée en mode VM réussit : 10 auto-tests et 17 scénarios.
10. Aucun accès à Fastclip ; crédits payants désactivés, ce que vous confirmez.

---

## Verdict final

**L'architecture est faisable et adaptée à votre objectif.** La frontière principale est une vraie machine virtuelle. Le réseau est filtré **hors** de la VM agents. Les échanges ne passent que par une interface étroite, initiée par l'hôte. Les données du projet ne persistent que sur l'hôte, après validation.

**Elle n'est pas encore prouvée.** Quatre inconnues pourraient la remettre en cause : le comportement à états du pare-feu Windows (T-NET-03), les performances de VirtualBox avec VBS, le comportement des jetons OAuth, et l'état de mise à jour de l'hôte.

**Une limite est permanente :** l'exfiltration vers les domaines autorisés. Elle est acceptable seulement si l'agent ne voit jamais que le dossier de sa tâche.

---

## Sources

- [VirtualBox : réseau virtuel, tableau des modes (host-only bidirectionnel)](https://www.virtualbox.org/manual/topics/networkingdetails.html)
- [VirtualBox : stockage, modes write-through, immuable et multiattach](https://www.virtualbox.org/manual/topics/storage.html)
- [VirtualBox : installation, fonctionnalités `ADDLOCAL` et propriétés MSI](https://www.virtualbox.org/manual/topics/installation.html)
- [VirtualBox : `VBoxManage` (`clonevm`, `modifyvm`, `snapshot`)](https://www.virtualbox.org/manual/topics/vboxmanage.html)
- [VirtualBox : fonctionnement avec Hyper-V, documentation 7.2.2 via les sources Debian](https://sources.debian.org/src/virtualbox/7.2.2-dfsg-2/doc/manual/en_US/dita/topics/hyperv-support.dita)
- [VirtualBox : dépannage Hyper-V, documentation 7.2.2 via les sources Debian](https://sources.debian.org/src/virtualbox/7.2.2-dfsg-2/doc/manual/en_US/dita/topics/ts_hyperv.dita)
- [VirtualBox 7.0 : limitations connues](https://docs.oracle.com/en/virtualization/virtualbox/7.0/user/KnownIssues.html)
- [VirtualBox 7 : accès NAT à la boucle locale de l'hôte, source non officielle (ticket minikube)](https://github.com/kubernetes/minikube/issues/15566)
- [Pare-feu Windows : priorité des règles](https://learn.microsoft.com/en-us/windows/security/operating-system-security/network-security/windows-firewall/rules)
- [Cmdlet `New-NetFirewallRule`](https://learn.microsoft.com/en-us/powershell/module/netsecurity/new-netfirewallrule)
- [systemd : contrôle des ressources (IPAddressAllow/Deny, MemoryMax, TasksMax)](https://www.freedesktop.org/software/systemd/man/latest/systemd.resource-control.html)
- [Python : `tarfile` et filtres d'extraction](https://docs.python.org/3/library/tarfile.html)
- [OpenSSH : `sshd(8)` et options de `authorized_keys`](https://man.openbsd.org/sshd.8)
- [Claude Code : authentification (stockage des identifiants, `setup-token`)](https://code.claude.com/docs/en/authentication.md)
- [Claude Code : rapport d'utilisateur sur la concurrence lors du renouvellement des jetons (non officiel)](https://claudeissues.com/issue/48786-multiple-concurrent-cli-sessions-cause-auth-failure-on-token-refresh-race-condit)
- [Claude Code : rapport d'utilisateur sur un fichier `.credentials.json` périmé qui masque la variable (non officiel)](https://claudeissues.com/issue/81281-bug-stale-claude-credentials-json-causes-oauth-token-has-expired-even-when-a-val)
- [Codex : authentification (documentation officielle)](https://developers.openai.com/codex/auth)
- [Codex : connexion sans interface graphique (source secondaire)](https://blog.laozhang.ai/en/posts/codex-headless-login)
- [WSL : documentation de sécurité](https://github.com/microsoft/WSL/blob/master/doc/docs/technical-documentation/security.md)
- [Programme ESU grand public](https://www.microsoft.com/en-us/windows/extended-security-updates)

Je m'arrête ici : je ne commence aucune étape sans votre autorisation explicite.
