<!-- Rapport extrait de la session Claude « Orchestrateur IA », 2026-11-17 21:51 UTC -->

# Rapport Phase 0B v12 : corrections F34 à F38

**Rappel du contexte.** L'orchestrateur tourne sur l'hôte Windows et pilote une VM agents et une VM passerelle. Huit règles `ORCH-*` par interface host-only filtrent le trafic. Le retour arrière repose sur des instantanés S0 et sur des **empreintes canoniques** des règles et de leurs filtres. L'encodage canonique, introduit en v11, est **étiqueté et délimité par la longueur** : `<étiquette><longueur UTF-16>:<contenu>`.

**Sources :** uniquement les rapports v5 à v11 et les extraits de documentation déjà obtenus. **Aucune documentation .NET, CIM ou WFP n'a été lue.** Toute affirmation sur ces API est [SUPPOSÉ]. Les valeurs IEEE 754 citées viennent de connaissances générales sur la norme, elles aussi [SUPPOSÉ], à confirmer par le test.

**Légende :** [DOC] documentation lue · [DÉDUIT] déduction · [SUPPOSÉ] hypothèse · [TEST] à démontrer.

---

## 1. Corrections

### F34 : ordre des octets des flottants

**Constat.**
- Pour `Single`, le fragment v11 encodait directement le résultat de `GetBytes()`, qui dépend de l'ordre des octets de la machine. **C'est une erreur certaine.**
- Pour `Double`, la v11 utilisait `DoubleToInt64Bits(...)` puis un formatage hexadécimal d'un **entier**. Ce résultat est déjà indépendant de l'architecture [DÉDUIT].

**Correction.** Le flottant est converti en son **motif binaire IEEE 754, sous forme d'entier**, puis écrit en hexadécimal, **octet de poids fort en premier**. Formater un entier ne dépend pas de l'ordre des octets en mémoire [DÉDUIT].
- **`Double`** : `DoubleToInt64Bits`, puis 16 chiffres hexadécimaux.
- **`Single`** : `.NET Framework` n'a probablement pas de `SingleToInt32Bits` [SUPPOSÉ]. On utilise donc `GetBytes([single])` puis **`ToUInt32` sur ces mêmes octets, sur la même machine**. Les deux opérations utilisent le même ordre, ce qui restitue le motif exact quel que soit l'ordre de la machine [DÉDUIT]. Résultat : 8 chiffres hexadécimaux.
- **Le type fait partie de l'encodage** (`System.Single` ou `System.Double`).
- **Aucune conversion en chaîne arrondie.** `+0.0` et `-0.0`, les infinis et les NaN (y compris leur charge utile) restent distincts.

**Risque plausible.** Dans un processus PowerShell **32 bits**, un NaN de signalisation pourrait être « assourdi » au chargement d'une valeur [SUPPOSÉ]. L'encodage des flottants est donc **refusé** hors d'un processus 64 bits (`[Environment]::Is64BitProcess` [SUPPOSÉ]).

### F35 : dates locales invalides

| Kind | Traitement |
|---|---|
| `Utc` | `Kind` et `Ticks`, sans fuseau |
| `Unspecified` | `Kind` et `Ticks` **bruts, sans interprétation**. Aucun contrôle n'a besoin de l'instant réel. Si un contrôle en avait besoin, il faudrait refuser |
| `Local`, heure **valide** | `Kind`, `Ticks`, identifiant du fuseau `TimeZoneInfo.Local` et décalage UTC à cette date |
| `Local`, heure **ambiguë** (retour à l'heure d'hiver) | **Refus** (`IsAmbiguousTime` [SUPPOSÉ]) |
| `Local`, heure **inexistante** (passage à l'heure d'été) | **Refus** (`IsInvalidTime` [SUPPOSÉ]) |

**Limite.** Un changement de fuseau de l'hôte, ou une mise à jour des règles de fuseau de Windows, modifie l'encodage d'une même date locale. Cela produit une instabilité, donc un **refus**. C'est voulu.

