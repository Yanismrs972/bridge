<!-- Rapport extrait de la session Claude « Orchestrateur IA », 2026-11-16 23:35 UTC -->

# Rapport Phase 0B v5 : corrections documentaires

Cette mission est restée documentaire. Je n'ai lancé aucune commande locale, créé ou modifié aucun fichier, rien installé ni configuré, et je n'ai pas accédé à Fastclip. **Ce rapport ne vaut pas autorisation d'exécution.**

**Statut des affirmations :**
- **[DOC]** : documentation officielle.
- **[DÉDUIT]** : déduit d'une documentation officielle.
- **[SUPPOSÉ]** : hypothèse.
- **[TEST]** : à prouver par un test.
- **[SECONDAIRE]** : source non officielle.

Les sections de la v4 qui ne sont pas reprises ici restent valables : architecture réseau, matrice, procédure d'arrêt ACPI, grammaire SSH, validation des archives et tests de la v4.

---

## Correction 1 : règles de pare-feu Windows

**Défaut signalé.** La revue indique que l'appel `Add-OrchRules $ctl '192.168.60.10' '192.168.60.9' '192.168.60.11'` produirait une seule plage `192.168.60.9-192.168.60.11`, qui contiendrait l'adresse autorisée.

**Mon analyse, honnête.** À la lecture, le code v4 construisait `-RemoteAddress "0.0.0.0-$lo","$hi-255.255.255.255"`, c'est-à-dire **deux** plages : `0.0.0.0-192.168.60.9` et `192.168.60.11-255.255.255.255`. Ces plages excluent .10. **Je ne peux pas le prouver** sans exécuter le code, ce qui m'est interdit ici.

En revanche, la revue a raison sur le fond : **la conception était fragile**.
- Les deux bornes, nommées `lo` et `hi`, étaient passées à la main et leur sens était contre-intuitif.
- Rien ne vérifiait leur cohérence.
- Une simple inversion d'arguments aurait bloqué la cible, ou ouvert d'autres adresses, sans aucune alerte.

**Correction.** Les plages sont **calculées** à partir de la seule adresse cible. Une **vérification statique** refuse le plan avant toute création, et cette même vérification est rejouée sur les règles réellement présentes, à chaque contrôle de dérive.

