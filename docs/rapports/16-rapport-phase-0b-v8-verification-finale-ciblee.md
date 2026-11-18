<!-- Rapport extrait de la session Claude « Orchestrateur IA », 2026-11-17 00:17 UTC -->

# Rapport Phase 0B v8 : vérification finale ciblée

**Cadre.** J'ai travaillé uniquement à partir des rapports v5 à v7 et des extraits de documentation déjà obtenus pendant cette conversation. Je n'ai fait aucune nouvelle consultation et lancé aucune commande.

**Limite importante.** Pour `New-NetFirewallRule`, je n'ai lu **que la liste des paramètres** et les descriptions de `-RemoteAddress`, `-RemotePort`, `-Protocol`, `-InterfaceAlias`, `-Program` et `-Action`. **Je n'ai pas lu** les descriptions de `-EdgeTraversalPolicy` ni de `-Platform`. Tout ce qui les concerne ci-dessous est donc [SUPPOSÉ].

**Légende :** [DOC] documentation lue · [DÉDUIT] déduction · [SUPPOSÉ] hypothèse · [TEST] à démontrer.

---

## 1. Défauts trouvés et corrections

### F13 : `EdgeTraversalPolicy`

**Défaut.** La v7 exigeait `Block` sur les huit règles, sans fondement documentaire.

**Ce qui est établi :**
- le paramètre `-EdgeTraversalPolicy <EdgeTraversal>` existe [DOC, liste des paramètres] ;
- **son sens, ses valeurs possibles et sa valeur par défaut n'ont pas été lus.**

Mes connaissances générales sont les suivantes [SUPPOSÉ] : le paramètre concerne le trafic **entrant non sollicité** qui traverse un NAT, par exemple via Teredo. Ses valeurs seraient `Block`, `Allow`, `DeferToUser` et `DeferToApp`. Il serait sans objet pour une règle sortante.

**Correction :**
- **`IN-ALL` (entrante) :** valeur attendue `Block`, considérée comme la valeur restrictive [SUPPOSÉ]. Toute autre valeur entraîne un refus.
- **Règles sortantes :** on n'exige pas arbitrairement `Block`. On accepte **la seule valeur relevée lors de l'étalonnage** (T-FW-LIVE) sur des règles sortantes créées sans préciser ce paramètre. Cette valeur doit être validée par un humain, puis figée dans le code. Toute autre valeur entraîne un refus.
- **Trois cas à distinguer :**
  - **propriété absente** de l'objet : refus ;
  - **valeur neutre** : la valeur étalonnée (par défaut) ;
  - **valeur restrictive** : `Block`.
- **Représentation inconnue :** refus, jamais une interprétation permissive.

### F14 : `Platform`

**Défaut.** Le paramètre `-Platform <String[]>` existe [DOC, liste des paramètres], mais il n'était pas contrôlé. **Son format et sa sémantique n'ont pas été lus.**

Mes connaissances générales [SUPPOSÉ] : il restreindrait la règle à certaines versions de Windows, et une liste vide signifierait « toutes les plateformes ». Une restriction inattendue pourrait **rendre une règle inactive sur cette machine**, ce qui serait silencieusement dangereux pour nos blocages.

**Correction :**
- la propriété est ajoutée à l'objet normalisé **si elle est exposée** sur l'objet règle, ce qui reste à constater en T-FW-LIVE ;
- **valeur neutre attendue :** liste vide [SUPPOSÉ] ;
- **toute valeur non vide entraîne un refus** ;
- propriété absente : refus de la vérification par les cmdlets, et passage à la méthode de secours.

**Méthode de secours, si la propriété n'est pas exposée de façon fiable :**
- vérifier dans WFP que des filtres existent réellement pour chaque règle `ORCH`, avec `netsh wfp show filters` (T-FW-WFP). Une règle inactive ne devrait pas produire de filtre [SUPPOSÉ] ;
- vérifier aussi par le comportement (tests T-NET).

**Le nom et le format ne sont pas inventés :** ils seront relevés, et non postulés.

### F15 : variante A″ de T-NET-03

