<!-- Rapport extrait de la session Claude « Orchestrateur IA », 2026-11-17 00:13 UTC -->

# Rapport Phase 0B v7 : dernière revue technique ciblée

**Cadre.** Cette mission est restée documentaire. Elle consiste en une relecture statique du code et du dossier, sans aucune nouvelle consultation externe : la mission interdit de contacter un service externe. Les sources citées sont donc celles déjà lues pour les v5 et v6. **Tout ce qui n'y figurait pas est marqué [SUPPOSÉ].**

**Légende :** [DOC] documentation officielle · [DÉDUIT] déduction · [SUPPOSÉ] hypothèse · [TEST] à démontrer.

---

## 1. Corrections apportées par rapport à la v6

### 1.1 Pare-feu : défauts trouvés en relecture du code v6, et corrections

| N° | Défaut dans le code v6 | Gravité | Correction |
|---|---|---|---|
| F1 | `$(if ($f -eq '4') { 'ICMPv4' } else { @() })` : pour IPv6, l'expression renvoie `$null`. La liste devient `@('UDP', $null)`, puis `$ProtoMap[$null]` **lève une exception** dans PowerShell 5.1 [DÉDUIT] | Bloquante : la vérification plante | `$protos = if ($f -eq '4') { @('UDP','ICMPv4') } else { @('UDP') }` |
| F2 | `ConvertTo-OrchPortIntervals` traduit une liste **vide ou nulle** en « tous les ports ». **Une valeur absente devient silencieusement `Any`** | Grave | Une liste vide ou nulle **lève une exception**. Seule la valeur explicite `Any` est acceptée |
| F3 | Usage de `-shl` et `-band` sur des `UInt64`. Le comportement de ces opérateurs sur `UInt64` dans PowerShell 5.1 n'a pas été vérifié, et il y a un risque de conversion vers `Int64` ou `Double` [SUPPOSÉ] | Incertaine | Remplacement par de l'**arithmétique entière seule** (`%` et `-`), puis un test de puissance de 2 par comparaison avec `[math]::Pow(2,k)`, exact jusqu'à 2³² [DÉDUIT] |
| F4 | Les ports à **zéros initiaux** (`022`) étaient acceptés | Mineure | Expression `\A(?:0\|[1-9][0-9]{0,4})\z` pour chaque borne |
| F5 | Les plages IPv6 étaient écrites avec l'adresse IPv4 en notation pointée (`::ffff:192.168.60.9`). On ignore comment Windows les enregistre : il pourrait les **convertir en IPv4** [SUPPOSÉ] | Incertaine | Notation **hexadécimale pure** (`::ffff:c0a8:3c09`), générée à partir des octets |
| F6 | `-InterfaceAlias` est de type **`WildcardPattern[]`** [DOC, résumé de la cmdlet]. Un nom contenant `*`, `?`, `[` ou `]` serait interprété comme un motif | Grave si cela arrive | **Refus** de tout nom contenant ces caractères |
| F7 | Les filtres d'une règle étaient lus **sans vérifier** qu'il y en a exactement un. Un filtre manquant donnait des propriétés nulles | Grave | **Exactement un** objet par type de filtre, sinon erreur |
| F8 | Les propriétés qui modifient la portée d'une règle **n'étaient pas toutes contrôlées** : service, paquet d'application, type d'interface, sécurité et utilisateurs, ICMP, cible dynamique, propriétaire, traversée de NAT, mots-clés dynamiques | Grave | Contrôle de chacune contre la valeur neutre attendue (section 1.2) |
| F9 | Seules les règles dont l'alias d'interface **valait exactement** le nôtre étaient repérées. Les règles valables sur **toutes** les interfaces (« Any ») n'étaient pas analysées | Partielle | Analyse ciblée des règles « Any » (section 1.2) |
| F10 | Une stratégie de groupe (GPO) peut **désactiver l'application des règles locales** [DOC, page « rules »] : nos règles seraient alors ignorées | Grave | Vérification du réglage de fusion des règles locales sur chaque profil [SUPPOSÉ : nom exact de la propriété] |
| F11 | La lecture règle par règle (4 cmdlets × des centaines de règles) est lente et risque des lectures partielles | Fonctionnelle | Lecture **en bloc** de chaque type de filtre dans `ActiveStore`, puis jointure par identifiant [SUPPOSÉ : `InstanceID` du filtre = `Name` de la règle] |
| F12 | Les règles n'étaient identifiées que par leur `DisplayName`, **qui n'est pas unique** | Grave pour le retour arrière | `-Name "ORCH-<runId>-<alias>-<n°>"` (identifiant unique), `-Group "ORCH-<runId>"`, et un journal des créations |