```powershell
#Requires -Version 5.1
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$Ipv4Rx = '^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$'
$V6All  = '::-ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff'   # format « plage IPv6 » documenté

function ConvertTo-OrchUInt32([string]$Ip) {
  if ($Ip -notmatch $Ipv4Rx) { throw "Adresse IPv4 invalide : $Ip" }   # refuse les formes ambiguës acceptées par TryParse
  $b = ([System.Net.IPAddress]::Parse($Ip)).GetAddressBytes(); [Array]::Reverse($b)
  [uint64][BitConverter]::ToUInt32($b, 0)
}
function ConvertFrom-OrchUInt32([uint64]$Value) {
  if ($Value -gt 4294967295) { throw "Valeur hors IPv4 : $Value" }
  $b = [BitConverter]::GetBytes([uint32]$Value); [Array]::Reverse($b)
  ([System.Net.IPAddress]::new($b)).ToString()
}
# Complément exact de la cible dans tout l'espace IPv4 : deux plages qui excluent uniquement la cible
function Get-OrchComplementV4([string]$Target) {
  $t = ConvertTo-OrchUInt32 $Target
  if ($t -eq 0 -or $t -eq 4294967295) { throw "Cible non admise : $Target" }
  @(('0.0.0.0-' + (ConvertFrom-OrchUInt32 ($t - 1))), ((ConvertFrom-OrchUInt32 ($t + 1)) + '-255.255.255.255'))
}
# Une entrée d'adresse de règle contient-elle l'adresse IPv4 donnée ? Tout format inconnu est REFUSÉ.
function Test-OrchV4Contains([string]$Spec, [string]$Ip) {
  $x = ConvertTo-OrchUInt32 $Ip
  if ($Spec -eq 'Any' -or $Spec -eq '*') { return $true }
  if ($Spec.Contains(':')) { return $false }                              # entrée IPv6
  if ($Spec -match '^([^-/]+)-([^-/]+)$') {
    $a = $Matches[1]; $b = $Matches[2]
    $lo = ConvertTo-OrchUInt32 $a; $hi = ConvertTo-OrchUInt32 $b
    if ($lo -gt $hi) { throw "Plage inversée : $Spec" }
    return ($x -ge $lo -and $x -le $hi)
  }
  if ($Spec -match '^([^/]+)/(\d{1,2})$') {
    $a = $Matches[1]; $n = [int]$Matches[2]; if ($n -gt 32) { throw "Préfixe invalide : $Spec" }
    $mask = if ($n -eq 0) { [uint64]0 } else { ([uint64]4294967295 -shl (32 - $n)) -band 4294967295 }
    return (($x -band $mask) -eq ((ConvertTo-OrchUInt32 $a) -band $mask))
  }
  if ($Spec -match '^([^/]+)/([^/]+)$') {                                 # masque pointé, forme parfois renvoyée par Windows
    $a = $Matches[1]; $m = ConvertTo-OrchUInt32 $Matches[2]
    return (($x -band $m) -eq ((ConvertTo-OrchUInt32 $a) -band $m))
  }
  if ($Spec -match $Ipv4Rx) { return ($x -eq (ConvertTo-OrchUInt32 $Spec)) }
  throw "Format d'adresse non reconnu, refus par prudence : $Spec"
}
function Test-OrchPortCovers($Specs, [int]$Port) {
  if ($null -eq $Specs -or @($Specs).Count -eq 0) { return $true }       # aucun filtre de port = tous les ports
  foreach ($s in @($Specs)) {
    if ($s -eq 'Any') { return $true }
    if ($s -match '^(\d{1,5})-(\d{1,5})$') {
      $a = [int]$Matches[1]; $b = [int]$Matches[2]
      if ($a -gt $b -or $b -gt 65535) { throw "Plage de ports invalide : $s" }
      if ($Port -ge $a -and $Port -le $b) { return $true }; continue
    }
    if ($s -match '^\d{1,5}$') { if ([int]$s -eq $Port) { return $true }; continue }
    throw "Format de port non reconnu : $s"
  }
  $false
}
function New-OrchRulePlan([string]$Alias, [string]$Target) {
  @(
    @{ Name="ORCH-$Alias-IN-ALL";         Direction='Inbound';  Protocol='Any';    RemoteAddress=@('Any');                   RemotePort=$null },
    @{ Name="ORCH-$Alias-OUT-V4-AUTRES";  Direction='Outbound'; Protocol='Any';    RemoteAddress=(Get-OrchComplementV4 $Target); RemotePort=$null },
    @{ Name="ORCH-$Alias-OUT-TCP-HORS22"; Direction='Outbound'; Protocol='TCP';    RemoteAddress=@($Target);                 RemotePort=@('0-21','23-65535') },
    @{ Name="ORCH-$Alias-OUT-UDP";        Direction='Outbound'; Protocol='UDP';    RemoteAddress=@($Target);                 RemotePort=$null },
    @{ Name="ORCH-$Alias-OUT-ICMP4";      Direction='Outbound'; Protocol='ICMPv4'; RemoteAddress=@($Target);                 RemotePort=$null },
    @{ Name="ORCH-$Alias-OUT-V6";         Direction='Outbound'; Protocol='Any';    RemoteAddress=@($V6All);                  RemotePort=$null }
  )
}
# Vérification statique : s'applique au plan AVANT création, puis aux règles relues (contrôle de dérive)
function Assert-OrchPlan($Plan, [string]$Target) {
  $err = @()
  foreach ($r in $Plan) {                                                # 1) aucune règle sortante ne doit bloquer TCP 22 vers la cible
    if ($r.Direction -ne 'Outbound') { continue }
    if (-not (($r.Protocol -eq 'Any' -or $r.Protocol -eq 'TCP') -and (Test-OrchPortCovers $r.RemotePort 22))) { continue }
    foreach ($s in @($r.RemoteAddress)) { if (Test-OrchV4Contains $s $Target) { $err += "$($r.Name) bloque TCP 22 vers $Target (entrée '$s')" } }
  }
  $other = @(($Plan | Where-Object { $_.Name -like '*-OUT-V4-AUTRES' }).RemoteAddress)
  $net = (ConvertTo-OrchUInt32 $Target) -band [uint64]4294967040        # /24 de la cible
  $samples = @(0..255 | ForEach-Object { ConvertFrom-OrchUInt32 ($net + $_) }) + '0.0.0.1','10.0.0.1','172.16.0.1','224.0.0.251','255.255.255.255'
  foreach ($ip in $samples) {                                            # 2) toute autre adresse doit être bloquée
    if ($ip -eq $Target) { continue }
    if (-not ($other | Where-Object { Test-OrchV4Contains $_ $ip })) { $err += "Adresse $ip non bloquée" }
  }
  $h = $Plan | Where-Object { $_.Name -like '*-OUT-TCP-HORS22' }
  foreach ($p in 0,1,21,23,135,445,3389,65535) { if (-not (Test-OrchPortCovers $h.RemotePort $p)) { $err += "TCP $p vers $Target non bloqué" } }
  if (Test-OrchPortCovers $h.RemotePort 22) { $err += "TCP 22 bloqué par $($h.Name)" }
  foreach ($suffix in 'IN-ALL','OUT-UDP','OUT-ICMP4','OUT-V6') {           # 3) règles obligatoires présentes
    if (-not ($Plan | Where-Object { $_.Name -like "*-$suffix" })) { $err += "Règle $suffix absente" }
  }
  if ($err.Count) { throw ("Plan de pare-feu refusé :`n" + ($err -join "`n")) }
}
function Install-OrchRules([string]$Alias, [string]$Target) {
  $plan = New-OrchRulePlan $Alias $Target
  Assert-OrchPlan $plan $Target                                          # rien n'est créé si la vérification échoue
  foreach ($r in $plan) {
    $p = @{ DisplayName=$r.Name; Direction=$r.Direction; InterfaceAlias=$Alias; Action='Block'; Profile='Any'; Enabled='True' }
    if ($r.Protocol -ne 'Any') { $p.Protocol = $r.Protocol }
    if (@($r.RemoteAddress) -notcontains 'Any') { $p.RemoteAddress = $r.RemoteAddress }
    if ($r.RemotePort) { $p.RemotePort = $r.RemotePort }
    New-NetFirewallRule @p | Out-Null
  }
}
# Relecture des règles réelles, pour le contrôle de dérive (la même Assert-OrchPlan est appliquée)
function Get-OrchLivePlan([string]$Alias) {
  Get-NetFirewallRule -DisplayName "ORCH-$Alias-*" | ForEach-Object {
    $af = $_ | Get-NetFirewallAddressFilter; $pf = $_ | Get-NetFirewallPortFilter; $if = $_ | Get-NetFirewallInterfaceFilter
    @{ Name=$_.DisplayName; Direction=[string]$_.Direction; Action=[string]$_.Action; Enabled=[string]$_.Enabled
       Protocol=[string]$pf.Protocol; RemoteAddress=@($af.RemoteAddress); RemotePort=@($pf.RemotePort); Interface=@($if.InterfaceAlias) }
  }
}
# Usage prévu en 0B.4 (non exécuté) :
#   Install-OrchRules '<alias A>' '192.168.60.10'
#   Install-OrchRules '<alias B>' '192.168.61.10'
```