**Défaut.** Une règle `Allow` temporaire **ne l'emporte pas sur un `Block` explicite préexistant** : le blocage explicite a la priorité [DOC].

**Ce que A″ permet de tester :**
- **si la connexion réussit**, c'est le **blocage par défaut** qui empêchait la connexion. Cela confirme aussi qu'aucune règle `Block` explicite ne correspond à ce trafic, et que le routage et l'écouteur fonctionnent [DÉDUIT] ;
- **si elle échoue**, la cause peut être un blocage explicite préexistant, un fournisseur WFP tiers, le routage ou l'écouteur. **A″ ne permet pas de conclure seul.**

**Correction :**
- **identifier obligatoirement le filtre responsable** : identifiant de filtre de l'événement 5152 ou 5157, rapproché de `netsh wfp show filters` et de `netsh wfp show state` ;
- **interdiction absolue** de désactiver ou de modifier une règle préexistante ;
- **diagnostic ambigu : test déclaré non concluant**, donc NO-GO pour la décision qui en dépend ;
- **A′ (sans aucune modification du pare-feu) reste la procédure privilégiée.** A″ exige une autorisation distincte.

### F16 : protocoles résiduels

| Trafic | Règle censée le traiter | Statut |
|---|---|---|
| TCP vers la cible, ports autres que 22 | `OUT-V4-TCP-HORS22` | Exprimé par une règle [DOC formats] ; **appliqué : non démontré** [TEST] |
| UDP et ICMPv4 vers la cible | `OUT-V4-UDP`, `OUT-V4-ICMP4` | Idem |
| **Autres numéros de protocole IP (0, 2 à 5, 7 à 16, 18 à 255) vers la cible en IPv4** | **Aucune** | **Non bloqués** par conception. `-Protocol` n'accepte qu'une valeur par règle [DOC] |
| Toute adresse IPv6 autre que l'adresse mappée de la cible, tous protocoles **dont ICMPv6** | `OUT-V6-AUTRES` | Exprimé ; appliqué : non démontré |
| Adresse mappée de la cible : TCP hors 22, UDP | `OUT-V6M-*` | Exprimé ; appliqué : non démontré |
| **Adresse mappée de la cible : ICMPv6 et autres protocoles** | **Aucune** | Non bloqués. Une adresse mappée n'existe a priori qu'au niveau des sockets et non sur le réseau [DÉDUIT], ce qui rend ce cas **théorique** |
| Sockets double pile | Couverture par les règles `V6M` | La documentation indique que la classification IPv4 peut ne pas avoir lieu et que le trafic se voit au niveau IPv6, avec l'adresse mappée [DOC]. **On ignore comment le pare-feu traduit une règle IPv4 pour ces sockets** [SUPPOSÉ] |
| **Entrant venant de la VM, tous protocoles** (dont ICMPv6 et protocoles « bruts ») | `IN-ALL` | Les couches ALE autorisent aussi « la création de sockets bruts » [DOC]. Le blocage effectif des protocoles sans connexion **n'est pas démontré** [TEST]. **C'est le sens qui compte le plus pour la sécurité** |
| Écart entre la représentation de la règle et la classification WFP | — | Une règle peut se traduire par plusieurs filtres, à plusieurs couches. **Seul l'examen des filtres WFP réels** peut le montrer [SUPPOSÉ] (T-FW-WFP) |

**Conclusion :** aucun protocole n'est démontré comme bloqué. Le choix A/B/C, pour les protocoles non TCP, UDP ou ICMP **émis par l'hôte**, reste **votre décision** en 0B.2.

### F17 : jointure des filtres

**Ce qui est documenté :**
- les conditions (adresses, ports, sécurité, interfaces, services) sont représentées dans « des objets séparés appelés filtres » [DOC, page sur la ligne de commande] ;
- le passage **d'un filtre à sa règle** par le pipeline est documenté, par exemple `Get-NetFirewallPortFilter | … | Get-NetFirewallRule` ou `Get-NetFirewallApplicationFilter … | Get-NetFirewallRule` [DOC] ;
- l'identifiant unique d'une règle est `-Name` [DOC].

