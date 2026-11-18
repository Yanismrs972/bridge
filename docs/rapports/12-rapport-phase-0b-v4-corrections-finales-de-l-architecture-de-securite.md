<!-- Rapport extrait de la session Claude « Orchestrateur IA », 2026-11-16 23:26 UTC -->

# Rapport Phase 0B v4 : corrections finales de l'architecture de sécurité

Cette mission est restée documentaire. Je n'ai lancé aucune commande locale, créé ou modifié aucun fichier, rien installé, configuré aucune machine virtuelle et contacté aucun agent. Je n'ai pas non plus accédé à Fastclip.

**Statut des affirmations :**
- **[DOC]** : documenté officiellement (source en fin de rapport).
- **[DÉDUIT]** : déduit d'une documentation officielle.
- **[SUPPOSÉ]** : hypothèse.
- **[TEST]** : doit être prouvé par un test de la section 9.

**Aucun test n'a été exécuté.**

---

## A. Corrections par rapport à la v3

| N° | Erreur de la v3 | Correction en v4 |
|---|---|---|
| 1 | L'extinction normale prévue était `controlvm poweroff`, une coupure brutale | Arrêt ACPI, attente, contrôle de l'état `poweroff`, refus de l'état `saved`, coupure brutale réservée à l'urgence (section 7) |
| 2 | Je supposais que VirtualBox 7 bloque l'adresse 10.0.2.2 par défaut, sur la foi d'une source non officielle | Option **fixée explicitement** à `off` ; tests ; analyse d'une passerelle compromise ; filtrage Windows à prouver ; architecture de repli (section 2) |
| 3 | Le port TCP 22 sortant n'était pas limité à l'adresse de la VM visée | Les règles limitent chaque réseau à une seule adresse, un seul protocole et un seul port. **IPv6 n'est plus dissocié**, il est filtré par le pare-feu. Une détection de dérive est ajoutée (section 4) |
| 4 | Le confinement systemd n'était qu'une liste de propriétés | Configuration de référence complète, avec chaque propriété reliée à sa source et à un test (section 5) |
| 5 | L'expression régulière acceptait des combinaisons incohérentes | Grammaire stricte par commande, machine à états, propriété des fichiers vérifiée, sudoers vérifié officiellement (section 6) |
| 6 | Il n'était pas précisé que l'extraction elle-même tourne sous l'identité `exec` | Extraction sous `exec` dans une unité confinée, règles détaillées, extraction Windows sûre (section 6) |
| 7 | Les identifiants reposaient sur des sources secondaires | Documentations officielles d'Anthropic et d'OpenAI ; droits et risques réels ; révocation (section 8) |
| 8 | Sources secondaires : ticket minikube, claudeissues, blogs | Remplacées par les documentations Oracle, Microsoft, systemd, sudo, OpenSSH, Anthropic et OpenAI, quand elles existent |

---

## 1. Architecture réseau corrigée

Le principe est inchangé : une VM agents, une VM passerelle, deux réseaux host-only séparés et un réseau interne.

| Réseau | Type | Adresses | Machines reliées |
|---|---|---|---|
| `orch-ctl` | host-only, adaptateur A, **sans DHCP** | Hôte 192.168.60.1, agents 192.168.60.10 | Hôte et VM agents |
| `orch-adm` | host-only, adaptateur B, **sans DHCP** | Hôte 192.168.61.1, passerelle 192.168.61.10 | Hôte et passerelle |
| `orch-int` | réseau interne | Passerelle 10.66.0.1, agents 10.66.0.2 | Les deux VM ; **invisible de l'hôte** [DOC] |
| NAT | NAT, carte 1 de la passerelle, `--nat-localhostreachable1=off` | 10.0.2.0/24 | Passerelle uniquement |

- La VM agents n'a **aucune** carte NAT, pont, ni carte sur `orch-adm`.
- La passerelle n'a **aucune** carte sur `orch-ctl`.
- Ces deux points sont garantis par la configuration et vérifiables avec `showvminfo --machinereadable` [DOC pour les options `--nicN` et `--intnetN`].

---

## 2. NAT vers l'hôte et vers le réseau local

**État de l'option :**
- La page officielle de `VBoxManage` montre dans son résumé l'option `[--nat-localhostreachableN=on | off]`, où N est le numéro de la carte [DOC].
- Je n'ai **pas trouvé sa description ni sa valeur par défaut** dans les passages lus.
- **Elle sera donc fixée explicitement :** `VBoxManage modifyvm orch-passerelle --nat-localhostreachable1=off`.
- Sa présence dans la version installée sera vérifiée en 0B.3 avec l'aide intégrée de `VBoxManage` [TEST].