Le contrôle de dérive appelle `Assert-OrchPlan (Get-OrchLivePlan $alias) $target`. Il vérifie en plus que les six règles existent exactement, qu'elles sont activées (`Enabled=True`), en blocage (`Action=Block`), et attachées à la bonne interface.

**Rôle de chaque règle :**

| Règle | Effet exact |
|---|---|
| `IN-ALL` | Bloque tout trafic entrant sur l'interface, tous protocoles, IPv4 et IPv6 (aucun filtre d'adresse) [DÉDUIT]. Elle vise les connexions ouvertes par la VM ; son effet sur les réponses est traité en correction 2. |
| `OUT-V4-AUTRES` | Bloque tout trafic IPv4 sortant de l'hôte vers **toute adresse sauf la cible** : les autres machines du sous-réseau, les adresses de diffusion et de multidiffusion, et le reste de l'espace IPv4. |
| `OUT-TCP-HORS22` | Vers la cible : bloque TCP sur tous les ports **sauf 22**. |
| `OUT-UDP` / `OUT-ICMP4` | Vers la cible : bloquent UDP et ICMPv4. |
| `OUT-V6` | Bloque tout trafic IPv6 sortant sur l'interface. IPv6 reste lié, conformément à la recommandation de Microsoft, mais il est inutilisable sur cette interface. |

**Résultat :** le seul trafic sortant que **rien ne bloque** sur l'interface est TCP vers la cible sur le port 22.

**Source :**
- un blocage l'emporte sur une autorisation, en entrée comme en sortie [DOC, priorité des règles] ;
- formats acceptés pour les adresses (adresse, sous-réseau, plage IPv4 et IPv6) et pour les ports (port, plage 0-65535) [DOC, `New-NetFirewallRule`].

**Réellement garanti :** rien n'est garanti avant exécution. La vérification statique garantit seulement que **le plan** ne bloque pas la cible et bloque bien les échantillons testés.

**Reste à tester :**
- **T-FW-PLAN** : la vérification statique est jouée sur des plans volontairement erronés (cible dans une plage, bornes inversées, port 22 bloqué, règle manquante, format inconnu). Chacun doit être refusé.
- **T-FW-LIVE** : relecture des règles réelles. Windows peut présenter les adresses sous une autre forme, par exemple un masque pointé : le format doit être reconnu, ou alors refusé.
- **T-FW-OUT** et **T-NET-01/02/03** (v4).

**Si un test échoue :**
- échec de T-FW-PLAN : bogue de la vérification, à corriger avant tout ;
- format live non reconnu : refus par prudence, l'orchestrateur ne démarre pas, et l'analyseur est corrigé ;
- trafic non bloqué : NO-GO réseau.

**Limites qui demeurent :**
- les protocoles IP autres que TCP, UDP et ICMP vers la cible ne sont pas bloqués en sortie, faute de pouvoir exprimer « tout sauf TCP » [DÉDUIT]. Ce trafic serait de toute façon initié par l'hôte ;
- aucune règle ne restreint *quel programme* de l'hôte peut ouvrir le port 22 ;
- les échanges de niveau 2 (ARP) ne passent pas par le filtrage IP [DÉDUIT].

---

## Correction 2 : comportement à états du pare-feu

**Défaut.** La v4 tenait pour probable, sans le démontrer, qu'une règle entrante « tout bloquer » n'affecte pas les réponses d'une connexion ouverte par l'hôte.

**Ce que dit la documentation officielle :**
- Le pare-feu « bloque tout le trafic entrant, sauf s'il est sollicité ou correspond à une règle » [DOC, vue d'ensemble].
- Il « rejette le trafic qui ne correspond ni à un trafic non sollicité autorisé, ni à un trafic envoyé en réponse à une requête de l'appareil » [DOC, gestion en ligne de commande].
- La plateforme de filtrage de Windows (WFP) dispose de couches ALE dédiées au **filtrage à états**. Ces couches classent le trafic « par connexion ou par opération de socket ». Elles sont **les seules couches** qui permettent de filtrer selon l'application [DOC, ALE].
- Une règle explicite l'emporte sur le comportement par défaut, et un blocage l'emporte sur une autorisation [DOC, priorité des règles].

**Conclusion.** La documentation **ne dit pas explicitement** si une règle *explicite* de blocage entrant s'applique aussi aux paquets de réponse d'un flux autorisé en sortie. La classification « par connexion » des couches ALE suggère que non [DÉDUIT], mais **ce n'est pas démontré**. Une réponse de forum Microsoft Q&A affirme ce comportement à états, avec réserve [SECONDAIRE].

