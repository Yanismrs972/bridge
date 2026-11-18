<!-- Rapport extrait de la session Claude « Orchestrateur IA », 2026-11-16 23:51 UTC -->

# Rapport Phase 0B v6 : revue corrective finale

Cette mission est restée documentaire. Je n'ai lancé aucune commande, créé aucun fichier, rien installé ni démarré, contacté aucun agent ni aucune API, et je n'ai pas accédé à Fastclip. **Ce rapport ne vaut pas autorisation d'exécution.**

Je n'ai fait aucune nouvelle recherche pour cette v6. Les sources sont celles déjà consultées pour la v5, citées en fin de rapport.

**Statut des affirmations :** [DOC] documentation officielle · [DÉDUIT] déduction raisonnable · [SUPPOSÉ] hypothèse · [TEST] non démontré · [SECONDAIRE] source non officielle.

---

## Correction 1 : vérificateur du pare-feu

### 1. Défauts constatés

**Rectification préalable.** Le code v4 construisait bien **deux** plages IPv4 qui excluaient la cible. La fonction `Get-OrchComplementV4` de la v5 est **valide** : pour une cible *t* comprise entre 1 et 2³²−2, les intervalles [0, t−1] et [t+1, 2³²−1] sont disjoints, excluent *t*, et leur union est l'espace IPv4 privé de *t*. Les deux cas limites (*t* = 0 et *t* = 2³²−1) sont refusés. Ce calcul est conservé.

**Défauts réels de la v5 :**
1. **Expression régulière IPv4.** Sur les zéros initiaux, elle les refusait déjà : `[1-9]?\d` ne reconnaît pas `01`. Mais elle avait deux autres défauts :
   - `$` accepte un **retour à la ligne final** en .NET : `"1.2.3.4\n"` était accepté ;
   - `\d` reconnaît **tous les chiffres Unicode**, y compris arabes ou devanagari, pas seulement 0 à 9.
2. **Masque pointé** : sa contiguïté n'était pas vérifiée.
3. **IPv6** : toute chaîne contenant `:` était déclarée « sans correspondance », sans analyse.
4. **Ports isolés** : non bornés à 0–65535.
5. **Contrôle des règles réelles** : il vérifiait les noms, pas les propriétés.
6. **Couverture IPv4** : vérifiée par **échantillonnage**, sans démonstration.
7. **Phrase fausse** dans la v5 : « le seul trafic sortant non bloqué est TCP/22 ». **C'était inexact.** Vers la cible, les protocoles IP autres que TCP, UDP et ICMPv4 ne sont pas bloqués, par exemple GRE (47), ESP (50) ou SCTP (132).
8. **Défaut nouveau, trouvé en relisant la documentation WFP.** Pour une socket double pile, la classification au niveau IPv4 peut ne pas avoir lieu. Le trafic IPv4 est alors visible **au niveau IPv6, avec l'adresse IPv4 mappée** `::ffff:a.b.c.d` [DOC, ALE]. La règle `OUT-V6` de la v5 bloquait **tout** l'IPv6, y compris `::ffff:192.168.60.10`. Elle aurait pu **bloquer le SSH légitime** si `ssh.exe` utilise une socket double pile, ou laisser des règles IPv4 sans effet sur ce trafic [DÉDUIT, TEST].

### 2. Correction proposée

Chaque entrée de règle est convertie en **intervalles d'entiers** : 32 bits pour IPv4, 128 bits pour IPv6, et 0 à 65535 pour les ports. Les intervalles sont ensuite **fusionnés**. La couverture est démontrée par une **égalité exacte d'ensembles**, et non par des échantillons. Tout format inconnu est **refusé**.

Il y a désormais **huit** règles au lieu de six, à cause du défaut 8 : deux règles ajoutent l'adresse IPv4 mappée.

