<!-- Rapport extrait de la session Claude « Orchestrateur IA », 2026-11-17 21:57 UTC -->

# Rapport Phase 0B v13 : revue corrective F39 à F42

## Note préalable sur les règles de la mission

La mission impose deux règles qui se contredisent en partie : consulter une documentation officielle, et ne contacter aucun service externe. J'ai considéré que **lire des pages publiques de documentation officielle** est l'activité documentaire demandée.

**Ce que j'ai consulté :** uniquement neuf pages de référence .NET sur **learn.microsoft.com**, dans leur version **.NET Framework 4.8**, qui est celle de Windows PowerShell 5.1 [SUPPOSÉ quant à la correspondance des versions].

**Ce que je n'ai pas fait :** contacter un agent ou une API, exécuter une commande, un script ou du code, ni créer, modifier ou supprimer un fichier.

**Légende :** [DOC] documentation consultée · [DÉDUIT] déduction · [SUPPOSÉ] hypothèse · [TEST] à démontrer.

---

## 1. Sources officielles consultées et ce qu'elles établissent

| Source (.NET Framework 4.8) | Ce qu'elle établit |
|---|---|
| [`BitConverter.DoubleToInt64Bits`](https://learn.microsoft.com/en-us/dotnet/api/system.bitconverter.doubletoint64bits?view=netframework-4.8) | « L'ordre des bits de l'entier renvoyé dépend de l'architecture, petit-boutiste ou gros-boutiste ». Exemple officiel : `1.0` → `3FF0000000000000`, `NaN` → `FFF8000000000000`, `-∞` → `FFF0000000000000`, `+∞` → `7FF0000000000000`, `Epsilon` → `0000000000000001`, `MaxValue` → `7FEFFFFFFFFFFFFF` |
| [`BitConverter.GetBytes`](https://learn.microsoft.com/en-us/dotnet/api/system.bitconverter.getbytes?view=netframework-4.8) | L'ordre des octets du tableau renvoyé dépend de l'architecture. Il existe une surcharge `GetBytes(Single)` |
| [`BitConverter.IsLittleEndian`](https://learn.microsoft.com/en-us/dotnet/api/system.bitconverter.islittleendian?view=netframework-4.8) | Champ en lecture seule qui indique l'ordre des octets. Il vaut `True` sur les ordinateurs de type x86, selon l'exemple |
| [`Double.NaN`](https://learn.microsoft.com/en-us/dotnet/api/system.double.nan?view=netframework-4.8) | Une opération sur NaN donne NaN ; `==` est faux entre deux NaN. **Rien sur la conservation des charges utiles ni sur les NaN de signalisation** |
| [Constructeurs de `UTF8Encoding`](https://learn.microsoft.com/en-us/dotnet/api/system.text.utf8encoding.-ctor?view=netframework-4.8) | Avec `throwOnInvalidBytes = true`, une séquence invalide lève une `ArgumentException`. L'exemple encode deux substituts hauts consécutifs avec `GetBytes` et obtient une `EncoderFallbackException`. Le constructeur par défaut ne lève rien et remplace silencieusement (`EF BF BD` dans l'exemple). Un BOM n'est **jamais** ajouté par `GetBytes`, même si `encoderShouldEmitUTF8Identifier` vaut `true` |
| [`Encoding.EncoderFallback`](https://learn.microsoft.com/en-us/dotnet/api/system.text.encoding.encoderfallback?view=netframework-4.8) | Propriété **modifiable** sauf si l'encodage est en lecture seule. Le gestionnaire d'exception s'appelle `EncoderExceptionFallback` |
| [`IDictionary.GetEnumerator`](https://learn.microsoft.com/en-us/dotnet/api/system.collections.idictionary.getenumerator?view=netframework-4.8) | Une modification de la collection rend l'énumérateur « irrémédiablement invalidé et son comportement est **indéfini** ». L'énumération n'est pas sûre en cas d'accès concurrent : il faut verrouiller la collection |
| [`Dictionary<TKey,TValue>.GetEnumerator`](https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.dictionary-2.getenumerator?view=netframework-4.8) | Une modification, « par exemple l'ajout d'éléments ou le changement de capacité », fait lever une `InvalidOperationException` au `MoveNext` suivant. L'exception pour `Remove` et `Clear` ne concerne que .NET Core 3.0 et suivants. Pas de synchronisation |

**Non consultés, restés [SUPPOSÉ] :**
- `BitConverter.ToUInt32`, `Int64BitsToDouble`, `ToSingle` ;
- `Environment.Is64BitProcess` ;
- `Hashtable` et son énumérateur ;
- la hiérarchie des exceptions (`EncoderFallbackException` dérivée d'`ArgumentException`) ;
- le comportement du compilateur JIT et du coprocesseur x87 sur les NaN ;
- les liaisons de PowerShell 5.1 (choix des surcharges, encapsulation des valeurs, `New-Object`) ;
- le passage des valeurs CIM ;
- `TimeZoneInfo` ;
- tout ce qui concerne CIM, WFP et NetSecurity.

---

## 2. Erreurs découvertes dans les versions précédentes

| N° | Version | Erreur | Statut |
|---|---|---|---|
| E1 | v12 | « `DoubleToInt64Bits` donne un résultat indépendant de l'architecture » | **Contredit par la documentation** : « l'ordre des bits […] dépend de l'architecture ». Ma déduction n'était pas une garantie. Correction : exiger `IsLittleEndian = True` et contrôler les vecteurs officiels |
| E2 | v12 | `$Utf8Strict` est une **variable globale partagée**, et `EncoderFallback` est modifiable | Un code du même environnement pourrait rendre l'encodeur permissif, ou remplacer la variable. Correction : un encodeur créé **localement** à chaque calcul d'empreinte, puis vérifié |
| E3 | v12 | `GetBytes([single]$Value)` suppose que PowerShell choisit la surcharge `Single` | S'il choisissait la surcharge `Double`, le résultat ferait 8 octets et `ToUInt32` ne lirait que les 4 premiers, d'où un **motif faux**. Correction : vérifier que le tableau fait **exactement 4 octets** |
| E4 | v11 et v12 | Collections ordonnées (`List`, `ArrayList`) et dictionnaires acceptés **sans analyse de leur cohérence** en cas de modification | Traité en F40 |
| E5 | v12 | « F37 » était présenté comme réglé alors que la configuration réelle de l'encodeur n'était pas établie | Traité en F41 |

---

## 3. Corrections

### F39 : conservation exacte des motifs IEEE 754

**Le chemin des données, étape par étape :**

| Étape | Ce qui se passe | Garantie |
|---|---|---|
| 1. Origine CIM | La valeur fait l'objet d'un passage du fournisseur jusqu'à PowerShell | **Aucune connaissance** de ce passage. Une charge utile de NaN a pu changer **avant** que la valeur nous parvienne [SUPPOSÉ] |
| 2. Réception | Le `Double` ou le `Single` est encapsulé dans un `object` (boxing). La copie est censée être bit à bit [SUPPOSÉ] | [SUPPOSÉ] |
| 3. Test `-is [double]` | Aucune conversion [SUPPOSÉ] | [SUPPOSÉ] |
| 4. Appel de `DoubleToInt64Bits($Value)` | PowerShell extrait la valeur du boxing pour la passer en argument. Une conversion numérique pourrait intervenir si le type n'était pas exact [SUPPOSÉ] | [SUPPOSÉ] |
| 5. `[single]$Value` puis `GetBytes` | Conversion vers le même type, puis choix de la surcharge | **Choix de la surcharge non établi (E3)** |
| 6. Réinterprétation en entier | `DoubleToInt64Bits`, ou `ToUInt32` sur les 4 octets | Ordre des bits et des octets dépendant de l'architecture [DOC] |
| 7. Écriture hexadécimale | `Int64.ToString('x16')` ou `UInt32.ToString('x8')` | [SUPPOSÉ] : complément à deux pour un `Int64` négatif |

**NaN de signalisation et charges utiles.**
- **Aucune documentation consultée ne garantit leur conservation** [DOC : absence].
- Dans un processus 32 bits, un passage par le coprocesseur x87 peut transformer un NaN de signalisation en NaN silencieux [SUPPOSÉ].
- Sur x64, toute conversion qui élargit la valeur (`Single` vers `Double`) pourrait faire de même [SUPPOSÉ].
- **Un processus 64 bits ne prouve donc rien à lui seul.**

**Règle retenue.** Il est **interdit d'affirmer que tous les NaN sont conservés**. Tout NaN, `Double` ou `Single`, quel que soit son motif, entraîne un **refus de l'instantané**. Les règles de pare-feu ne contiennent probablement aucun flottant [SUPPOSÉ] : ce refus ne devrait rien coûter en pratique.

**Valeurs non NaN acceptées** (y compris `±0`, `±∞` et les sous-normaux), à quatre conditions :
- `IsLittleEndian = True` [DOC : champ existant] ;
- tableau d'**exactement 4 octets** pour un `Single` ;
- vecteurs officiels reproduits par T-FW-CANON-ENDIAN ;
- réussite de T-FW-CANON-NAN-PRESERVATION pour les valeurs non NaN qui suivent le même chemin.

**Refus du processus 32 bits.** Ce refus est **prudent**, fondé sur un risque plausible et non démontré. Avec le refus de tout NaN, il n'est **plus strictement nécessaire** pour les NaN. On le garde tant que T-FW-CANON-NAN-PRESERVATION n'a pas montré qu'un processus 32 bits conserve les autres valeurs.

### F40 : cohérence des lectures de dictionnaires (et de collections)

**Ce que dit la documentation :**
- au niveau de l'interface `IDictionary`, une modification pendant l'énumération rend le comportement **indéfini** ;
- pour `Dictionary<K,V>` sous .NET Framework 4.8, l'ajout ou le changement de capacité fait lever une **`InvalidOperationException`** ;
- le remplacement d'une valeur n'est **pas** cité explicitement ;
- pour `Hashtable`, je n'ai rien lu [SUPPOSÉ].

**Ce qui n'est pas détecté [DÉDUIT] :**
- **comparer `Count` avant et après ne suffit pas** : le remplacement d'une valeur, ou une suppression suivie d'un ajout, laisse le nombre d'entrées inchangé ;
- **une modification à l'intérieur d'un objet imbriqué** n'est jamais vue par l'énumérateur du dictionnaire ;
- **une énumération qui aboutit n'est pas une lecture atomique.**

**Photographie cohérente.** Elle exige un accès exclusif. Le verrou conseillé par la documentation ne protège que si **tous** les écrivains utilisent ce même verrou [DÉDUIT]. **Le canonicaliseur ne peut donc pas garantir seul la cohérence.**

**Règles retenues :**
1. **Invariant d'architecture :** on ne canonise que des objets **privés à l'exécution en cours**, obtenus par l'orchestrateur dans un seul espace d'exécution PowerShell, sans fil d'exécution concurrent, et jamais exposés à d'autres codes [DÉDUIT : condition de conception, pas une preuve].
2. **Données d'origine CIM :** un dictionnaire n'y est **pas attendu** [SUPPOSÉ]. Si l'on en rencontre un, l'instantané est **refusé** jusqu'à ce que T-FW-CIM-SYSTEM montre qu'il est légitime.
3. **Toute exception pendant l'énumération** (`InvalidOperationException` ou autre) entraîne un refus.
4. **Double canonicalisation**, avec comparaison des deux résultats. C'est une **détection**, pas une preuve : un changement suivi d'un retour à l'état initial entre les deux passes reste invisible.
5. Le contrôle `Count` est conservé, mais présenté **comme un contrôle faible**.
6. **Si l'invariant 1 ne peut pas être établi : refus.**

### F41 : encodeur UTF-8 strict

**Ce que dit la documentation :**
- `UTF8Encoding($false, $true)` : pas de préambule (`GetPreamble` renvoie un tableau vide), et `GetBytes` ne préfixe jamais de BOM ;
- avec `throwOnInvalidBytes = true`, une séquence invalide fait lever une **exception** au lieu d'un remplacement silencieux. L'exemple officiel le montre pour **l'encodage** de substituts hauts isolés ;
- le constructeur par défaut, lui, remplace silencieusement ;
- `EncoderFallback` est **modifiable**.

**Correction :**
- l'encodeur est **créé localement** dans la fonction d'empreinte, jamais partagé ;
- **avant usage**, on vérifie que `EncoderFallback` est bien un `EncoderExceptionFallback` et que `GetPreamble().Length` vaut 0 ;
- **toute exception** lors de l'encodage de la représentation **complète** invalide l'instantané ;
- **F37 n'est pas validé** tant que T-FW-UTF8-STRICT n'a pas réussi.

### F42 : trois propriétés distinctes

| Propriété | Démontrée par | Ce que cela ne démontre pas |
|---|---|---|
| **S1. Stabilité de l'algorithme** : mêmes entrées, même version, même environnement, même résultat | T-FW-CANON-* et T-FW-CANON-STABILITY, sur des objets fixes | La cohérence de la lecture du système |
| **S2. Cohérence de la lecture** : un état cohérent des règles et de leurs filtres | Instantanés A et B identiques (une seule relecture), associations stables (T-FW-JOIN), F20 validé (T-FW-STORE) | **Deux lectures identiques ne prouvent pas une lecture atomique** : un aller-retour (« ABA ») entre les lectures reste possible |
| **S3. Identité avec l'état réel de Windows** : ce que l'on voit correspond aux règles et filtres réellement en vigueur | T-FW-WFP, T-FW-FILTER-IDENTITY, T-FW-CORRELATION, T-FW-COMPORT, chacun partiellement | **Une empreinte identique ne prouve pas qu'une règle est appliquée.** Un filtre présent dans deux relevés a pu être supprimé puis recréé entre eux. **En position B, l'empreinte du schéma CIM ne prouve pas une identité sémantique complète** |

**Conditions minimales d'une suppression automatique.** Une suppression ne concerne que **nos propres objets de configuration**. Elle exige S1 et S2, pas S3. **Toutes** les conditions suivantes doivent être réunies :
- **C1.** Même version de canonicalisation pour S0, le journal et l'état courant. Tests T-FW-CANON-*, T-FW-UTF8-STRICT et T-FW-CANON-ENDIAN réussis **sur cet hôte**.
- **C2.** Vérifications à l'exécution : encodeur strict, `IsLittleEndian = True`, processus 64 bits, **aucun NaN**, aucune valeur ambiguë.
- **C3.** S0 et l'état courant valides selon les conditions V1 à V9 de la v10 (F20 validé, instantanés A et B stables, associations sans ambiguïté, sérialisation stricte).
- **C4.** La cible est journalisée `CRÉÉE`, **absente de S0** dans les deux magasins, dans `PersistentStore`, de source locale, avec `Group = ORCH-<runId>`.
- **C5.** L'empreinte courante de la cible, filtres compris, est **égale à celle du journal**.
- **C6.** Toutes les règles de S0 sont inchangées : aucune modification concurrente.
- **C7.** Après chaque suppression, une nouvelle mesure stable montre que **seul ce `Name`** a disparu.

**Si une seule condition n'est pas démontrée : arrêt sans suppression et revue humaine.** Les retours en arrière (ABA) entre deux lectures ne menacent pas la sécurité de la suppression : on ne supprime que si l'état final est **exactement** celui que nous avons créé [DÉDUIT].

---

## 4. Fragments corrigés

Ces fragments sont **non exécutés**. Ils dépendent des hypothèses listées en section 6.

```powershell
# F39 — flottants : petit-boutiste exigé, aucun NaN accepté, longueur contrôlée
function ConvertTo-OrchFloatCanon($Value) {
  if (-not [BitConverter]::IsLittleEndian) { throw 'Architecture non petit-boutiste : encodage flottant refusé' }   # [DOC] champ
  if (-not [Environment]::Is64BitProcess)  { throw 'Processus 32 bits : refus prudent' }                              # [SUPPOSÉ] API
  if ($Value -is [double]) {
    if ([double]::IsNaN($Value)) { throw 'NaN refusé : conservation du motif non démontrée' }
    $bits = [BitConverter]::DoubleToInt64Bits($Value)                                                                   # [DOC] dépend de l'architecture
    return New-OrchTlv 'F' ((New-OrchTlv 'S' 'System.Double') + (New-OrchTlv 'S' $bits.ToString('x16', $Inv)))
  }
  if ($Value -is [single]) {
    if ([single]::IsNaN($Value)) { throw 'NaN refusé : conservation du motif non démontrée' }
    $b = [BitConverter]::GetBytes([single]$Value)
    if ($b.Length -ne 4) { throw 'Surcharge GetBytes inattendue : encodage refusé' }                                    # E3
    $bits = [BitConverter]::ToUInt32($b, 0)                                                                             # [SUPPOSÉ] même ordre qu'à l'écriture
    return New-OrchTlv 'F' ((New-OrchTlv 'S' 'System.Single') + (New-OrchTlv 'S' $bits.ToString('x8', $Inv)))
  }
  throw 'Type flottant inattendu'
}
# F41 — empreinte : encodeur strict local, vérifié avant usage
function Get-OrchCanonHash([string]$Canon) {
  $enc = New-Object System.Text.UTF8Encoding($false, $true)
  if ($enc.EncoderFallback -isnot [System.Text.EncoderExceptionFallback]) { throw 'Encodeur non strict : instantané refusé' }
  if ($enc.GetPreamble().Length -ne 0) { throw 'Préambule inattendu : instantané refusé' }
  try { $bytes = $enc.GetBytes($Canon) } catch { throw 'Représentation canonique invalide en UTF-8 strict : instantané refusé' }
  $sha = [System.Security.Cryptography.SHA256]::Create()
  try { -join ($sha.ComputeHash($bytes) | ForEach-Object { $_.ToString('x2') }) } finally { $sha.Dispose() }
}
# F40 — le canonicaliseur reçoit une déclaration explicite de l'appelant ; sans elle, tout dictionnaire ou toute liste est refusé
#   ConvertTo-OrchCanon $obj -PrivateSnapshot:$true   (invariant d'architecture, non vérifiable par le canonicaliseur)
#   La double canonicalisation et la comparaison des deux résultats sont faites par l'appelant.
```

La validation précoce de chaque chaîne, à l'intérieur du canonicaliseur, utilise elle aussi un encodeur **local**.

**L'encodage CIM et le schéma CIM restent au stade de la spécification**, sans code.

---

## 5. Tests proposés

**Aucun n'a été exécuté.**

| Test | Préconditions | Observations | Réussite | Si échec |
|---|---|---|---|---|
| **T-FW-CANON-NAN-PRESERVATION** | Processus 64 bits **et** 32 bits, pour comparaison ; valeurs construites à partir de motifs (`Int64BitsToDouble`, `ToSingle` [SUPPOSÉ]) | Motifs `Double` : `7ff8000000000000`, `fff8000000000000`, `7ff0000000000001` (signalisation), `7ff4000000000000`, `7ff8000000000123`, `fff0000000000001`. Motifs `Single` : `7fc00000`, `ffc00000`, `7f800001`, `7fa00000`, `7fc00123`. **Le motif est relevé à chaque étape** : après construction, affectation à une variable, mise dans un `object[]`, passage en paramètre non typé, propriété d'un objet personnalisé, test `-is`, conversion `[single]` ou `[double]`, puis appel de la fonction d'encodage | Motifs identiques à toutes les étapes en 64 bits pour les valeurs **non NaN** testées en parallèle. **Les NaN sont dans tous les cas refusés par la fonction.** Le test **documente** leur comportement sans le promouvoir en garantie | Une étape modifie un motif non NaN : encodage flottant refusé dans son ensemble |
| **T-FW-CANON-ENDIAN** (mis à jour) | `IsLittleEndian = True` | Vecteurs **officiels** de la documentation de `DoubleToInt64Bits` (1.0, MaxValue, MinValue, Epsilon, ±∞), plus `±0.0` ; vecteurs `Single` (`3f800000`, `80000000`…, [SUPPOSÉ]) ; longueur de `GetBytes` égale à 4 | Égalité exacte avec les vecteurs | Canonicalisation refusée |
| **T-FW-CANON-DICT-CONCURRENT** | Point d'interruption **réservé au test** dans le canonicaliseur, après k entrées ; puis un second espace d'exécution qui écrit en parallèle | Ajout, suppression, remplacement de valeur, suppression puis ajout de la même clé, modification d'un objet imbriqué ; même scénario sur une `List` et une `Hashtable` | Toute modification détectable (exception, ou différence entre les deux passes) entraîne un refus. **Les modifications non détectées en une seule passe**, comme celles d'un objet imbriqué, **sont constatées et signalées** comme une limite, sans être présentées comme détectées | Une modification détectable ne provoque pas de refus : canonicaliseur non fiable |
| **T-FW-UTF8-STRICT** | Encodeur local | Type de `EncoderFallback` ; préambule vide ; premier octet de `GetBytes('a')` égal à `61` (pas de BOM) ; substitut haut isolé en fin de chaîne ; substitut bas isolé en début ; paire inversée ; deux substituts hauts consécutifs (cas de l'exemple officiel) ; paire valide U+1F600 donnant `F0 9F 98 80` ; **contrôle** : le constructeur par défaut donne `EF BF BD` pour les mêmes entrées | Exception pour chaque cas invalide ; résultat exact pour la paire valide ; le contrôle montre bien un remplacement, ce qui prouve que le test fait la différence | F37 non validé : aucune empreinte |
| **T-FW-CANON-UTF8-FINAL** (v12, complété) | Idem | Substitut isolé placé dans une propriété imbriquée, dans un nom de propriété, dans une clé de dictionnaire | Exception à la validation finale | Idem |

**Tests des versions précédentes toujours nécessaires :** T-FW-CANON-* (v11 et v12), T-FW-CIM-SYSTEM, T-FW-CIM-SCHEMA, T-FW-STORE, T-FW-JOIN, T-FW-AUDIT, T-FW-CORRELATION, T-FW-FILTER-IDENTITY, T-FW-CANDIDATES, T-FW-POLICY-EFFECTIVE, T-FW-DUALSTACK, T-FW-COMPORT, T-FW-PROTO-ECH, T-FW-ROLLBACK, T-NET-03, T-EBPF-*, T-SYSD-COMPAT, T-NAT-WIN, T-CRED-NOWB, T-REVOKE.

---

## 6. Hypothèses restantes

**[SUPPOSÉ] :**
- `ToUInt32`, `Int64BitsToDouble`, `ToSingle`, `Is64BitProcess` ;
- choix des surcharges et encapsulation des valeurs par PowerShell 5.1 ;
- comportement du compilateur JIT et du coprocesseur x87 ;
- passage des valeurs flottantes CIM ;
- comportement de `Hashtable` en cas de modification ;
- hiérarchie des exceptions d'encodage ;
- liaison de `New-Object` avec deux booléens ;
- absence de flottants et de dictionnaires dans les données de pare-feu ;
- **toutes** les hypothèses ouvertes depuis la v6 : CIM, WFP, NetSecurity, magasins, fonctionnement à états, eBPF, jetons de Codex, révocation serveur, NAT de VirtualBox.

---

## 7. Verdicts

| Périmètre | Verdict |
|---|---|
| **Cohérence documentaire** | **Améliorée, incomplète.** Quatre points sont désormais appuyés sur la documentation .NET (ordre des octets, encodeur strict, invalidation des énumérateurs, dictionnaires). L'erreur E1 de la v12 est corrigée. CIM, WFP et NetSecurity restent non documentés dans le dossier |
| **Fiabilité du canonicaliseur** | **Non démontrée.** Aucun test exécuté ; encodage CIM non implémenté ; NaN refusés par principe ; cohérence des collections fondée sur un invariant d'architecture et non sur une preuve |
| **Fiabilité de la lecture des règles** | **Non démontrée.** F20 non validé ; lecture non atomique ; S3 seulement partiel par construction |
| **Fiabilité du retour arrière** | **Non démontrée.** Les conditions C1 à C7 sont définies, mais aucune n'est vérifiée ; T-FW-ROLLBACK n'a pas été exécuté |
| **Autorisation d'installation** | **NO-GO** |
| **Autorisation d'appels réels aux agents** | **NO-GO** |

Pour rappel, **0B.1** (contrôles en lecture seule) et **0B.2** (décisions d'architecture) restent en **GO conditionnel**. Ce GO ne vaut pas autorisation : une autorisation explicite et distincte reste nécessaire.

---

## Déclaration

**Fait :**
- revue statique des rapports v5 à v12 ;
- **lecture de neuf pages de documentation officielle .NET Framework 4.8** sur learn.microsoft.com (listées en section 1), dont une relue localement à partir de son extrait déjà téléchargé ;
- rédaction de ce rapport v13.

**Non fait :**
- aucune commande locale, aucun script, aucun code exécuté ;
- aucun fichier créé, modifié ou supprimé dans le projet ;
- aucune installation, aucune VM démarrée ;
- aucun agent ni aucune API contactés, et aucun autre service que la documentation publique de Microsoft ;
- aucun accès à Fastclip ni à Git ;
- **aucun test exécuté**, et aucun résultat présenté comme vérifié ;
- l'implémentation n'est pas commencée.

**Aucune autorisation d'exécution n'est présumée.**