### F36 : empreinte du schéma CIM

**Éléments potentiellement pertinents.** Tous sont [SUPPOSÉ] quant à leur présence dans l'API, puisque la documentation n'a pas été lue :

| Élément | Pertinence |
|---|---|
| Nom de la classe et espace de noms | Identité |
| Chaîne des classes parentes, jusqu'à la racine | Héritage des définitions |
| Propriétés : nom, type CIM (y compris les types tableau), indicateurs, valeur par défaut | Interprétation des valeurs |
| Propriétés de référence et classe référencée | Liens entre objets |
| **Qualificateurs de classe et de propriété**, notamment ceux qui donnent le sens des codes numériques (de type `ValueMap` et `Values`) | **Élevée** : ils donnent la signification des codes numériques, par exemple ceux de l'action ou du sens d'une règle |
| Méthodes, paramètres et leurs qualificateurs | Faible pour les données, mais inclus par prudence |
| Indicateurs des qualificateurs (propagation) | Interprétation des qualificateurs |
| **Contexte hors du schéma CIM :** version du module PowerShell NetSecurity et empreinte de ses fichiers de définition, numéro de build de Windows | **Élevée** : la conversion des codes CIM en valeurs comme `Block` ou `Inbound` pourrait être définie dans le module PowerShell plutôt que dans le schéma [SUPPOSÉ] |

**Deux possibilités :**
- **(A) Empreinte complète.** On sérialise tout le graphe de la classe : qualificateurs, propriétés, méthodes et classes parentes, plus le contexte du module et de Windows. On applique la règle « tout membre public inconnu d'un type de schéma entraîne un refus », par inventaire par réflexion. **Ce n'est possible que si cet inventaire peut être démontré exhaustif** (T-FW-CIM-SCHEMA).
- **(B) Pas de prétention à la stabilité sémantique.** Si l'exhaustivité n'est pas démontrée, l'empreinte du schéma ne sert qu'à **détecter les changements des éléments listés**. Le rapport déclare alors : « **stabilité sémantique non démontrée** ».

**Position par défaut : (B)**, jusqu'à la réussite de T-FW-CIM-SCHEMA.

### F37 : validation UTF-8 de la représentation complète

**Correction.** La représentation canonique complète (en-tête de version, métadonnées et valeurs) est encodée **en une seule fois** en UTF-8 strict **juste avant le hachage**, sans aucun remplacement de caractère. Une exception **invalide tout l'instantané**.

La validation de chaque chaîne au moment où elle est rencontrée reste utile pour **localiser** l'erreur, mais **seule la validation finale fait foi**.

**Remarque [DÉDUIT].** Chaque élément de l'encodage commence par une étiquette ASCII. Un substitut haut isolé à la fin d'un contenu ne peut donc **jamais** se retrouver collé à un substitut bas isolé au début du contenu suivant, ce qui formerait par accident une paire valide. La validation finale détecte donc bien chaque substitut isolé.

### F38 : extraction exacte des clés de dictionnaire

**Risques avec `@($Value.PSBase.Keys)` puis l'indexeur :**
- l'énumération par PowerShell **pourrait** dérouler une clé qui est elle-même une collection [SUPPOSÉ : risque plausible, non certain] ;
- l'indexeur **relit** la valeur à travers le comparateur du dictionnaire ;
- `PSBase` passe par l'adaptateur PowerShell.

**Correction : aucune énumération par PowerShell.**
1. **Seuls les types qui implémentent `System.Collections.IDictionary`** sont acceptés. Cela couvre `Hashtable` et les dictionnaires génériques usuels, qui implémentent aussi cette interface [SUPPOSÉ]. Les **dictionnaires seulement génériques**, sans cette interface, sont **refusés**.
2. **Énumération par réflexion** sur les interfaces : `IDictionary.GetEnumerator`, puis `IEnumerator.MoveNext` et `IDictionaryEnumerator.Entry`, appelés par `MethodInfo.Invoke` et `PropertyInfo.GetValue`. On obtient chaque **`DictionaryEntry` : la clé et la valeur d'origine, sans relecture**.
3. Les entrées sont stockées dans une `List[object]` par `.Add`. **Jamais `+=`**, qui aplatit les tableaux.
4. Le nombre d'entrées énumérées doit être égal à `ICollection.Count`, lu par réflexion. Sinon : refus.
5. Chaque clé est **canonisée après son extraction**, en argument et non par le pipeline. Le comparateur reste ordinal et sensible à la casse, et toute collision après canonicalisation entraîne un refus (inchangé depuis la v11).