```powershell
#Requires -Version 5.1
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Numerics
$BI     = [System.Numerics.BigInteger]
$Oct    = '(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])'   # chiffres ASCII uniquement, pas de zéro initial
$Ipv4Rx = "\A$Oct(?:\.$Oct){3}\z"                                     # \A…\z : aucun retour à la ligne final
$MaxV4  = [uint64]4294967295
$One4   = [uint64]1
$MaxV6  = $BI::Pow(2, 128) - $BI::One
$Mapped = $BI::Parse('281470681743360')                               # 0xFFFF × 2^32 : base de ::ffff:0:0/96
$ProtoMap = @{ 'Any'='Any'; 'TCP'='TCP'; '6'='TCP'; 'UDP'='UDP'; '17'='UDP'; 'ICMPv4'='ICMPv4'; '1'='ICMPv4' }

function ConvertTo-OrchV4([string]$Ip) {
  if ($Ip -cnotmatch $Ipv4Rx) { throw "IPv4 invalide : '$Ip'" }
  $b = ([System.Net.IPAddress]::Parse($Ip)).GetAddressBytes(); [Array]::Reverse($b)
  [uint64][BitConverter]::ToUInt32($b, 0)
}
function ConvertFrom-OrchV4([uint64]$V) {
  if ($V -gt $MaxV4) { throw "Hors IPv4 : $V" }
  $b = [BitConverter]::GetBytes([uint32]$V); [Array]::Reverse($b)
  ([System.Net.IPAddress]::new($b)).ToString()
}
function ConvertTo-OrchV6([string]$Ip) {                              # vérificateur IPv6 réel (zones « % » refusées)
  if ($Ip -cnotmatch '\A[0-9A-Fa-f:.]{2,45}\z' -or -not $Ip.Contains(':')) { throw "IPv6 invalide : '$Ip'" }
  $a = $null
  if (-not [System.Net.IPAddress]::TryParse($Ip, [ref]$a) -or
      $a.AddressFamily -ne [System.Net.Sockets.AddressFamily]::InterNetworkV6) { throw "IPv6 invalide : '$Ip'" }
  $be = $a.GetAddressBytes(); $le = New-Object byte[] 17               # petit-boutiste + octet nul => entier positif
  for ($i = 0; $i -lt 16; $i++) { $le[$i] = $be[15 - $i] }
  $BI::new($le)
}
function New-OrchIv($F, $Lo, $Hi) { if ($Lo -gt $Hi) { throw "Intervalle inversé" }; [pscustomobject]@{ F=$F; Lo=$Lo; Hi=$Hi } }

# Une entrée d'adresse de règle -> intervalles ; tout format non reconnu lève une exception (= refus)
function ConvertTo-OrchIntervals([string]$Spec) {
  if ($Spec -ceq 'Any') { return @((New-OrchIv '4' ([uint64]0) $MaxV4), (New-OrchIv '6' $BI::Zero $MaxV6)) }
  if ($Spec.Contains(':')) {
    if ($Spec -cmatch '\A([^-/]+)-([^-/]+)\z') { $x=$Matches[1]; $y=$Matches[2]; return @(New-OrchIv '6' (ConvertTo-OrchV6 $x) (ConvertTo-OrchV6 $y)) }
    if ($Spec -cmatch '\A([^/]+)/([0-9]{1,3})\z') {
      $x=$Matches[1]; $n=[int]$Matches[2]; if ($n -gt 128) { throw "Préfixe IPv6 invalide : $Spec" }
      $size = $BI::Pow(2, 128 - $n); $v = ConvertTo-OrchV6 $x; $lo = $v - ($v % $size)
      return @(New-OrchIv '6' $lo ($lo + $size - $BI::One))
    }
    $v = ConvertTo-OrchV6 $Spec; return @(New-OrchIv '6' $v $v)
  }
  if ($Spec -cmatch '\A([^-/]+)-([^-/]+)\z') { $x=$Matches[1]; $y=$Matches[2]; return @(New-OrchIv '4' (ConvertTo-OrchV4 $x) (ConvertTo-OrchV4 $y)) }
  if ($Spec -cmatch '\A([^/]+)/([0-9]{1,2})\z') {
    $x=$Matches[1]; $n=[int]$Matches[2]; if ($n -gt 32) { throw "Préfixe IPv4 invalide : $Spec" }
    $inv = if ($n -eq 0) { $MaxV4 } else { ($One4 -shl (32 - $n)) - $One4 }
    $lo = (ConvertTo-OrchV4 $x) -band ($MaxV4 - $inv); return @(New-OrchIv '4' $lo ($lo + $inv))
  }
  if ($Spec -cmatch '\A([^/]+)/([^/]+)\z') {                          # masque pointé : contiguïté obligatoire
    $x=$Matches[1]; $m = ConvertTo-OrchV4 $Matches[2]; $inv = $MaxV4 - $m
    if (($inv -band ($inv + $One4)) -ne 0) { throw "Masque non contigu : $Spec" }
    $lo = (ConvertTo-OrchV4 $x) -band $m; return @(New-OrchIv '4' $lo ($lo + $inv))
  }
  $v = ConvertTo-OrchV4 $Spec; @(New-OrchIv '4' $v $v)
}
function Merge-OrchIntervals($Ivs, [string]$F) {                      # union triée et fusionnée (intervalles adjacents compris)
  $one = if ($F -eq '6') { $BI::One } else { $One4 }
  $out = New-Object System.Collections.Generic.List[object]
  foreach ($iv in @($Ivs | Where-Object { $_.F -eq $F } | Sort-Object -Property Lo)) {
    $n = $out.Count
    if ($n -gt 0 -and $iv.Lo -le ($out[$n-1].Hi + $one)) { if ($iv.Hi -gt $out[$n-1].Hi) { $out[$n-1].Hi = $iv.Hi } }
    else { $out.Add([pscustomobject]@{ F=$F; Lo=$iv.Lo; Hi=$iv.Hi }) }
  }
  ,$out.ToArray()
}
function Test-OrchSameIntervals($A, $B) {
  $A=@($A); $B=@($B); if ($A.Count -ne $B.Count) { return $false }
  for ($i=0; $i -lt $A.Count; $i++) { if ($A[$i].Lo -ne $B[$i].Lo -or $A[$i].Hi -ne $B[$i].Hi) { return $false } }
  $true
}
function ConvertTo-OrchPortIntervals($Specs) {
  $list = @($Specs | Where-Object { $null -ne $_ })
  if ($list.Count -eq 0 -or ($list -ccontains 'Any')) { return ,@([pscustomobject]@{ F='p'; Lo=[uint64]0; Hi=[uint64]65535 }) }
  $ivs = foreach ($s in $list) {
    if ($s -cmatch '\A([0-9]{1,5})-([0-9]{1,5})\z') { $a=[uint64]$Matches[1]; $b=[uint64]$Matches[2] }
    elseif ($s -cmatch '\A[0-9]{1,5}\z') { $a=[uint64]$s; $b=$a }
    else { throw "Port invalide : '$s'" }
    if ($b -gt 65535 -or $a -gt $b) { throw "Port hors 0-65535 ou plage inversée : '$s'" }
    [pscustomobject]@{ F='p'; Lo=$a; Hi=$b }
  }
  Merge-OrchIntervals $ivs 'p'
}
# Définition canonique : seule source des règles créées ET de la comparaison avec les règles réelles
function Get-OrchExpected([string]$Alias, [string]$Target) {
  $t = ConvertTo-OrchV4 $Target; if ($t -eq 0 -or $t -eq $MaxV4) { throw "Cible non admise : $Target" }
  $prev = ConvertFrom-OrchV4 ($t - $One4); $next = ConvertFrom-OrchV4 ($t + $One4)
  $v4o  = @("0.0.0.0-$prev", "$next-255.255.255.255")
  $v6o  = @("::-::ffff:$prev", "::ffff:$next-ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff")   # tout IPv6 sauf ::ffff:<cible>
  $hors22 = @('0-21','23-65535')
  @(
    [pscustomobject]@{ Name="ORCH-$Alias-IN-ALL";              Direction='Inbound';  Protocol='Any';    RemoteAddress=@('Any');            RemotePort=@('Any') }
    [pscustomobject]@{ Name="ORCH-$Alias-OUT-V4-AUTRES";       Direction='Outbound'; Protocol='Any';    RemoteAddress=$v4o;                RemotePort=@('Any') }
    [pscustomobject]@{ Name="ORCH-$Alias-OUT-V4-TCP-HORS22";   Direction='Outbound'; Protocol='TCP';    RemoteAddress=@($Target);          RemotePort=$hors22 }
    [pscustomobject]@{ Name="ORCH-$Alias-OUT-V4-UDP";          Direction='Outbound'; Protocol='UDP';    RemoteAddress=@($Target);          RemotePort=@('Any') }
    [pscustomobject]@{ Name="ORCH-$Alias-OUT-V4-ICMP4";        Direction='Outbound'; Protocol='ICMPv4'; RemoteAddress=@($Target);          RemotePort=@('Any') }
    [pscustomobject]@{ Name="ORCH-$Alias-OUT-V6-AUTRES";       Direction='Outbound'; Protocol='Any';    RemoteAddress=$v6o;                RemotePort=@('Any') }
    [pscustomobject]@{ Name="ORCH-$Alias-OUT-V6M-TCP-HORS22";  Direction='Outbound'; Protocol='TCP';    RemoteAddress=@("::ffff:$Target"); RemotePort=$hors22 }
    [pscustomobject]@{ Name="ORCH-$Alias-OUT-V6M-UDP";         Direction='Outbound'; Protocol='UDP';    RemoteAddress=@("::ffff:$Target"); RemotePort=@('Any') }
  )
}
# Démonstration exacte de couverture sur un ensemble de règles (attendues ou réelles)
function Assert-OrchCoverage($Rules, [string]$Target) {
  $err = New-Object System.Collections.Generic.List[string]
  $t  = ConvertTo-OrchV4 $Target; $mt = $BI::Add($Mapped, [System.Numerics.BigInteger]$t)
  $iv = { param($r) @($r.RemoteAddress) | ForEach-Object { ConvertTo-OrchIntervals $_ } }
  $out = @($Rules | Where-Object { $_.Direction -eq 'Outbound' })
  $any = @($out | Where-Object { $ProtoMap[$_.Protocol] -eq 'Any' })
  # (1) IPv4 sortant, tous protocoles : union = EXACTEMENT [0,t-1] U [t+1,max]
  $u4 = Merge-OrchIntervals ($any | ForEach-Object { & $iv $_ }) '4'
  if (-not (Test-OrchSameIntervals $u4 @((New-OrchIv '4' ([uint64]0) ($t-$One4)), (New-OrchIv '4' ($t+$One4) $MaxV4)))) { $err.Add("Union IPv4 tous protocoles différente de « tout sauf $Target »") }
  # (2) IPv6 sortant, tous protocoles : union = EXACTEMENT tout IPv6 sauf ::ffff:<cible>
  $u6 = Merge-OrchIntervals ($any | ForEach-Object { & $iv $_ }) '6'
  if (-not (Test-OrchSameIntervals $u6 @((New-OrchIv '6' $BI::Zero ($mt-$BI::One)), (New-OrchIv '6' ($mt+$BI::One) $MaxV6)))) { $err.Add("Union IPv6 tous protocoles incorrecte") }
  # (3) TCP vers la cible (IPv4 et mappée) : union des ports bloqués = EXACTEMENT [0,21] U [23,65535]
  foreach ($pair in @(@('4', [uint64]$t), @('6', $mt))) {
    $f = $pair[0]; $x = $pair[1]
    $hit = @($out | Where-Object { ($ProtoMap[$_.Protocol] -in 'Any','TCP') -and @(& $iv $_ | Where-Object { $_.F -eq $f -and $_.Lo -le $x -and $x -le $_.Hi }).Count -gt 0 })
    $p = Merge-OrchIntervals ($hit | ForEach-Object { ConvertTo-OrchPortIntervals $_.RemotePort }) 'p'
    if (-not (Test-OrchSameIntervals $p @((New-OrchIv 'p' ([uint64]0) ([uint64]21)), (New-OrchIv 'p' ([uint64]23) ([uint64]65535))))) { $err.Add("Ports TCP bloqués vers la cible (IPv$f) différents de « tout sauf 22 »") }
    foreach ($proto in @('UDP') + $(if ($f -eq '4') { 'ICMPv4' } else { @() })) {
      if (-not ($out | Where-Object { $ProtoMap[$_.Protocol] -eq $proto -and @(& $iv $_ | Where-Object { $_.F -eq $f -and $_.Lo -le $x -and $x -le $_.Hi }).Count -gt 0 })) { $err.Add("$proto vers la cible (IPv$f) non bloqué") }
    }
  }
  # (4) Entrant : tous protocoles, tout IPv4 et tout IPv6, tous ports
  $in = @($Rules | Where-Object { $_.Direction -eq 'Inbound' -and $ProtoMap[$_.Protocol] -eq 'Any' })
  if (-not (Test-OrchSameIntervals (Merge-OrchIntervals ($in | ForEach-Object { & $iv $_ }) '4') @(New-OrchIv '4' ([uint64]0) $MaxV4)) -or
      -not (Test-OrchSameIntervals (Merge-OrchIntervals ($in | ForEach-Object { & $iv $_ }) '6') @(New-OrchIv '6' $BI::Zero $MaxV6))) { $err.Add("Blocage entrant incomplet") }
  ,$err.ToArray()
}
# Lecture des règles RÉELLES (magasin actif : local + stratégies), propriétés comprises
function Get-OrchLive([string]$Alias) {
  $all  = @(Get-NetFirewallRule -PolicyStore ActiveStore)
  $read = { param($r)
    $af=$r|Get-NetFirewallAddressFilter; $pf=$r|Get-NetFirewallPortFilter; $if=$r|Get-NetFirewallInterfaceFilter; $ap=$r|Get-NetFirewallApplicationFilter
    [pscustomobject]@{ Name=$r.DisplayName; Direction=[string]$r.Direction; Action=[string]$r.Action; Enabled=[string]$r.Enabled; Profile=[string]$r.Profile
      Interface=@($if.InterfaceAlias); Protocol=[string]$pf.Protocol; RemoteAddress=@($af.RemoteAddress); RemotePort=@($pf.RemotePort)
      LocalAddress=@($af.LocalAddress); LocalPort=@($pf.LocalPort); Program=[string]$ap.Program }
  }
  [pscustomobject]@{
    Mine        = @($all | Where-Object { $_.DisplayName -like 'ORCH-*' } | ForEach-Object { & $read $_ })
    OnInterface = @($all | Where-Object { @(($_ | Get-NetFirewallInterfaceFilter).InterfaceAlias) -contains $Alias } | ForEach-Object { $_.DisplayName })
  }
}
# Comparaison stricte des propriétés réelles avec la définition canonique
function Assert-OrchRules($Expected, $Live, [string]$Alias) {
  $err = New-Object System.Collections.Generic.List[string]; $names = @($Expected | ForEach-Object Name)
  foreach ($g in @($Live.Mine | Where-Object { $_.Name -like "ORCH-$Alias-*" } | Group-Object Name)) {
    if ($names -cnotcontains $g.Name) { $err.Add("Règle inattendue : $($g.Name)") }
    if ($g.Count -gt 1)              { $err.Add("Doublon : $($g.Name) (×$($g.Count))") }
  }
  foreach ($n in $Live.OnInterface) { if ($names -cnotcontains $n) { $err.Add("Règle étrangère liée à l'interface : $n") } }
  foreach ($e in $Expected) {
    $l = @($Live.Mine | Where-Object { $_.Name -ceq $e.Name }); if ($l.Count -ne 1) { $err.Add("Absente ou multiple : $($e.Name)"); continue }; $l = $l[0]
    if ($l.Action  -ne 'Block') { $err.Add("$($e.Name) : Action=$($l.Action)") }
    if ($l.Enabled -ne 'True')  { $err.Add("$($e.Name) : Enabled=$($l.Enabled)") }
    if ($l.Direction -ne $e.Direction) { $err.Add("$($e.Name) : Direction=$($l.Direction)") }
    if ($l.Profile -ne 'Any')   { $err.Add("$($e.Name) : Profile=$($l.Profile)") }
    if (@($l.Interface).Count -ne 1 -or $l.Interface[0] -cne $Alias) { $err.Add("$($e.Name) : interface=$($l.Interface -join ',')") }
    if ($ProtoMap[$l.Protocol] -ne $e.Protocol) { $err.Add("$($e.Name) : protocole=$($l.Protocol)") }
    if ((@($l.LocalAddress) -join ',') -ne 'Any' -or (@($l.LocalPort) -join ',') -ne 'Any' -or $l.Program -ne 'Any') { $err.Add("$($e.Name) : condition locale ou programme inattendue") }
    foreach ($f in '4','6') {
      $ea = Merge-OrchIntervals (@($e.RemoteAddress) | ForEach-Object { ConvertTo-OrchIntervals $_ }) $f
      $la = Merge-OrchIntervals (@($l.RemoteAddress) | ForEach-Object { ConvertTo-OrchIntervals $_ }) $f
      if (-not (Test-OrchSameIntervals $ea $la)) { $err.Add("$($e.Name) : adresses distantes IPv$f différentes") }
    }
    if (-not (Test-OrchSameIntervals (ConvertTo-OrchPortIntervals $e.RemotePort) (ConvertTo-OrchPortIntervals $l.RemotePort))) { $err.Add("$($e.Name) : ports distants différents") }
  }
  ,$err.ToArray()
}
function Install-OrchRules([string]$Alias, [string]$Target) {          # 0B.4 uniquement, par l'utilisateur, en administrateur
  $exp = Get-OrchExpected $Alias $Target
  $e = Assert-OrchCoverage $exp $Target; if ($e.Count) { throw ("Plan refusé :`n" + ($e -join "`n")) }
  if (@(Get-NetFirewallRule -PolicyStore PersistentStore -DisplayName "ORCH-$Alias-*" -ErrorAction SilentlyContinue).Count) { throw "Règles ORCH déjà présentes : aucune modification, revue humaine" }
  foreach ($r in $exp) {
    $p = @{ DisplayName=$r.Name; Direction=$r.Direction; InterfaceAlias=$Alias; Action='Block'; Profile='Any'; Enabled='True'; PolicyStore='PersistentStore' }
    if ($r.Protocol -ne 'Any') { $p.Protocol = $r.Protocol }
    if (@($r.RemoteAddress) -cnotcontains 'Any') { $p.RemoteAddress = $r.RemoteAddress }
    if (@($r.RemotePort)    -cnotcontains 'Any') { $p.RemotePort    = $r.RemotePort }
    New-NetFirewallRule @p | Out-Null
  }
  $live = Get-OrchLive $Alias
  $errs = @(Assert-OrchRules $exp $live $Alias) + @(Assert-OrchCoverage $live.Mine $Target)
  if ($errs.Count) { throw ("Vérification après création en échec :`n" + ($errs -join "`n")) }
}
# Contrôle de dérive avant chaque tâche : Assert-OrchRules + Assert-OrchCoverage sur Get-OrchLive, plus les contrôles v4
# (GUID d'adaptateur, adresses, Forwarding, profils, configuration des VM). Toute erreur => refus de démarrer les agents.
```

