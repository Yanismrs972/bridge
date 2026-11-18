<!-- Rapport extrait de la session Claude « Orchestrateur IA », 2026-11-17 00:53 UTC -->

# Rapport Phase 0B v11 : corrections F28 à F33

**Rappel du contexte.** L'orchestrateur tourne sur l'hôte Windows et pilote une VM agents et une VM passerelle. Le contrôle passe par deux réseaux host-only, protégés par huit règles `ORCH-*` par interface. Le retour arrière repose sur des instantanés S0 et sur des empreintes **canoniques** des règles et de leurs sept filtres.

Ce rapport s'appuie **uniquement** sur les rapports v5 à v10 et sur les extraits de documentation déjà obtenus.

**Je n'ai consulté aucune documentation .NET, CIM ou WFP au-delà de ces extraits.** Toute affirmation sur ces API est donc [SUPPOSÉ], même lorsqu'elle repose sur des connaissances générales solides.

**Légende :** [DOC] documentation lue · [DÉDUIT] déduction · [SUPPOSÉ] hypothèse · [TEST] à démontrer.

---

## 1. Principe commun : un encodage étiqueté et délimité par sa longueur

**Défaut transversal de la v10.** Les représentations mêlaient des préfixes et des séparateurs (`|`, `:`, `[ ]`). C'est fragile.

**Correction.** Chaque valeur est encodée sous la forme **`<étiquette><longueur>:<contenu>`** :
- l'**étiquette** est un caractère qui identifie le type ;
- la **longueur** est le nombre d'unités UTF-16 du contenu, en notation décimale ;
- le **contenu** d'une valeur composite est la simple **suite des encodages de ses composants**, chacun délimité par sa propre longueur.

Le résultat est **sans ambiguïté et sans séparateur à interpréter** [DÉDUIT].

L'empreinte est un SHA-256 calculé sur le texte encodé **en UTF-8 strict**. Un caractère de substitution isolé (surrogate) lève une exception au lieu d'être remplacé silencieusement par U+FFFD, ce qui aurait pu rendre deux chaînes différentes identiques [SUPPOSÉ : comportement de `UTF8Encoding(false, true)`].

---

## 2. Corrections

### F28 : dictionnaires

**Défaut.** La table `@{}` de PowerShell compare les clés **sans tenir compte de la casse** : `Name` et `name` auraient fusionné [SUPPOSÉ, comportement connu de PowerShell].

Deux autres pièges ont été trouvés en relisant :
- `$h.Keys` et `$h.Count` renvoient **la valeur de l'entrée** si le dictionnaire contient une clé nommée `Keys` ou `Count` [SUPPOSÉ]. Il faut passer par `PSBase`.
- Le comparateur implicite ne doit pas être utilisé.

**Correction :**
- **structure :** un `Dictionary[string,string]` construit **explicitement** avec `StringComparer::Ordinal` ;
- **clés :** chaque clé du dictionnaire source est d'abord **canonisée**. L'étiquette de type fait partie de sa forme canonique, ce qui distingue `1` (entier) de `"1"` (chaîne) ;
- **doublons :** deux clés sources différentes qui donnent la même forme canonique entraînent un **refus** ;
- **tri :** tri ordinal des formes canoniques des clés ;
- **clé non sérialisable :** exception, donc refus ;
- **dictionnaire vide :** encodé avec un nombre d'entrées égal à 0 ;
- **lecture de la source :** par `PSBase.Keys`, puis par l'indexeur avec l'objet-clé d'origine [SUPPOSÉ].

### F29 : tableaux

**Correction.** Pour un `System.Array`, l'encodage comprend :
- le **type exact** (nom complet) ;
- le **rang** ;
- pour chaque dimension, sa **longueur** et sa **borne inférieure** ;
- puis les éléments, **dans l'ordre d'énumération ligne par ligne** [SUPPOSÉ : ordre d'énumération .NET d'un tableau multidimensionnel].

Contrôle supplémentaire : le nombre d'éléments énumérés doit être égal au **produit des longueurs**, sinon refus.