**Ce que cette option couvre et ne couvre pas :**
- **Elle couvre** seulement l'accès à la boucle locale de l'hôte par 10.0.2.2 [DÉDUIT].
- **Elle ne couvre pas** l'accès, à travers le NAT, à l'adresse de l'hôte sur votre réseau local ni aux autres appareils de ce réseau. Le moteur NAT ouvre ses connexions depuis la pile réseau de l'hôte [DÉDUIT de la documentation réseau d'Oracle].

**Passerelle compromise.** Si un attaquant obtient root sur la passerelle, il peut **effacer les règles nftables**. Il lui reste alors :
- le NAT vers Internet ;
- le réseau local (box, imprimantes, autres PC) ;
- l'adresse de l'hôte sur le réseau local ;
- éventuellement 10.0.2.2, si l'option était inefficace.

En revanche, `orch-adm` reste protégé par le pare-feu Windows (section 4).

**Filtrage complémentaire côté Windows :**
- Le pare-feu identifie une application par **le chemin complet de son exécutable** [DOC, paramètre `-Program`].
- Le processus qui émet le trafic NAT n'est **pas documenté** dans les passages lus. Je **suppose** qu'il s'agit du processus de la VM : `VBoxHeadless.exe` en mode sans affichage, ou `VirtualBoxVM.exe` avec affichage [SUPPOSÉ].
- **Je ne prétends pas qu'une règle sur ce programme fonctionne** : le test T-NAT-WIN mesure le processus réel, avant et après une règle de blocage vers les plages privées.
- **Limite probable :** le trafic vers 127.0.0.1 (cible de 10.0.2.2) passe par la boucle locale, que le pare-feu Windows ne filtre généralement pas [SUPPOSÉ]. Pour 10.0.2.2, on s'appuie donc sur l'option VirtualBox et sur nftables, et le test T-NAT-01 le vérifie.

**Si le filtrage Windows ne peut pas être garanti (échec de T-NAT-WIN), le risque est le suivant :** une passerelle compromise donne un accès au réseau local. Trois solutions de repli :
1. **Supprimer le NAT de la passerelle.** Le proxy amont serait alors un petit programme de l'orchestrateur sur l'hôte, à l'écoute sur 192.168.61.1, qui n'accepte que `CONNECT` vers la liste blanche. Ce programme aurait un chemin fixe, avec une règle sortante Windows qui bloque les plages privées.
   - **Avantage :** le réseau local n'est plus joignable depuis les VM.
   - **Inconvénient :** un service exposé sur l'hôte et un analyseur réseau sur l'hôte. Cela ouvre l'interface d'administration en entrée sur un seul port, depuis une seule adresse.
2. **Une passerelle matérielle dédiée** sur un segment de réseau séparé. C'est la solution la plus robuste, mais elle a un coût.
3. **Accepter le risque**, en vous l'expliquant clairement. **Je ne le recommande pas** pour des agents autonomes.

---

## 3. Schéma et matrice de communication

```
                                   INTERNET
                                      ▲ TCP 443 + DNS 10.0.2.3, compte proxy uniquement
                                      │ NAT VirtualBox, --nat-localhostreachable1=off
┌──────────────────── HÔTE WINDOWS (corrigé) ──────────────────────────────────────┐
│ Orchestrateur : VBoxManage.exe, ssh.exe, powershell.exe (contrôles de dérive)    │
│ Pare-feu A et B : ENTRANT bloqué (IPv4 et IPv6) ;                                 │
│                   SORTANT limité à TCP 22 vers .10                                │
│ [option à prouver] blocage du processus VM vers les plages privées               │
│  A 192.168.60.1                                          B 192.168.61.1          │
└────┬─────────────────────────────────────────────────────────────┬───────────────┘
     │ orch-ctl : SSH hôte → .10:22                                 │ orch-adm : SSH hôte → .10:22
┌────▼──────── VM AGENTS ──────────────┐            ┌──────────────▼─── VM PASSERELLE ──┐
│ ctl0 .60.10 sshd → gate               │            │ adm0 .61.10 sshd (admin)          │
│ int0 10.66.0.2                        │───────────►│ int0 10.66.0.1 squid :3128 :3129  │
│ disque système IMMUABLE               │  orch-int  │ nat0 10.0.2.15 → NAT              │
│ disque identifiants WRITE-THROUGH     │            │ pas de routage, journaux          │
│ unités systemd orch-sup / orch-exec   │            └───────────────────────────────────┘
└───────────────────────────────────────┘
```

| N° | Source → Destination | Réseau | Protocole / port | Autorisé | Assuré par |
|---|---|---|---|---|---|
| 1 | Hôte → 192.168.60.10 | ctl | TCP 22 | Oui | Pare-feu Windows (sortant), nft de l'agent, sshd |
| 2 | Hôte → toute autre adresse de ctl | ctl | Tous | **Non** | Pare-feu Windows sortant [TEST T-FW-OUT] |
| 3 | Hôte → 192.168.61.10 | adm | TCP 22 | Oui | Idem, sur adm |
| 4 | VM agents → hôte | ctl | Tous, IPv4 et IPv6 | **Non** | Pare-feu Windows entrant [TEST T-NET-01/02] ; nft de l'agent |
| 5 | Passerelle → hôte | adm | Tous, IPv4 et IPv6 | **Non** | Pare-feu Windows entrant ; nft de la passerelle |
| 6 | `sup` → 10.66.0.1:3128 | int | TCP | Oui | `IPAddressAllow` de l'unité, nft par compte, nft de la passerelle |
| 7 | `exec` → 10.66.0.1:3129 | int | TCP | Oui | Idem |
| 8 | VM agents → passerelle, autres ports | int | — | **Non** | nft de la passerelle ; sshd limité à adm0 |
| 9 | Passerelle → VM agents, connexion initiée | int | — | **Non** | nft de l'agent (connexions établies uniquement) |
| 10 | VM agents → adm | — | — | **Impossible** | Configuration (aucune carte) ; pas de routage Windows [TEST] |
| 11 | Passerelle → ctl | — | — | **Impossible** | Configuration |
| 12 | VM agents → Internet ou NAT | — | — | **Impossible** | Configuration |
| 13 | Proxy → Internet | NAT | TCP 443 | Liste blanche | squid et nft de la passerelle |
| 14 | Passerelle → 10.0.2.2, adresse locale de l'hôte, plages privées | NAT | Tous | **Non** | Option `off`, nft ; Windows à prouver [TEST T-NAT-01/02/WIN] |
| 15 | Réseau local → VM | — | — | Impossible | Pas de pont, pas de redirection de port |

**Chemins de contournement :**
1. Faille de l'hyperviseur.
2. **Passerelle compromise, puis réseau local** (section 2).
3. IPv6 si le pare-feu est mal appliqué.
4. Dérive de configuration : adaptateur renommé, routage activé (section 4).
5. Exfiltration vers les domaines autorisés.
6. Persistance malveillante via le disque d'identifiants.
7. Redémarrage depuis l'intérieur de la VM sans extinction.
8. Bogues des validateurs de l'hôte.
9. Erreur humaine pendant la maintenance.
10. Accès de l'agent au bus D-Bus de systemd (section 5).

**Ce qui est garanti par la configuration de VirtualBox**, vérifiable par `showvminfo` :
- les réseaux auxquels chaque VM est reliée ;
- l'invisibilité du réseau interne pour l'hôte [DOC] ;
- les canaux d'intégration désactivés [DOC pour les options] ;
- les types de disque [DOC].

**Ce qui repose sur des règles à prouver :** tout le reste du tableau.

---

## 4. Règles de pare-feu Windows corrigées

Elles ne seront appliquées qu'en 0B.4, par vous, en console administrateur. **Aucune règle existante ne doit être modifiée**, il s'agit seulement d'ajouts.

**Ce que dit la documentation [DOC] :**
- une règle de blocage l'emporte sur une règle d'autorisation, aussi bien en entrée qu'en sortie ;
- `-RemoteAddress` accepte des adresses, sous-réseaux et plages IPv4 et IPv6 ;
- `-RemotePort` accepte un port ou une plage `0-65535` ;
- `-Protocol` accepte TCP, UDP, ICMPv4, ICMPv6 ou un numéro de 0 à 255.

Comme un blocage l'emporte toujours, on n'autorise pas le port 22 : on **bloque tout le reste**.

```powershell
# Noms réels relevés en 0B.4 avec Get-NetAdapter ; GUID d'interface enregistrés pour la détection de dérive
$ctl = '<alias adaptateur A>' ; $adm = '<alias adaptateur B>'
$V6  = '::-ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff'
function Add-OrchRules($alias, $target, $lo, $hi) {
  # 1) Entrant : tout bloquer (aucun filtre d'adresse : couvre IPv4 et IPv6 [DÉDUIT])
  New-NetFirewallRule -DisplayName "ORCH-$alias-IN-ALL"   -Direction Inbound  -InterfaceAlias $alias -Action Block -Profile Any
  # 2) Sortant IPv4 : toute adresse sauf la VM attendue
  New-NetFirewallRule -DisplayName "ORCH-$alias-OUT-V4AUTRES" -Direction Outbound -InterfaceAlias $alias -Action Block -Profile Any -RemoteAddress "0.0.0.0-$lo","$hi-255.255.255.255"
  # 3) Sortant vers la VM : TCP sauf 22, UDP, ICMPv4
  New-NetFirewallRule -DisplayName "ORCH-$alias-OUT-TCP-HORS22" -Direction Outbound -InterfaceAlias $alias -Action Block -Profile Any -Protocol TCP -RemoteAddress $target -RemotePort '0-21','23-65535'
  New-NetFirewallRule -DisplayName "ORCH-$alias-OUT-UDP"   -Direction Outbound -InterfaceAlias $alias -Action Block -Profile Any -Protocol UDP    -RemoteAddress $target
  New-NetFirewallRule -DisplayName "ORCH-$alias-OUT-ICMP4" -Direction Outbound -InterfaceAlias $alias -Action Block -Profile Any -Protocol ICMPv4 -RemoteAddress $target
  # 4) Sortant IPv6 : tout bloquer (IPv6 reste lié, mais inutilisable sur cette interface)
  New-NetFirewallRule -DisplayName "ORCH-$alias-OUT-V6"    -Direction Outbound -InterfaceAlias $alias -Action Block -Profile Any -RemoteAddress $V6
}
Add-OrchRules $ctl '192.168.60.10' '192.168.60.9' '192.168.60.11'
Add-OrchRules $adm '192.168.61.10' '192.168.61.9' '192.168.61.11'
```

**Choix pour IPv6.** Microsoft écrit : « *nous ne recommandons pas* […] de dissocier IPv6 des interfaces » sans besoin justifiable, et précise qu'une dissociation peut aboutir à une configuration Windows non prise en charge [DOC]. **IPv6 reste donc lié**, et il est neutralisé par les règles 1 et 4 [TEST T-NET-02]. Le blocage de la règle 4 bloque aussi la découverte de voisins IPv6 (ND) sortante sur ces interfaces, ce qui est voulu : IPv6 n'y est pas utilisé.

**Ce que ces règles ne couvrent pas :**
- Les protocoles IP autres que TCP, UDP et ICMP vers la VM ne sont pas bloqués en sortie, faute de pouvoir exprimer « tout sauf TCP » [DÉDUIT]. Le risque est faible, car ce trafic serait initié par l'hôte.
- Aucune règle ne limite *quel programme* de l'hôte peut ouvrir le port 22.
- **Le comportement à états** (réponses SSH acceptées malgré la règle 1) n'est pas documenté dans les pages lues [SUPPOSÉ]. Le test T-NET-03 est **décisif**.

**Mesures complémentaires :**
- désactiver le serveur DHCP de VirtualBox sur A et B ;
- désactiver NetBIOS sur A et B ;
- ne pas lier « Partage de fichiers » ni « Client SMB » sur A et B. C'est facultatif, mais cela n'entre pas dans l'avertissement de Microsoft, qui porte sur IPv6.

**Détection de dérive.** Avant **chaque** démarrage d'une VM, l'orchestrateur lance un script de contrôle. Ce script fait partie du harnais, son empreinte est vérifiée, et il est exécuté avec `powershell.exe -NoProfile -NonInteractive -File <script>` (lecture seule). Il vérifie :
1. les adaptateurs A et B, identifiés par leur **GUID** : alias, description et numéro d'interface identiques aux valeurs enregistrées ;
2. **aucun autre** adaptateur host-only VirtualBox ;
3. leurs adresses IPv4 exactes (.1/24), sans autre adresse IPv4 ;
4. le jeu exact de règles `ORCH-*` : toutes présentes, activées, en blocage, profil Any, avec les bons filtres d'interface, d'adresse et de port. Une exportation canonique est comparée par empreinte ;
5. les trois profils du pare-feu activés, avec le blocage entrant par défaut ;
6. `Forwarding` à `Disabled` sur **toutes** les interfaces (`Get-NetIPInterface`) ;
7. avec `VBoxManage showvminfo --machinereadable` et `list hostonlyifs` / `list dhcpservers`, une configuration des VM **identique** à la référence : cartes, réseaux, DHCP désactivé, presse-papiers, glisser-déposer, USB, son, VRDE, ports série, dossiers partagés, types de disque, `natlocalhostreachable` [SUPPOSÉ : nom exact de la clé à relever].

**Au moindre écart, l'orchestrateur refuse de démarrer les agents**, journalise l'écart et vous prévient. Le contrôle est refait **après** chaque tâche, ce qui ne détecte qu'a posteriori une dérive survenue pendant la tâche.

---

## 5. Confinement systemd de référence

Les agents tournent dans des unités transitoires lancées par `systemd-run`. Les propriétés listées seront vérifiées dans la page de manuel de **la version de systemd installée** : la documentation lue est la version « latest », et Debian stable peut être plus ancienne [SUPPOSÉ].

**Unité `exec`** (forme `.service`, pour la lecture ; `<id>` est l'identifiant validé) :
```ini
[Service]
Type=exec
User=exec
Group=exec
WorkingDirectory=/srv/ws/<id>
ExecStart=/usr/local/lib/orch/exec-launch            # root:root 0755, voir section 8
UMask=0077
# Ressources [DOC resource-control]
MemoryHigh=3G
MemoryMax=4G
MemorySwapMax=0
TasksMax=256
CPUQuota=200%
RuntimeMaxSec=900                                     # systemd.service [SUPPOSÉ, page non relue]
# Réseau [DOC resource-control / exec]
IPAddressDeny=any
IPAddressAllow=10.66.0.1/32
RestrictAddressFamilies=AF_INET                      # AF_UNIX exclu si Claude fonctionne sans [TEST]
# Privilèges [DOC exec]
NoNewPrivileges=yes
CapabilityBoundingSet=
AmbientCapabilities=
RestrictSUIDSGID=yes
LockPersonality=yes
RestrictRealtime=yes
KeyringMode=private
# Fichiers [DOC exec]
ProtectSystem=strict
ProtectHome=tmpfs
PrivateTmp=yes
TemporaryFileSystem=/srv:ro
BindPaths=/srv/ws/<id>                                # seul dossier de projet visible [SUPPOSÉ : création du point de montage]
InaccessiblePaths=/var/lib/orch-cred /var/spool/orch-gate /var/log/orch /etc/ssh /run/dbus /run/systemd/private
RuntimeDirectory=orch-exec-<id>                       # HOME et CLAUDE_CONFIG_DIR temporaires [SUPPOSÉ]
# Périphériques [DOC exec]
PrivateDevices=yes                                    # implique DevicePolicy=closed
# Noyau et processus [DOC exec]
ProtectKernelTunables=yes
ProtectKernelModules=yes
ProtectKernelLogs=yes
ProtectControlGroups=yes
ProtectClock=yes
ProtectHostname=yes
ProtectProc=invisible
PrivateIPC=yes
# Espaces de noms et appels système [DOC exec]
RestrictNamespaces=yes
SystemCallArchitectures=native
SystemCallFilter=@system-service
SystemCallErrorNumber=EPERM
# Identifiants [DOC exec]
LoadCredential=claude_token:/var/lib/orch-cred/exec/claude_token
UnsetEnvironment=ANTHROPIC_API_KEY ANTHROPIC_AUTH_TOKEN ANTHROPIC_BASE_URL CLAUDE_CODE_USE_BEDROCK CLAUDE_CODE_USE_VERTEX CLAUDE_CODE_USE_FOUNDRY
Environment=HTTPS_PROXY=http://10.66.0.1:3129 HOME=/run/orch-exec-<id> CLAUDE_CONFIG_DIR=/run/orch-exec-<id>/cfg DISABLE_AUTOUPDATER=1
```

**Propriétés écartées :**
- `MemoryDenyWriteExecute`, **incompatible avec les moteurs JIT** comme Node et V8 [DOC] ;
- `PrivateNetwork`, car l'agent a besoin du proxy ;
- `ProcSubset=pid`, qui casse des interfaces utilisées par de nombreux programmes [DOC]. À tester avant de l'ajouter ;
- `PrivateUsers`, inutile ici car `RestrictNamespaces` bloque la création d'espaces de noms.

**Unité `sup`** : identique, avec ces différences :
- `User=sup` ;
- **pas de `BindPaths`** : aucun projet visible, `/srv` est vide en lecture seule ;
- `Environment=HTTPS_PROXY=http://10.66.0.1:3128`, `CODEX_HOME=/run/orch-sup-<id>/codex` ;
- `LoadCredential=codex_auth:/var/lib/orch-cred/sup/auth.json` ;
- `RuntimeDirectoryPreserve=yes`, pour recopier `auth.json` après l'exécution [SUPPOSÉ] ;
- `InaccessiblePaths` couvre aussi `/srv/ws`.

**Limites et dépendances [DOC sauf mention] :**

| Propriété | Limite |
|---|---|
| `IPAddressAllow` / `IPAddressDeny` | **Sans effet** si le noyau n'a pas le support eBPF des cgroups |
| `RestrictNamespaces`, `SystemCallFilter` | Appliqués seulement sur certaines architectures, dont x86-64 |
| `RestrictAddressFamilies` | Ne concerne que `socket()` ; les sockets hérités, `socketpair()` et io_uring ne sont pas touchés |
| `ProtectSystem` | Ne garantit pas la protection dans tous les cas |
| `ProtectHome` | Ne protège pas les dossiers personnels non standard |
| `ProtectProc` | Sans effet sur un noyau sans `hidepid` par montage |
| `ProtectControlGroups` | Les valeurs avancées demandent la hiérarchie unifiée (cgroup v2) |
| `NoNewPrivileges` | Ne s'applique pas aux processus lancés à la demande par d'autres services (`at`, `crontab`, `systemd-run`) : **c'est pourquoi D-Bus et le socket privé de systemd sont rendus inaccessibles**, et `at` et `cron` ne sont pas installés [DÉDUIT] |
| `Environment=` | **Ne convient pas aux secrets** : visible des clients non privilégiés via D-Bus. D'où `LoadCredential` |
| `$CREDENTIALS_DIRECTORY` | Lisible seulement par l'utilisateur de l'unité et par root ; en mémoire non échangeable « quand c'est possible » |

**Garanties visées et test associé :**

| Garantie | Propriétés | Test |
|---|---|---|
| `exec` ne lit pas les fichiers de `sup`, et inversement | Comptes distincts, 0700, `InaccessiblePaths`, `ProtectProc=invisible`, `ProtectHome=tmpfs` | T-SYSD-X |
| Aucun agent ne modifie le système | `ProtectSystem=strict`, `CapabilityBoundingSet=`, `NoNewPrivileges`, `RestrictSUIDSGID` | T-SYSD-RO |
| Chaque agent n'accède qu'à son espace de travail | `TemporaryFileSystem=/srv:ro` et `BindPaths` | T-SYSD-WS |
| Aucun accès aux journaux ni aux fichiers de l'orchestrateur | `InaccessiblePaths` | T-SYSD-LOG |
| Réseau limité au proxy | `IPAddressAllow`, `RestrictAddressFamilies`, nft | T-SYSD-NET (vérifie aussi le support eBPF) |
| Pas de nouveaux espaces de noms, pas de nouveaux appels système | `RestrictNamespaces`, `SystemCallFilter` | T-SYSD-NS |
| Pas d'accès aux périphériques | `PrivateDevices` | T-SYSD-DEV |
| Pas de lancement via systemd ou D-Bus | `InaccessiblePaths=/run/dbus …` | T-SYSD-DBUS |

---

## 6. `orch-gate`, `orch-priv` et les archives

### Grammaire SSH

`orch-gate` est écrit en Python et lancé avec `python3 -I`. Il utilise `re.fullmatch`, **et non `$`**, qui accepte un retour à la ligne final. La commande est découpée sur un espace ASCII unique.

| Commande | Forme exacte | Entrée standard |
|---|---|---|
| `put-task` | `put-task <ID>` | Archive tar, ≤ 20 Mo |
| `run-sup` | `run-sup <ID>` | Instructions UTF-8 valides, ≤ 256 Ko |
| `run-exec` | `run-exec <ID>` | Idem |
| `get-result` | `get-result <ID>` | **Doit être vide** |
| `kill` | `kill <ID>` | Doit être vide |
| `status` | `status`, **sans identifiant** | Doit être vide |

`<ID>` vaut `[a-z0-9]{16}`, généré par l'hôte. **Tout le reste est refusé**, en particulier :
- un verbe sans identifiant, ou `status` suivi d'un identifiant ;
- plusieurs espaces, une tabulation, un retour à la ligne ;
- des majuscules, de l'Unicode ;
- plus de 64 octets ;
- une commande absente (tentative de session interactive).

**Contrôles complémentaires :**
- `SSH_CONNECTION` doit venir de 192.168.60.1, en plus de `from=` ;
- **machine à états par identifiant :**
  - `put-task` seulement pour un identifiant inconnu ;
  - `run-*` seulement après un `put-task` réussi, sans exécution en cours ;
  - au plus N `run-sup` et 2 `run-exec` ;
  - `get-result` seulement après la fin de `run-exec`, quand l'unité est vide ;
- un verrou exclusif : une seule commande à la fois ;
- des délais maximaux ;
- un journal de chaque commande, après nettoyage des caractères de contrôle.

**`SSH_ORIGINAL_COMMAND` n'est jamais transmis à un shell.** sshd exécute la commande imposée « à travers le shell de connexion de l'utilisateur avec `-c` » et place la commande du client dans `SSH_ORIGINAL_COMMAND` [DOC sshd_config]. La commande imposée est un chemin fixe, sans argument.

### Configuration de sshd [DOC sshd_config]

```
Match User gate
  ForceCommand /usr/local/sbin/orch-gate
  DisableForwarding yes
  PermitTTY no
  PermitTunnel no
  PermitUserEnvironment no
```

Avec en plus :
- `AllowUsers gate` ;
- `ListenAddress 192.168.60.10` ;
- authentification par mot de passe et clavier-interactif désactivées ;
- `AuthorizedKeysFile /etc/ssh/authorized_keys/%u`, appartenant à root, en 0644 ;
- `StrictModes yes` : sshd vérifie les droits et le propriétaire du dossier personnel et des fichiers de clés [DOC] ;
- `AcceptEnv` vide : c'est la valeur par défaut [DOC] ;
- clé déclarée avec `from="192.168.60.1",restrict,command="/usr/local/sbin/orch-gate"`.

### Propriété des fichiers [TEST T-PERM]

- `/usr/local/sbin/orch-gate`, `/usr/local/sbin/orch-priv` et `/usr/local/lib/orch/*` : root:root, 0755 ou moins, non modifiables par `gate`.
- **Tous les dossiers parents** (`/`, `/usr`, `/usr/local`, `/usr/local/sbin`, `/usr/local/lib`, `/usr/local/lib/orch`) appartiennent à root et ne sont pas modifiables par le groupe ni par les autres. C'est la configuration par défaut de Debian [DÉDUIT], vérifiée avec `namei -l` et `find -perm`.

### sudoers [DOC]

La documentation officielle confirme que si les arguments se réduisent à `""`, « la commande ne peut être lancée que *sans* argument ». `env_reset` est actif par défaut et donne « un environnement nouveau et minimal ». Configuration :

```
Defaults:gate env_reset, secure_path="/usr/sbin:/usr/bin:/sbin:/bin"
gate ALL=(root) NOPASSWD: /usr/local/sbin/orch-priv ""
```

### `orch-priv`, le seul code exécuté en root

- Lancé avec `python3 -I`, sans `shell=True`.
- Il lit **au plus 4 Ko** de JSON sur l'entrée standard. Les clés en double sont refusées. Le jeu de clés est exact pour chaque verbe : types fixes, valeurs comparées à une expression stricte, aucune clé en plus.
- Verbes : `prepare`, `run`, `kill`, `collect`, `status` (comme en v3). Chacun ne lance que des commandes à arguments fixes, construits à partir de l'identifiant validé.
- Pour lire les fichiers déposés par `gate`, root **ouvre le fichier avec `O_NOFOLLOW`** puis vérifie avec `fstat` que c'est un fichier ordinaire, appartenant à `gate`, de taille limitée. Il **passe ensuite le descripteur** à l'extracteur. L'extracteur n'a ainsi jamais accès au dossier de dépôt de `gate`, et un lien piégé déposé par `gate` ne peut pas être suivi.

**Aucune commande arbitraire n'est possible :** aucune donnée reçue n'arrive dans une ligne de commande, un shell ou un chemin non validé.

### Archives entrantes : extraction sous l'identité `exec`

1. `orch-priv` (root) crée `/srv/ws/<id>.tmp-<aléa>` en **création exclusive**, avec le propriétaire `exec:exec` et les droits 0700. `/srv/ws` appartient à root en 0711.
2. **L'analyse et l'extraction tournent sous `exec`**, dans une unité transitoire confinée : `User=exec`, `PrivateNetwork=yes`, `ProtectSystem=strict`, `ReadWritePaths=` limité au dossier temporaire, `MemoryMax=512M`, `TasksMax=16`, `RuntimeMaxSec=60`, avec les mêmes protections que la section 5. L'archive arrive par l'entrée standard.
3. L'extracteur lit l'archive en flux (`tarfile`, mode `r|`) et applique les règles suivantes :
   - **types :** seulement les fichiers ordinaires et les dossiers. Liens symboliques, liens physiques, fichiers spéciaux, en-têtes PAX globaux et fichiers épars sont refusés ;
   - **noms :** UTF-8 déjà normalisé NFC, sans caractère nul, `\` ni `/` initial, sans composant vide, `.` ou `..` ;
   - **longueurs :** au plus 100 octets par composant et 200 par chemin ;
   - **doublons :** un **même nom, ou un nom égal après passage en minuscules et normalisation NFC, est refusé**. Une archive tar peut contenir deux fois le même nom, et le second écrase le premier : c'est une technique d'attaque connue ;
   - **limites :** au plus 5 000 entrées, 5 Mo par fichier et 50 Mo au total ;
   - **écriture :** par descripteur de dossier, avec `O_CREAT|O_EXCL|O_NOFOLLOW`. Fichiers en 0600, dossiers en 0700. Les droits, propriétaires et dates de l'archive sont ignorés ;
   - **filet de sécurité :** le filtre `data` de `tarfile` est appliqué en plus [DOC]. La documentation Python précise qu'*aucun filtre ne bloque toutes les fonctionnalités dangereuses* et que le filtre `data` n'empêche pas le déni de service [DOC]. D'où les limites ci-dessus.
4. **En cas d'erreur :**
   - l'extracteur s'arrête avec un code d'erreur et la tâche est marquée en échec ;
   - le dossier temporaire est supprimé **sous `exec`**, dans une unité confinée, avec `shutil.rmtree`, conçu pour résister aux attaques par liens symboliques [SUPPOSÉ : doc `shutil` à relire] ;
   - **en tout état de cause**, il disparaît au démarrage suivant, puisqu'il se trouve sur le disque immuable.
5. **En cas de succès :** root renomme le dossier temporaire en `/srv/ws/<id>`, ce qui est une opération atomique.

### Archives revenant sur Windows (orchestrateur Node)

**Réception et analyse :**
- L'archive est reçue dans un **dossier de quarantaine neuf** : `%LOCALAPPDATA%\orch-ia\quarantaine\<id>\`, créé en mode exclusif. Ses parents sont vérifiés : pas de point de réanalyse, chemin réel attendu.
- Elle est analysée par un **lecteur ustar minimal écrit pour l'orchestrateur**. On n'utilise jamais `tar.exe`, `Expand-Archive` ni un outil d'archivage.
- Seuls les fichiers ordinaires et les dossiers sont acceptés, sans en-têtes PAX ni noms longs GNU, avec des noms de 100 octets au plus.

**Contrôles sur les noms :**
- pas de `..` ni de `.` ;
- pas de chemin absolu : `/` ou `\` initial, lettre de lecteur, préfixe `\\?\` ou `\\.\` ;
- **aucune barre oblique inversée `\` dans un nom** : elle est valide sous Linux mais devient un séparateur sous Windows ;
- pas de `:` (flux alternatifs NTFS et lettres de lecteur) ;
- pas de caractère `< > " | ? *` ni de caractère de 0 à 31 [DOC] ;
- **pas de nom réservé** : CON, PRN, AUX, NUL, COM0 à COM9, COM¹, COM², COM³, LPT0 à LPT9, LPT¹, LPT², LPT³, avec ou sans extension, sans tenir compte de la casse [DOC] ;
- pas de point ni d'espace final [DOC] ;
- **collisions de casse** et **équivalences Unicode** : les noms doivent être déjà en NFC, et deux noms identiques après normalisation NFC et passage en majuscules sont refusés ;
- les noms qui ressemblent à des **alias courts 8.3** (par exemple `NOM~1`) sont refusés [DOC : ces alias existent] ;
- **doublons** refusés ;
- longueur limitée à 200 caractères en relatif et **moins de 260** en absolu (`MAX_PATH`) [DOC] ;
- **liste exacte des fichiers autorisés** pour la tâche.

**Extraction.** Une vérification préalable des noms ne suffit pas, donc l'extraction elle-même est sûre :
- chaque dossier est créé **un par un**, sans création récursive, en mode exclusif ;
- après chaque création, l'orchestrateur vérifie avec `lstat` et `realpath` que c'est un vrai dossier, au chemin attendu, et non un point de réanalyse ;
- chaque fichier est créé avec le **drapeau `wx`** (création exclusive), qui échoue si **quoi que ce soit** existe déjà à ce chemin, y compris un lien [DÉDUIT] ;
- comme le dossier de quarantaine est neuf et que l'orchestrateur crée lui-même chaque élément, **aucun lien ne peut préexister**, sauf action d'un autre processus de votre compte : l'hôte est considéré comme de confiance ;
- on vérifie ensuite le résultat (comme en 0A), puis vous validez, puis une nouvelle version est copiée en mode `wx`.

**Rien n'est jamais ouvert ni exécuté.**

---

## 7. Arrêt et persistance

### Arrêt normal

Commandes prévues, non exécutées :
```
VBoxManage controlvm orch-agents acpipowerbutton            # « envoie un signal ACPI d'arrêt » [DOC]
# boucle : toutes les 2 s, au plus 120 s
VBoxManage showvminfo orch-agents --machinereadable          # attendre VMState="poweroff" [SUPPOSÉ : nom et valeurs à relever en 0B.6]
```

Déroulé :
1. `collect` doit être terminé **avant** l'arrêt, et l'unité de l'agent doit être vide.
2. Debian traite le bouton ACPI : `systemd-logind` lance l'extinction [SUPPOSÉ] [TEST T-PERS-ACPI].
3. Si l'état est `poweroff`, l'arrêt est normal.
4. Si l'état est **`saved`**, l'orchestrateur **refuse** de redémarrer la VM et prévient un humain. VirtualBox ne réinitialise pas le disque immuable depuis un état sauvegardé [DOC]. L'action humaine prévue est `VBoxManage discardstate`, suivie d'une vérification [SUPPOSÉ].
5. Si l'état est **`aborted`** ou si le délai est dépassé : incident.

**Coupure d'urgence uniquement :** `VBoxManage controlvm orch-agents poweroff`. Elle ne sauvegarde pas l'état et peut faire perdre des données [DOC]. La tâche est alors marquée « arrêt d'urgence », ses résultats ne sont pas validés, et le jeton est vérifié au cycle suivant.

**Attention :** un root compromis dans la VM peut ignorer le signal ACPI. Le dépassement de délai déclenche alors la coupure d'urgence.

### Réinitialisation du disque immuable

Ce que dit la documentation [DOC] :
- les écritures vont dans une image de différences, effacée **à chaque démarrage lancé par VirtualBox** ;
- elle ne l'est pas après un redémarrage depuis l'intérieur de la VM, ni depuis un état sauvegardé, ni avec un snapshot pris machine allumée ;
- `modifymedium --autoreset` contrôle ce comportement.

Vérifications à chaque cycle :
- `showmediuminfo` doit indiquer le type immuable avec la réinitialisation automatique active [SUPPOSÉ : noms des champs à relever] ;
- à la fin de chaque tâche, root écrit un **témoin aléatoire** dans `/etc` et `/var`. Au démarrage suivant, `status` vérifie que ces témoins **ont disparu** et que l'identifiant de démarrage (`boot_id`) a changé. Sinon, l'orchestrateur refuse de continuer [TEST T-PERS-ACPI].

### Persistance

Inchangée depuis la v3 :
- disque système immuable ;
- données du projet uniquement sur l'hôte, en versions validées ;
- identifiants sur un disque write-through, que les snapshots ne touchent pas [DOC] ;
- dossier de configuration neuf à chaque exécution, avec une synchronisation validée du seul fichier d'identifiants.

---

## 8. Gestion des identifiants

### Claude Code [DOC, documentation d'authentification]

- `claude setup-token` produit un **jeton OAuth valable un an**. La commande **ne l'enregistre nulle part** : il faut le copier.
- Il s'utilise avec `CLAUDE_CODE_OAUTH_TOKEN`.
- Il exige un abonnement **Pro, Max, Ultra, Team ou Enterprise**.
- Il « ne peut faire que des requêtes au modèle » : pas de contrôle à distance ni de connecteurs claude.ai. Les serveurs MCP locaux fonctionnent toujours.
- Le **mode `--bare` ne lit pas** cette variable. Notre harnais n'utilise pas `--bare`.
- **Priorité :** `CLAUDE_CODE_OAUTH_TOKEN` passe **après** `ANTHROPIC_AUTH_TOKEN`, `ANTHROPIC_API_KEY` et `apiKeyHelper`. D'où `UnsetEnvironment`, et un `settings.json` sans `apiKeyHelper`.
- **Renouvellement :** générer un nouveau jeton avant l'échéance [DÉDUIT].
- **Révocation :** la page lue **ne décrit pas** comment révoquer un jeton `setup-token` (`/logout` concerne la connexion par `/login`). **Point ouvert bloquant** avant tout appel réel : trouver la procédure officielle.

**Lanceur `exec-launch`** (root:root 0755, exécuté sous `exec`) :
1. lit `$CREDENTIALS_DIRECTORY/claude_token`, lisible seulement par `exec` et root [DOC] ;
2. vérifie le format du jeton ;
3. le place dans **son propre** environnement ;
4. lance `claude` avec les arguments fixes de 0A, avec `execve`.

Le jeton n'apparaît ainsi :
- ni dans les propriétés de l'unité (pas d'`Environment=`) [DOC] ;
- ni dans une ligne de commande ;
- ni dans un fichier persistant ;
- ni dans les journaux : le lanceur n'écrit rien sur sa sortie et l'orchestrateur masque tout motif de jeton dans les flux.

**Limite :** l'environnement d'un processus reste lisible par **son propre utilisateur** et par root [DÉDUIT de Linux]. `sup` ne le voit pas, grâce à `ProtectProc=invisible` et à un compte distinct.

### Codex [DOC, documentation d'authentification]

- Les identifiants sont stockés « en clair dans `~/.codex/auth.json` » (sous `CODEX_HOME`) ou dans le trousseau du système.
- Option `cli_auth_credentials_store` : `file`, `keyring`, `auto` ou `ephemeral`. Ici : **`file`**, car il n'y a pas de trousseau dans la VM.
- Le renouvellement est automatique pendant l'usage.
- Sans navigateur : connexion par code (`codex login --device-auth`, en **bêta**), copie de `auth.json`, ou redirection de port.
- Pour l'automatisation, la documentation recommande de **laisser Codex renouveler `auth.json` puis de conserver le fichier mis à jour pour l'exécution suivante**. Elle précise aussi que **les clés API restent recommandées pour l'automatisation**, ce que nous excluons à cause du coût.
- « Traitez `auth.json` comme un mot de passe : il contient des jetons d'accès. »
- `codex logout` efface les identifiants locaux.
- **La rotation des jetons et la révocation côté serveur ne sont pas décrites** dans cette page : le **risque de rotation n'est pas résolu**.

**Persistance de `auth.json` :**
1. Root le copie dans le dossier d'exécution de l'unité.
2. `-c cli_auth_credentials_store="file"` est passé en argument [SUPPOSÉ : compatible avec `--ignore-user-config`].
3. Après l'exécution, root le valide (fichier ordinaire, JSON valide, taille limitée ; son schéma n'est pas documenté) puis le recopie sur le disque write-through.
4. **Jamais deux Codex en même temps.**