**Rôle des huit règles :**

| Règle | Effet exact |
|---|---|
| `IN-ALL` | Bloque tout trafic entrant sur l'interface, tous protocoles, IPv4 et IPv6 |
| `OUT-V4-AUTRES` | Bloque tout trafic IPv4 sortant vers toute adresse sauf la cible |
| `OUT-V4-TCP-HORS22` | Bloque TCP vers la cible sur tous les ports sauf 22 |
| `OUT-V4-UDP` / `OUT-V4-ICMP4` | Bloquent UDP et ICMPv4 vers la cible |
| `OUT-V6-AUTRES` | Bloque tout IPv6 sortant, **sauf** l'adresse mappée `::ffff:<cible>` |
| `OUT-V6M-TCP-HORS22` / `OUT-V6M-UDP` | Mêmes blocages TCP (hors 22) et UDP pour l'adresse mappée, au cas où le trafic d'une socket double pile serait classé au niveau IPv6 [DOC ALE, DÉDUIT] |

**Ce que la démonstration établit.** Les égalités d'intervalles sont exactes sur les entiers. Elles prouvent que **l'ensemble de règles**, une fois lu, bloque tout l'espace d'adresses sauf la cible, et tous les ports TCP sauf 22. Cette preuve repose sur deux conditions :
- l'analyseur interprète correctement les formats renvoyés par Windows : c'est ce que vérifie T-FW-PLAN ;
- Windows applique ses règles comme le documentent la priorité des blocages et les formats d'adresse : c'est ce que vérifie T-NET.