| Cas | Traitement |
|---|---|
| Tableau unidimensionnel | Rang 1 |
| Tableau en escalier (tableau de tableaux) | Un tableau de tableaux, chacun encodé avec sa propre structure |
| Tableau vide | Rang et longueurs nulles |
| `List`1`, `ArrayList`, `Collection`1`, `ReadOnlyCollection`1` | Type, nombre d'éléments, éléments dans l'ordre, **seulement pour cette liste fermée** de collections ordonnées |
| Collections **non indexées ou à ordre non déterministe** (`HashSet`, collections de clés, énumérables paresseux ou générateurs) | **Refus** |

### F30 : inventaire des propriétés système CIM

**Changement de principe.** Par défaut, **tout est inclus**, y compris le nom du serveur et le chemin. Ces valeurs sont stables sur une même machine [SUPPOSÉ]. Les inclure ne fait que rendre l'instantané propre à cette machine. **Les exclusions de la v10 sont retirées.**

**Inventaire par réflexion .NET**, sans passer par l'adaptateur PowerShell :
- liste des propriétés publiques des types `CimInstance`, `CimSystemProperties` et `CimProperty` [SUPPOSÉ : noms de types] ;
- comparaison avec un **inventaire de référence versionné** :
  - pour `CimSystemProperties` : `Namespace`, `ServerName`, `ClassName`, `Path` [SUPPOSÉ] ;
  - pour `CimProperty` : `Name`, `Value`, `CimType`, `Flags`, et un éventuel indicateur de modification côté client [SUPPOSÉ].
- **Toute propriété publique absente de cet inventaire entraîne un refus.** Une nouvelle propriété n'est donc jamais ignorée silencieusement.

**Seule exception envisagée : le schéma de classe (`CimClass`).** Il décrit la classe et non l'instance. Il n'est pas sérialisé par instance, mais **une seule empreinte du schéma par classe** est calculée : nom de la classe parente, noms et types CIM de ses propriétés [SUPPOSÉ : API]. Un changement de schéma, par exemple après une mise à jour de Windows, entraîne une dérive et un refus. **Cette exclusion est documentée, justifiée, versionnée, et doit être approuvée par vous** avant usage.

**Toute autre exclusion** suit la même procédure : documentation, justification, version et approbation. Elle n'est envisagée que si T-FW-CIM-SYSTEM montre une **instabilité réelle**.

**La complétude des données CIM reste une hypothèse.** Rien ne prouve que le fournisseur NetSecurity expose toutes ses données pertinentes dans les propriétés CIM [SUPPOSÉ].

### F31 : règles concurrentes et attribution

**Dimensions de filtrage à examiner** (noms des paramètres [DOC] ; noms des propriétés renvoyées [SUPPOSÉ]) :
- sens, action, activation, profil ;
- adresses locales et distantes, dont les mots-clés dynamiques ;
- ports locaux et distants, cible dynamique ;
- protocole, type ICMP ;
- interface, type d'interface ;
- programme, paquet d'application, service, propriétaire ;
- utilisateur local, utilisateur distant, machine distante ;
- authentification, chiffrement, contournement des blocages ;
- traversée de NAT, options de mappage, plateforme ;
- étiquettes App Control (`PolicyAppId` [DOC, page « rules »]).

**Quatre catégories de candidats :**

| Catégorie | Peut être exclue si… |
|---|---|
| **1. Règles NetSecurity interprétables** | **Au moins une** dimension est **entièrement interprétable** et ne correspond **pas** au stimulus. Exemples : sens opposé ; `Enabled=False` ; action `Allow` (le contournement de blocage étant déjà refusé partout) ; protocole différent ; intervalles d'adresses ou de ports disjoints ; liste d'interfaces explicite qui ne contient pas l'interface du stimulus ; profil ne contenant pas le profil réellement appliqué à l'adaptateur ; programme dont le chemin littéral exact diffère. **Restent non interprétables :** les chemins à variables d'environnement, les descripteurs SDDL d'utilisateur, les mots-clés dynamiques, une plateforme non vide et les étiquettes App Control. Les conditions d'authentification ou de chiffrement « requises » ne correspondent pas à du trafic sans IPsec [DÉDUIT], mais ce point reste [TEST] |
| **2. Filtres WFP du pare-feu Windows** | Couche sans rapport avec le stimulus, ou conditions exportées **entièrement interprétables** et disjointes. Une action « autoriser » ne peut pas causer un blocage [DÉDUIT] |
| **3. Filtres de fournisseurs tiers** | Mêmes critères. Les filtres à **callout** peuvent faire n'importe quoi : **ils ne sont jamais exclus**, sauf si leur couche est hors sujet |
| **4. Conditions non interprétables, ou filtres non visibles** (filtres de démarrage, filtres internes) | **Jamais exclus** |

**Règle de décision.** On peut déclarer la règle `ORCH` **seule responsable** seulement si :
- l'événement désigne son filtre, avec une identité établie (F32) ;
- **et** tous les autres candidats ont été **exclus**, avec un motif documenté.

**Sinon : attribution partielle.**

### F32 : identité et stabilité des filtres WFP

**Un identifiant égal dans deux relevés ne suffit pas.** Il faut vérifier les sept conditions suivantes :
1. **même démarrage**, par comparaison de l'heure du dernier démarrage avant et après [SUPPOSÉ : source de cette valeur] ;
2. **même contexte de stratégie** : empreinte globale `ActiveStore` (F27) **et** empreinte de l'ensemble des filtres WFP identiques avant et après ;
3. **présence du filtre dans les deux relevés** ;
4. **même clé GUID du filtre** et **même identifiant d'exécution** ;
5. **même fournisseur**, **même couche et sous-couche**, **même poids et même action** ;
6. **mêmes conditions**, comparées sous forme canonique ;
7. **pas de suppression puis recréation non détectée.**

Ces noms de champs proviennent de connaissances générales sur WFP, pas de documentation lue [SUPPOSÉ].

**Limites :**
- deux relevés ne peuvent pas détecter une suppression suivie d'une recréation à l'identique entre eux. Il faudrait l'audit des **changements de stratégie WFP** [SUPPOSÉ : sous-catégorie et événements], dont l'activation **modifie la configuration** et demande une autorisation distincte ;
- l'export WFP lui-même n'est pas instantané.

**Si l'identité ne peut pas être établie :** corrélation **partielle**, ou **non établie** si une condition est contredite.

### F33 : dates et métadonnées CIM

**Dates :**

| Type | Encodage |
|---|---|
| `DateTime`, `Kind = Utc` | `Kind`, puis `Ticks` |
| `DateTime`, `Kind = Unspecified` | `Kind`, puis `Ticks` **bruts, sans aucune conversion ni hypothèse de fuseau**. Si un contrôle avait besoin de l'instant réel, il faudrait refuser. Aucun contrôle actuel n'en a besoin |
| `DateTime`, `Kind = Local` | `Kind`, `Ticks`, identifiant du fuseau horaire local, décalage UTC à cette date. **Une heure ambiguë au moment d'un changement d'heure entraîne un refus** |
| `DateTimeOffset` | `Ticks` et décalage |
| `TimeSpan` | `Ticks` |

Les règles de pare-feu contiennent-elles des dates ? [SUPPOSÉ : probablement non].

**Métadonnées CIM**, chacune encodée comme une valeur étiquetée :
- `Namespace` et `ClassName` : chaînes **exactes**, sans normalisation de casse. Une instabilité entraîne un refus ;
- `CimType` et `Flags` : encodés comme des **énumérations**, c'est-à-dire le type complet **et** la valeur entière sous-jacente [SUPPOSÉ : ce sont des énumérations] ;
- chaque propriété CIM : nom, puis type CIM, puis indicateurs, puis valeur, chacun délimité par sa propre longueur.

---

## 3. Réexamen global du canonicaliseur

| Type | Décision |
|---|---|
| Entiers (`Byte`, `SByte`, `Int16` à `UInt64`) | Type et valeur en notation invariante |
| `Char` | Point de code UTF-16 |
| `IntPtr`, `UIntPtr`, `BigInteger` | **Refus** : dépendant de la plateforme ou non attendu |
| `Decimal` | Résultat de `GetBits`, qui préserve l'échelle : `1.0` et `1.00` restent distincts |
| `Double` et `Single` | **Représentation binaire exacte**, en hexadécimal. La forme `R` de la v10 était un défaut : sous .NET Framework, elle confondrait sans doute `-0.0` et `0.0` [SUPPOSÉ]. La représentation binaire distingue aussi NaN et ±∞ |
| GUID | Forme `D` |
| Dates | Voir F33 |
| Énumérations | Type et valeur entière sous-jacente. Le nom n'est pas fiable : alias et combinaisons d'indicateurs [DÉDUIT] |
| Chaînes | Exactes, sans normalisation Unicode, en UTF-8 strict |
| Tableaux d'octets | Hexadécimal, traité **avant** les tableaux en général |
| Dictionnaires | Voir F28 |
| Objets PowerShell simples | Propriétés de note seules, triées en ordre ordinal. L'ordre d'insertion n'est **pas** significatif, choix documenté. Les membres ajoutés à une valeur ordinaire ne sont pas sérialisés : aucun n'est attendu dans les données CIM brutes [SUPPOSÉ] |
| Instances CIM | **Spécification seulement**, sans code, puisque les API ne sont pas vérifiées (F30 et F33) |
| Tableaux et collections | Voir F29 |
| Récursion | Profondeur maximale de 16, **et** détection des cycles par égalité de référence sur le chemin courant (`ReferenceEquals`), car .NET Framework n'a pas de comparateur de références prêt à l'emploi [SUPPOSÉ] |
| Tout autre type | **Refus** |

**Constructions PowerShell 5.1 dont la sémantique n'est pas établie [SUPPOSÉ] :**
- `-is [enum]` sur des valeurs CIM converties ;
- `ChangeType` vers le type sous-jacent d'une énumération ;
- `$tableau.Rank` (propriété du tableau et non énumération de ses membres) ;
- ordre de `foreach` sur un tableau multidimensionnel ;
- `PSBase` sur un `Dictionary` générique ;
- `New-Object` avec un comparateur passé en argument ;
- `GetType()` d'une valeur enveloppée dans un `PSObject` ;
- exceptions levées par `UTF8Encoding` en mode strict ;
- `IsAmbiguousTime`.

### Fragment de code, non exécuté et partiel

Il dépend des hypothèses ci-dessus. Les instances CIM ne sont volontairement **pas** implémentées.

```powershell
$OrchCanonVersion = 'canon-v11'
$Utf8Strict = New-Object System.Text.UTF8Encoding($false, $true)
$Inv = [Globalization.CultureInfo]::InvariantCulture
function New-OrchTlv([char]$Tag, [string]$Payload) { [string]$Tag + [string]$Payload.Length + ':' + $Payload }
function ConvertTo-OrchCanon($Value, [int]$Depth = 0, $Path = $null) {
  if ($null -eq $Path) { $Path = New-Object 'System.Collections.Generic.List[object]' }
  if ($Depth -gt 16) { throw 'Profondeur excessive : instantané refusé' }
  if ($null -eq $Value) { return 'N0:' }
  $t = $Value.GetType()
  if ($Value -is [string]) { [void]$Utf8Strict.GetBytes($Value); return New-OrchTlv 'S' $Value }
  if ($Value -is [bool])   { return New-OrchTlv 'B' $(if ($Value) { '1' } else { '0' }) }
  if ($Value -is [char])   { return New-OrchTlv 'H' ([string][int]$Value) }
  if ($Value -is [enum]) {
    $u = [System.Convert]::ChangeType($Value, [System.Enum]::GetUnderlyingType($t), $Inv)
    return New-OrchTlv 'E' ((New-OrchTlv 'S' $t.FullName) + (ConvertTo-OrchCanon $u ($Depth + 1) $Path))
  }
  $ints = [type[]]@([byte],[sbyte],[int16],[uint16],[int32],[uint32],[int64],[uint64])
  if ($ints -contains $t)   { return New-OrchTlv 'I' ((New-OrchTlv 'S' $t.FullName) + (New-OrchTlv 'S' ([System.Convert]::ToString($Value, $Inv)))) }
  if ($Value -is [decimal]) { return New-OrchTlv 'Q' (([decimal]::GetBits($Value) | ForEach-Object { $_.ToString($Inv) }) -join ',') }
  if ($Value -is [double])  { return New-OrchTlv 'F' ('d' + [BitConverter]::DoubleToInt64Bits($Value).ToString('x16')) }
  if ($Value -is [single])  { return New-OrchTlv 'F' ('s' + (-join ([BitConverter]::GetBytes([single]$Value) | ForEach-Object { $_.ToString('x2') }))) }
  if ($Value -is [guid])    { return New-OrchTlv 'G' $Value.ToString('D') }
  if ($Value -is [datetime]) {
    $p = (New-OrchTlv 'S' ([string]$Value.Kind)) + (New-OrchTlv 'S' $Value.Ticks.ToString($Inv))
    if ($Value.Kind -eq [DateTimeKind]::Local) {
      $tz = [TimeZoneInfo]::Local
      if ($tz.IsAmbiguousTime($Value)) { throw 'Date locale ambiguë : instantané refusé' }
      $p += (New-OrchTlv 'S' $tz.Id) + (New-OrchTlv 'S' $tz.GetUtcOffset($Value).Ticks.ToString($Inv))
    }
    return New-OrchTlv 'T' $p
  }
  if ($Value -is [datetimeoffset]) { return New-OrchTlv 'O' ((New-OrchTlv 'S' $Value.Ticks.ToString($Inv)) + (New-OrchTlv 'S' $Value.Offset.Ticks.ToString($Inv))) }
  if ($Value -is [timespan]) { return New-OrchTlv 'P' $Value.Ticks.ToString($Inv) }
  if ($Value -is [byte[]])   { return New-OrchTlv 'X' (-join ($Value | ForEach-Object { $_.ToString('x2') })) }
  if ($t.IsValueType) { throw "Type valeur non pris en charge : $($t.FullName)" }
  foreach ($seen in $Path) { if ([object]::ReferenceEquals($seen, $Value)) { throw 'Cycle détecté : instantané refusé' } }
  $Path.Add($Value)
  try {
    if ($Value -is [Microsoft.Management.Infrastructure.CimInstance]) { throw 'Encodage CIM non implémenté : API non vérifiée (spécification F30, F33)' }
    if ($Value -is [System.Collections.IDictionary]) {
      $map = New-Object 'System.Collections.Generic.Dictionary[string,string]' ([System.StringComparer]::Ordinal)
      foreach ($k in @($Value.PSBase.Keys)) {
        $kc = ConvertTo-OrchCanon $k ($Depth + 1) $Path
        if ($map.ContainsKey($kc)) { throw 'Clés identiques après canonicalisation : instantané refusé' }
        $map.Add($kc, (ConvertTo-OrchCanon $Value[$k] ($Depth + 1) $Path))
      }
      $keys = New-Object 'string[]' $map.Count; $map.PSBase.Keys.CopyTo($keys, 0); [Array]::Sort($keys, [System.StringComparer]::Ordinal)
      $p = (New-OrchTlv 'S' $t.FullName) + (New-OrchTlv 'S' ([string]$keys.Count))
      foreach ($k in $keys) { $p += $k + $map[$k] }                        # clés et valeurs déjà auto-délimitées
      return New-OrchTlv 'D' $p
    }
    if ($Value -is [System.Array]) {
      $p = (New-OrchTlv 'S' $t.FullName) + (New-OrchTlv 'S' ([string]$Value.Rank)); $n = [int64]1
      for ($d = 0; $d -lt $Value.Rank; $d++) { $p += (New-OrchTlv 'S' ([string]$Value.GetLength($d))) + (New-OrchTlv 'S' ([string]$Value.GetLowerBound($d))); $n *= $Value.GetLength($d) }
      $c = 0; foreach ($i in $Value) { $p += ConvertTo-OrchCanon $i ($Depth + 1) $Path; $c++ }
      if ($c -ne $n) { throw 'Nombre d''éléments incohérent : instantané refusé' }
      return New-OrchTlv 'A' $p
    }
    $gen = if ($t.IsGenericType) { $t.GetGenericTypeDefinition().FullName } else { $t.FullName }
    if ($Value -is [System.Collections.IList] -and @('System.Collections.ArrayList','System.Collections.Generic.List`1','System.Collections.ObjectModel.Collection`1','System.Collections.ObjectModel.ReadOnlyCollection`1') -contains $gen) {
      $p = (New-OrchTlv 'S' $t.FullName) + (New-OrchTlv 'S' ([string]$Value.Count))
      foreach ($i in $Value) { $p += ConvertTo-OrchCanon $i ($Depth + 1) $Path }
      return New-OrchTlv 'L' $p
    }
    if ($t -eq [System.Management.Automation.PSCustomObject]) {
      $members = @($Value.PSObject.Properties)
      if (@($members | Where-Object { $_.MemberType -ne 'NoteProperty' }).Count) { throw 'Membres calculés : instantané refusé' }
      $names = [string[]]@($members | ForEach-Object Name); [Array]::Sort($names, [System.StringComparer]::Ordinal)
      $p = New-OrchTlv 'S' ([string]$names.Count)
      foreach ($nm in $names) { $p += (New-OrchTlv 'S' $nm) + (ConvertTo-OrchCanon $Value.PSObject.Properties[$nm].Value ($Depth + 1) $Path) }
      return New-OrchTlv 'R' $p
    }
    throw "Type non pris en charge : $($t.FullName) — instantané refusé"
  } finally { $Path.RemoveAt($Path.Count - 1) }
}
```

---

## 4. Effets sur F27 et sur les garanties

**Aucune empreinte n'est valide, et donc aucune suppression n'est possible, dans chacun des cas suivants :**
- une ambiguïté de canonicalisation, quelle qu'elle soit ;
- un type, une propriété ou une propriété système inconnu ;
- une structure mal représentée : collection non ordonnée, nombre d'éléments incohérent, cycle ;
- une **exclusion CIM non approuvée** ;
- une **identité de filtre WFP incertaine** (F32) ;
- des instantanés instables ;
- F20 non validé, ou une association ambiguë ;
- une **version de canonicalisation différente** entre S0 et l'état courant (passer de `canon-v10` à `canon-v11` **invalide** toute comparaison avec un S0 calculé en v10).

**Pour un test d'efficacité :** si un candidat concurrent ne peut pas être exclu, l'attribution est partielle et la règle n'est pas démontrée. Cela n'empêche pas un retour arrière, qui ne repose que sur les empreintes.

**Empreinte valide et règle appliquée sont deux choses différentes.** Une empreinte valide prouve **l'identité et la stabilité des données lues** dans NetSecurity. Elle ne prouve **pas** que Windows applique la règle. Cette preuve ne peut venir que de T-FW-COMPORT, de T-FW-CORRELATION et de T-FW-FILTER-IDENTITY, avec leurs limites.

---

## 5. Hypothèses restantes

**[SUPPOSÉ] :**
- toutes les API .NET et CIM citées : `UTF8Encoding` strict, `Dictionary` et `StringComparer`, `Array.Rank`, `GetLength`, `GetLowerBound`, ordre d'énumération, `BitConverter`, `decimal.GetBits`, `TimeZoneInfo`, types `CimInstance`, `CimProperty`, `CimSystemProperties`, `CimType`, `CimFlags`, `CimClass` ;
- comportement de la table `@{}` et de `PSBase` ;
- complétude des données CIM de NetSecurity ;
- champs de l'export WFP ;
- source de l'heure de démarrage ;
- audit des changements de stratégie WFP ;
- présence de dates dans les règles de pare-feu ;
- **toutes** les hypothèses ouvertes depuis la v6 : magasins, `Platform`, `EdgeTraversalPolicy`, fonctionnement à états, champs des événements, pktmon, sockets double pile, eBPF, jetons de Codex, révocation serveur, NAT de VirtualBox.

---

## 6. Nouveaux tests

**Aucun n'a été exécuté.** Ils se font sur des objets de test **locaux**, sans modification du système, sauf mention contraire.

| Test | Préconditions | Observations attendues | Réussite | Conséquence d'un échec |
|---|---|---|---|---|
| **T-FW-CANON-DICT** | Dictionnaires de test | `Name` et `name` ; `1` (entier) et `"1"` (chaîne) ; deux clés distinctes de même forme canonique ; dictionnaire vide ; clé nommée `Keys` ou `Count` ; clé non sérialisable | Encodages distincts dans les deux premiers cas ; refus dans le troisième ; encodage d'un dictionnaire vide ; énumération correcte des clés pièges ; refus de la clé non sérialisable | Canonicalisation non fiable : installation NO-GO |
| **T-FW-CANON-ARRAY** | Tableaux de test | 1×6, 2×3, 3×2 et 6×1 avec les mêmes éléments ; tableau en escalier ; tableau vide ; borne inférieure non nulle ; `HashSet` ; énumérable paresseux | Les quatre formes donnent quatre encodages différents ; refus pour les deux derniers types | Idem |
| **T-FW-CIM-SYSTEM** | Lecture d'une instance de règle (0B.4 ou plus tard) | Inventaire par réflexion des propriétés publiques ; comparaison avec la référence ; deux lectures successives | Inventaire égal à la référence ; valeurs stables ; empreinte du schéma relevée | Propriété inconnue : refus et revue. Instabilité : proposition d'exclusion soumise à votre approbation |
| **T-FW-CANDIDATES** | Inventaire `ActiveStore` et WFP ; stimulus défini | Liste des candidats en quatre catégories, avec le motif d'exclusion de chacun | Tous les candidats autres que la règle testée sont exclus pour un motif interprétable | Attribution partielle : la règle n'est pas démontrée seule responsable |
| **T-FW-FILTER-IDENTITY** | Relevés WFP avant et après, au même démarrage | Les sept conditions de F32 | Toutes vérifiées | Corrélation partielle ou non établie |
| **T-FW-CANON-DATETIME** | Dates de test | `Utc`, `Local` et `Unspecified` aux mêmes ticks ; heure locale ambiguë ; `DateTimeOffset` | Trois encodages différents ; refus de l'heure ambiguë ; ticks `Unspecified` inchangés | Canonicalisation non fiable |
| **T-FW-CANON-METADATA** | Spécification CIM implémentée et vérifiée | Deux instances de test qui ne diffèrent que par l'espace de noms, la classe, le type CIM ou les indicateurs | Quatre encodages distincts ; aucune collision | Encodage CIM non fiable |
| **T-FW-CANON-FLOAT** (revue globale) | Valeurs de test | `0.0` et `-0.0` ; NaN ; ±∞ ; `1.0` et `1.00` en décimal | Tous distincts | Idem |
| **T-FW-CANON-UTF8** (revue globale) | Chaîne contenant un substitut isolé | Encodage | Exception, donc refus | Risque de collision : NO-GO |
| **T-FW-CANON-COMPLEX** (v10, modifié) | Avec l'encodage étiqueté | Modification interne d'un objet imbriqué de même type | Empreintes différentes | Installation NO-GO |

**Tests v10 toujours nécessaires :** T-FW-PLAN, T-FW-STORE, T-FW-CANON, T-FW-JOIN, T-FW-POLICY-EFFECTIVE, T-FW-DUALSTACK, T-FW-AUDIT, T-FW-CORRELATION, T-FW-COMPORT, T-FW-PROTO-ECH, T-FW-ROLLBACK, T-NET-03, T-EBPF-*, T-SYSD-COMPAT, T-NAT-WIN, T-CRED-NOWB et T-REVOKE.

---

## 7. Risques résiduels

1. **Faux refus :** la canonicalisation, plus stricte, risque de bloquer des états légitimes. C'est voulu, mais cela peut gêner l'exploitation.
2. **Complétude CIM non démontrable** par la seule lecture des propriétés.
3. **Une suppression puis recréation de filtre WFP** entre deux relevés n'est pas détectable sans l'audit des changements de stratégie.
4. **Attribution souvent partielle**, à cause des filtres à callout et des filtres non visibles.
5. **L'encodage CIM n'est pas implémenté** : sans lui, aucune empreinte de règle réelle n'est possible.
6. **Risques ouverts depuis les versions précédentes :**
   - exfiltration vers les domaines autorisés ;
   - absence de révocation serveur documentée ;
   - rotation des jetons de Codex ;
   - protocoles résiduels ;
   - faille de l'hyperviseur ;
   - compromission de la passerelle ;
   - hôte Windows 10 à migrer avant le 12 octobre 2027 ;
   - erreur humaine.

---

## 8. Verdicts

| Périmètre | Verdict |
|---|---|
| **Cohérence documentaire** | **Améliorée, incomplète** : encodage CIM resté à l'état de spécification ; API non consultées ; aucun code exécuté |
| **0B.1** : contrôles en lecture seule | **GO conditionnel**, **qui ne vaut pas autorisation**. Une autorisation explicite et distincte reste nécessaire. Les commandes qui demandent des droits d'administrateur doivent être exclues ou faire l'objet d'une décision explicite |
| **0B.2** : décisions d'architecture | **GO conditionnel**, avec en plus de la v10 : approbation éventuelle de l'exclusion `CimClass` ; décision sur l'audit des changements de stratégie WFP |
| **Installation** | **NO-GO** |
| **Appels réels aux agents** | **NO-GO** |

---

## Déclaration

**Fait :** une revue documentaire des rapports v5 à v10, la conception des corrections F28 à F33, un réexamen global du canonicaliseur, et ce rapport v11.

**Non fait :**
- aucune commande, même en lecture seule ;
- aucun fichier créé, modifié ou supprimé ;
- aucune installation, aucune VM démarrée ;
- aucun agent, aucune API, aucun service externe contacté, et **aucune nouvelle documentation consultée** : aucune documentation .NET, CIM ou WFP n'a été lue pour ce rapport ;
- aucun accès à Fastclip ni à Git ;
- **aucun test exécuté et aucun code exécuté** : le fragment de code n'est ni validé, ni complet.

**Aucune autorisation d'exécution n'est présumée.**