---

## 2. Réexamen transversal du canonicaliseur

**Erreurs certaines dans le fragment v11 :**
1. L'encodage de `Single` dépend de l'ordre des octets (F34).
2. Les heures locales inexistantes n'étaient pas traitées (F35).
3. Il n'y avait pas de validation UTF-8 finale (F37).
4. L'encodage CIM n'est pas implémenté : **aucune empreinte de règle réelle n'est encore possible.** C'était déjà connu.

**Risques plausibles :**
- énumération des clés par PowerShell (F38, corrigé) ;
- processus 32 bits et NaN (F34) ;
- instabilité des indicateurs CIM ou des fuseaux, qui donnerait de faux refus ;
- coût de la concaténation de chaînes sur de gros objets ;
- passage par une enveloppe `PSObject` lors des appels par réflexion.

**Points revus et jugés cohérents** [DÉDUIT, sous réserve des hypothèses] :
- longueurs comptées en unités UTF-16 (`String.Length`), de façon cohérente partout ;
- tableaux : type, rang, longueurs, bornes et contrôle du nombre d'éléments ;
- collections ordonnées sur liste fermée, refus des autres ;
- entiers en notation invariante avec leur type ; décimaux par `GetBits` ;
- `null` encodé `N0:` ;
- cycles détectés par égalité de référence, profondeur maximale de 16 ;
- refus de tout type inconnu.

**Hypothèses PowerShell 5.1 et .NET non vérifiées :**
- `DoubleToInt64Bits` ; `ToUInt32` ; `Int64.ToString('x16', …)` pour une valeur négative (complément à deux attendu) ;
- `Is64BitProcess` ; `IsInvalidTime` et `IsAmbiguousTime` ;
- `Invoke` sur un énumérateur de structure « emballé », avec conservation de son état d'un appel à l'autre ;
- déballage d'un `PSObject` lors des appels par réflexion ;
- ordre d'énumération d'un tableau multidimensionnel ;
- `-is` sur des valeurs enveloppées ;
- types et membres CIM.

**Stabilité entre deux lectures identiques :** elle n'est pas démontrée. Elle sera vérifiée par T-FW-CANON-STABILITY.

### Fragments corrigés, non exécutés

Ils remplacent les parties correspondantes du fragment v11, inchangé ailleurs. Ils dépendent des hypothèses ci-dessus.