**Ce qui n'est pas documenté** dans ce que j'ai lu :
- la jointure par `InstanceID`, qui **reste une hypothèse** ;
- le sens **règle vers filtre** par le pipeline (`$rule | Get-NetFirewallAddressFilter`), qui est [SUPPOSÉ] même s'il est très probable ;
- le nom des cmdlets `Get-NetFirewallInterfaceTypeFilter` et `Get-NetFirewallServiceFilter`, qui est [SUPPOSÉ]. En revanche, `Get-NetFirewallAddressFilter`, `PortFilter`, `InterfaceFilter`, `ApplicationFilter` et `SecurityFilter` sont cités par la documentation [DOC].

**Méthode plus sûre, plus lente**, qui remplace la jointure en bloc :
1. **Instantané A** : ensemble des `Name` de règles dans `ActiveStore`.
2. **Sens règle → filtre** : pour chaque règle, chaque type de filtre doit renvoyer **exactement un** objet. Sinon, la vérification est refusée.
3. **Sens filtre → règle** (le sens documenté) : énumérer tous les filtres de chaque type, puis remonter de chacun à sa règle. Chaque filtre doit désigner **exactement une** règle de l'instantané A, et chaque règle doit être désignée **exactement une fois** par type de filtre. Il ne doit y avoir ni filtre orphelin, ni règle sans filtre.
4. **Instantané B**, identique à A. Sinon, le pare-feu a changé pendant la lecture : une seule nouvelle tentative, puis refus.
5. **Contrôle final :** le nombre de règles traitées est égal au nombre de règles de A.

Le **squelette `Get-OrchActive` de la v7 est déclaré non exécutable.** Il appelait en plus les cmdlets de filtre **sans `-PolicyStore`**, donc peut-être sur le magasin par défaut au lieu d'`ActiveStore` [SUPPOSÉ]. Il est remplacé par le fragment de la section 2.

### F18 : compatibilité avec Windows PowerShell 5.1

Revue statique. **Rien n'est démontré : chaque point ci-dessous sera vérifié par T-FW-PLAN.**

| N° | Point | Risque |
|---|---|---|
| P1 | `$BI::Pow(2,128)` : l'entier 2 doit être converti implicitement en `BigInteger` | Résolution de la surcharge [SUPPOSÉ]. Correction : `$BI::Pow([System.Numerics.BigInteger]2, 128)` |
| P2 | `$BI::new([byte[]])` | Choix du bon constructeur [SUPPOSÉ] |
| P3 | Opérateurs `+ - %` et comparaisons sur `BigInteger` | Appel des surcharges .NET par PowerShell [SUPPOSÉ] |
| P4 | Conversion `[System.Numerics.BigInteger]` d'une valeur `UInt64` | [SUPPOSÉ] |
| P5 | `UInt64 - UInt64` et `UInt64 + UInt64` : le type du résultat doit rester `UInt64` | Possible élargissement vers `Decimal` ou `Double` [SUPPOSÉ]. Comparaisons ensuite ? |
| P6 | Ne **jamais** comparer un `BigInteger` à un `UInt64` | Filtrage par famille dans `Merge-OrchIntervals`, à vérifier |
| P7 | `Sort-Object -Property Lo` sur des `BigInteger` | [SUPPOSÉ] |
| P8 | Retours `,$tableau` : un tableau vide doit donner `Count = 0` et non `$null` ; un tableau à un élément doit rester un tableau | Déroulement implicite. `ConvertTo-OrchPortIntervals` renvoie `Merge-OrchIntervals …` **sans virgule** : déroulement d'un niveau [DÉDUIT]. À uniformiser avec `,` |
| P9 | `@(@('4',$t), @('6',$mt))` doit donner deux paires | [DÉDUIT] |
| P10 | `$ProtoMap[$null]` lève une exception | Correction : vérifier `$null` explicitement avant l'indexation |
| P11 | `$Matches` après `-cmatch`, et réutilisation après un appel de fonction | Valeurs capturées immédiatement (déjà fait) |
| P12 | Expressions avec `\A…\z`, classes `[0-9]` et motif d'alias contenant un accent grave | Comportement de .NET [DÉDUIT] |
| P13 | `'{0:x2}' -f [byte]` | [DÉDUIT] |
| P14 | Valeurs d'énumération CIM converties en chaînes (`Enabled`, `Action`, `Direction`, `Profile`) | Représentation exacte [SUPPOSÉ] |
| P15 | `Get-NetFirewallRule -Name x` sans résultat : erreur non bloquante, transformée en exception par `ErrorActionPreference=Stop` | Toute vérification d'absence doit utiliser `-ErrorAction SilentlyContinue` puis tester `$null` |
| P16 | Splatting `@p` avec `Enabled='True'` et `Profile='Any'` | Conversion vers les énumérations [SUPPOSÉ] |
| P17 | Accès à une propriété absente sous `Set-StrictMode -Version Latest` | Utiliser `PSObject.Properties[...]` |
| P18 | Propagation de `throw` depuis les blocs `Where-Object` et `ForEach-Object` | [DÉDUIT] |
| P19 | `List[T].Add` ne doit pas polluer la sortie d'une fonction (contrairement à `ArrayList.Add`) | [DÉDUIT] |
| P20 | `& "Get-NetFirewall${k}Filter"` avec une entrée par le pipeline | [DÉDUIT] |