| Cas | Comportement attendu | Statut |
|---|---|---|
| 1. SSH ouvert par Windows vers 192.168.60.10:22 | Autorisé : aucune règle sortante ne correspond (correction 1) | [DÉDUIT] |
| 2. Réponses de la VM à cette connexion (SYN-ACK et suite du flux) | Probablement autorisées, en tant que flux déjà autorisé en sortie | **Non démontré : test T-NET-03 obligatoire** |
| 3. Nouvelle connexion ouverte par la VM vers Windows | Bloquée par `IN-ALL` | [DOC] priorité du blocage explicite |

**Test T-NET-03, désormais obligatoire et décisif.**

**Préconditions** (réglages temporaires, faits par vous) :
- règles actives sur l'interface ;
- audit WFP activé :
  ```
  auditpol /set /subcategory:"Filtering Platform Connection" /success:enable /failure:enable
  auditpol /set /subcategory:"Filtering Platform Packet Drop" /failure:enable
  ```
- journal du pare-feu activé : `Set-NetFirewallProfile -LogBlocked True -LogAllowed True`.

**Procédure :**
1. Depuis l'hôte : `ssh -v gate@192.168.60.10 status`.
2. Depuis la VM : connexion vers un écouteur de test de l'hôte, par exemple 192.168.60.1:50003, en TCP et en UDP, puis `ping`.
3. Même procédure sur `orch-adm` (T-NET-03b).
4. Rétablir l'audit et la journalisation à leur état initial.

**Journaux à examiner** [DOC pour la liste des événements] :
- événement **5156** (connexion autorisée) pour `ssh.exe`, en sortie vers .10:22 ;
- **aucun 5152 ni 5157** sur ce flux ;
- côté VM, des événements **5157 ou 5152** en entrée, dont le *Filter Run-Time ID* correspond à `ORCH-…-IN-ALL`. La correspondance se fait avec `netsh wfp show filters`, en lecture seule ;
- `pfirewall.log` : `ALLOW … 192.168.60.1 → 192.168.60.10:22 SEND` et `DROP … 192.168.60.10 → 192.168.60.1 RECEIVE`.

**Résultat attendu :** l'étape 1 réussit sans perte de paquet sur ce flux, et l'étape 2 échoue entièrement.

**Si le test échoue** (réponses bloquées) : **NO-GO pour la conception actuelle.** Les solutions de repli, à décider ensuite, ont toutes des défauts :
- **(a)** supprimer `IN-ALL` et s'appuyer sur le blocage entrant par défaut. Les règles d'autorisation d'autres applications, valables sur toutes les interfaces, s'appliqueraient alors aussi à ces adaptateurs : c'est risqué ;
- **(b)** bloquer en entrée tout sauf le port source 22 de la cible. C'est **contournable** : un root dans la VM peut ouvrir des connexions depuis son port 22 ;
- **(c)** revoir le canal de contrôle.

**Aucune de ces solutions ne sera appliquée sans nouvelle analyse.**

---

## Correction 3 : confinement systemd

**Défauts de la v4 :**
- `TemporaryFileSystem=/srv:ro` combiné à `BindPaths=/srv/ws/<id>` : un point de montage serait à créer dans un tmpfs en lecture seule, ce qui n'est pas démontré ;
- `RuntimeDirectoryMode` **n'était pas défini**, alors que sa valeur par défaut est **0755** [DOC] : le dossier aurait été listable par l'autre agent ;
- les versions minimales et les dépendances n'étaient pas indiquées.

**Corrections :**
1. **Espace de travail.** `/work` est un dossier vide créé à la construction de l'image (root, 0755). Configuration :
   - `TemporaryFileSystem=/srv:ro`, qui masque tout `/srv` ;
   - `BindPaths=/srv/ws/<id>:/work` ;
   - `WorkingDirectory=/work`.

   La destination existe déjà, ce qui respecte l'exigence « la destination doit exister ou systemd doit pouvoir la créer » [DOC]. Il n'y a plus de point de montage à créer dans un tmpfs en lecture seule.
2. **`RuntimeDirectoryMode=0700`** est fixé explicitement. Le dossier d'exécution est un sous-dossier de `/run` qui appartient à `User=` [DOC] : celui de `exec` est donc illisible par `sup`, et inversement.
3. **`RestrictAddressFamilies=AF_INET AF_UNIX`.** La documentation recommande d'inclure `AF_UNIX` dans la plupart des cas [DOC]. Le retrait d'`AF_UNIX` sera testé, mais pas imposé d'emblée. `AF_INET6` et `AF_NETLINK` restent exclus.
4. Un **autotest à chaque démarrage de la VM agents** vérifie qu'une unité de test avec `IPAddressDeny=any` ne peut joindre ni 10.66.0.1 ni 1.1.1.1. **En cas d'échec, `orch-priv` refuse toute tâche.** Ce n'est pas facultatif : sans support eBPF, ces réglages sont « sans effet » [DOC].