```powershell
# F34 — flottants : motif IEEE 754 en entier, hexadécimal octet de poids fort en premier
function ConvertTo-OrchFloatCanon($Value) {
  if (-not [Environment]::Is64BitProcess) { throw 'Processus 32 bits : encodage des flottants refusé' }
  if ($Value -is [double]) {
    $bits = [BitConverter]::DoubleToInt64Bits($Value)
    return New-OrchTlv 'F' ((New-OrchTlv 'S' 'System.Double') + (New-OrchTlv 'S' $bits.ToString('x16', $Inv)))
  }
  if ($Value -is [single]) {
    $bits = [BitConverter]::ToUInt32([BitConverter]::GetBytes([single]$Value), 0)   # même ordre machine à l'écriture et à la lecture
    return New-OrchTlv 'F' ((New-OrchTlv 'S' 'System.Single') + (New-OrchTlv 'S' $bits.ToString('x8', $Inv)))
  }
  throw 'Type flottant inattendu'
}
# F35 — dates
function ConvertTo-OrchDateCanon([datetime]$Value) {
  $p = (New-OrchTlv 'S' ([string]$Value.Kind)) + (New-OrchTlv 'S' $Value.Ticks.ToString($Inv))
  if ($Value.Kind -eq [DateTimeKind]::Local) {
    $tz = [TimeZoneInfo]::Local
    if ($tz.IsInvalidTime($Value))   { throw 'Heure locale inexistante : instantané refusé' }
    if ($tz.IsAmbiguousTime($Value)) { throw 'Heure locale ambiguë : instantané refusé' }
    $p += (New-OrchTlv 'S' $tz.Id) + (New-OrchTlv 'S' $tz.GetUtcOffset($Value).Ticks.ToString($Inv))
  }
  New-OrchTlv 'T' $p
}
# F38 — entrées de dictionnaire extraites par les interfaces, sans énumération PowerShell
$OrchDictGetEnum = [System.Collections.IDictionary].GetMethod('GetEnumerator')
$OrchMoveNext    = [System.Collections.IEnumerator].GetMethod('MoveNext')
$OrchEntry       = [System.Collections.IDictionaryEnumerator].GetProperty('Entry')
$OrchCount       = [System.Collections.ICollection].GetProperty('Count')
function Get-OrchDictEntries($Dict) {
  if ($Dict -isnot [System.Collections.IDictionary]) { throw 'Dictionnaire sans interface IDictionary : instantané refusé' }
  $out = New-Object 'System.Collections.Generic.List[object]'
  $en = $OrchDictGetEnum.Invoke($Dict, $null)
  while ([bool]$OrchMoveNext.Invoke($en, $null)) { $out.Add($OrchEntry.GetValue($en, $null)) }
  if ($out.Count -ne [int]$OrchCount.GetValue($Dict, $null)) { throw 'Nombre d''entrées incohérent : instantané refusé' }
  ,$out
}
#   Dans ConvertTo-OrchCanon, branche dictionnaire :
#   $entries = Get-OrchDictEntries $Value
#   for ($i = 0; $i -lt $entries.Count; $i++) { $e = $entries[$i]; $kc = ConvertTo-OrchCanon $e.Key ($Depth+1) $Path; ...; $map.Add($kc, (ConvertTo-OrchCanon $e.Value ($Depth+1) $Path)) }
# F37 — validation UTF-8 stricte de la représentation complète, puis hachage
function Get-OrchCanonHash([string]$Canon) {
  try { $bytes = $Utf8Strict.GetBytes($Canon) } catch { throw 'Représentation canonique invalide en UTF-8 strict : instantané refusé' }
  $sha = [System.Security.Cryptography.SHA256]::Create()
  try { -join ($sha.ComputeHash($bytes) | ForEach-Object { $_.ToString('x2') }) } finally { $sha.Dispose() }
}
```

L'**encodage CIM et le schéma CIM restent au stade de la spécification** (sections F30, F33 et F36), sans code, puisque leurs API n'ont pas été vérifiées.

---

## 3. Conséquences sur F27 et sur le retour arrière

En plus des conditions de la v11, **une empreinte est refusée dans chacun de ces cas** :
- encodage d'un flottant hors du motif binaire canonique, ou processus 32 bits ;
- date locale ambiguë ou inexistante ;
- schéma CIM insuffisamment caractérisé. En position (B), l'empreinte reste utilisable pour détecter des changements, mais **jamais présentée comme une garantie sémantique**. En revanche, **une classe dont le schéma ne peut pas être sérialisé du tout entraîne un refus** ;
- échec de l'encodage UTF-8 final ;
- extraction des clés non exacte : interface absente, nombre d'entrées incohérent, collision ;
- toute valeur ou propriété ambiguë ;
- version de l'algorithme différente de celle de S0 (`canon-v12` invalide les comparaisons avec `canon-v11`).

**Dans tous ces cas, aucune suppression n'est possible : arrêt et revue humaine.**

**Rappel.** Une empreinte valide prouve l'**identité et la stabilité des données lues**. Elle **ne démontre pas** que Windows applique la règle. Cette preuve relève de T-FW-COMPORT, T-FW-CORRELATION et T-FW-FILTER-IDENTITY.