### Pour les deux agents

| Point | Claude (`setup-token`) | Codex (`auth.json`) |
|---|---|---|
| Droits documentés | Requêtes au modèle avec votre abonnement | « Jetons d'accès » du compte ChatGPT ; leur portée exacte **n'est pas documentée** |
| Risques réels en cas de vol | Utilisation de votre quota ; **facturation si l'usage supplémentaire payant est actif** ; abus attribués à votre compte ; usage des données envoyées | **Au pire**, actions avec votre compte ChatGPT au-delà de Codex [SUPPOSÉ] ; quota ; abus attribués à votre compte |
| Révocation | **À établir** (point bloquant) | `codex logout` (local) ; révocation serveur **à établir** (point bloquant), probablement par déconnexion des sessions du compte [SUPPOSÉ] |
| Lecture par l'autre agent | Impossible : comptes distincts, 0700, `$CREDENTIALS_DIRECTORY` réservé, `ProtectProc`, `InaccessiblePaths` | Idem |
| Absence dans les journaux | Masquage dans les flux ; jamais en argument ni dans une propriété d'unité | Idem |

**Recommandation :** utiliser des **comptes dédiés** aux agents, distincts de vos comptes personnels, si les conditions d'utilisation le permettent [SUPPOSÉ]. Dans tous les cas, désactiver l'usage supplémentaire payant.