| Propriété | Version min. | Dépendance noyau / cgroup / eBPF | Effet exact | Limites | Test |
|---|---|---|---|---|---|
| `BindPaths` | 233 [DOC] | Espace de noms de montage | Montage propre à l'unité, invisible de l'hôte | La destination doit exister ou être créable | T-SYSD-WS |
| `TemporaryFileSystem` | 238 [DOC] | Espace de noms de montage | tmpfs sur le point indiqué ; combinable avec `BindPaths` | Ordre des montages non documenté | T-SYSD-WS |
| `RuntimeDirectory` | 211 [DOC] | — | Dossier sous `/run`, propriétaire `User=`, supprimé à l'arrêt ; implique `BindPaths` | Mode 0755 par défaut, d'où `RuntimeDirectoryMode` | T-SYSD-X |
| `RuntimeDirectoryMode` | 234 [DOC] | — | Droits du dossier | — | T-SYSD-X |
| `RuntimeDirectoryPreserve` | 235 [DOC] | — | Conserve le dossier après l'arrêt (sinon suppression) | Le nettoyage revient à l'orchestrateur, ou à l'extinction de la VM (`/run` est en mémoire) | T-CRED-CODEX |
| `LoadCredential` | 247 [DOC] | — | Dossier en lecture seule, accessible au seul utilisateur de l'unité et à root, en mémoire non échangeable « si possible » | Comportement si la source manque : **non explicite** ; un code de sortie 243 (« échec de mise en place des identifiants ») existe [DOC] | T-CRED-LC |
| `IPAddressAllow` / `IPAddressDeny` | 235 [DOC] | **Support eBPF des cgroups** ; sans lui, « sans effet » [DOC] ; cgroup v2 [SUPPOSÉ] | Filtre les paquets IP des sockets `AF_INET` et `AF_INET6` de tous les processus de l'unité ; impossible à contourner avec le préfixe « + » [DOC] | Ne concerne pas `AF_UNIX` [DOC] ; pas de filtrage par port | Autotest de démarrage, T-SYSD-NET |
| `RestrictAddressFamilies` | 211 [DOC] | seccomp | Limite `socket()` | Les sockets hérités, `socketpair()` et io_uring ne sont pas touchés ; efficace seulement sur x86-64 et quelques autres architectures [DOC] | T-SYSD-NET, T-SYSD-COMPAT |
| `RestrictNamespaces` | 233 [DOC] | seccomp ; architectures listées | Limite `unshare`, `clone` et `setns` | **Peut casser le sandbox interne de Codex** (bubblewrap) [SUPPOSÉ] | T-SYSD-COMPAT |
| `SystemCallFilter` | 187 [DOC] (groupe `@system-service` : version non relue [SUPPOSÉ ≥ 239]) | seccomp | Liste blanche d'appels système | `execve` reste implicitement autorisé | T-SYSD-NS |
| `SystemCallArchitectures=native` | 209 [DOC] | seccomp | Bloque les ABI alternatives | — | T-SYSD-NS |
| `ProtectSystem` | 214 [DOC] | Espace de noms de montage | `strict` rend toute l'arborescence en lecture seule, sauf exceptions | Ne garantit pas tous les cas [DOC v4] | T-SYSD-RO |
| `ProtectHome` | 214 [DOC] | Espace de noms de montage | `/home`, `/root` et `/run/user` vides ou inaccessibles | Ne couvre pas les dossiers personnels non standard | T-SYSD-X |
| `ReadWritePaths` | 231 [DOC] | Espace de noms de montage | Exception d'écriture sous `strict` | Ne rend pas inscriptible un système de fichiers monté en lecture seule | T-SYSD-WS |
| `InaccessiblePaths` | ancienne (version non relue) | Espace de noms de montage | Rend inaccessibles les chemins listés et leur contenu | Impossible d'y imbriquer un `BindPaths` [DOC] | T-SYSD-LOG |
| `ProtectProc` | 247 [DOC] | Option `hidepid` par montage, sinon **sans effet silencieux** [DOC v4] | Masque les processus des autres utilisateurs | — | T-SYSD-X |
| `ProtectKernelTunables` / `ProtectControlGroups` | 232 [DOC] | `ProtectControlGroups` avancé : cgroup v2 et espaces de noms cgroup | `/proc/sys` et `/sys` en lecture seule ; hiérarchie cgroup en lecture seule | Les changements indirects par IPC restent possibles [DOC] | T-SYSD-RO |
| `PrivateIPC` | 248 [DOC] | Espace de noms IPC | Isole SysV IPC et les files de messages POSIX | Ne couvre pas `AF_UNIX` ni la mémoire partagée POSIX [DOC] | T-SYSD-X |
| `NoNewPrivileges` | 187 [DOC] | — | Interdit tout gain de privilège via `execve` | Ne couvre pas les processus lancés via d'autres services, d'où le blocage de `/run/dbus` et `/run/systemd/private` | T-SYSD-DBUS |
| `UnsetEnvironment` | 235 [DOC] | — | Retire les variables à la toute fin | — | T-CRED-LEAK |
| `MemoryMax` / `MemoryHigh` | 231 [DOC] | cgroup v2, contrôleur `memory` [DOC] | Plafond mémoire, puis OOM dans l'unité | — | T-DOS |
| `MemorySwapMax` | 232 [DOC] | cgroup v2 | Plafond du swap | — | T-DOS |
| `TasksMax` | 227 [DOC] | Contrôleur `pids` | Plafond du nombre de tâches (threads compris) | — | T-DOS |
| `CPUQuota` | 213 [DOC] | `cpu.max` (v2) | Quota de processeur | — | T-DOS |
| `RuntimeMaxSec` | non relue [SUPPOSÉ] | — | Durée maximale | — | T-DOS |