**Phrase corrigée.** Sur ces interfaces, le trafic sortant qui n'est bloqué par aucune règle est :
- TCP vers la cible sur le port 22 ;
- **les protocoles IP autres que TCP, UDP et ICMPv4 vers la cible** ;
- vers l'adresse mappée, ICMP et les autres protocoles.

**« Tout sauf TCP/22 » ne s'exprime pas avec une seule règle.** `-Protocol` n'accepte qu'**une seule** valeur par règle, nommée ou numérique de 0 à 255 [DOC]. Trois options, **à décider en 0B.2, sans application** :
- **(A) Une règle de blocage par numéro de protocole**, soit 253 règles par interface et par famille (0 à 255, sauf 1, 6 et 17). Le vérificateur serait étendu pour prouver que l'ensemble des protocoles bloqués vers la cible vaut {0…255} \ {6}. Rien ne garantit que Windows accepte chaque numéro dans une règle à adresse IPv4, ni que les performances restent correctes [TEST].
- **(B) Accepter ce risque résiduel en le documentant.** Ce trafic ne peut être **qu'émis par l'hôte**. Il ne donne à la VM aucun moyen d'ouvrir une connexion vers l'hôte, car `IN-ALL` couvre tous les protocoles [DÉDUIT].
- **(C) Supprimer le réseau IP de contrôle.** Le contrôle passerait par un **port série virtuel relié à un tube nommé de l'hôte** (`--uart-modeN=server <tube>`) [DOC, résumé de `modifyvm`]. La VM agents ne garderait alors que le réseau interne vers la passerelle. En contrepartie : protocole de transport à écrire, surface d'attaque de l'émulation série, débit faible.