---

## 2. Fragments de code corrigés

Je ne donne que les fragments suffisamment fondés. **Aucun n'est exécutable en l'état ni testé.**

```powershell
# Propriété absente  ≠  valeur vide (neutre)  ≠  valeur restrictive
function Get-OrchProp($Obj, [string]$Name) {
  $p = $Obj.PSObject.Properties[$Name]
  if ($null -eq $p) { throw "Propriété absente : '$Name' (refus)" }
  ,$p.Value
}
function Assert-OrchEdge($Rule, [string]$CalibratedOutbound) {      # F13
  $v = [string](Get-OrchProp $Rule 'EdgeTraversalPolicy')
  if ([string]$Rule.Direction -eq 'Inbound') { if ($v -cne 'Block') { throw "$($Rule.Name) : EdgeTraversalPolicy=$v (attendu Block)" } }
  elseif ($v -cne $CalibratedOutbound) { throw "$($Rule.Name) : EdgeTraversalPolicy=$v (attendu : valeur étalonnée '$CalibratedOutbound')" }
}
function Assert-OrchPlatform($Rule) {                                 # F14 ; valeur neutre supposée : vide
  $v = @(Get-OrchProp $Rule 'Platform') | Where-Object { $null -ne $_ -and [string]$_ -ne '' }
  if (@($v).Count -ne 0) { throw "$($Rule.Name) : restriction de plateforme inattendue '$(@($v) -join ',')'" }
}
# F17 : association règle -> filtre, exactement un objet par type
$OrchFilterKinds = @('Address','Port','Interface','InterfaceType','Application','Service','Security')   # noms InterfaceType et Service : [SUPPOSÉ]
function Get-OrchRuleFilters($Rule) {
  $res = [ordered]@{}
  foreach ($k in $OrchFilterKinds) {
    $f = @($Rule | & "Get-NetFirewall${k}Filter")
    if ($f.Count -ne 1) { throw "Règle '$($Rule.Name)' : $($f.Count) filtre(s) $k (attendu : 1)" }
    $res[$k] = $f[0]
  }
  $res
}
# F17 : contrôle inverse, dans le sens documenté filtre -> règle
function Assert-OrchJoin([string[]]$RuleNames) {
  foreach ($k in $OrchFilterKinds) {
    $seen = @{}
    foreach ($f in @(& "Get-NetFirewall${k}Filter" -PolicyStore ActiveStore)) {      # -PolicyStore sur les filtres : [SUPPOSÉ]
      $r = @($f | Get-NetFirewallRule)
      if ($r.Count -ne 1) { throw "Filtre $k orphelin ou ambigu ($($r.Count) règles)" }
      $n = [string]$r[0].Name
      if ($RuleNames -cnotcontains $n) { throw "Filtre $k rattaché à une règle hors instantané : '$n'" }
      if ($seen.ContainsKey($n)) { throw "Règle '$n' : plusieurs filtres $k" }
      $seen[$n] = $true
    }
    foreach ($n in $RuleNames) { if (-not $seen.ContainsKey($n)) { throw "Règle '$n' sans filtre $k" } }
  }
}
# P10
function Get-OrchProto($Value) {
  if ($null -eq $Value -or -not $ProtoMap.ContainsKey([string]$Value)) { throw "Protocole inconnu ou absent : '$Value'" }
  $ProtoMap[[string]$Value]
}
```