La version de systemd de Debian stable n'a pas été vérifiée [SUPPOSÉ ≥ 248]. Elle sera relevée en 0B.6, et chaque option sera confirmée dans la page de manuel installée.

**Compatibilité avec Claude Code, Codex et Node.js [TEST T-SYSD-COMPAT] :**
- **Node et V8** ont besoin de mémoire exécutable pour le JIT : `MemoryDenyWriteExecute` reste exclu [DOC].
- **Résolution DNS** : la glibc peut utiliser `AF_NETLINK` ou `AF_UNIX`. L'adresse du proxy est une **adresse IP littérale** (`http://10.66.0.1:3129`), donc aucune résolution DNS n'est nécessaire côté agent [DÉDUIT]. La prise en compte de `HTTPS_PROXY` par Claude Code et par Codex n'a pas été vérifiée [SUPPOSÉ].
- **Outils de Claude** : Glob et Grep lancent ripgrep, qui communique par tubes. Ceux-ci ne sont pas concernés par `RestrictAddressFamilies`, qui ne vise que `socket()` [DOC].
- **Codex** pourrait tenter de créer son propre sandbox, qui utilise des espaces de noms. Cela entre en conflit avec `RestrictNamespaces=yes` [SUPPOSÉ]. **C'est une décision à prendre sur la foi du test**, sans élargir les droits par défaut.
- **Procédure du test** : `--version`, puis démarrage sans appel au modèle sous l'unité de référence. Toute erreur `EPERM` ou `SIGSYS` est journalisée.

**Dossiers de configuration et identifiants [TEST T-SYSD-X, T-CRED-LC] :**
- **`exec`** :
  - `/run/orch-exec-<id>/` en 0700, appartenant à `exec` ;
  - `cfg/` créé par le lanceur avec un `umask` de 0077 ;
  - `settings.json` copié depuis un modèle appartenant à root ;
  - **le jeton n'est jamais écrit sur disque.**
- **`sup`** :
  - `/run/orch-sup-<id>/` en 0700, appartenant à `sup` ;
  - `codex/auth.json` en 0600.
- **Source des identifiants** : `/var/lib/orch-cred/{exec,sup}/…`, appartenant à **root**, en 0600. C'est root qui les lit, au moment de `LoadCredential`.

**Conséquence de l'échec d'un test T-SYSD :** la propriété est inefficace. **NO-GO pour les appels réels** tant que la garantie correspondante n'est pas obtenue autrement. Si c'est l'autotest eBPF qui échoue, toute tâche est refusée.

---

## Correction 4 : persistance de `auth.json` pour Codex

**Défaut.** La documentation confirme le stockage dans `auth.json` et le renouvellement automatique. Elle recommande aussi, pour l'automatisation, de « garder le fichier mis à jour pour l'exécution suivante » [DOC]. Mais cela **ne prouve pas** que notre copie fonctionnera, et **la rotation des jetons n'est pas documentée**.

**Procédure précise :**
1. **Avant l'unité**, `orch-priv` (root) ouvre `/var/lib/orch-cred/sup/auth.json` avec `O_NOFOLLOW` et vérifie :
   - fichier ordinaire, propriétaire root, mode 0600 ;
   - taille de 1 octet à 64 Ko ;
   - UTF-8 valide ;
   - JSON valide de type objet.

   Il calcule l'empreinte **H0** et la liste des clés de premier niveau **K0**, puis les journalise (empreinte et liste uniquement, jamais le contenu). Le fichier est transmis par `LoadCredential`, et le lanceur le copie dans `/run/orch-sup-<id>/codex/auth.json` en 0600.
2. **Codex s'exécute** avec `cli_auth_credentials_store="file"` [DOC pour l'option]. Le passage par `-c` en même temps que `--ignore-user-config` est [SUPPOSÉ]. Codex peut réécrire le fichier.
3. **Après l'unité**, quelle que soit sa façon de se terminer (`RuntimeDirectoryPreserve=yes`), root ouvre la copie avec `O_NOFOLLOW` et vérifie : fichier ordinaire, propriétaire `sup`, taille au plus 64 Ko, JSON objet. Il calcule **H1** et **K1**.
   - **H1 = H0** : aucun renouvellement, rien à faire.
   - **H1 ≠ H0 et K1 = K0** : renouvellement présumé. Écriture de `auth.json.nouveau` (root, 0600), `fsync`, puis renommage atomique par-dessus `auth.json`. L'ancienne version est conservée sous `auth.json.precedent`, par renommage. L'événement est journalisé avec les empreintes seulement.
   - **K1 ≠ K0** : **le format a peut-être changé**. Le fichier principal n'est pas remplacé, le nouveau est mis en quarantaine (root, 0600), et **toute nouvelle tâche Codex est refusée jusqu'à votre examen.**
   - **Fichier absent, invalide, lien ou trop gros** : le fichier principal est conservé et l'état est marqué « incertain ». Si Codex a signalé une erreur d'authentification, il faut une reconnexion humaine.
4. **Rotation.** Si Codex utilise des jetons de renouvellement à usage unique, ce qui n'est **pas documenté**, la sauvegarde *après chaque exécution, y compris en échec*, est indispensable. Une exécution tuée pendant l'écriture peut laisser un fichier partiel. L'ancien fichier serait alors conservé, peut-être déjà consommé, et l'exécution suivante échouerait. **C'est un mode d'échec accepté, qui demande une reconnexion humaine.**
5. **L'orchestrateur ne cherche jamais à interpréter les champs du fichier** : leur schéma n'est pas documenté.
6. **Une seule exécution Codex à la fois.** C'est imposé par le verrou de `orch-gate`.