### 3. Sources officielles

- [DOC] priorité des règles : un blocage l'emporte sur une autorisation ;
- [DOC] formats d'adresse et de port de `New-NetFirewallRule`, et `-Protocol` à valeur unique ;
- [DOC] note ALE sur les sockets double pile.

### 4. Réellement garanti

Rien sur le système réel. **La cohérence mathématique de la définition attendue** est démontrée, à condition que l'analyseur soit correct.

### 5. Reste à tester

**T-FW-PLAN étendu.** Tous les cas suivants doivent être refusés :
- `192.168.060.10`, `1.2.3.4` suivi d'un retour à la ligne, chiffres arabes ;
- masque `255.0.255.0`, port `70000`, plage `30-20` ;
- `fe80::/129`, `::1%3` ;
- doublon de règle, règle `ORCH` supplémentaire, règle désactivée, action `Allow`, mauvaise interface, mauvais protocole ;
- adresse `Any` dans `OUT-V6-AUTRES`.

**T-FW-LIVE** : formats réellement renvoyés par Windows.

**T-FW-DUAL** : SSH depuis un client en IPv4 pur, puis depuis un client à socket double pile, pour vérifier que les règles `V6M` ne gênent pas le SSH légitime et bloquent bien les autres ports.

**T-FW-PROTO** : seulement si l'option (A) est retenue.

### 6. Conséquence en cas d'échec

- Analyseur : correction du code, et 0B.4 bloquée.
- Format réel non reconnu : refus de démarrer, puis extension de l'analyseur après revue.
- T-FW-DUAL : revue de la conception IPv6.

---

## Correction 2 : T-NET-03 renforcé

### 1. Défaut constaté

La v5 ne permettait pas de distinguer les causes d'un échec. Elle risquait aussi de conclure au filtrage à états sur la seule réussite du SSH.

Autre imprécision de la v5 : l'événement **5152** n'appartient pas à la sous-catégorie « Filtering Platform Connection ». La liste officielle de cette sous-catégorie contient 5031, 5150, 5151 et 5154 à 5159 [DOC]. 5152 relève de « Filtering Platform Packet Drop » [DÉDUIT].