---

## 9. Tests complets

**Aucun test n'a été exécuté.**

**Réactions de l'orchestrateur en cas d'échec :**
- **R1** : la phase est bloquée ; correction humaine, puis nouvelle batterie complète.
- **R2** : refus de démarrer les agents, au contrôle préalable.
- **R3** : coupure d'urgence, quarantaine, alerte humaine.

### Réseau

| Test | Préconditions | Procédure | Attendu | Échec si | Réaction |
|---|---|---|---|---|---|
| T-NET-01 | Règles actives, VM agents démarrée | Depuis la VM : balayage TCP et UDP de 1 à 65535 vers 192.168.60.1 | Aucune réponse | Un port répond | R1 |
| T-NET-02 | IPv6 lié côté hôte | Depuis la VM, en root pour le test : activer IPv6, envoyer `ping6` vers ff02::1 sur ctl0, découvrir les voisins, tenter des connexions vers l'adresse `fe80::` de l'hôte | Aucune réponse IPv6 de l'hôte | Une réponse | R1 |
| T-NET-03a | Règle « tout bloquer en entrée » active sur A | SSH de l'hôte vers 192.168.60.10:22 | Connexion réussie | Échec : la conception à états est infirmée | R1 (revue de conception) |
| T-NET-03b | Idem sur B | SSH de l'hôte vers 192.168.61.10:22 | Connexion réussie | Échec | R1 |
| T-FW-OUT | VM de test temporaire 192.168.60.11 sur ctl, sshd actif | SSH de l'hôte vers .11:22, puis vers .10:2222 | Les deux sont bloqués | L'un passe | R1 |
| T-NET-04/05 | — | VM agents vers 192.168.61.0/24 ; passerelle vers 192.168.60.0/24 | Injoignables | Une réponse | R1 |
| T-NET-06 | — | VM agents vers 10.66.0.1:22 et autres ports ; `sup` vers le port 3129, `exec` vers le port 3128 | Refusés | Un accès réussi | R1 |
| T-NET-07 | — | VM agents : Internet direct, DNS, ICMP, QUIC | Impossibles | Un accès réussi | R1 |
| T-NET-08 | Proxy actif | Domaine hors liste, adresse IP littérale, domaine autorisé sur le port 22, requête HTTP simple ; domaine autorisé sur le port 443 | Les quatre premiers refusés, le dernier accepté, tous journalisés | Écart | R1 |
| T-NET-12 | — | `Get-NetIPInterface` | `Forwarding = Disabled` partout | Une interface en `Enabled` | R2 |