**L'orchestrateur arrête tout et demande une reconnexion humaine** dans les cas suivants :
- **Erreur d'authentification de Codex** : événement `turn.failed` ou `error` contenant 401, « unauthorized », « refresh » ou « token », ou code de sortie non nul accompagné de ces motifs. Code d'arrêt `IDENTIFIANTS_CODEX_INVALIDES`, **sans aucune nouvelle tentative**.
- **Fichier principal absent ou invalide au démarrage.**
- **Format changé** (K1 ≠ K0).
- **Empreinte du fichier principal différente de la dernière valeur journalisée** : modification hors de `orch-priv`.
- **Échec de T-CRED-RENEW** en 0B.9.

**Réellement garanti :** rien. La procédure **réduit** le risque de perte d'un jeton renouvelé, mais **la rotation n'est pas démontrée**.

**À tester :**
- **T-CRED-RENEW** : au moins 5 cycles sur plus de 24 h, avec relevé de H0 et H1 à chaque cycle ;
- **T-CRED-CODEX** : interruption volontaire pendant l'exécution, puis vérification du comportement prévu ;
- **T-CRED-FMT** : faux fichier avec des clés différentes, qui doit être mis en quarantaine.

**Si les tests échouent :**
- NO-GO pour Codex dans cette architecture ;
- solutions de repli à décider en 0B.2 : (a) reconnexion humaine régulière, en acceptant l'interruption de service ; (b) stockage `ephemeral` avec une connexion par tâche, irréaliste sans navigateur ; (c) un autre superviseur.

---

## Correction 5 : procédures de révocation

### Claude (`claude setup-token`)

| Niveau | Procédure | Statut |
|---|---|---|
| Locale | Retirer le jeton du disque d'identifiants et de tout environnement | Efficace localement uniquement [DÉDUIT] |
| Déconnexion du compte | `/logout` supprime et révoque les identifiants écrits par certaines connexions, comme la connexion Console sans clé [DOC]. **Aucun effet documenté sur un jeton `setup-token`**, qui n'est enregistré nulle part [DOC] | Non applicable ou non documenté |
| Révocation serveur | **Aucune procédure officielle trouvée.** Des sources non officielles citent une page *Settings → Claude Code → Authorization tokens* sur claude.ai, et des utilisateurs signalent des jetons **encore actifs après révocation** [SECONDAIRE] | **Bloquant** |

### Codex (connexion par ChatGPT)

| Niveau | Procédure | Statut |
|---|---|---|
| Locale | `codex logout` « efface les identifiants actuels » [DOC] ; retirer `auth.json` du disque d'identifiants | Efficace localement uniquement |
| Déconnexion du compte | Déconnexion de toutes les sessions dans les réglages du compte ChatGPT [SUPPOSÉ : non vérifié pour les jetons de Codex] | Non démontré |
| Révocation serveur | **Non décrite** dans la documentation d'authentification [DOC : absente]. Les jetons d'accès des espaces de travail Enterprise sont révocables [DOC], mais ils ne s'appliquent pas à un compte personnel gratuit. Une demande de fonctionnalité indique qu'il n'existe pas d'interface pour révoquer une autorisation OAuth précise [SECONDAIRE] | **Bloquant** |

**Atténuation à décider en 0B.2 :** utiliser des **comptes dédiés** aux agents, si les conditions d'utilisation le permettent [SUPPOSÉ]. La révocation ultime serait alors de changer le mot de passe du compte, de fermer ses sessions, ou de supprimer le compte, sans toucher à vos comptes personnels.

**Ce qui reste à tester (T-REVOKE), avec un jeton de test :**
- **Claude** : générer un jeton, le révoquer par la procédure identifiée, puis vérifier qu'une requête minimale est **refusée**.
- **Codex** : même démarche, avec `codex logout`, puis déconnexion de toutes les sessions côté compte, puis vérification avec l'ancien `auth.json`.

**Si la révocation ne peut être ni documentée ni prouvée : NO-GO pour les appels réels.**

---

## Tests ajoutés ou modifiés

Ils s'ajoutent à ceux de la v4. **Aucun n'a été exécuté.**