---

## 4. Hypothèses restantes

**[SUPPOSÉ] :**
- toutes les API citées en section 2 ;
- valeurs IEEE 754 de référence ;
- membres des types de schéma CIM (qualificateurs, déclarations de propriétés et de méthodes, classe parente, classe référencée) ;
- rôle du module NetSecurity dans la traduction des codes ;
- comportement en processus 32 bits ;
- **toutes** les hypothèses ouvertes depuis la v6 : magasins, `Platform`, `EdgeTraversalPolicy`, fonctionnement à états, champs des événements, export WFP, pktmon, sockets double pile, eBPF, jetons de Codex, révocation serveur, NAT de VirtualBox.

---

## 5. Nouveaux tests

**Aucun n'a été exécuté.** Ils portent sur des objets de test locaux, sans aucune modification du système.

| Test | Préconditions | Observations | Réussite |
|---|---|---|---|
| **T-FW-CANON-ENDIAN** | Processus 64 bits | Vecteurs `Double` : `+0.0` → `0000000000000000` ; `-0.0` → `8000000000000000` ; `1.0` → `3ff0000000000000` ; `-2.0` → `c000000000000000` ; `+∞` → `7ff0000000000000` ; `-∞` → `fff0000000000000` ; plus petit sous-normal → `0000000000000001` ; NaN construit à partir de `7ff0000000000001` et de `7ff8000000000000`. Vecteurs `Single` : `+0` → `00000000` ; `-0` → `80000000` ; `1.0` → `3f800000` ; `-2.0` → `c0000000` ; `+∞` → `7f800000` ; `-∞` → `ff800000` ; plus petit sous-normal → `00000001` ; NaN construit à partir de `7f800001`. Un même nombre en `Single` et en `Double` donne deux encodages distincts. En processus 32 bits : refus | Chaque encodage est égal au vecteur attendu ; les NaN gardent leur motif ; les types sont distingués. **Les vecteurs eux-mêmes sont à confirmer** |
| **T-FW-CANON-DATETIME-EDGE** | **Fuseau de l'hôte à heure d'été**, par exemple l'heure de Paris [SUPPOSÉ]. Sinon, les cas limites ne peuvent pas être produits avec `Kind = Local`, et le test est déclaré non applicable | Heure valide (15/06/2026 12:00, Local) ; **inexistante** (29/03/2026 02:30, Local) ; **ambiguë** (25/10/2026 02:30, Local) ; mêmes ticks en `Utc` et en `Unspecified` | Encodage pour l'heure valide ; refus pour les heures inexistante et ambiguë ; trois encodages distincts pour les trois `Kind` ; `Unspecified` sans conversion. Dates déduites de la règle européenne (dernier dimanche de mars et d'octobre) [DÉDUIT], à confirmer par les données de fuseau de Windows |
| **T-FW-CIM-SCHEMA** | Lecture d'une classe de règle et d'une classe de filtre (0B.4 ou plus tard) | Inventaire par réflexion des membres des types de schéma ; sérialisation de la classe, de ses parents, des qualificateurs, propriétés et méthodes ; deux lectures ; comparaison entre deux classes différentes | Aucun membre inconnu ; deux lectures identiques ; classes distinctes ; qualificateurs de sens des codes présents. **Réussite : passage à la position (A) possible. Échec : position (B) maintenue** |
| **T-FW-CANON-UTF8-FINAL** | Objets de test | Substitut isolé placé : dans une valeur imbriquée (dictionnaire dans une liste dans un objet), dans un **nom** de propriété d'objet, dans une clé de dictionnaire ; et, si une instance CIM de test côté client est possible [SUPPOSÉ], dans une métadonnée CIM | Exception à la validation finale dans chaque cas ; aucune empreinte produite |
| **T-FW-CANON-DICT-KEYS** | Objets de test | Clé qui est un tableau `@(1,2)` ; clé qui est une liste ; `Name` et `name` ; `1` et `"1"` ; dictionnaire générique (`Dictionary[object,object]`) ; type uniquement générique, sans `IDictionary` ; dictionnaire vide | Clés tableau et liste conservées entières et encodées comme collections ; encodages distincts ; dictionnaire générique accepté ; type uniquement générique refusé ; dictionnaire vide encodé ; aucune collision |
| **T-FW-CANON-STABILITY** | Mêmes objets, ou même règle relue | Deux canonicalisations successives | Chaînes et empreintes identiques |

**Conséquence de tout échec :** canonicalisation non fiable, donc installation NO-GO. Pour T-FW-CIM-SCHEMA : position (B) seulement.

**Tests des versions précédentes toujours nécessaires :**
- **v11 :** T-FW-CANON-DICT, T-FW-CANON-ARRAY, T-FW-CIM-SYSTEM, T-FW-CANDIDATES, T-FW-FILTER-IDENTITY, T-FW-CANON-DATETIME, T-FW-CANON-METADATA, T-FW-CANON-FLOAT, T-FW-CANON-UTF8, T-FW-CANON-COMPLEX ;
- **v10 et antérieures :** T-FW-PLAN, T-FW-STORE, T-FW-CANON, T-FW-JOIN, T-FW-POLICY-EFFECTIVE, T-FW-DUALSTACK, T-FW-AUDIT, T-FW-CORRELATION, T-FW-COMPORT, T-FW-PROTO-ECH, T-FW-ROLLBACK, T-NET-03, T-EBPF-*, T-SYSD-COMPAT, T-NAT-WIN, T-CRED-NOWB, T-REVOKE.

---

## 6. Risques résiduels

1. **La stabilité sémantique du schéma n'est pas démontrée** (position B), notamment si la traduction des codes dépend du module PowerShell.
2. **Faux refus** dus à la rigueur de la canonicalisation : changement de fuseau, indicateurs instables.
3. **Encodage CIM non implémenté** : aucune empreinte réelle n'est encore possible.
4. **Risques ouverts depuis les versions précédentes :**
   - exfiltration vers les domaines autorisés ;
   - absence de révocation serveur documentée ;
   - rotation des jetons de Codex ;
   - protocoles résiduels ;
   - visibilité partielle de WFP et attributions partielles ;
   - faille de l'hyperviseur ;
   - compromission de la passerelle ;
   - hôte Windows 10 à migrer avant le 12 octobre 2027 ;
   - erreur humaine.

---

## 7. Verdicts

| Périmètre | Verdict |
|---|---|
| **Cohérence documentaire** | **Améliorée, incomplète** : F34 à F38 traités sur le papier ; encodage et schéma CIM au stade de la spécification ; aucune API vérifiée ; aucun code exécuté |
| **0B.1** : contrôles en lecture seule | **GO conditionnel**, **qui ne vaut pas autorisation**. Une autorisation explicite et distincte reste nécessaire. Les commandes qui exigent des droits d'administrateur doivent être exclues ou faire l'objet d'une décision explicite |
| **0B.2** : décisions d'architecture | **GO conditionnel**, avec en plus : accepter ou non la position (B) pour le schéma CIM ; imposer ou non un processus 64 bits |
| **Installation** | **NO-GO** |
| **Appels réels aux agents** | **NO-GO** |

---

## Déclaration

**Fait :** une revue documentaire des rapports v5 à v11, la conception des corrections F34 à F38, un réexamen transversal du canonicaliseur, et ce rapport v12.

**Non fait :**
- aucune commande, même en lecture seule ;
- aucun fichier créé, modifié ou supprimé ;
- aucune installation, aucune VM démarrée ;
- aucun agent, aucune API ni aucun service externe contacté, et **aucune documentation nouvelle consultée** (ni .NET, ni CIM, ni WFP, ni la norme IEEE 754) ;
- aucun accès à Fastclip ni à Git ;
- **aucun test exécuté et aucun code exécuté**.

Les fragments de code sont partiels et non validés. **Aucune autorisation d'exécution n'est présumée.**