---

## 3. Retour arrière revu

**Magasins.** `ActiveStore` est la vue **effective**, issue de la fusion des règles locales et des stratégies [SUPPOSÉ]. Les suppressions ne visent **que** `PersistentStore`, c'est-à-dire les règles locales. Une règle de stratégie de groupe n'y figure pas, et elle ne peut donc pas être atteinte par `Remove-NetFirewallRule -PolicyStore PersistentStore` [DÉDUIT]. On vérifie en plus son `PolicyStoreSourceType` [SUPPOSÉ : nom et valeur].

**Procédure :**
1. **Avant :**
   - instantanés S0, avec les `Name` d'`ActiveStore` et de `PersistentStore`, et une **empreinte des propriétés normalisées** de chaque règle ;
   - pour chaque nom prévu `ORCH-<runId>-<alias>-<n°>`, vérifier qu'il **n'existe dans aucun** magasin. S'il existe : arrêt (collision de noms).
2. **Journal en deux temps**, en ajout seul et synchronisé sur disque à chaque écriture :
   - `INTENTION <Name>` **avant** la création ;
   - `CRÉÉE <Name> <empreinte>` **après** la création et la relecture de la règle.
3. **Suppression autorisée** seulement pour une règle qui remplit **toutes** ces conditions :
   - journalisée `CRÉÉE` ;
   - absente de S0 ;
   - présente dans `PersistentStore` par son `Name` exact ;
   - `Group` égal à `ORCH-<runId>` ;
   - source locale ;
   - **empreinte actuelle égale à l'empreinte journalisée**, ce qui prouve qu'elle n'a pas été modifiée par quelqu'un d'autre.

   La suppression se fait une règle à la fois, avec `Remove-NetFirewallRule -Name <exact> -PolicyStore PersistentStore`. Après chacune, on vérifie que **seule** cette règle a disparu.
4. **Arrêt sans aucune suppression** dans chacun de ces cas :
   - `INTENTION` sans `CRÉÉE` : interruption entre la création et la journalisation ;
   - règle portant l'identifiant d'exécution mais absente du journal ;
   - empreinte différente ;
   - règle de S0 modifiée, ou ensemble différent de S0 en dehors de nos règles (modification concurrente).

   Dans tous ces cas, la liste vous est présentée.
5. **Vérification finale :** les ensembles d'`ActiveStore` et de `PersistentStore` sont **égaux à S0**, et les empreintes des règles de S0 sont inchangées. Sinon : arrêt et revue humaine.

Le retour arrière fait partie de l'étape 0B.4 et relève de son autorisation. **Il n'est pas prêt à l'emploi tant que T-FW-ROLLBACK n'a pas été exécuté.**

---

## 4. Hypothèses encore non vérifiées

**Pare-feu :**
- sens, valeurs et valeur par défaut d'`EdgeTraversalPolicy` ; format et sémantique de `Platform` ;
- noms des cmdlets `InterfaceTypeFilter` et `ServiceFilter` ; paramètre `-PolicyStore` des cmdlets de filtre ; sens règle → filtre par le pipeline ;
- jointure par `InstanceID` (abandonnée) ;
- nom et valeur de `PolicyStoreSourceType` ; nature exacte d'`ActiveStore` ;
- représentation des énumérations ; présence de filtres WFP pour une règle inactive ;
- traduction des règles IPv4 pour les sockets double pile ; blocage effectif des protocoles bruts en entrée.

**PowerShell :** points P1 à P20.

**Points des v6 et v7 toujours ouverts :**
- fonctionnement à états face à un blocage explicite ;
- `pktmon` ;
- code d'erreur `EPERM` ;
- formats de `bpftool` et de `systemctl` ;
- rotation et révocation des jetons ;
- comportement du NAT de VirtualBox.