### NAT

| Test | Préconditions | Procédure | Attendu | Échec si | Réaction |
|---|---|---|---|---|---|
| T-NAT-01 | `--nat-localhostreachable1=off` ; écouteur de test sur l'hôte en 127.0.0.1:50001 ; nft de la passerelle **désactivé pour le test** | Depuis la passerelle : connexion à 10.0.2.2:50001 | Refusée | Connexion établie | R1, option inefficace |
| T-NAT-02 | Écouteur de test sur l'adresse locale de l'hôte:50002 ; un autre appareil du réseau local ; nft actif | Passerelle vers l'adresse locale de l'hôte, vers le réseau local, vers 192.168.0.0/16 et 10/8 | Refusés par nft | Un accès réussi | R1 |
| T-NAT-03 | **Passerelle compromise simulée** : nft vidé par root | Refaire T-NAT-02, puis tenter adm (hôte) et ctl | adm et ctl bloqués par Windows ; **le réseau local est joignable** (risque documenté), sauf si T-NAT-WIN réussit | adm ou ctl joignable | R1 |
| T-NAT-WIN | Comme T-NAT-03 ; audit WFP activé par vous | Pendant une connexion de test : `Get-NetTCPConnection` → `OwningProcess` → chemin de l'exécutable ; règle de blocage sur ce chemin vers les plages privées ; refaire le test ; vérifier qu'Internet 443 fonctionne toujours | Processus identifié ; réseau local bloqué ; Internet intact | Processus non identifiable ou blocage inefficace | **Repli de la section 2** |