**Ce que j'ai revu sans y trouver de problème** [DÉDUIT, compatibilité PowerShell 5.1 à confirmer par T-FW-PLAN] :
- `[System.Net.IPAddress]::new([byte[]])` et `[BitConverter]::ToUInt32` ;
- les conversions `[uint64]` ;
- `BigInteger` : `$BI::new([byte[]])` avec un octet de signe nul, `Pow`, `Add`, les opérateurs `+ - %` (surcharges de .NET appelées par PowerShell [SUPPOSÉ]), et les comparaisons par `IComparable` ;
- `Sort-Object` sur des valeurs d'un même type (chaque famille d'adresses est traitée séparément) ;
- `-cmatch`, `-ccontains` et `-in`.

**Point d'attention :** il ne faut **jamais comparer un `BigInteger` à un `UInt64`**. La fonction `Merge-OrchIntervals` filtre par famille, ce qui l'évite.

### 1.2 Fragments de code corrigés

Les parties non citées de la v6 restent inchangées.

```powershell
# (F3, F4) Ports et masques sans opérateurs binaires
$PortRx = '\A(?:0|[1-9][0-9]{0,4})\z'
function Test-OrchPow2([uint64]$v) { for ($k = 0; $k -le 32; $k++) { if ($v -eq [uint64][math]::Pow(2, $k)) { return $true } }; $false }
#   préfixe /n :   $size = [uint64][math]::Pow(2, 32 - $n); $lo = $x - ($x % $size); $hi = $lo + $size - $One4
#   masque pointé : $size = ($MaxV4 - $m) + $One4; if (-not (Test-OrchPow2 $size)) { throw "Masque non contigu" }; $lo = $x - ($x % $size)

# (F2) Une valeur absente n'est jamais « Any »
function ConvertTo-OrchPortIntervals($Specs) {
  $list = @($Specs | Where-Object { $null -ne $_ -and $_ -ne '' })
  if ($list.Count -eq 0) { throw "Ports distants absents : refus (jamais assimilés à Any)" }
  if ($list -ccontains 'Any') { if ($list.Count -ne 1) { throw "'Any' mêlé à d'autres ports" }; return ,@(New-OrchIv 'p' ([uint64]0) ([uint64]65535)) }
  $ivs = foreach ($s in $list) {
    if ($s -cmatch '\A([0-9]{1,5})-([0-9]{1,5})\z') { $x=$Matches[1]; $y=$Matches[2] } elseif ($s -cmatch '\A[0-9]{1,5}\z') { $x=$s; $y=$s } else { throw "Port invalide : '$s'" }
    if ($x -cnotmatch $PortRx -or $y -cnotmatch $PortRx) { throw "Zéro initial refusé : '$s'" }
    $a=[uint64]$x; $b=[uint64]$y; if ($b -gt 65535 -or $a -gt $b) { throw "Port hors 0-65535 ou plage inversée : '$s'" }
    New-OrchIv 'p' $a $b
  }
  Merge-OrchIntervals $ivs 'p'
}
# Même règle pour les adresses : liste vide = exception ; 'Any' seulement s'il est seul

# (F1) dans Assert-OrchCoverage
#   $protos = if ($f -eq '4') { @('UDP','ICMPv4') } else { @('UDP') }

# (F5) Adresse IPv4 mappée en hexadécimal pur
function ConvertTo-OrchMappedHex([uint64]$v) {
  $b = ([System.Net.IPAddress]::Parse((ConvertFrom-OrchV4 $v))).GetAddressBytes()
  '::ffff:{0:x2}{1:x2}:{2:x2}{3:x2}' -f $b[0], $b[1], $b[2], $b[3]
}
#   $v6o = @("::-$(ConvertTo-OrchMappedHex ($t-$One4))", "$(ConvertTo-OrchMappedHex ($t+$One4))-ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff")
#   cible mappée : ConvertTo-OrchMappedHex $t

# (F6)
function Assert-OrchAlias([string]$Alias) {
  if ($Alias -cmatch '[\*\?\[\]`]' -or $Alias.Trim() -ne $Alias -or $Alias -eq '') { throw "Alias d'interface refusé (caractère de motif ou espace) : '$Alias'" }
}