---

## 5. Tests nécessaires

Ils s'ajoutent à ceux de la v7. **Aucun n'a été exécuté.**

| Test | Objet | Réussite | Échec |
|---|---|---|---|
| **T-FW-PLAN (5.1)** | Points P1 à P20, plus les cas v7 et des cas sur les types : un tableau d'un élément, un tableau vide, `$null`, et les comparaisons entre `BigInteger` et `UInt64` | Résultats exacts et refus attendus, sans exception inattendue | Correction du code ; 0B.4 bloquée |
| **T-FW-LIVE (étalonnage)** | Relevé des propriétés réelles (EdgeTraversal, Platform, énumérations, source) sur les huit règles | Valeurs relevées, validées par un humain, puis figées | Refus ; revue du code |
| **T-FW-JOIN** | `Assert-OrchJoin`, et une modification de règle **provoquée** entre les instantanés A et B | Jointure cohérente ; changement détecté | Méthode non fiable : refus |
| **T-FW-WFP** | Filtres WFP réels de chaque règle `ORCH` : présence, couches, conditions | Filtres présents et conformes | La règle n'est peut-être pas appliquée : NO-GO réseau |
| **T-FW-PROTO-RES** | **Entrée** : la VM envoie ICMPv6, GRE, SCTP et du trafic brut vers l'hôte ; capture avec pktmon et événements WFP. **Sortie** : observation dans la VM | Entrée : rien n'est traité par l'hôte, et des événements attribués à `IN-ALL` existent. Sortie : résultat conforme au choix A/B/C | Entrée non bloquée : **NO-GO** |
| **T-FW-ROLLBACK** | Échec provoqué ; interruption entre `INTENTION` et `CRÉÉE` ; collision de noms simulée ; modification concurrente simulée | Suppression limitée aux règles éligibles ; arrêt sans suppression dans les cas ambigus ; état final égal à S0 | Retour arrière inutilisable : installation interdite |
| **T-NET-03 A″** | Seulement si A′ n'est pas concluante | Réussite, ou échec dont le filtre responsable est identifié | Diagnostic ambigu : non concluant |

---

## 6. Risques résiduels

Ils sont inchangés depuis la v7, avec deux précisions :
1. Les propriétés `EdgeTraversalPolicy` et `Platform` sont **non documentées dans le dossier**. Leur contrôle repose sur un étalonnage.
2. **Le blocage en entrée des protocoles non TCP et non UDP venant de la VM n'est pas démontré.** C'est désormais un **point bloquant** pour les appels réels.

---

## 7. Verdicts actualisés

| Périmètre | Verdict | Motif |
|---|---|---|
| **Cohérence documentaire** | **Améliorée, incomplète** | F13 à F18 traités, mais des propriétés restent non documentées dans le dossier, et le code n'est ni complet ni testé |
| **0B.1** : contrôles en lecture seule | **GO conditionnel** | Liste de commandes fixée à l'avance, sans droits d'administrateur ni modification ; **autorisation explicite distincte nécessaire**, et non présumée |
| **0B.2** : décisions d'architecture | **GO conditionnel** | Choix A/B/C, comptes dédiés, VBS, repli NAT, superviseur de remplacement |
| **Installation** | **NO-GO** | 0B.1 et 0B.2 non validés ; hôte non vérifié ; T-FW-PLAN, T-FW-JOIN et T-FW-ROLLBACK non exécutés |
| **Appels réels aux agents** | **NO-GO** | Révocation serveur non documentée ; T-FW-PROTO-RES (entrée), T-FW-WFP, T-NET-03, T-EBPF-*, T-SYSD-COMPAT, T-NAT-WIN et T-CRED-NOWB non démontrés |

---

**Déclaration.** Cette mission est restée strictement documentaire. Je n'ai exécuté aucune commande, créé, modifié ou supprimé aucun fichier, rien installé ni démarré, contacté aucun agent, aucune API ni aucun service externe, et je n'ai consulté ni Fastclip ni Git. **Aucune autorisation d'exécution n'est considérée comme acquise.**
