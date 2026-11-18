<!-- Rapport extrait de la session Claude « Orchestrateur IA », 2026-11-17 23:51 UTC -->

# Rapport Phase 0B v17 : corrections F55 à F58

## 1. Cadre et limites de la mission

**Fait :**
- lecture en ligne de deux pages publiques de Microsoft Learn ;
- relecture locale, avec l'outil de lecture de fichiers, d'extraits de documentation déjà téléchargés (`Get-NetFirewallRule`, `Remove-NetFirewallRule`, `Disable-NetFirewallRule`, formats de date) ;
- analyse des rapports v5 à v16.

**Non fait :** aucune commande, aucun script, aucun code, aucun test exécuté ; aucun fichier du projet créé, modifié ou supprimé ; aucune installation ; aucune VM démarrée ; aucun agent ni aucune API contactés ; aucun accès à Fastclip ni à Git ; aucune modification du pare-feu ni de WFP.

**Une information absente des pages lues ne prouve pas qu'elle n'existe pas.**

**Légende :** [DOC] documentation consultée · [DÉDUIT] déduction · [SUPPOSÉ] hypothèse · [TEST] à démontrer plus tard.

---

## 2. Sources officielles consultées

| Page | Affirmations soutenues |
|---|---|
| [`DateTime.UtcNow`](https://learn.microsoft.com/en-us/dotnet/api/system.datetime.utcnow?view=netframework-4.8) (nouvelle) | Renvoie la date et l'heure courantes **de cet ordinateur**, exprimées en UTC, avec `Kind = Utc`. **Résolution dépendante du minuteur du système, « généralement entre 0,5 et 15 ms »**. Alternative : `DateTimeOffset.UtcNow`, avec un décalage nul |
| [Chaînes de format de date standard](https://learn.microsoft.com/en-us/dotnet/standard/base-types/standard-date-and-time-format-strings) (nouvelle) | Le format aller-retour **`"o"`** suit l'ISO 8601 : **`Z` pour `Kind = Utc`**, **un décalage (+01:00…) pour `Kind = Local`** et pour `DateTimeOffset`, **aucune information de fuseau pour `Kind = Unspecified`**. **Le format `"u"` appliqué à un `DateTime` ajoute `Z` sans conversion** (13:45:30 devient « 13:45:30Z »), alors qu'appliqué à un `DateTimeOffset` il convertit (20:45:30Z) |
| [`Get-NetFirewallRule`](https://learn.microsoft.com/en-us/powershell/module/netsecurity/get-netfirewallrule) (relue) | Définitions de `PersistentStore`, `ActiveStore`, `RSOP`, `SystemDefaults`, `StaticServiceStore` et `ConfigurableServiceStore` ; stratégies de groupe de l'ordinateur désignées par `-PolicyStore <hostname>`, avec l'exemple **`-PolicyStore localhost`** ; règles AppIso inaccessibles ; descriptions de `-TracePolicyStore`, `PolicyStoreSource` et `PolicyStoreSourceType` ; magasin par défaut `PersistentStore` |

---

## 3. F55 : sémantique des magasins

| Valeur de `-PolicyStore` | Nature | Définition documentée |
|---|---|---|
| `PersistentStore` | **Magasin** local | Stratégie persistante locale, **hors stratégies de groupe**, créée manuellement ou par programme. Les règles y sont « rattachées à `ActiveStore` et activées immédiatement ». Magasin par défaut [DOC] |
| `ActiveStore` | **Agrégat** | « La somme de tous les magasins qui s'appliquent » : `RSOP` plus les magasins locaux, c'est-à-dire `PersistentStore`, la protection des services Windows (WSH) **statique** et la WSH **configurable** [DOC] |
| `RSOP` | **Agrégat** de stratégies de groupe, en lecture seule | « La somme de toutes les stratégies de groupe appliquées à l'ordinateur local » [DOC] |
| `localhost` (ou le nom de l'ordinateur) | **Magasin de stratégie de groupe** | Les stratégies de groupe sont aussi des magasins, et celles de l'ordinateur se désignent ainsi [DOC]. **Ce n'est pas un synonyme de `PersistentStore`.** Son effet réel sur une édition Famille n'est pas établi [SUPPOSÉ] |
| `SystemDefaults` | **Référentiel** en lecture seule | « L'état par défaut des règles **livrées avec Windows Server 2012** » [DOC]. **Le texte vise Windows Server 2012 ; son contenu sur Windows 10 22H2 n'est pas documenté** dans la page lue. Il **ne figure pas** dans la définition d'`ActiveStore` [DOC] : c'est une **référence**, pas une source de la politique effective [DÉDUIT] |
| `StaticServiceStore` | **Magasin** en lecture seule | Restrictions de services « livrées avec Windows Server 2012 » [DOC]. Le rattacher à la « WSH statique » citée pour `ActiveStore` est [DÉDUIT] |
| `ConfigurableServiceStore` | **Magasin** en lecture et écriture | Restrictions ajoutées pour des services tiers [DOC]. Le rattacher à la « WSH configurable » est [DÉDUIT] |

**Recouvrements [DÉDUIT des définitions] :**
- `ActiveStore` **contient** la fusion de `PersistentStore`, des deux magasins WSH et de `RSOP` ;
- `RSOP` **contient** la stratégie de groupe locale si elle est appliquée.

Interroger tous ces magasins produit donc des **doublons par construction**. **Ces requêtes ne sont pas des sources indépendantes.**

**Conclusions erronées à éviter :**
- **compter** une règle vue dans `PersistentStore` et dans `ActiveStore` comme **deux** observations indépendantes ;
- conclure de son absence dans `ActiveStore` qu'elle n'existe **nulle part**. Une règle locale peut être **écrasée** par une règle de même nom venue d'une stratégie de groupe, car à la fusion des règles de même nom « s'écrasent » [DOC] ;
- prendre `localhost` pour le magasin local persistant ;
- prendre `SystemDefaults` pour une source active.

---

## 4. F56 : provenance des règles

**Ce que dit la documentation :**
- `PolicyStoreSource` et `PolicyStoreSourceType` sont renseignés « **si l'objet est obtenu depuis `ActiveStore` avec l'option `TracePolicyStoreSource`** » [DOC] ;
- **incohérence de nommage** : le commutateur réellement documenté s'appelle **`-TracePolicyStore`**. Il « interroge le nom de la stratégie de groupe source et le place dans `PolicyStoreSource` » [DOC]. On suppose qu'il s'agit de la même option [SUPPOSÉ] ;
- `PolicyStoreSource` est **un chemin** vers le magasin d'origine, « pas toujours » réutilisable comme valeur de `-PolicyStore` : pour une stratégie de domaine, il ne contient que le nom de la stratégie [DOC] ;
- `PolicyStoreSourceType` est **un type** : `Local`, `GroupPolicy`, `Dynamic`, `Generated` ou `Hardcoded`. **Les trois derniers peuvent apparaître lors de la surveillance de la politique active, mais ne sont pas des noms de magasins utilisables** [DOC] ;
- **on ignore ce que valent ces champs sans `-TracePolicyStore`** [SUPPOSÉ : vides ou non fiables].

**Conditions nécessaires :** une lecture depuis **`ActiveStore`** **et** avec **`-TracePolicyStore`** [DOC, sous réserve de l'équivalence des noms].

**Quatre statuts de provenance :**

| Statut | Condition |
|---|---|
| `relevée` | Lecture depuis `ActiveStore` avec `-TracePolicyStore`, valeurs **présentes**, type dans la liste documentée, deux lectures A et B concordantes |
| `non_demandée` | Lecture sans `-TracePolicyStore`, ou hors d'`ActiveStore` |
| `indisponible` | Propriété absente ou vide, ou erreur malgré les bonnes conditions |
| `ambiguë` | Valeur hors de la liste documentée, source de domaine incomplète, ou lectures A et B divergentes |

**Règles :**
- `sourceTypeObserved` et `sourceObserved` valent **`null` sauf si le statut est `relevée`**, et la raison est alors indiquée ;
- **`PolicyStoreSource` (le chemin) et `PolicyStoreSourceType` (le type) ne sont jamais confondus** ;
- **l'exhaustivité de la provenance n'est pas démontrée**.

---

## 5. F57 : horodatages

**Principes :**
- un champ ne porte le suffixe ou la mention UTC **que si la valeur est obtenue en UTC** : `DateTime.UtcNow` avec `Kind = Utc`, ou `DateTimeOffset.UtcNow` [DOC] ;
- elle est écrite avec **`"o"`**, qui produit le suffixe `Z` pour `Kind = Utc` [DOC] ;
- **le format `"u"` est interdit** pour un `DateTime` : il ajoute `Z` sans convertir, ce qui pourrait faire passer une heure locale pour une heure UTC [DOC] ;
- l'heure **locale** éventuelle est stockée à part, avec son décalage et l'identifiant du fuseau ;
- la valeur provient de **l'horloge système de cet ordinateur** [DOC], **non certifiée** : elle peut être modifiée par un administrateur, et l'état de sa synchronisation n'est pas connu [SUPPOSÉ]. **Elle ne constitue aucune preuve temporelle** ;
- sa **résolution est de 0,5 à 15 ms** [DOC] : l'ordre de deux événements proches ne se déduit pas des horodatages, d'où un **numéro de séquence** dans le journal ;
- si le fuseau ou la conversion ne sont pas connus, la valeur est `null`, avec sa raison ;
- **le retour de notre appel de création n'est pas la date de création de la règle.** Celle-ci n'est pas documentée : elle vaut `null`.

**Structure d'un horodatage :**
```
{
  "event": "operationStarted | createCallReturned | lastObservation | reportGenerated",
  "observedBy": "orchestrateur",
  "sequence": <entier croissant du journal>,
  "utcIso8601": "<AAAA-MM-JJThh:mm:ss.fffffffZ obtenu par DateTime.UtcNow et le format 'o'> ou null",
  "utcSource": "DateTime.UtcNow (Kind=Utc), format 'o'" ou null,
  "localIso8601": "<heure locale au format 'o' avec décalage> ou null",
  "localOffset": "<+hh:mm> ou null",
  "timeZoneId": "<identifiant du fuseau> ou null",
  "clock": { "source": "horloge système locale", "certified": false, "syncStatus": "inconnu", "resolutionNote": "0,5 à 15 ms selon la documentation" },
  "uncertainty": "<texte si une donnée manque>"
}
```

---

## 6. F58 : exhaustivité de l'inventaire

**Trois niveaux à ne pas confondre :**
1. **Couverture documentaire** : la liste des magasins **décrits** par la documentation (section 3).
2. **Possibilité réelle de les interroger** sur cet hôte : droits, édition de Windows, erreurs d'accès [TEST].
3. **Exhaustivité de leur contenu** : non démontrée.

**Limites :**
- les **agrégats** (`ActiveStore`, `RSOP`) montrent un résultat **fusionné**, d'où les écrasements possibles par nom ;
- les **règles AppIso** ne sont **pas accessibles** avec `Get-NetFirewallRule` [DOC] ;
- les éléments de source **`Dynamic`, `Generated` ou `Hardcoded`** apparaissent seulement en surveillance, sans magasin interrogeable [DOC] ;
- les **stratégies de domaine** ne sont pas joignables hors d'un domaine ;
- les **filtres WFP d'autres fournisseurs** ne sont pas des règles NetSecurity [DÉDUIT des v14 et v15].

**Réserve AppIso, maintenue :**
1. la présence ou l'absence de la clé de registre n'est **qu'un indice** ;
2. l'inventaire des règles AppIso est **non garanti** (format non documenté [SUPPOSÉ]) ;
3. leur contribution à la politique effective est **non déterminable** par NetSecurity [DOC].

**Une règle non trouvée dans les magasins interrogés n'est pas pour autant absente de tout le pare-feu. C9 reste non prouvée.**

---

## 7. Schéma JSON corrigé du rapport de récupération

```
{
  "format": "orch-recovery-report/3",
  "operation": {
    "operationId": "<runId : GUID aléatoire>",
    "operationStarted": { "<structure d'horodatage, section 5>" }
  },
  "reportGenerated": { "<structure d'horodatage>" },
  "canonVersion": "<version de l'algorithme>",
  "runtime": { "<relevés T-FW-RUNTIME-COMPAT>" },
  "rules": [{
    "name": "ORCH-<runId>-<alias>-<n>",
    "displayName": "...", "group": "ORCH-<runId>",
    "ruleCreationTime": null,
    "ruleCreationTimeReason": "Aucune date de création de règle documentée par NetSecurity dans les pages consultées",
    "createCallReturned": { "<structure d'horodatage ; ce n'est PAS la création de la règle>" },
    "expectedStore": "PersistentStore",
    "expectedSourceType": "Local",
    "expectedProperties": { "<forme normalisée lisible>" },
    "expectedRuleFingerprint": "<SHA-256 issu du journal CRÉÉE>",
    "lastObservation": {
      "at": { "<structure d'horodatage>" },
      "queries": [
        { "policyStore": "PersistentStore",          "kind": "store",          "readable": true, "found": true,  "error": null },
        { "policyStore": "StaticServiceStore",       "kind": "store",          "readable": true, "found": false, "error": null },
        { "policyStore": "ConfigurableServiceStore", "kind": "store",          "readable": true, "found": false, "error": null },
        { "policyStore": "localhost",                "kind": "gpoStore",       "readable": null, "found": null,  "error": "<message ou null>" },
        { "policyStore": "RSOP",                     "kind": "aggregate",      "readable": true, "found": false, "error": null },
        { "policyStore": "ActiveStore",              "kind": "aggregate",      "readable": true, "found": true,  "error": null,
          "traceRequested": true },
        { "policyStore": "SystemDefaults",           "kind": "referenceDefaults", "readable": true, "found": false, "error": null }
      ],
      "aggregationNote": "Les agrégats recoupent les magasins : les résultats ne sont pas des observations indépendantes. Une règle peut être écrasée dans ActiveStore par une règle de même nom d'une autre source.",
      "provenance": {
        "status": "relevée | non_demandée | indisponible | ambiguë",
        "policyStoreSourceObserved": "<chemin, seulement si status = relevée, sinon null>",
        "policyStoreSourceTypeObserved": "<Local | GroupPolicy | Dynamic | Generated | Hardcoded, seulement si status = relevée, sinon null>",
        "reason": "<obligatoire si status ≠ relevée>",
        "note": "Dynamic, Generated et Hardcoded ne sont pas des magasins interrogeables. La provenance n'est pas démontrée exhaustive."
      },
      "observedRuleFingerprint": "<SHA-256 ou null>",
      "readStable": true,
      "wfpHints": { "note": "indices seulement : aucune correspondance prouvée entre filtres WFP et règle" }
    },
    "anomalies": ["ABSENTE_DES_MAGASINS_INTERROGES", "EMPREINTE_DIFFERENTE", "NOM_DANS_AUTRE_MAGASIN", "SOURCE_NON_LOCALE", "PROVENANCE_NON_RELEVEE", "LECTURE_INSTABLE", "MAGASIN_ILLISIBLE"]
  }],
  "coverage": {
    "storesQueried": ["<liste issue de queries>"],
    "storesUnreadable": [{ "policyStore": "...", "error": "..." }],
    "sourcesNotCovered": [
      { "source": "AppIso", "registryKeyPresence": "présente | absente | non vérifiée", "rulesInventory": "non garanti", "effectiveContribution": "non déterminable par NetSecurity" },
      { "source": "objets Dynamic/Generated/Hardcoded", "reason": "aucun magasin interrogeable" },
      { "source": "stratégies de domaine", "reason": "hors domaine ou non joignables" },
      { "source": "filtres WFP d'autres fournisseurs", "reason": "pas des règles NetSecurity" }
    ],
    "c9": "non prouvée"
  },
  "manualInspection": {
    "warning": "INSPECTION SEULEMENT. Recherches PAR NOM, sans valeur d'identité : le nom peut avoir été réutilisé et la règle trouvée peut être une recréation. Aucune désactivation ni suppression n'est recommandée. Toute action relève de la décision indépendante de l'administrateur. Rappel documenté : une cmdlet de modification lancée sans sélecteur peut toucher toutes les règles.",
    "lookupsByName": [
      "Get-NetFirewallRule -PolicyStore ActiveStore -TracePolicyStore -Name '<nom exact>' | Format-List *",
      "Get-NetFirewallRule -PolicyStore PersistentStore -Name '<nom exact>' | Format-List *",
      "Get-NetFirewallRule -PolicyStore PersistentStore -Name '<nom exact>' | Get-NetFirewallAddressFilter | Format-List *  (idem pour les autres catégories de filtres)"
    ]
  },
  "limits": "Nom réutilisable ; une empreinte identique ne prouve pas l'identité d'un objet ; aucune action atomique ; aucun instantané atomique du pare-feu ; inventaire non exhaustif (C9 non prouvée) ; horloge non certifiée ; rapport susceptible d'être périmé au moment de son usage.",
  "reportIntegrityDigest": {
    "algorithm": "SHA-256",
    "scope": "rapport sans ce champ",
    "meaning": "Intégrité contre une corruption accidentelle seulement. Ni authenticité ni provenance. Une signature ou un MAC serait une évolution séparée, avec sa propre spécification de gestion des clés."
  }
}
```

---

## 8. Corrections apportées à la v16

| N° | Erreur dans la v16 | Correction |
|---|---|---|
| E24 | `localhost` figurait dans la liste des magasins sans explication, comme une source parmi d'autres | Défini comme **magasin de stratégie de groupe de l'ordinateur**, classé `gpoStore` (F55) |
| E25 | `storesQueried` mélangeait magasins, agrégats et référentiel, et `foundIn` pouvait passer pour des constats indépendants | Tableau `queries` avec la **nature** de chaque magasin et une note sur l'agrégation (F55, F58) |
| E26 | `sourceTypeObserved` était présent sans ses conditions de collecte | Ajout du statut de provenance, valeur `null` sauf si le statut est « relevée », et séparation du chemin et du type (F56) |
| E27 | Champs suffixés `Utc` accompagnés de la mention « horloge locale » | Structure d'horodatage explicite : UTC prouvé par la source, heure locale à part, horloge non certifiée, numéro de séquence (F57) |
| E28 | `SystemDefaults` présenté sans réserve | Référence à Windows Server 2012 signalée ; ce n'est pas une source d'`ActiveStore` (F55) |
| E29 | Équivalence entre `StaticServiceStore` / `ConfigurableServiceStore` et WSH statique / configurable présentée sans étiquette | Étiquetée **[DÉDUIT]** (F55) |
| E30 | « Absente » sans préciser le périmètre | Anomalie renommée `ABSENTE_DES_MAGASINS_INTERROGES` (F58) |

**Vérification de non-régression :**
- aucune garantie d'identité d'instance ;
- aucune séquence de désactivation ou de suppression ;
- aucune correspondance supposée avec WFP ;
- aucun instantané atomique du pare-feu ;
- aucune exhaustivité AppIso ;
- intégrité distinguée de l'authenticité ;
- aucun test présenté comme exécuté.

**Les corrections F51 à F54 sont conservées.**

---

## 9. Hypothèses et inconnues restantes

**[SUPPOSÉ] :**
- équivalence entre `TracePolicyStoreSource` et `-TracePolicyStore` ;
- valeur de la provenance sans ce commutateur ;
- effet et lisibilité de `localhost` sur une édition Famille ;
- contenu de `SystemDefaults` et de `StaticServiceStore` sous Windows 10 ;
- format des règles AppIso ;
- état de synchronisation de l'horloge ;
- **toutes** les hypothèses ouvertes depuis la v6.

**[TEST], interdits pour l'instant :**
- possibilité réelle d'interroger chaque magasin ;
- présence et forme de la provenance ;
- comportement de `-TracePolicyStore`.

---

## 10. Verdicts de sécurité

| Décision | Verdict |
|---|---|
| **Installation** | **NO-GO** |
| **Appels réels aux agents** | **NO-GO** |
| **Modification du pare-feu** | **NO-GO** |
| **Suppression automatique** | **NO-GO** |
| **Désactivation automatique** | **NO-GO** |
| **Modification directe de WFP** | **NO-GO** |
| **Retour arrière, version 1** | **Rapport d'inspection uniquement** |
| **Tests** | **Non autorisés** |
| **Implémentation** | **Non autorisée** |

**La v17 reste purement documentaire. Elle ne vaut aucune autorisation d'exécution, de test, d'installation ou d'implémentation.**