# (F7, F8, F11) Lecture en bloc, exactement un filtre de chaque type par règle, toutes propriétés de portée
function Get-OrchActive {
  $rules = @(Get-NetFirewallRule -PolicyStore ActiveStore)
  $kinds = [ordered]@{
    Addr=Get-NetFirewallAddressFilter; Port=Get-NetFirewallPortFilter; If=Get-NetFirewallInterfaceFilter
    IfType=Get-NetFirewallInterfaceTypeFilter; App=Get-NetFirewallApplicationFilter; Svc=Get-NetFirewallServiceFilter
    Sec=Get-NetFirewallSecurityFilter
  }
}
```

Ce dernier fragment est un **squelette, non prêt à l'emploi**. Chaque appel ci-dessus doit prendre `-PolicyStore ActiveStore` et ses résultats doivent être indexés par `InstanceID` [SUPPOSÉ]. Pour **chaque** règle, la procédure exige **un et un seul** objet de chaque type, sinon elle signale « filtre absent ou multiple : refus ». Elle produit ensuite un objet normalisé qui contient :
- l'identifiant `Name`, `DisplayName`, `Group`, `Direction`, `Action`, `Enabled`, `Profile` ;
- `PolicyStoreSourceType`, `PolicyStoreSource`, `EdgeTraversalPolicy`, `LooseSourceMapping`, `LocalOnlyMapping`, `Owner` ;
- `InterfaceAlias`, `InterfaceType`, `Protocol`, `LocalAddress`, `RemoteAddress`, `LocalPort`, `RemotePort`, `IcmpType`, `DynamicTarget` ;
- `Program`, `Package`, `Service` ;
- `Authentication`, `Encryption`, `OverrideBlockRules`, `LocalUser`, `RemoteUser`, `RemoteMachine` ;
- les éventuels mots-clés d'adresses dynamiques.

**Les noms et les valeurs exacts de ces propriétés sont [SUPPOSÉ].** Ils seront relevés en T-FW-LIVE (étalonnage). Toute valeur inconnue entraîne un refus et une mise à jour **revue** du code.

**Valeurs attendues pour nos huit règles** [SUPPOSÉ quant à leur représentation exacte] :

| Propriété | Valeur attendue |
|---|---|
| `Action` | `Block` |
| `Enabled` | `True` |
| `Profile` | `Any` |
| `PolicyStoreSourceType` | `Local` |
| `InterfaceAlias` | exactement l'alias attendu |
| `InterfaceType` | `Any` |
| `Program`, `Package`, `Service` | `Any` |
| `LocalAddress`, `LocalPort` | `Any` |
| `IcmpType`, `DynamicTarget` | `Any` |
| `Authentication`, `Encryption` | `NotRequired` |
| `OverrideBlockRules` | `False` |
| `LocalUser`, `RemoteUser`, `RemoteMachine` | `Any` |
| `EdgeTraversalPolicy` | `Block` |
| `LooseSourceMapping`, `LocalOnlyMapping` | `False` |
| `Owner` | vide |
| Mots-clés dynamiques | aucun |

**Règles inattendues dans `ActiveStore` (F9, F10) :**
- **règles `ORCH`** : le jeu doit être exactement les huit règles de l'exécution enregistrée (identifiant d'exécution et `Name`), sans doublon et sans `DisplayName` `ORCH-*` en plus ;
- **règles liées à nos interfaces** (alias exact) : aucune autre que les nôtres ;
- **règles « Any » (toutes interfaces) ou issues d'une stratégie de groupe :**
  - **contournement authentifié** : aucune règle d'`ActiveStore` ne doit avoir `OverrideBlockRules=True`. Une telle règle peut l'emporter sur un blocage [DOC]. Si une seule existe : refus ;
  - **blocages étrangers couvrant TCP 22 vers la cible** : c'est un risque de **disponibilité**, pas de sécurité, signalé en avertissement ;
  - les autorisations « Any » ne peuvent pas lever nos blocages, puisqu'un blocage explicite l'emporte [DOC]. **Elles sont donc inventoriées sans être refusées** ;
- **fusion des règles locales** activée sur les trois profils, si une stratégie peut la désactiver [DOC]. Sinon : refus ;
- **limite :** les cmdlets NetSecurity ne montrent ni les filtres WFP des fournisseurs tiers, ni les filtres de démarrage [DOC : ces derniers existent]. **Contrôler `ActiveStore` ne suffit donc pas à connaître l'état réel de WFP.** Il faut compléter par `netsh wfp show filters`, en lecture seule (T-FW-LIVE).

### 1.3 Installation et retour arrière

**Ce qui se passe aujourd'hui si une création échoue au milieu** [DÉDUIT] :
- le code v6 lève une exception ;
- **les règles déjà créées restent en place**, aucun retour arrière n'est prévu ;
- un état partiel en résulte, par exemple `IN-ALL` créé seul, ce qui bloque les VM sans autoriser le contrôle ;
- le contrôle de dérive refuserait ensuite de démarrer les agents. C'est sûr pour la sécurité, mais cela laisse un état incohérent sur l'hôte.

**Retour arrière proposé. Il n'est pas prêt à l'emploi tant que T-FW-ROLLBACK n'a pas été exécuté.**

1. **Avant toute création :**
   - générer un identifiant d'exécution aléatoire (128 bits) ;
   - relever l'**ensemble S0** des `Name` présents dans `ActiveStore`, avec leur `PolicyStoreSourceType` ;
   - relever l'empreinte de la liste des règles issues de stratégies de groupe ;
   - en option, faire un export de sauvegarde de la configuration du pare-feu, uniquement comme pièce d'archive et jamais restauré automatiquement [SUPPOSÉ : commande d'export] ;
   - refuser l'installation si une règle `ORCH-*` existe déjà (déjà prévu en v6).
2. **Créations une par une**, avec `-Name "ORCH-<runId>-<alias>-<n°>"`, `-Group "ORCH-<runId>"`, `-PolicyStore PersistentStore`. **Chaque création réussie est inscrite immédiatement** dans un journal en ajout seul.
3. **En cas d'échec**, on ne supprime que les règles qui remplissent **toutes** ces conditions :
   - `Name` présent dans le journal de cette exécution ;
   - `Name` absent de S0 ;
   - `PolicyStoreSourceType = Local` ;
   - `Group = ORCH-<runId>`.

   La suppression se fait **une règle à la fois, par `Name` exact**, sans motif ni `-DisplayName` ni `-Group` seul : `Remove-NetFirewallRule -Name <exact> -PolicyStore PersistentStore`.
4. **Propriété incertaine :** une règle porte l'identifiant d'exécution sans être journalisée (par exemple après un plantage entre la création et l'écriture du journal), **ou** une condition manque. Alors **aucune intervention** : la procédure s'arrête et vous montre la liste.
5. **Les règles préexistantes et celles issues de stratégies de groupe ne sont jamais touchées**, puisqu'elles sont dans S0 ou hors du magasin local.
6. **Vérification finale :**
   - l'ensemble des `Name` d'`ActiveStore` est **identique à S0** ;
   - aucune règle ne porte l'identifiant d'exécution ;
   - l'empreinte des règles issues de stratégies de groupe est inchangée.

   En cas d'écart : arrêt et revue humaine.

---

## 2. T-NET-03 : phase de référence corrigée

**Défaut de la v6.** Le pare-feu existant peut déjà bloquer une connexion de la VM vers un écouteur de l'hôte. Les réseaux non identifiés reçoivent le profil Public [DOC], et l'entrant est bloqué par défaut [DOC]. **Une réussite de référence n'est donc pas garantie.**

**Procédure de référence A′, privilégiée, sans aucune modification du pare-feu :**

1. **Routage :**
   - `Find-NetRoute -RemoteIPAddress 192.168.60.10` doit renvoyer l'adaptateur A et la source 192.168.60.1 ;
   - dans la VM : `ip route` et `ip addr`.
2. **Écouteur de l'hôte :** un écouteur de test fixe sur 192.168.60.1:50003 doit apparaître à l'état `Listen` (`Get-NetTCPConnection -LocalPort 50003`). Une connexion **locale** de l'hôte vers sa propre adresse prouve que l'écouteur fonctionne. Le pare-feu ne s'applique généralement pas au trafic local [SUPPOSÉ].
3. **Arrivée des paquets :**
   - capture côté hôte sur l'adaptateur A avec l'outil intégré `pktmon` [SUPPOSÉ : disponible sous Windows 10 22H2] ;
   - tentative de la VM vers 192.168.60.1:50003 ;
   - **résultat attendu :** le SYN est vu à l'arrivée sur l'adaptateur A, puis rejeté avec un événement 5152 ou 5157 dont l'identifiant de filtre est relevé ;
   - **cela établit le chemin réseau et le filtre responsable, sans rien ouvrir.**
4. **Sens hôte → VM :** `tcpdump -ni ctl0` dans la VM pendant `Test-NetConnection 192.168.60.10 -Port 22`.

**Variante A″, seulement si A′ n'est pas concluante.** Elle **modifie la configuration du pare-feu** et **exige une autorisation distincte**.
- **Règle temporaire :** une seule, `-Name "ORCH-TEST-<runId>"`, `Direction=Inbound`, `Action=Allow`, `Protocol=TCP`, `LocalAddress=192.168.60.1`, `LocalPort=50003`, `RemoteAddress=192.168.60.10`, `InterfaceAlias=<A>`, `Profile=Any`.
- **Elle n'est créée qu'avant les règles `ORCH`**, sur une VM fraîchement installée et **sans aucun agent**, pendant quelques minutes.
- **Restauration :** suppression par `Name` exact, selon la procédure de la section 1.3.
- **Vérification de la suppression :** `Get-NetFirewallRule -PolicyStore ActiveStore -Name "ORCH-TEST-<runId>"` ne renvoie rien, et l'ensemble d'`ActiveStore` est égal à S0.

**Diagnostic** (phase B, règles `ORCH` en place) :

| Observation | Cause |
|---|---|
| Mauvaise interface selon `Find-NetRoute`, ou paquet absent à l'arrivée sur l'adaptateur | **Routage** |
| Paquet présent, écouteur absent (pas d'état `Listen` ; RST dans la VM pour le sens inverse) | **Écouteur** |
| 5152 ou 5157 dont l'identifiant correspond à un filtre d'une règle `ORCH-<runId>-*` | **Règle ORCH** |
| Identifiant correspondant à une règle non `ORCH` de Windows (règle préexistante, blocage par défaut) | **Règle préexistante** |
| Identifiant appartenant à un fournisseur WFP autre que le pare-feu Windows (`netsh wfp show state` et `show filters`) | **Fournisseur WFP tiers** |
| Flux sortant autorisé (5156), SYN-ACK vu dans la VM, puis 5152 entrant sur ce flux attribué à `IN-ALL` | **Filtrage à états inopérant** |

Les critères de réussite de la v6 sont conservés, et ils sont **tous obligatoires**. **L'absence d'un événement n'est jamais une preuve suffisante.** Il faut aussi que pktmon et tcpdump donnent des résultats cohérents. Si l'audit est incomplet, le test est **non concluant**, donc NO-GO.

---

## 3. eBPF : test du mécanisme et validation de la politique réelle

**Validation 1, le mécanisme (T-EBPF-MECA).** C'est le test différentiel de la v6 sur 127.0.0.1, conservé à l'identique : une unité témoin, une unité avec `IPAddressDeny=any`, une unité avec `IPAddressDeny=any` et `IPAddressAllow=127.0.0.1`, avec relevé de l'attachement.

- **Ce qu'il démontre** [DÉDUIT] :
  - le noyau et systemd mettent en œuvre le filtrage IP par cgroup ;
  - systemd attache bien les programmes pour une unité qui a ces propriétés ;
  - le refus par défaut et la liste blanche fonctionnent pour une adresse.
- **Ce qu'il ne démontre pas :**
  - les propriétés de l'unité agent réelle ;
  - l'effet des unités parentes ;
  - le filtrage du trafic qui sort par `int0` (même mécanisme, mais chemin différent [DÉDUIT]) ;
  - le fonctionnement du proxy, de nftables ou de la passerelle ;
  - les sockets créées hors de l'unité puis transmises [DOC : non couvertes].

**Validation 2, la politique réelle (T-EBPF-POLICY).**
- `orch-priv` dispose d'un **mode sonde**. Ce mode construit les propriétés de l'unité **avec exactement le même code** que pour une vraie tâche, mais lance un programme sonde au lieu de l'agent. La sonde lit `/proc/self/cgroup` et attend.
- Pendant qu'elle tourne, root relève :
  - `systemctl show <unité> -p IPAddressDeny -p IPAddressAllow -p ControlGroup`. Attendu : refus de tout, autorisation de `10.66.0.1/32`, et rien d'autre [SUPPOSÉ : format d'affichage] ;
  - les **unités parentes** : `systemctl show system.slice -p IPAddressAllow -p IPAddressDeny`, puis la tranche racine. Les listes sont **combinées avec celles des parents** [DOC] : **toute liste d'autorisation chez un parent est refusée**, car elle élargirait l'accès ;
  - `bpftool cgroup show` sur le chemin **réellement** renvoyé par la sonde. On doit y trouver les programmes d'entrée et de sortie [SUPPOSÉ : format].
- **Le même relevé est fait à chaque tâche réelle** sur l'unité réellement lancée. En cas d'écart, la tâche est arrêtée et mise en quarantaine.

**Validation 3, la connectivité (T-EBPF-CONN)**, séparée et faite en mode sonde. La sonde tente cinq connexions. Pour chacune, on relève le code d'erreur, les compteurs nftables de la VM agents et le journal nftables de la passerelle.

| Connexion | Résultat attendu | Responsable attendu |
|---|---|---|
| 10.66.0.1:3129 | Réussite | — |
| 10.66.0.1:3128 | Refus | nftables de la VM agents (filtrage par compte) |
| 10.66.0.1:22 | Refus | nftables de la passerelle |
| 192.168.60.1:22 | Refus | Le filtre eBPF de l'unité (adresse non autorisée), avec un refus local attendu de type `EPERM` [SUPPOSÉ] |
| 1.1.1.1:443 | Refus | Idem |

Ces trois validations distinctes servent à ne pas confondre filtrage eBPF, routage et nftables.

**Si une preuve manque** (par exemple `bpftool` absent ou un format illisible) : **NO-GO.**

---

## 4. Codex : politique d'`auth.json` verrouillée

**Corrections :**
- **Toute** proposition d'acceptation d'un `auth.json` produit pendant une tâche est retirée, qu'elle soit automatique ou soumise à votre validation.
- **Politique unique : jamais d'écriture en retour.** Le fichier principal ne change qu'après une **reconnexion humaine par le mécanisme officiel** (`codex login`, éventuellement `--device-auth` [DOC]). Cette reconnexion se fait dans une **session de maintenance sans aucune tâche**, sur une VM fraîchement réinitialisée [DÉDUIT : distinct d'un fichier produit pendant un travail].
- **Si le mode sans écriture en retour échoue :** arrêt du superviseur, aucune nouvelle tâche, puis reconnexion humaine ou décision de remplacer le superviseur.

**Définition de T-CRED-NOWB :**

| Paramètre | Valeur |
|---|---|
| Phase | **0B.9**, seulement après la réussite de 0B.5 à 0B.8 |
| Autorisation | **Distincte**, car le test comprend une connexion par vous et des requêtes réelles |
| Cycles | **Au moins 6**, sur **au moins 72 h**, dont deux séparés par au moins 24 h d'inactivité. La durée de vie des jetons n'est pas documentée [SUPPOSÉ], d'où cet étalement |
| Redémarrage réel | Extinction ACPI de la VM et réinitialisation du disque immuable entre deux cycles, donc nouveau processus et nouvelle copie, en lecture seule, du même fichier principal |
| Niveau 1 : démarrage | `codex --version`. Ne prouve que la présence du programme |
| Niveau 2 : authentification | Commande d'état de connexion, si elle existe [SUPPOSÉ]. **Elle peut n'être que locale**, sans preuve que le serveur accepte le jeton |
| Niveau 3 : appel réel | **Une** requête minimale par cycle, sans outil, en lecture seule, **soit au plus 6 requêtes** prises sur votre quota gratuit. C'est le seul niveau qui prouve l'authentification côté serveur |
| Relevé | Empreinte du fichier principal (constante, sinon anomalie) et empreinte de la copie après exécution (indique un renouvellement, sans rien persister) |
| Réussite | 6 cycles sur 6 réussis au niveau 3, fichier principal jamais modifié |
| Échec | Échec d'authentification à n'importe quel cycle : application de la politique ci-dessus |

**Je ne lance aucun appel réel.**

---

## 5. Révocation

C'est inchangé depuis la v6, sans nouvelle recherche puisque toute consultation externe est interdite :

| Niveau | Claude (`setup-token`) | Codex (connexion ChatGPT) |
|---|---|---|
| Suppression locale | Possible ; **le jeton reste valide** | Possible ; **les jetons restent valides** |
| Déconnexion locale | `/logout` : aucun effet documenté sur ce jeton | `codex logout` : effacement local [DOC] |
| Fermeture de session | Non documentée pour ce jeton | Déconnexion du navigateur [DOC] : aucun effet documenté sur la CLI |
| Révocation serveur | **Non documentée** | **Non documentée** (le cas Enterprise ne s'applique pas) |

T-REVOKE ne pourra avoir lieu que si les deux conditions sont réunies : **une procédure officielle identifiée**, et **votre autorisation explicite** pour une requête de vérification faite avec l'ancien jeton conservé à part. **Je ne présente aucune méthode non documentée comme opérationnelle.**

---

## 6. Défauts encore présents

1. Le code du pare-feu **n'a jamais été exécuté**. Sa compatibilité avec PowerShell 5.1 n'est établie que par relecture.
2. Les **noms et représentations réels des propriétés** de pare-feu sont inconnus et doivent être étalonnés.
3. Les protocoles IP autres que TCP, UDP et ICMPv4 vers la cible restent **non bloqués** (options A, B ou C à décider en 0B.2).
4. **WFP n'est que partiellement visible** par NetSecurity : fournisseurs tiers et filtres de démarrage.
5. Le **retour arrière** n'a jamais été testé.
6. Le **comportement à états** face à un blocage explicite **n'est pas documenté**.
7. La **révocation côté serveur n'est pas documentée** pour les deux jetons.
8. La **rotation des jetons de Codex n'est pas documentée.**

## 7. Hypothèses non vérifiées

| Domaine | Hypothèses [SUPPOSÉ] |
|---|---|
| Pare-feu | Jointure des filtres par `InstanceID` ; valeurs `Any`, `True` et `Local` ; propriété de fusion des règles locales ; enregistrement des plages IPv6 mappées ; acceptation des numéros de protocole (option A) |
| Outils Windows | `pktmon` présent ; commande d'export de la configuration du pare-feu |
| Pare-feu, trafic local | Non filtré par défaut |
| Linux | Code d'erreur `EPERM` renvoyé par le filtre eBPF ; formats de `systemctl show` et de `bpftool` ; `bpftool` disponible dans l'image |
| Codex | Commande d'état de connexion ; durée de vie des jetons |

## 8. Tests nécessaires

**Aucun test n'a été exécuté.**

| Test | Préconditions | Entrées | Réussite | Faux positifs possibles | Si échec |
|---|---|---|---|---|---|
| **T-FW-PLAN** | Fonctions chargées, aucune règle créée | Entrées invalides : `192.168.060.10` ; adresse suivie d'un retour à la ligne ; chiffres arabes ; masque `255.0.255.0` ; `/33` ; `fe80::/129` ; `::1%3` ; port `022`, `70000`, `30-20` ; liste de ports **vide** ; `Any` mêlé à des ports ; alias contenant `*` ou `[` ; plan sans `OUT-V6-AUTRES` ; `Any` dans une règle IPv6. Entrée valide : le plan correct pour .10 et .60.10 en IPv6 mappée | Toutes les entrées invalides sont refusées ; le plan correct est accepté ; **aucune exception non prévue** (le défaut F1 est corrigé) | Un refus pour une mauvaise raison : il faut vérifier le message d'erreur attendu, pas seulement le refus | Correction du code ; 0B.4 bloquée |
| **T-FW-LIVE** | Règles créées en 0B.4 | `Get-OrchActive` | Huit règles exactes ; toutes les propriétés conformes au tableau 1.2 ; aucun `OverrideBlockRules` ; fusion des règles locales active ; règles `ORCH` présentes dans `netsh wfp show filters` | Représentation inconnue prise pour une non-conformité : refus par prudence, puis étalonnage revu | Pas d'agents ; analyse |
| **T-FW-DUAL** | Règles actives | SSH depuis un client IPv4 pur, puis depuis un client à socket double pile ; port 23 vers la cible et vers son adresse mappée | SSH réussi dans les deux cas ; le port 23 est bloqué dans les deux cas ; événements attribués à des règles `ORCH` | Client qui n'utilise pas réellement une socket double pile : vérifier le type de socket | Revue de la conception IPv6 |
| **T-FW-ROLLBACK** | Machine de test ou hôte avec votre autorisation ; S0 relevé | Échec provoqué à la 4ᵉ création ; journal amputé de sa dernière entrée (cas incertain) | Retour arrière des seules règles journalisées ; arrêt sur le cas incertain ; ensemble final égal à S0 ; règles de stratégie inchangées | S0 relevé trop tôt, alors qu'une autre application modifie les règles : comparer l'ensemble deux fois | Procédure non utilisable : installation interdite |
| **T-NET-03 A′/B** | Section 2 | Section 2 | Tous les critères obligatoires sont remplis, et pktmon et tcpdump sont cohérents | Audit incomplet, ou identifiants de filtre relevés à un autre moment | NO-GO pour la conception ; option C prioritaire |
| **T-EBPF-MECA / POLICY / CONN** | Section 3 | Section 3 | Section 3 | Propriétés différentes entre unités, service pas prêt, `bpftool` absent (test non concluant) | NO-GO |
| **T-CRED-NOWB** | Section 4 | Section 4 | 6 cycles sur 6 au niveau 3 | Échec réseau mis sur le compte de l'authentification : relever l'erreur exacte | Politique de la section 4 |

## 9. Risques résiduels

1. Exfiltration vers les domaines autorisés, impossible à bloquer sans inspection TLS.
2. Absence de révocation serveur documentée pour les deux jetons.
3. Rotation des jetons de Codex non documentée.
4. Protocoles non TCP, UDP ou ICMP émis par l'hôte vers la cible.
5. Visibilité partielle de WFP.
6. Faille de l'hyperviseur.
7. Accès au réseau local en cas de compromission de la passerelle (T-NAT-WIN).
8. Hôte Windows 10 à migrer avant le 12 octobre 2027.
9. Erreur humaine pendant la maintenance.

## 10. Verdicts

| Périmètre | Verdict | Motif |
|---|---|---|
| **Revue documentaire** | **Cohérente pour cette itération, non prête pour une installation** | Défauts F1 à F12 corrigés sur le papier, mais code jamais exécuté ; défauts 6.1 à 6.8 encore ouverts |
| **0B.1** : contrôles en lecture seule | **GO conditionnel** | Liste de commandes fixée à l'avance, sans droits d'administrateur ni modification ; **autorisation distincte nécessaire** |
| **0B.2** : décisions d'architecture | **GO conditionnel** | Choix à faire : option A, B ou C pour les protocoles non TCP ; comptes dédiés ; choix sur VBS ; repli NAT ; superviseur de remplacement si T-CRED-NOWB échoue |
| **0B.3 et phases suivantes** | **NO-GO** | Tant que 0B.1 et 0B.2 ne sont pas validés et que l'hôte n'est pas à jour ; chaque phase demandera son autorisation |
| **Installation** | **NO-GO** | Mêmes conditions, plus T-FW-PLAN réussi avant 0B.4 et T-FW-ROLLBACK avant d'appliquer les règles sur l'hôte |
| **Appels réels aux agents** | **NO-GO** | Révocation serveur non documentée ; T-NET-03, T-FW-DUAL, T-EBPF-*, T-SYSD-COMPAT, T-NAT-WIN et T-CRED-NOWB non démontrés ; hôte à jour |

## 11. Sources officielles et affirmations qu'elles soutiennent

Aucune nouvelle consultation n'a été faite pour cette v7. Ces sources sont celles lues pour les v5 et v6.

| Source | Ce qu'elle soutient |
|---|---|
| [Pare-feu Windows : vue d'ensemble](https://learn.microsoft.com/en-us/windows/security/operating-system-security/network-security/windows-firewall/) | Entrant bloqué sauf trafic sollicité ou règle ; profil Public par défaut pour les réseaux non identifiés |
| [Pare-feu Windows : gestion en ligne de commande](https://learn.microsoft.com/en-us/windows/security/operating-system-security/network-security/windows-firewall/configure-with-command-line) | Rejet du trafic qui n'est ni autorisé ni une réponse ; existence de `pfirewall.log` |
| [Pare-feu Windows : priorité des règles](https://learn.microsoft.com/en-us/windows/security/operating-system-security/network-security/windows-firewall/rules) | Le blocage l'emporte, en entrée comme en sortie ; une stratégie peut désactiver la fusion des règles locales |
| [`New-NetFirewallRule`](https://learn.microsoft.com/en-us/powershell/module/netsecurity/new-netfirewallrule) | Formats d'adresses (adresse, sous-réseau, plage, IPv4 et IPv6) et de ports (0-65535) ; `-Protocol` à valeur unique, de 0 à 255 ; `-InterfaceAlias` de type `WildcardPattern[]` ; existence de `OverrideBlockRules` |
| [WFP : ALE](https://learn.microsoft.com/en-us/windows/win32/fwp/application-layer-enforcement--ale-) | Filtrage à états par connexion ; classification des sockets double pile au niveau IPv6 avec adresse mappée |
| [Audit Filtering Platform Connection](https://learn.microsoft.com/en-us/previous-versions/windows/it-pro/windows-10/security/threat-protection/auditing/audit-filtering-platform-connection) | Liste des événements de la sous-catégorie (5031, 5150, 5151, 5154 à 5159) ; 5152 n'en fait pas partie |
| [systemd.resource-control](https://www.freedesktop.org/software/systemd/man/latest/systemd.resource-control.html) | `IPAddressAllow`/`Deny` depuis la version 235 ; sans effet sans eBPF ; combinés avec les unités parentes ; appliqués à tout le cgroup |
| [systemd.exec](https://www.freedesktop.org/software/systemd/man/latest/systemd.exec.html) | Versions et limites des options de confinement (v6) |
| [VirtualBox : `VBoxManage`](https://www.virtualbox.org/manual/topics/vboxmanage.html) | `--uart-modeN`, pour l'option C |
| [Claude Code : authentification](https://code.claude.com/docs/en/authentication) | `setup-token` valable un an et non enregistré ; effet de `/logout` sur la connexion Console sans clé |
| [Codex : authentification](https://learn.chatgpt.com/docs/auth) | `auth.json` en clair ; renouvellement automatique ; `codex logout` en local ; connexion par code ; rotation et révocation non décrites |
| [Codex Enterprise : jetons d'accès](https://learn.chatgpt.com/docs/enterprise/access-tokens) | Révocation des jetons d'espace de travail Enterprise, non applicable ici |

---

**Déclaration.** Cette mission est restée strictement documentaire. Je n'ai exécuté aucune commande, créé ou modifié aucun fichier, rien installé ni démarré, et je n'ai contacté aucun agent, aucune API ni aucun service externe. Je n'ai accédé ni à Fastclip ni à Git. **Aucune autorisation d'exécution n'est demandée, et aucune n'est présumée.**