| Test | Préconditions | Procédure | Attendu | Échec si | Réaction |
|---|---|---|---|---|---|
| T-FW-PLAN | Fonctions de la correction 1 | `Assert-OrchPlan` sur 8 plans erronés : cible dans une plage, bornes inversées, port 22 bloqué, règle manquante, format inconnu, `/24` incluant la cible, `Any`, IPv6 mal formé | Les 8 sont refusés | Un plan est accepté | Correction du code, 0B.4 bloquée |
| T-FW-LIVE | Règles créées | `Assert-OrchPlan (Get-OrchLivePlan …)` | Accepté | Refus ou format inconnu | Analyse, l'orchestrateur ne démarre pas |
| T-NET-03a/b | Correction 2 | Procédure de la correction 2 | Cas 1 et 2 réussis, cas 3 bloqué, journaux conformes | Réponses bloquées | NO-GO pour la conception, revue |
| Autotest eBPF | Chaque démarrage de la VM agents | Unité de test avec `IPAddressDeny=any` vers 10.66.0.1 et 1.1.1.1 | Les deux sont refusés | Une connexion réussit | Toutes les tâches sont refusées |
| T-SYSD-COMPAT | Unités de référence | `--version` de Claude et de Codex, démarrage sans appel au modèle, avec et sans `AF_UNIX`, avec `RestrictNamespaces` | Fonctionnement, ou liste exacte des blocages | Erreur non expliquée | Décision documentée, sans élargissement implicite |
| T-CRED-LC | — | Source d'identifiant absente ; source qui est un lien ; vérification des droits de `$CREDENTIALS_DIRECTORY` et de `/run/orch-*` | L'unité échoue (code 243 attendu) ; aucun lien suivi ; dossiers en 0700 | Démarrage sans identifiant, ou dossier lisible par l'autre agent | NO-GO |
| T-CRED-CODEX / FMT | Codex connecté (0B.9) | Exécution tuée ; fichier modifié par une clé ajoutée ; fichier remplacé par un lien | Comportements de la correction 4 | Écart | NO-GO pour Codex |
| T-REVOKE | Jetons de test | Correction 5 | Ancien jeton refusé après révocation | Jeton encore accepté | NO-GO pour les appels réels |

---

## Verdicts

| Périmètre | Verdict | Conditions |
|---|---|---|
| **0B.1** : vérifications en lecture seule | **GO conditionnel** | Liste de commandes fixée à l'avance, sans droits d'administrateur et sans aucune modification. Une autorisation explicite distincte est nécessaire ; ce rapport n'en est pas une. |
| **0B.2** : décisions d'architecture | **GO conditionnel** | Les décisions peuvent être prises en connaissance des points ouverts : comptes dédiés, choix sur VBS, repli NAT, repli du pare-feu si T-NET-03 échoue, sort de Codex si T-CRED-RENEW échoue. |
| **Installations** | **NO-GO** | Tant que 0B.1 et 0B.2 ne sont pas validés **et** que l'hôte n'est pas à jour. |
| **Appels réels aux agents** | **NO-GO** | Points bloquants : T-NET-03a et 03b, autotest eBPF, T-SYSD-COMPAT, protection du réseau local par T-NAT-WIN ou architecture de repli, **procédures de révocation des deux jetons (aujourd'hui non documentées officiellement)**, T-CRED-RENEW, hôte à jour. |

---

## Sources

**Officielles :**
- [Pare-feu Windows : vue d'ensemble (trafic sollicité ou non)](https://learn.microsoft.com/en-us/windows/security/operating-system-security/network-security/windows-firewall/)
- [Pare-feu Windows : gestion en ligne de commande (trafic de réponse, journalisation)](https://learn.microsoft.com/en-us/windows/security/operating-system-security/network-security/windows-firewall/configure-with-command-line)
- [Pare-feu Windows : priorité des règles](https://learn.microsoft.com/en-us/windows/security/operating-system-security/network-security/windows-firewall/rules)
- [`New-NetFirewallRule` : formats d'adresses et de ports](https://learn.microsoft.com/en-us/powershell/module/netsecurity/new-netfirewallrule)
- [WFP : Application Layer Enforcement (filtrage à états)](https://learn.microsoft.com/en-us/windows/win32/fwp/application-layer-enforcement--ale-)
- [Audit Filtering Platform Connection (événements 5152 à 5159)](https://learn.microsoft.com/en-us/previous-versions/windows/it-pro/windows-10/security/threat-protection/auditing/audit-filtering-platform-connection)
- [Microsoft : configuration d'IPv6](https://learn.microsoft.com/en-us/troubleshoot/windows-server/networking/configure-ipv6-in-windows)
- [systemd.exec](https://www.freedesktop.org/software/systemd/man/latest/systemd.exec.html)
- [systemd.resource-control](https://www.freedesktop.org/software/systemd/man/latest/systemd.resource-control.html)
- [Claude Code : authentification](https://code.claude.com/docs/en/authentication)
- [Codex : authentification](https://learn.chatgpt.com/docs/auth)
- [Codex Enterprise : jetons d'accès](https://learn.chatgpt.com/docs/enterprise/access-tokens)

**Secondaires**, signalées comme telles et non retenues comme preuves :
- [Microsoft Q&A : bloquer les connexions entrantes (pare-feu à états, réponse d'un MVP)](https://learn.microsoft.com/en-us/answers/questions/562298/windows-firewall-how-to-block-all-incoming-connect)
- [Claude Code : demande de fonctionnalité pour révoquer un jeton `setup-token` (ticket GitHub)](https://github.com/anthropics/claude-code/issues/57400)
- [Claude Code : ticket sur des jetons encore actifs après révocation](https://claudeissues.com/issue/57320-bug-oauth-token-deactivation)
- [Claude Code : ticket sur la déconnexion de toutes les sessions depuis claude.ai](https://claudeissues.com/issue/43801-bug-security-log-out-all-sessions-claude-code-instance-revocation-via-claude-ai)
- [Communauté OpenAI : demande de gestion des sessions OAuth](https://community.openai.com/t/add-oauth-session-management-for-openai-developer-tools-and-codex-cli-oauth-sessions/1385920)
- [Codex : ticket GitHub sur la clé API créée automatiquement](https://github.com/openai/codex/issues/2000)

Je m'arrête ici.