### Dérive de configuration

| Test | Préconditions | Procédure | Attendu | Échec si | Réaction |
|---|---|---|---|---|---|
| T-DRIFT-01 | Référence enregistrée | Renommer l'adaptateur A | Le contrôle préalable refuse le démarrage | Démarrage | R1 |
| T-DRIFT-02 à 06 | — | Changer l'IP ; désactiver une règle `ORCH-*` ; activer le routage ; ajouter un adaptateur host-only ; réactiver le presse-papiers d'une VM | Refus à chaque fois | Démarrage | R1 |

### SSH et privilèges

| Test | Préconditions | Procédure | Attendu | Échec si | Réaction |
|---|---|---|---|---|---|
| T-SSH-GRAM | `orch-gate` installé | Pour chaque verbe : sans identifiant, deux identifiants, majuscules, 15 ou 17 caractères, Unicode, tabulation, double espace, retour à la ligne final, `;`, `$(…)`, `status <ID>`, commande vide, 65 octets ; entrée non vide pour `status`, `get-result` et `kill` | Tous refusés et journalisés | Une commande acceptée | R1 |
| T-SSH-FWD | — | `ssh -t`, `-L`, `-R`, `-D`, `-s sftp`, `scp`, `-o SendEnv=X` | Refusés | Une réussite | R1 |
| T-PRIV | — | `sudo -l` sous `gate` ; `orch-priv` avec des arguments ; JSON invalide, clé en double, clé en trop, chemin à la place de l'identifiant ; deux exécutions simultanées ; dépôt d'un lien symbolique dans le dossier de `gate` | Refusés ; `O_NOFOLLOW` bloque le lien | Une réussite | R1 |
| T-PERM | — | `namei -l`, `stat` et `find -perm` sur les programmes et leurs parents | root, non modifiables par d'autres | Écart | R1 |