### 2. Correction proposée : procédure différentielle

**Phase 0, préparation.** Avec votre autorisation :
- activer l'audit `Filtering Platform Connection` (succès et échec) et `Filtering Platform Packet Drop` (échec) ;
- activer `pfirewall.log` ;
- relever `netsh wfp show filters` (lecture seule) pour associer les *Filter Run-Time ID* aux règles ;
- relever `netsh wfp show state`, qui recense les fournisseurs WFP : un antivirus ou un pare-feu tiers peut filtrer de son côté [SUPPOSÉ].

**Phase A, référence sans règles `ORCH`.** Elle se fait avant leur création, avec une VM fraîchement installée, **sans aucun agent**.
- **Routage :** `Find-NetRoute -RemoteIPAddress 192.168.60.10` doit renvoyer l'adaptateur A et l'adresse source 192.168.60.1. `Get-NetRoute -DestinationPrefix 192.168.60.0/24`.
- **Écouteur :** dans la VM, `ss -ltn` montre sshd sur 192.168.60.10:22. Dans le sens inverse, un écouteur de test fixe sur l'hôte en 192.168.60.1:50003.
- **Chemin :** `tcpdump -ni ctl0` dans la VM pendant `Test-NetConnection 192.168.60.10 -Port 22`, puis tentative de la VM vers 192.168.60.1:50003, qui **doit réussir** en phase A.

**Phase B, avec les règles `ORCH`.** Mêmes opérations.

**Diagnostic de l'échec :**

| Observation | Cause |
|---|---|
| `Find-NetRoute` indique une autre interface, ou tcpdump ne voit aucun SYN | **Routage** |
| SYN reçu par la VM, qui répond par un RST ; `ss` ne montre aucun écouteur | **Écouteur** |
| Événement 5157 ou 5152 dont l'identifiant de filtre correspond à une règle `ORCH-*` | **Pare-feu Windows (nos règles)** |
| Événement 5157 ou 5152 dont l'identifiant correspond à une autre règle ou à un autre fournisseur WFP | **Autre règle** |
| SYN envoyé (5156 sortant ou `ALLOW SEND`), SYN-ACK envoyé par la VM (tcpdump), puis 5152 entrant sur ce flux attribué à `ORCH-…-IN-ALL` | **Filtrage à états inopérant face à un blocage explicite** |

**Critères de réussite**, tous obligatoires :
1. Le SSH réussit.
2. Un 5156 existe pour `ssh.exe` en sortie.
3. **Aucun** 5152 ni 5157 sur ce flux.
4. **Toutes** les tentatives ouvertes par la VM (TCP, UDP, ICMP, IPv6 local au lien) échouent, et des événements **attribués à `IN-ALL`** existent.
5. tcpdump est cohérent avec ces événements.

**Le succès du SSH ne suffit pas.**

**Limites d'interprétation des journaux :**
- les événements peuvent être limités en volume et ne sont pas exhaustifs : **l'absence d'événement ne prouve pas l'absence de blocage** ;
- les *Filter Run-Time ID* changent après un redémarrage ou une modification de stratégie : il faut les relever au moment même du test ;
- l'événement indique le filtre qui a tranché, pas tous les filtres concernés ;
- `pfirewall.log` peut perdre des entrées sous forte charge [SUPPOSÉ].

Après le test, l'audit et la journalisation sont remis à leur état initial.

### 3. Sources officielles

- [DOC] trafic sollicité ou non sollicité ;
- [DOC] couches ALE à états ;
- [DOC] liste des événements d'audit.

### 4. Réellement garanti

Rien. Le comportement à états face à un blocage explicite **n'est pas documenté**.

### 5. Reste à tester

T-NET-03a sur `orch-ctl` et T-NET-03b sur `orch-adm`, selon la procédure ci-dessus.

### 6. Conséquence en cas d'échec

**NO-GO pour la conception.** Les options de la v5 (a) et (b) ont des défauts connus. L'option (C) de la correction 1 deviendrait alors une option prioritaire à étudier.

---

## Correction 3 : autotest eBPF différentiel

### 1. Défaut constaté

L'échec d'une connexion vers 10.66.0.1 ou 1.1.1.1 peut venir de la passerelle, du routage ou de nftables. **Ce n'est pas une preuve.**

### 2. Correction proposée

Tout le test se fait **sur la boucle locale de la VM agents**. Il ne touche ni le réseau, ni la passerelle. `IPAddressDeny` s'applique aux sockets `AF_INET` et `AF_INET6` [DOC], ce qui inclut la boucle locale [DÉDUIT].

**Préconditions :**
- un **service de test** : une unité sans restriction réseau qui écoute sur 127.0.0.1:8099 et journalise chaque connexion reçue ;
- `/sys/fs/cgroup` de type cgroup2 (`stat -fc %T /sys/fs/cgroup` doit renvoyer `cgroup2fs`) ;
- aucune règle nftables portant sur la boucle locale, vérifié par `nft list ruleset` ;
- `bpftool` disponible dans l'image [SUPPOSÉ : paquet à prévoir].

**Trois unités transitoires**, avec **exactement les mêmes propriétés** que l'unité de référence (même `User=`, mêmes `RestrictAddressFamilies`, `SystemCallFilter`…), à une exception près :
1. **Témoin** : sans `IPAddressDeny`. La connexion à 127.0.0.1:8099 doit **réussir**, et le service journalise une connexion.
2. **Test** : avec `IPAddressDeny=any`. La connexion doit **échouer**. L'erreur relevée attendue est `EPERM` [SUPPOSÉ], et **aucune** connexion ne doit apparaître dans le journal du service.
3. **Sélectivité** : avec `IPAddressDeny=any` et `IPAddressAllow=127.0.0.1`. La connexion doit **réussir**. Cela prouve que l'échec du test vient du filtre IP, et non d'une autre propriété.

