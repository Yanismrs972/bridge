<!-- Rapport extrait de la session Claude « Orchestrateur IA », 2026-11-17 23:30 UTC -->

# Rapport Phase 0B v14 : revue corrective F43 à F46

## Cadre

J'ai lu en ligne des pages publiques de documentation Microsoft Learn, comme la mission le demande. Je n'ai contacté aucun agent ni aucune API, et je n'ai rien exécuté, créé ou modifié.

Une page déjà téléchargée a été relue localement, depuis son extrait enregistré, avec l'outil de lecture de fichiers. Ce n'était pas une commande.

**Légende :** [DOC] documentation consultée · [DÉDUIT] déduction · [SUPPOSÉ] hypothèse · [TEST] à démontrer.

---

## 1. Sources consultées pour la v14

| Source | Affirmations qu'elle soutient |
|---|---|
| [`Remove-NetFirewallRule`](https://learn.microsoft.com/en-us/powershell/module/netsecurity/remove-netfirewallrule) | La cmdlet « interroge » les règles puis supprime « la règle trouvée ». `-Name` **accepte les jokers**, et le nom « fonctionne comme un nom de fichier : **une seule règle d'un nom donné par magasin** à la fois ». Lors de la fusion des stratégies, des règles **de même nom** venues de magasins différents « s'écrasent ». La valeur par défaut de `Name` est aléatoire. `ActiveStore` réunit les stratégies de groupe, `PersistentStore`, **le magasin statique et le magasin configurable de la protection des services Windows (WSH)**. Valeurs possibles de `PolicyStoreSourceType` : `Local`, `GroupPolicy`… **Aucun paramètre de condition** (version, étiquette) avant suppression |
| [`FWPM_FILTER0`](https://learn.microsoft.com/en-us/windows/win32/api/fwpmtypes/ns-fwpmtypes-fwpm_filter0) | `filterKey` est un GUID, généré par le moteur de filtrage (BFE) s'il est nul à l'ajout. La documentation dit qu'il « identifie de manière unique la *session* », ce qui est vraisemblablement une coquille pour « le filtre ». `filterId` est un LUID, renvoyé lors de la lecture ou de l'énumération. Indicateurs « persistant », « au démarrage » et « désactivé » |
| [`FwpmTransactionBegin0`](https://learn.microsoft.com/en-us/windows/win32/api/fwpmu/nf-fwpmu-fwpmtransactionbegin0) | WFP propose des transactions en lecture ou en lecture et écriture, **au niveau de l'API WFP**, pas au niveau de NetSecurity |
| [`Double.IsNaN`](https://learn.microsoft.com/en-us/dotnet/api/system.double.isnan?view=netframework-4.8) | Renvoie `true` si la valeur « est évaluée comme NaN ». **Rien** sur les NaN de signalisation |
| [Détermination des versions de .NET Framework](https://learn.microsoft.com/en-us/dotnet/framework/install/how-to-determine-which-versions-are-installed) | La valeur `Release` sous `HKLM\SOFTWARE\Microsoft\NET Framework Setup\NDP\v4\Full` donne la version : 4.8 sous Windows 10 2022 Update = **528372** ; seuil de 4.8.1 = **533320**. `RuntimeInformation.FrameworkDescription` renvoie par exemple « .NET Framework 4.8.4250.0 ». **Ne pas utiliser `Environment.Version`** pour les versions 4.5 et suivantes. Le CLR 4.0.30319.42000 correspond à toutes les versions à partir de 4.6. Un processus 32 bits sous Windows 64 bits lit le registre sous `Wow6432Node` |
| [Qu'est-ce que Windows PowerShell ?](https://learn.microsoft.com/en-us/powershell/scripting/what-is-windows-powershell) | Windows PowerShell 5.1 utilise **le .NET Framework complet** ; son support est lié à la version de Windows |

**Sources de la v13 toujours valables :** `DoubleToInt64Bits`, `GetBytes`, `IsLittleEndian`, `Double.NaN`, `UTF8Encoding`, `EncoderFallback`, `IDictionary.GetEnumerator` et `Dictionary.GetEnumerator`.

**Non consulté :** la page des prérequis système de PowerShell 5.1. L'adresse visée a renvoyé la page « Qu'est-ce que Windows PowerShell ? ». Les versions minimales de .NET exigées restent donc [SUPPOSÉ].

---

## 2. Erreurs découvertes dans les versions précédentes

| N° | Version | Erreur | Correction |
|---|---|---|---|
| E6 | v8 à v13 | « Le `Name` est unique dans `ActiveStore` » | **Faux** : l'unicité vaut **par magasin**, et des règles de même nom venues de magasins différents **s'écrasent** à la fusion [DOC]. Une stratégie de groupe portant le même nom que notre règle pourrait **masquer** notre règle locale. L'absence du nom doit être vérifiée dans **tous** les magasins lisibles, et la règle active de ce nom doit être **de source `Local`** |
| E7 | v3 à v13 | « `ActiveStore` = règles locales + stratégies de groupe » | Incomplet : il comprend aussi **les magasins WSH statique et configurable** [DOC] |
| E8 | v7 à v13 | Suppression par `-Name` exact | `-Name` **accepte les jokers** [DOC]. Il faut une **validation stricte** du nom (aucun `*`, `?`, `[`, `]`), et non une simple supposition |
| E9 | v13 | « Documentation .NET Framework 4.8, **celle de** Windows PowerShell 5.1 » | Imprécis : PowerShell 5.1 utilise **la version 4.x installée** (4.8 ou 4.8.1), à relever sur l'hôte [DOC] |
| E10 | v13 | T-FW-CANON-NAN-PRESERVATION semblait servir de preuve | Corrigé par F45 |

---

## 3. Corrections

### F43 : course entre vérification et suppression (TOCTOU) dans le retour arrière

**Le scénario.** L'orchestrateur crée une règle et la vérifie. Un autre processus la supprime puis la **recrée avec le même nom et les mêmes propriétés**. L'orchestrateur supprime alors la règle sur la foi de sa vérification précédente.

| Élément | Constat |
|---|---|
| **Identité d'une règle** | Le `Name` est un identifiant **choisi par le créateur** et **réutilisable** [DOC]. Aucune propriété documentée de version, de date de création ou d'identifiant immuable n'a été trouvée [DOC : absence dans les pages lues]. **Une règle recréée à l'identique est indiscernable par NetSecurity** [DÉDUIT] |
| **Empreinte** | **Égalité d'empreinte ≠ identité d'objet.** L'empreinte décrit des données, pas une instance |
| **Filtres WFP** | `filterKey` est généré par le moteur si l'appelant ne le fixe pas, et `filterId` est un LUID [DOC]. Une recréation produirait **probablement** un nouveau `filterId` [SUPPOSÉ]. Mais le **lien entre une règle et ses filtres WFP n'est pas documenté**, et un appelant peut fixer lui-même le `filterKey` [DOC]. **Indice possible, pas une preuve** |
| **Portée dans le temps** | `filterId` est valable pendant l'exécution du moteur et peut changer au redémarrage [SUPPOSÉ]. Le `Name` est permanent mais réutilisable |
| **Suppression atomique ?** | `Remove-NetFirewallRule` **interroge puis supprime**, sans condition préalable sur l'état [DOC]. Les **transactions WFP** existent, mais au niveau des filtres WFP, pas des règles du pare-feu. Supprimer des filtres gérés par le service du pare-feu ne supprimerait pas la règle [SUPPOSÉ]. **Aucune opération atomique « vérifier puis supprimer » n'est disponible** avec les interfaces retenues [DÉDUIT] |
| **Modification concurrente** | Possible pour tout processus administrateur, à tout moment. Elle n'est détectable **qu'après coup** |

**Conclusion : la suppression automatique n'est pas suffisamment sûre.** Le retour arrière devient **assisté** :
1. L'orchestrateur prépare un plan de suppression, avec les noms, les empreintes et la preuve des conditions remplies.
2. **Vous validez le plan.**
3. Juste avant chaque suppression, une nouvelle lecture est faite ; la suppression utilise **l'objet** de cette relecture.
4. Une vérification suit chaque suppression.

**La fenêtre de concurrence est réduite, pas supprimée.** Ce risque résiduel est déclaré.

### F44 : preuve de propriété exclusive des données

**`-PrivateSnapshot:$true` n'est qu'une déclaration, pas une preuve.**

| Méthode | Ce qu'elle apporte | Limite |
|---|---|---|
| Copie superficielle | Un nouveau conteneur | Les objets imbriqués restent partagés |
| Copie profonde | Une structure indépendante **après** la copie | La copie **lit** la source : la course est seulement déplacée vers le moment de la copie [DÉDUIT] |
| Photographie immuable | La forme canonique est une **chaîne**, immuable par nature [SUPPOSÉ : immutabilité de `String`] | Sa cohérence dépend de la lecture qui l'a produite |
| Verrou partagé | Efficace **seulement si tous les écrivains** l'utilisent [DOC : verrouiller la collection pour toute l'énumération] | Impossible à imposer à un code arbitraire |

**Ce qui n'est pas démontrable à l'exécution :** l'absence d'autres fils d'exécution. Le CLR en possède toujours, et les modules peuvent en créer [SUPPOSÉ].

**Règle retenue, en « mode données système » :**
- **acceptés seulement :** les valeurs de type feuille immuables (chaînes, types valeur), les tableaux de ces valeurs **clonés immédiatement à la lecture** (copie superficielle suffisante puisque les éléments sont immuables [DÉDUIT]), et les instances CIM lues par notre propre code ;
- **refusés :** dictionnaires, listes, objets PowerShell modifiables, et toute référence d'origine inconnue ;
- **contrôles à l'exécution, qui indiquent sans prouver :** une seule espace d'exécution (`Get-Runspace` [SUPPOSÉ]) et aucun travail en arrière-plan (`Get-Job`) ;
- **double canonicalisation :** une détection, pas une preuve.

La propriété exclusive est **établie par construction et par revue de code**. Elle n'est **pas prouvée** à l'exécution.

### F45 : séparer le traitement des NaN de celui des valeurs acceptées

**Quatre volets distincts :**
1. **Diagnostic du comportement des NaN** : purement informatif, sans garantie.
2. **Détection des NaN** : par `IsNaN` **et** par l'inspection du motif binaire (exposant entièrement à 1 et mantisse non nulle). Les deux résultats doivent concorder ; **un désaccord entraîne un refus**.
   - `IsNaN` et les NaN de signalisation : la documentation n'en dit rien [DOC].
   - Une transformation « silencieuse » d'un NaN (mise à 1 du bit de silence) **le laisse NaN** [SUPPOSÉ : sémantique IEEE 754, non consultée].
   - La détection est donc robuste dans le sens « un NaN reste NaN », même si le chemin d'accès au motif le modifie. **La charge utile, elle, n'est pas garantie.**
3. **Conservation du motif des valeurs non NaN** : démontrée seulement par le test.
4. **Conditions d'acceptation** : valeur non NaN selon les deux détecteurs, `IsLittleEndian = True`, processus 64 bits, `GetBytes(Single)` de longueur 4, et vecteurs reproduits.

**Il est interdit d'affirmer que les charges utiles des NaN sont conservées.**

### F46 : applicabilité exacte de l'environnement

| Dépend de | Éléments |
|---|---|
| **Windows PowerShell 5.1** | Langage, liaison des méthodes, encapsulation des valeurs, `New-Object`, mode de langage (le **mode de langage restreint bloquerait** la réflexion [SUPPOSÉ]), édition « Desktop » |
| **.NET Framework installé (4.8 ou 4.8.1, mise à jour sur place)** | `BitConverter`, `UTF8Encoding`, collections, `TimeZoneInfo`, `SHA256` [DOC pour la détection de version] |
| **Windows** | Module NetSecurity, fournisseur CIM, service du pare-feu, WFP, données de fuseau horaire, architecture (ordre des octets) |

**À relever sur l'hôte avant toute implémentation : T-FW-RUNTIME-COMPAT, en lecture seule, non exécuté.**
- **PowerShell :** `$PSVersionTable` (version, édition, `CLRVersion`, `BuildVersion`), chemin de l'exécutable de l'hôte (`System32` ou `SysWOW64`), mode de langage, stratégie d'exécution.
- **.NET :** `Release` sous `HKLM\…\NDP\v4\Full` [DOC], et `RuntimeInformation.FrameworkDescription` [DOC].
- **Processus et architecture :** `Is64BitProcess`, `Is64BitOperatingSystem`, `IsLittleEndian`, `PROCESSOR_ARCHITECTURE`.
- **Windows :** build et révision du système.
- **NetSecurity :** version du module, chemin, empreintes de ses fichiers.

Toute différence avec la configuration de référence entraîne une **nouvelle revue documentaire** pour la version constatée.

---

## 4. Fragments, non exécutés

```powershell
# F45 — détection NaN par deux méthodes concordantes ; tout NaN est refusé ensuite
function Test-OrchFloatIsNaN($Value) {
  if ($Value -is [double]) {
    $api  = [double]::IsNaN($Value)
    $bits = [BitConverter]::DoubleToInt64Bits($Value)
    $pat  = ((($bits -shr 52) -band 0x7FF) -eq 0x7FF) -and (($bits -band 0xFFFFFFFFFFFFF) -ne 0)
  } elseif ($Value -is [single]) {
    $api = [single]::IsNaN($Value)
    $b = [BitConverter]::GetBytes([single]$Value); if ($b.Length -ne 4) { throw 'Surcharge GetBytes inattendue' }
    $u = [int64][BitConverter]::ToUInt32($b, 0)
    $pat = ((($u -shr 23) -band 0xFF) -eq 0xFF) -and (($u -band 0x7FFFFF) -ne 0)
  } else { throw 'Type flottant inattendu' }
  if ($api -ne $pat) { throw 'Détecteurs NaN en désaccord : refus' }
  $api
}
# E8 — nom de règle sans aucun joker, format imposé
function Assert-OrchRuleName([string]$Name) {
  if ($Name -cnotmatch '\AORCH-[0-9a-f]{32}-[A-Za-z0-9._#-]{1,64}-[0-9]{1,2}\z' -or $Name -match '[\*\?\[\]]') { throw "Nom de règle refusé : '$Name'" }
}
```

---

## 5. Réexamen complet des conditions C1 à C7

| Propriété | Atteignable ? | Fondement |
|---|---|---|
| **1. Identité des données** (même forme canonique) | Oui, sous réserve des tests | T-FW-CANON-*, T-FW-UTF8-STRICT, T-FW-CANON-ENDIAN |
| **2. Cohérence de la lecture** | Partiellement : instantanés A et B identiques, mais **lecture non atomique** | T-FW-STORE, T-FW-JOIN, instantanés stables |
| **3. Identité de l'objet système** | **Non** : nom réutilisable, aucun identifiant immuable documenté. Les identifiants WFP ne donnent qu'un indice | F43 |
| **4. Absence de modification concurrente** | **Détectable seulement après coup**, jamais empêchée | F43 et F44 |
| **5. Sûreté de l'opération de suppression** | **Non** : aucune vérification-suppression atomique | `Remove-NetFirewallRule` [DOC] |
| **6. Vérification après suppression** | Oui : nouvelle mesure, avec ses limites. Elle **détecte**, elle n'annule pas | C7 |

**Conditions révisées.** C1 à C7 de la v13 restent **nécessaires**, avec trois ajouts :
- **C8** : T-FW-RUNTIME-COMPAT conforme ;
- **C9** : noms validés (E8) et **aucune règle de même nom dans aucun magasin** (E6) ;
- **C10** : **validation humaine du plan de suppression**.

C1 à C10 réunies ne suffisent toujours pas à démontrer les propriétés 3 et 5. **Le retour arrière automatique n'est donc pas déclaré sûr. Seul un retour arrière assisté, avec validation humaine, est envisageable**, et il n'est pas encore démontré.

---

## 6. Tests proposés

**Aucun n'a été exécuté.**

| Test | Préconditions | Observations | Réussite |
|---|---|---|---|
| **T-FW-ROLLBACK-TOCTOU** | Règle de test dédiée ; second processus administrateur ; point de pause réservé au test entre la vérification et la suppression | Le second processus supprime la règle puis la recrée avec le même nom et les mêmes propriétés ; relevé des empreintes, puis de `filterKey` et `filterId` si le lien est établi | **Constat attendu : l'empreinte ne distingue pas les deux objets.** Le test réussit si la procédure **n'effectue jamais** de suppression automatique et demande une validation humaine. Les éventuels changements d'identifiants WFP sont documentés comme **indices** |
| **T-FW-CANON-SNAPSHOT-ISOLATION** | Objets de test ; second espace d'exécution qui écrit en parallèle | Copie superficielle puis modification d'un objet imbriqué ; tableau cloné puis modification de l'original ; écriture concurrente pendant la canonicalisation ; présentation d'une `Hashtable`, d'une `List` et d'un objet personnalisé en mode « données système » ; relevé de `Get-Runspace` et `Get-Job` | Le clone n'est pas affecté ; les types mutables sont refusés ; les écritures concurrentes sont détectées **ou** signalées comme non détectées, sans prétention de preuve |
| **T-FW-CANON-NAN-REJECTION** | Processus 64 bits | NaN silencieux et de signalisation, de signe ±, avec et sans charge utile, en `Double` et en `Single` | Tous refusés **et** les deux détecteurs concordent ; ±∞ non refusés |
| **T-FW-CANON-FLOAT-ACCEPTED-PATTERNS** | Processus 64 bits, `IsLittleEndian = True` | Vecteurs officiels de `DoubleToInt64Bits`, ±0, plus petits et plus grands sous-normaux, ±∞, équivalents `Single`. Motif relevé à **chaque étape** du chemin des données | Motifs identiques à chaque étape |
| **T-FW-CANON-NAN-DIAG** (ancien T-FW-CANON-NAN-PRESERVATION) | Processus 64 et 32 bits | Motifs NaN à chaque étape | **Diagnostic seulement**, aucune conclusion de conservation |
| **T-FW-RUNTIME-COMPAT** | Lecture seule, avec une autorisation distincte | Relevés de la section F46 | Valeurs relevées et égales à la référence documentée |

**Tests des versions précédentes toujours nécessaires :** T-FW-CANON-*, T-FW-UTF8-STRICT, T-FW-CIM-*, T-FW-STORE, T-FW-JOIN, T-FW-AUDIT, T-FW-CORRELATION, T-FW-FILTER-IDENTITY, T-FW-CANDIDATES, T-FW-POLICY-EFFECTIVE, T-FW-DUALSTACK, T-FW-COMPORT, T-FW-PROTO-ECH, T-FW-ROLLBACK, T-NET-03, T-EBPF-*, T-SYSD-COMPAT, T-NAT-WIN, T-CRED-NOWB, T-REVOKE.

---

## 7. Hypothèses restantes

**[SUPPOSÉ] :**
- comportement de la suppression par `-InputObject` ;
- lien entre une règle et ses filtres WFP ;
- changement de `filterId` lors d'une recréation ;
- impossibilité d'utiliser les transactions WFP pour les règles du pare-feu ;
- `Get-Runspace` ;
- immutabilité de `String` ;
- sémantique IEEE 754 du passage d'un NaN en NaN silencieux ;
- prérequis .NET de PowerShell 5.1 ;
- effet du mode de langage restreint ;
- **toutes** les hypothèses ouvertes des versions précédentes.

---

## 8. Verdicts

| Périmètre | Verdict |
|---|---|
| **Cohérence documentaire** | **Améliorée, incomplète** : erreurs E6 à E10 corrigées ; pages CIM, NetSecurity et filtres encore non lues |
| **Fiabilité du canonicaliseur** | **Non démontrée** : aucun test exécuté ; encodage CIM non implémenté ; propriété exclusive établie par construction et non prouvée |
| **Fiabilité de la lecture du système** | **Non démontrée** : lecture non atomique ; identité de l'objet système impossible à établir |
| **Fiabilité du retour arrière automatique** | **Non sûr** : course entre vérification et suppression, sans opération atomique disponible. **Une validation humaine est obligatoire** |
| **Fiabilité du retour arrière assisté** | **Non démontrée** : T-FW-ROLLBACK et T-FW-ROLLBACK-TOCTOU non exécutés |
| **Installation** | **NO-GO** |
| **Appels réels aux agents** | **NO-GO** |

**Aucune autorisation d'exécution n'est présumée.** 0B.1 et 0B.2 restent en GO conditionnel, ce qui ne vaut pas autorisation.

---

## Déclaration

**Fait :**
- revue statique des rapports v5 à v13 ;
- **lecture en ligne de six pages officielles Microsoft Learn** : `Remove-NetFirewallRule`, `FWPM_FILTER0`, `FwpmTransactionBegin0`, `Double.IsNaN`, détection des versions de .NET Framework, présentation de Windows PowerShell ;
- relecture locale de l'extrait déjà téléchargé de la page `Remove-NetFirewallRule` ;
- rédaction de ce rapport v14.

**Non fait :**
- aucune commande, aucun script, aucun code exécuté ;
- aucun fichier du projet créé, modifié ou supprimé ;
- aucune installation, aucune VM démarrée ;
- aucun agent ni aucune API contactés, et aucun autre service que la documentation publique de Microsoft ;
- aucun accès à Fastclip ni à Git ;
- aucun test exécuté ;
- l'implémentation n'est pas commencée.