### Confinement systemd

| Test | Préconditions | Procédure | Attendu | Échec si | Réaction |
|---|---|---|---|---|---|
| T-SYSD-X | `sup` et `exec` lancés | Depuis chaque unité : lire `/var/lib/orch-cred/*`, `/run/orch-<autre>-*`, `/proc/<pid de l'autre>/environ`, la liste de `/proc` | Refusé ou invisible | Une lecture réussie | R1 |
| T-SYSD-RO / WS / LOG / DEV / NS / DBUS / NET | Unité de test avec la configuration de référence | Écrire dans `/etc`, `/usr`, `/srv/ws/<autre>`, `/var/log/orch` ; ouvrir `/dev/sda` ; `unshare -U` ; `mount` ; `busctl` et `systemd-run` ; `connect` vers 1.1.1.1 et 10.66.0.1:22 | Tout est refusé, sauf 10.66.0.1 sur le port prévu. **Le test réseau prouve aussi que `IPAddressDeny` est effectif** (support eBPF) | Une opération réussit | R1 |

### Archives

| Test | Préconditions | Procédure | Attendu | Échec si | Réaction |
|---|---|---|---|---|---|
| T-TAR-VM | Extracteur installé | Archives contenant un lien symbolique, un lien physique, `../`, un chemin absolu, un fichier spécial, un doublon exact, un doublon de casse, des noms NFC et NFD, 6 000 entrées, un fichier de 6 Mo ; **pendant l'extraction, `ps` doit montrer l'UID `exec`** | Toutes refusées ; extraction sous `exec` ; dossier temporaire absent après échec ou au démarrage suivant | Une archive acceptée ou une extraction sous root | R1 |
| T-TAR-WIN | Validateur de l'orchestrateur | Archives contenant `..`, `C:x`, `\`, `a:b`, `NUL.txt`, `COM¹`, un point final, un espace final, `A` et `a`, du NFC et du NFD, `NOM~1`, un chemin de 270 caractères, un doublon, un fichier hors de la liste autorisée | Toutes refusées ; rien n'est écrit hors de la quarantaine | Une acceptée | R1 |

### Persistance et identifiants