**Preuves à collecter :**
- l'erreur et le journal du service, pour chaque unité ;
- `systemctl show <unité> -p IPAddressDeny -p IPAddressAllow -p ControlGroup` ;
- `bpftool cgroup show /sys/fs/cgroup/<ControlGroup>`, qui doit montrer des programmes `cgroup_skb` en entrée et en sortie **attachés au cgroup de l'unité de test**, et **absents** de celui du témoin [SUPPOSÉ : forme exacte de la sortie] ;
- en option, `IPAccounting=yes` et ses compteurs [SUPPOSÉ].

**Faux positifs possibles :**

| Faux positif | Réponse |
|---|---|
| Échec dû à une autre propriété | L'unité 3 et des propriétés identiques l'écartent |
| Service pas prêt | Témoin lancé avant et après le test |
| Port déjà utilisé | Vérification avec `ss` |
| Confusion entre IPv4 et IPv6 | Adresse littérale 127.0.0.1 |
| `bpftool` absent | **Test non concluant, donc NO-GO** |

Si le témoin échoue, le test est invalide (problème d'environnement).

**Version à chaque démarrage :** les trois unités, plus la preuve d'attachement si `bpftool` est présent. La version complète est jouée en 0B.7.

### 3. Sources officielles

[DOC] `IPAddressAllow` et `IPAddressDeny` : version 235, dépendance eBPF, « sans effet » sans ce support, appliqués à tout le cgroup.

### 4. Réellement garanti

Rien avant le test. Après le test, la preuve vaut **pour cette version du noyau et de systemd**.

### 5. Reste à tester

L'autotest de démarrage et T-SYSD-NET en 0B.7.

### 6. Conséquence en cas d'échec

Toute tâche est refusée. NO-GO pour les appels réels tant que le filtrage par unité n'est pas obtenu autrement, par exemple avec nftables par compte, qui ne résiste pas à un root dans la VM.

---

## Correction 4 : `auth.json` de Codex

### 1. Défaut constaté

La v5 acceptait comme « renouvellement présumé » tout fichier modifié qui gardait les **mêmes clés de premier niveau** (K1 = K0). **Cela ne prouve rien.**
- Les **valeurs** peuvent être remplacées arbitrairement. Par exemple, des jetons d'un **autre compte** feraient tourner le superviseur sous le compte d'un attaquant, qui pourrait alors observer les requêtes.
- Le fichier peut être **rejoué** avec une version plus ancienne.
- Des données peuvent être glissées dans des champs existants.
- Le schéma n'étant pas documenté, **aucun contrôle sémantique honnête n'est possible.**

### 2. Correction proposée

**Mode par défaut : sans écriture en retour.**
- Le fichier principal (root, 0600) est transmis en lecture seule. Codex travaille sur une copie.
- **La copie, renouvelée ou non, n'est jamais réenregistrée.** Le fichier principal n'est remplacé que par une **reconnexion humaine**.
- Ce mode empêche **toute** persistance d'une modification faite par le processus Codex.
- **Il ne fonctionne que si les jetons de renouvellement ne sont pas à usage unique**, ce qui n'est **pas documenté**. Il est validé par T-CRED-NOWB : au moins 5 cycles sur plus de 48 h, sans aucune écriture en retour.

**Si T-CRED-NOWB échoue** (rotation constatée), le mode avec écriture en retour serait :
- recopie seulement après l'arrêt complet de l'unité, avec `O_NOFOLLOW`, contrôle de taille et JSON valide ;
- **mise en quarantaine systématique** de chaque nouvelle version ;
- **refus de nouvelle tâche tant que vous n'avez pas validé** ;
- conservation des versions précédentes ;
- **reconnexion humaine périodique** obligatoire.

**Je dois être clair : dans ce mode, un processus Codex compromis peut faire persister un contenu arbitraire dans son propre fichier d'identifiants.** Aucune validation n'est possible sans schéma documenté, et votre validation porterait sur un contenu opaque. **Ce risque n'est pas résolu de façon fiable.** L'architecture exigerait alors :
- soit une **reconnexion humaine à chaque échec de renouvellement**, en acceptant l'interruption ;
- soit une autre solution : un autre superviseur, ou un compte dédié dont la compromission resterait limitée à ce compte. Les clés API restent exclues, à cause du coût.

**Inchangé :** quarantaine et refus de nouvelle tâche en cas d'incertitude, journal des empreintes, une seule exécution Codex à la fois, et arrêt sur toute erreur d'authentification (`IDENTIFIANTS_CODEX_INVALIDES`, sans nouvelle tentative).

### 3. Sources officielles

[DOC] stockage en clair dans `auth.json`, options de stockage, renouvellement automatique, conseil de conserver le fichier mis à jour en automatisation. **La rotation et le schéma ne sont pas documentés.**

### 4. Réellement garanti

En mode sans écriture en retour, **le processus Codex ne peut pas modifier durablement le fichier principal** [DÉDUIT : il n'a aucun accès en écriture à ce fichier]. Rien d'autre n'est garanti.

### 5. Reste à tester

- **T-CRED-NOWB** ;
- T-CRED-CODEX et T-CRED-FMT, de la v5 ;
- **T-CRED-WB**, seulement si T-CRED-NOWB échoue.

### 6. Conséquence en cas d'échec

Si T-CRED-NOWB échoue, la persistance arbitraire devient possible. Il faut alors une **décision explicite de votre part en 0B.2** (reconnexion humaine régulière, ou autre solution). Sans cette décision : **NO-GO pour Codex.**

---

## Correction 5 : révocation

### 1. Défaut constaté

La v5 mêlait plusieurs notions : suppression locale, déconnexion locale, fermeture de session et révocation côté serveur.

### 2. Clarification

| Niveau | Claude (`setup-token`) | Codex (connexion ChatGPT) |
|---|---|---|
| **Suppression locale** | La commande « ne l'enregistre nulle part » [DOC]. Il suffit de retirer la copie conservée par l'orchestrateur. **Le jeton reste valide.** | Retirer `auth.json`. **Les jetons restent valides** [DÉDUIT] |
| **Déconnexion locale** | `/logout` « supprime et révoque » l'identifiant écrit par une connexion Console sans clé [DOC]. **Aucun effet documenté sur `setup-token`.** | `codex logout` « efface les identifiants actuels » [DOC]. Le texte parle d'effacement local, pas de révocation |
| **Fermeture de session de compte** | Aucune procédure officielle trouvée concernant ces jetons | « Se déconnecter » dans ChatGPT termine la session **dans ce navigateur** [DOC]. Aucun effet documenté sur les jetons de la CLI |
| **Révocation serveur** | **Non documentée officiellement.** Une page de jetons dans les réglages de claude.ai, et des jetons restés actifs après révocation [SECONDAIRE] | **Non documentée** pour les comptes personnels. Les jetons d'espace de travail Enterprise sont révocables [DOC], mais ce cas ne s'applique pas ici |

**Je n'invente aucune procédure.**

**Test T-REVOKE corrigé :**
1. Conserver **à part** une copie de l'ancien jeton (Claude) ou de l'ancien `auth.json` (Codex), en root 0600, dans une zone de test.
2. Appliquer la procédure candidate, si une procédure officielle est un jour identifiée.
3. Utiliser **la copie conservée** pour une requête minimale, autorisée séparément en 0B.9.
4. **Résultat attendu :** refus (401 ou équivalent). **Une acceptation prouve que la procédure est inefficace.**

Le test consomme une requête au modèle : il ne se fait que dans la fenêtre 0B.9, sur autorisation explicite.

### 3. Sources officielles

Documentations d'authentification de Claude Code et de Codex, et documentation des jetons d'accès Enterprise de Codex [DOC]. Les éléments sur la page de jetons de claude.ai et sur les jetons restés actifs sont [SECONDAIRE].

### 4. Réellement garanti

Uniquement la suppression locale.

### 5. Reste à tester

T-REVOKE, dès qu'une procédure serveur officielle existe.

### 6. Conséquence en cas d'échec

**NO-GO maintenu pour les appels réels.**

---

## Verdicts

| Périmètre | Verdict | Motif |
|---|---|---|
| **0B.1** : vérifications en lecture seule | **GO conditionnel** | Liste de commandes fixée à l'avance, sans droits d'administrateur ni modification, avec une autorisation explicite distincte |
| **0B.2** : décisions d'architecture | **GO conditionnel** | Décisions à prendre en connaissance des points ouverts : option A, B ou C pour les protocoles non TCP ; politique d'`auth.json` si T-CRED-NOWB échoue ; comptes dédiés ; choix sur VBS ; repli NAT |
| **Installations** | **NO-GO** | Tant que 0B.1 et 0B.2 ne sont pas validés **et** que l'hôte n'est pas à jour |
| **Appels réels aux agents** | **NO-GO** | **Aucune procédure officielle de révocation côté serveur** pour les deux jetons. Restent aussi à démontrer : T-NET-03a/b, T-FW-DUAL, autotest eBPF différentiel, T-SYSD-COMPAT, T-NAT-WIN ou architecture de repli, T-CRED-NOWB, hôte à jour |

---

## Sources

**Officielles :**
- [Pare-feu Windows : vue d'ensemble](https://learn.microsoft.com/en-us/windows/security/operating-system-security/network-security/windows-firewall/)
- [Pare-feu Windows : gestion en ligne de commande](https://learn.microsoft.com/en-us/windows/security/operating-system-security/network-security/windows-firewall/configure-with-command-line)
- [Pare-feu Windows : priorité des règles](https://learn.microsoft.com/en-us/windows/security/operating-system-security/network-security/windows-firewall/rules)
- [`New-NetFirewallRule`](https://learn.microsoft.com/en-us/powershell/module/netsecurity/new-netfirewallrule)
- [WFP : Application Layer Enforcement](https://learn.microsoft.com/en-us/windows/win32/fwp/application-layer-enforcement--ale-)
- [Audit Filtering Platform Connection](https://learn.microsoft.com/en-us/previous-versions/windows/it-pro/windows-10/security/threat-protection/auditing/audit-filtering-platform-connection)
- [VirtualBox : `VBoxManage` (`--uart-modeN`)](https://www.virtualbox.org/manual/topics/vboxmanage.html)
- [systemd.resource-control](https://www.freedesktop.org/software/systemd/man/latest/systemd.resource-control.html)
- [systemd.exec](https://www.freedesktop.org/software/systemd/man/latest/systemd.exec.html)
- [Claude Code : authentification](https://code.claude.com/docs/en/authentication)
- [Codex : authentification](https://learn.chatgpt.com/docs/auth)
- [Codex Enterprise : jetons d'accès](https://learn.chatgpt.com/docs/enterprise/access-tokens)

**Secondaires**, non retenues comme preuves :
- [Claude Code : demande de fonctionnalité pour révoquer un jeton `setup-token`](https://github.com/anthropics/claude-code/issues/57400)
- [Claude Code : ticket sur des jetons encore actifs après révocation](https://claudeissues.com/issue/57320-bug-oauth-token-deactivation)
- [Communauté OpenAI : demande de gestion des sessions OAuth](https://community.openai.com/t/add-oauth-session-management-for-openai-developer-tools-and-codex-cli-oauth-sessions/1385920)

Je m'arrête ici.