| Test | Préconditions | Procédure | Attendu | Échec si | Réaction |
|---|---|---|---|---|---|
| T-PERS-ACPI | Disque immuable | Écrire les témoins, envoyer le signal ACPI, attendre `poweroff`, redémarrer, puis `status` ; variante avec un redémarrage depuis l'intérieur de la VM ; variante avec `savestate` | Témoins absents après extinction ; le redémarrage interne est détecté comme « non terminé » ; l'état `saved` est refusé | Témoin présent ou démarrage depuis l'état `saved` | R3, puis R1 |
| T-PERS-CFG | — | Déposer `settings.json`, des hooks et `config.toml` sur le disque d'identifiants | Ignorés et signalés | Un fichier est pris en compte | R1 |
| T-CRED-RENEW | Connexions faites par vous en 0B.9 ; **aucune tâche de travail**, seulement `--version` ou un canari minimal autorisé séparément | 5 cycles complets (démarrage, exécution, extinction) sur plus de 24 h | Claude : jeton accepté à chaque cycle. Codex : `auth.json` mis à jour, persisté, accepté au cycle suivant | Reconnexion exigée ou erreur de réutilisation | R1, et revue de la stratégie |
| T-CRED-LEAK | — | Rechercher le jeton dans les journaux, `systemctl show`, `/proc/*/cmdline` et les fichiers persistants | Absent | Présent | R1, révocation |

Les tests T-DEV, T-DOS et T-INJ de la v3 sont conservés.

---

## 10. Risques résiduels

1. **Exfiltration vers les domaines autorisés**, y compris avec la clé d'un attaquant. Impossible à bloquer sans inspection TLS.
2. **Accès au réseau local en cas de compromission de la passerelle**, tant que T-NAT-WIN n'a pas réussi.
3. **Révocation des jetons non documentée** pour `setup-token` et pour la révocation serveur de Codex.
4. **Rotation des jetons de Codex non documentée.**
5. Sortie de machine virtuelle par une faille de l'hyperviseur.
6. Protections systemd dépendantes du noyau : eBPF, architecture, `hidepid`.
7. Bogues des validateurs de l'hôte.
8. Hôte Windows 10, à migrer avant le 12 octobre 2027.
9. Erreur humaine en maintenance.
10. Chaîne d'approvisionnement de l'image (npm, apt).

---

## 11. Plan d'exécution

**Chaque étape demande une autorisation distincte.**

| Étape | Contenu | Condition pour passer à la suite |
|---|---|---|
| 0B.1 | **Lecture seule** : contrôles de l'hôte (OS, mises à jour, processeur, mémoire, VBS, interfaces, routage) | Rapport de constats validé par vous |
| 0B.2 | Décisions écrites : ESU ou Windows 11, VBS, hyperviseur, comptes dédiés | Votre validation |
| P0 | Mise à jour de l'hôte, faite par vous | Hôte corrigé |
| 0B.3 | Installation de VirtualBox, par vous, avec `ADDLOCAL` minimal ; vérification de `--nat-localhostreachableN` | Option disponible |
| 0B.4 | Adaptateurs A et B, règles de la section 4, enregistrement de la référence | Contrôle de dérive à l'état « conforme » |
| 0B.5 | Passerelle | T-NET (partie passerelle), T-NAT-01 et 02 |
| 0B.6 | VM agents, **sans CLI d'agent** | T-NET complet, T-NET-03a et 03b, T-DEV, mesure des performances |
| 0B.7 | `orch-gate`, `orch-priv`, unités, extracteur | T-SSH, T-PRIV, T-PERM, T-SYSD, T-TAR |
| 0B.8 | Disque immuable, disque d'identifiants | T-PERS |
| 0B.9 | CLI et connexions faites par vous, **sans tâche de travail** ; liste blanche | T-CRED, procédure de révocation documentée |
| 0B.10 | Tests de compromission : T-NAT-03 et T-NAT-WIN | Choix : NAT avec Windows, ou repli |
| 0B.11 | Batterie complète et simulation 0A en mode VM | 100 % réussis |
| *0A.2* | *Appels réels* | ***Autorisation distincte*** après validation de la Phase 0B |

---

## Verdict

**GO conditionnel, limité à l'étape 0B.1** (vérifications en lecture seule).

**NO-GO pour toute installation** tant que les résultats de 0B.1 et les décisions de 0B.2 ne sont pas validés.

**NO-GO pour tout appel réel aux agents** tant que les points suivants ne sont pas démontrés par des tests réels :
1. comportement à états du pare-feu Windows (T-NET-03a et 03b) ;
2. efficacité de `IPAddressDeny`, qui dépend du support eBPF (T-SYSD-NET) ;
3. protection du réseau local en cas de passerelle compromise (T-NAT-WIN), ou mise en place de l'architecture de repli ;
4. procédures officielles de révocation des deux jetons ;
5. stabilité du renouvellement des identifiants (T-CRED-RENEW) ;
6. hôte à jour.

L'architecture est **cohérente et faisable**, mais plusieurs protections reposent encore sur des hypothèses. Une limite est **permanente** : l'exfiltration vers les domaines autorisés.

---

## Sources officielles

- [VirtualBox : `VBoxManage` (`--nat-localhostreachableN`, `controlvm acpipowerbutton`, `poweroff`, `savestate`, `modifymedium --type` et `--autoreset`)](https://www.virtualbox.org/manual/topics/vboxmanage.html)
- [VirtualBox : réseau virtuel](https://www.virtualbox.org/manual/topics/networkingdetails.html)
- [VirtualBox : stockage (immuable, write-through)](https://www.virtualbox.org/manual/topics/storage.html)
- [VirtualBox : installation (`ADDLOCAL`)](https://www.virtualbox.org/manual/topics/installation.html)
- [VirtualBox 7.2.2 : fonctionnement avec Hyper-V, manuel via les sources Debian](https://sources.debian.org/src/virtualbox/7.2.2-dfsg-2/doc/manual/en_US/dita/topics/hyperv-support.dita)
- [Microsoft : priorité des règles du pare-feu Windows](https://learn.microsoft.com/en-us/windows/security/operating-system-security/network-security/windows-firewall/rules)
- [Microsoft : `New-NetFirewallRule`](https://learn.microsoft.com/en-us/powershell/module/netsecurity/new-netfirewallrule)
- [Microsoft : configurer IPv6 (déconseille la dissociation)](https://learn.microsoft.com/en-us/troubleshoot/windows-server/networking/configure-ipv6-in-windows)
- [Microsoft : nommage des fichiers, chemins et espaces de noms](https://learn.microsoft.com/en-us/windows/win32/fileio/naming-a-file)
- [systemd.exec](https://www.freedesktop.org/software/systemd/man/latest/systemd.exec.html)
- [systemd.resource-control](https://www.freedesktop.org/software/systemd/man/latest/systemd.resource-control.html)
- [sudoers](https://www.sudo.ws/docs/man/sudoers.man/)
- [OpenSSH : `sshd_config(5)`](https://man.openbsd.org/sshd_config.5)
- [OpenSSH : `sshd(8)`](https://man.openbsd.org/sshd.8)
- [Python : `tarfile`](https://docs.python.org/3/library/tarfile.html)
- [Claude Code : authentification](https://code.claude.com/docs/en/authentication)
- [OpenAI Codex : authentification](https://learn.chatgpt.com/docs/auth)

**Sources secondaires de la v3 retirées :**
- le ticket minikube, remplacé par le résumé officiel de `VBoxManage` et par la décision de fixer l'option explicitement ;
- claudeissues et le blog laozhang, remplacés par les documentations officielles d'Anthropic et d'OpenAI.

Je m'arrête ici. Je ne lance aucune étape et je ne demande aucune autorisation d'installation.
