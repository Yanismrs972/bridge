<!-- Rapport extrait de la session Claude « Orchestrateur IA », 2026-11-17 23:59 UTC -->

# Rapport Phase 0B v18 : corrections F59 à F62

## 1. Cadre et limites

- **Nature de la mission.** La mission est exclusivement documentaire. Je n'ai lancé aucune commande ni aucun script, créé ou modifié aucun fichier, démarré aucune VM, appelé aucun agent ni aucune API, touché ni au pare-feu ni à WFP, et je n'ai accédé ni à Fastclip ni à Git.
- **Ce qui a été fait.** J'ai consulté de la documentation publique Microsoft et relu les versions v5 à v17.
- **Marqueurs utilisés :**
  - **[DOC]** : le fait est écrit dans une source officielle citée.
  - **[DÉDUIT]** : le fait est déduit de ces sources par raisonnement.
  - **[SUPPOSÉ]** : c'est une hypothèse non vérifiée.
  - **[TEST]** : seul un test pourrait trancher. Aucun test n'a été fait ni n'est autorisé.
- **Nouveauté du schéma.** Le schéma `orch-recovery-report/4` est une spécification sur papier. Il n'est ni implémenté ni validé.

## 2. Sources

- **S1 : `Get-NetFirewallRule` (module NetSecurity).** La page décrit :
  - les paramètres `-PolicyStore` et `-TracePolicyStore` ;
  - les propriétés `PolicyStoreSource` et `PolicyStoreSourceType` ;
  - la définition de RSOP : « read-only store contains the sum of all GPOs applied to the local computer » ;
  - les magasins `PersistentStore`, `ActiveStore`, `localhost`, `SystemDefaults`, `StaticServiceStore` et `ConfigurableServiceStore`.
- **S2 : `New-NetFirewallRule`, `Disable-NetFirewallRule` et `Remove-NetFirewallRule`.** Leur paramètre `-PolicyStore` accepte un magasin de GPO de la forme `domaine\nom_GPO`.
- **S3 : classe `System.Diagnostics.Stopwatch` (.NET Framework 4.8).**
  - Elle « measures elapsed time by counting timer ticks ».
  - Elle utilise le compteur de performance haute résolution s'il existe, sinon le minuteur système.
  - `Frequency` et `IsHighResolution` permettent de connaître la précision et la résolution.
  - `GetTimestamp` et `Frequency` peuvent remplacer `QueryPerformanceCounter` et `QueryPerformanceFrequency`.
  - Une note signale des résultats qui peuvent différer d'un processeur à l'autre à cause de « bugs in the BIOS or the Hardware Abstraction Layer (HAL) ». `ProcessorAffinity` est indiqué comme remède.
- **S4 : `DateTime.UtcNow`.** La résolution dépend du minuteur système, avec un ordre de grandeur de 0,5 à 15 ms. La propriété `Kind` vaut `Utc`.
- **S5 : formats de date standard.** Le format `"o"` est aller-retour, avec la précision de 7 chiffres et le décalage ou le `Z` selon `Kind`. Le format `"u"` ne convertit pas l'heure en UTC.
- **S6 : WFP.** Il s'agit de `FwpmFilterEnum0` (instantané limité aux filtres) et de la sémantique des transactions de session (sources déjà citées en v15 à v17).

## 3. F59 : provenance (deux statuts indépendants)

**Défaut de la v17.** La v17 avait un seul `provenance.status`. Une valeur absente pouvait donc rendre l'autre inutilisable. Le paramètre `-TracePolicyStore` y était aussi présenté à tort comme un nom incertain.

**Correction.**

- **Paramètre exact [DOC, S1].** Le paramètre s'appelle `-TracePolicyStore`. « TracePolicyStoreSource » n'apparaît que dans des formulations descriptives de la documentation : ce n'est pas un autre paramètre. Il n'y a donc aucune incertitude sur le nom.
- **Deux statuts indépendants**, un pour le chemin et un pour le type :
  - `sourcePath{status, value, reason}`, qui correspond à `PolicyStoreSource` ;
  - `sourceType{status, value, reason}`, qui correspond à `PolicyStoreSourceType`.
  - Chaque `status` prend l'une des valeurs `relevée`, `non_demandée`, `indisponible` ou `ambiguë`.
  - Si une valeur manque, l'autre est conservée telle quelle. Un `sourcePath` relevé avec un `sourceType` indisponible reste un `sourcePath` relevé.
- **Conditions de collecte [DOC, S1].** Les deux propriétés ne sont renseignées que si la requête utilise `-TracePolicyStore`. Sans ce paramètre, le statut est `non_demandée` et non `indisponible`.
- **Valeurs de `sourceType` [DOC, S1].** Les valeurs `Local`, `GroupPolicy`, `Dynamic`, `Generated` et `Hardcoded` sont conservées telles que relevées. `Dynamic`, `Generated` et `Hardcoded` sont des **types de provenance**, pas des magasins : on ne peut pas les passer à `-PolicyStore` et aucune lecture ciblée n'existe pour elles [DÉDUIT de la liste des magasins de S1].
- **Réserve d'exhaustivité maintenue.** Même si les deux champs sont relevés, ils ne prouvent ni l'identité de l'instance ni l'absence d'une autre règle de même nom dans un autre magasin. Ils ne garantissent pas non plus que toutes les sources ont été couvertes (règles AppIso, fournisseurs WFP tiers, règles WSH).

## 4. F60 : `observationsConcordant` remplace `readStable`

**Défaut de la v17.** Le nom `readStable` laissait croire à une stabilité de l'état. Or deux lectures identiques ne prouvent pas qu'aucune modification n'a eu lieu entre elles ou pendant elles.

**Correction.**

- **Champ `observationsConcordant`.** Il contient :
  - `readCount` ;
  - `reads[]`, avec pour chaque lecture `sequence`, `utcIso8601`, `monotonicTicks`, `query` et `outcome` ;
  - `comparedProperties[]` (par exemple `Name`, `DisplayName`, `Enabled`, `Direction`, `Action`, `Profile`, les filtres d'adresse, de port et d'application, `PolicyStoreSource` et `PolicyStoreSourceType` s'ils ont été relevés) ;
  - `differences[]` ;
  - `result`.
- **Valeurs de `result` :**
  - `concordantes` : toutes les lectures ont abouti et les propriétés comparées sont identiques ;
  - `divergentes` : au moins une propriété comparée diffère ; les différences sont listées ;
  - `lecture_incomplète` : au moins une lecture a abouti partiellement (magasin illisible ou propriété absente) ;
  - `lecture_impossible` : aucune lecture n'a abouti.
- **Limites écrites dans le rapport :**
  - « concordantes » ne prouve **aucune absence de concurrence**, car une modification suivie d'une restauration entre deux lectures passe inaperçue [DÉDUIT] ;
  - NetSecurity ne fournit **aucun instantané atomique** couvrant plusieurs objets ou plusieurs magasins [DÉDUIT de l'absence de primitive documentée dans S1] ;
  - l'instantané `FwpmFilterEnum0` ne couvre que les filtres WFP et n'est pas mis en correspondance avec les règles NetSecurity [DOC, S6].

## 5. F61 : trois mesures du temps, à ne pas confondre

1. **Horloge murale UTC (`DateTime.UtcNow`) [DOC, S4].**
   - Elle donne une date et une heure UTC.
   - Sa résolution dépend du minuteur système. Une résolution documentée n'est **pas** une précision mesurée.
   - Elle peut être ajustée par la synchronisation horaire, donc reculer ou sauter [DÉDUIT].
   - Elle n'est jamais certifiée : `clock.certified` vaut toujours `false`.
2. **Numéro de séquence du journal (`sequence`) [DÉDUIT].**
   - C'est un entier attribué par l'orchestrateur au moment de l'écriture d'une entrée.
   - Il ordonne **les entrées du journal**, pas les événements physiques : deux événements observés dans un ordre peuvent s'être produits dans l'autre.
3. **Mesure monotone (`Stopwatch.GetTimestamp`) [DOC, S3].**
   - C'est un nombre de tics du mécanisme de minuterie. On le convertit en durée avec `Frequency`.
   - Il ne donne **aucune date UTC** et ne se compare qu'entre deux mesures du même mécanisme.
   - S3 n'énonce **aucune garantie explicite de monotonie**. Elle signale au contraire des écarts possibles entre processeurs (BIOS ou couche HAL). La monotonie relève donc de [SUPPOSÉ / TEST].
   - Il faut relever `IsHighResolution` et `Frequency`. La « précision » que l'exemple de S3 déduit de `Frequency` est une résolution théorique, pas une exactitude mesurée.
   - `GetElapsedTime` n'existe probablement pas en .NET Framework 4.8 [SUPPOSÉ]. Il ne faut pas s'y fier : on calcule la différence de tics.

**Formats.** On utilise `"o"` uniquement sur une valeur dont `Kind` vaut `Utc` pour `utcIso8601`. L'heure locale (`localIso8601`) passe aussi par `"o"`, avec un `Kind` de valeur `Local` et un décalage explicite. Le format `"u"` est interdit parce qu'il ne convertit pas l'heure [DOC, S5].

**Ce que rien ne prouve.** Aucun champ ne constitue une preuve temporelle certifiée (horodatage qualifié, attestation RFC 3161, etc.).

## 6. F62 : GPO de domaine, RSOP, ActiveStore et contrôleur de domaine

**Défaut de la v17.** La formule « stratégies de domaine non joignables » mélangeait plusieurs notions.

**Correction :** cinq notions distinctes.

1. **Lecture directe d'une GPO de domaine.** Avec `-PolicyStore domaine\nom_GPO`, la lecture porte sur l'objet GPO lui-même [DOC, S2]. Elle suppose de joindre le domaine, donc un contrôleur, ainsi que des droits de lecture [DÉDUIT]. Son échec signifie seulement « GPO non lue », pas « stratégie absente ».
2. **Visibilité dans RSOP.** RSOP contient « the sum of all GPOs applied to the local computer » [DOC, S1]. Une stratégie **déjà appliquée** est donc visible localement dans RSOP. L'indisponibilité du contrôleur au moment de la lecture ne la rend pas invisible [DÉDUIT]. Le comportement exact hors ligne n'a pas été testé [TEST].
3. **Présence dans ActiveStore.** ActiveStore agrège notamment RSOP et PersistentStore [DOC, S1]. Une règle peut y figurer sans qu'on sache de quel magasin elle vient si `-TracePolicyStore` n'a pas été utilisé (voir F59).
4. **Disponibilité du contrôleur de domaine.** C'est un fait d'environnement, consigné à part : `joignable`, `non_joignable`, `non_testé` ou `sans_objet` pour une machine hors domaine. Le poste cible est un Windows 10 Famille, qui ne peut normalement pas joindre un domaine AD [SUPPOSÉ ; à vérifier]. Le cas reste documenté par principe.
5. **Exhaustivité de la provenance.** Elle n'est **jamais** déclarée. Ni RSOP ni ActiveStore ne prouvent qu'il n'existe pas de stratégie modifiée depuis la dernière application, de GPO non encore appliquée, de règle AppIso ou de filtre WFP tiers.

## 7. Schéma JSON `orch-recovery-report/4` (spécification, non implémentée)

```json
{
  "schema": "orch-recovery-report/4",
  "operation": { "operationId": "<uuid>", "operationStarted": "<horodatage>" },
  "timestampFormat": {
    "event": "string",
    "observedBy": "string",
    "sequence": "entier — ordre des entrées du journal, pas des événements physiques",
    "utcIso8601": "DateTime.UtcNow formaté 'o' (Kind=Utc)",
    "localIso8601": "formaté 'o' avec décalage explicite",
    "localOffset": "+hh:mm",
    "timeZoneId": "string",
    "monotonic": {
      "ticks": "Stopwatch.GetTimestamp()",
      "frequency": "Stopwatch.Frequency",
      "isHighResolution": "Stopwatch.IsHighResolution",
      "note": "aucune date UTC ; monotonie non garantie par la doc ; comparable uniquement dans le même processus"
    },
    "clock": {
      "source": "string",
      "certified": false,
      "syncStatus": "relevé | inconnu",
      "documentedResolution": "valeur documentée — pas une précision mesurée"
    },
    "uncertainty": "string"
  },
  "ruleCreationTime": null,
  "ruleCreationTimeReason": "aucune propriété documentée",
  "createCallReturned": "<horodatage>",
  "lastObservation": {
    "queries": [
      {
        "kind": "store | gpoStore | aggregate | referenceDefaults",
        "policyStore": "string",
        "tracePolicyStoreUsed": true,
        "outcome": "aboutie | partielle | échec",
        "provenance": {
          "sourcePath": { "status": "relevée | non_demandée | indisponible | ambiguë", "value": null, "reason": "string" },
          "sourceType": { "status": "relevée | non_demandée | indisponible | ambiguë", "value": "Local | GroupPolicy | Dynamic | Generated | Hardcoded | null", "reason": "string" }
        }
      }
    ]
  },
  "observationsConcordant": {
    "readCount": 0,
    "reads": [ { "sequence": 0, "utcIso8601": "", "monotonicTicks": 0, "query": "", "outcome": "" } ],
    "comparedProperties": [],
    "differences": [],
    "result": "concordantes | divergentes | lecture_incomplète | lecture_impossible",
    "limits": "aucune preuve d'absence de concurrence ; aucun instantané atomique NetSecurity"
  },
  "domainPolicy": {
    "gpoDirectRead": { "status": "lue | non_lue | non_demandée | sans_objet", "reason": "string" },
    "rsopVisibility": "relevée | non_relevée",
    "activeStorePresence": "relevée | non_relevée",
    "domainControllerReachability": "joignable | non_joignable | non_testé | sans_objet"
  },
  "coverage": {
    "storesQueried": [],
    "storesUnreadable": [],
    "sourcesNotCovered": ["AppIso (3 niveaux)", "types Dynamic/Generated/Hardcoded (non lisibles comme magasins)", "GPO non lues directement", "fournisseurs WFP tiers"],
    "c9": "non prouvée"
  },
  "manualInspection": "recherches par nom uniquement — aucune identité d'instance",
  "limits": [],
  "reportIntegrityDigest": { "algorithm": "SHA-256", "scope": "intégrité seulement — aucune authenticité" }
}
```

**Contrôle des noms de champs.** Aucun champ ne porte un nom qui promet plus que ce qui est démontré :

- `readStable` est supprimé ;
- `certified` est toujours `false` ;
- `documentedResolution` remplace toute mention de précision ;
- `c9` vaut toujours « non prouvée ».

## 8. Corrections apportées à la v17

| N° | Défaut de la v17 | Correction en v18 |
|---|---|---|
| E31 | Un seul statut de provenance : une valeur manquante masquait l'autre | `sourcePath` et `sourceType` indépendants (F59) |
| E32 | `TracePolicyStore` présenté comme un nom incertain | Nom exact `-TracePolicyStore` [DOC] (F59) |
| E33 | `Dynamic`, `Generated` et `Hardcoded` pouvaient passer pour des magasins | Ce sont des types de provenance, sans lecture ciblée (F59) |
| E34 | `readStable` laissait croire à un état stable | `observationsConcordant`, avec quatre résultats possibles et ses limites (F60) |
| E35 | Séquence présentée sans ses limites | La séquence ordonne le journal, pas les événements (F61) |
| E36 | Pas de mesure monotone ; « résolution » ambiguë | `Stopwatch` relevé, sans date UTC et sans monotonie garantie ; `documentedResolution` (F61) |
| E37 | « Stratégies de domaine non joignables » trop général | Cinq notions distinctes ; une stratégie déjà appliquée reste visible dans RSOP [DÉDUIT] (F62) |

**Vérification de non-régression :**

- aucune identité d'instance ;
- aucune suppression ni désactivation automatique ;
- aucune correspondance NetSecurity-WFP ;
- aucun instantané atomique ;
- aucune exhaustivité pour AppIso ;
- SHA-256 seul ne prouve pas l'authenticité ;
- aucune preuve temporelle certifiée ;
- aucun test prétendu.

## 9. Hypothèses et inconnues

- **H1 [SUPPOSÉ / TEST]** : l'horloge de `Stopwatch` est monotone sur la machine cible, malgré la réserve de S3 sur le BIOS et la couche HAL.
- **H2 [SUPPOSÉ]** : `Stopwatch.GetElapsedTime` est absent de .NET Framework 4.8.
- **H3 [DÉDUIT / TEST]** : les stratégies déjà appliquées restent visibles dans RSOP quand le contrôleur de domaine est injoignable.
- **H4 [SUPPOSÉ]** : Windows 10 Famille ne peut pas joindre un domaine AD, donc les GPO de domaine sont sans objet en pratique sur l'hôte.
- **H5 [TEST]** : comportement de `PolicyStoreSourceType` pour les règles à valeur `Dynamic`, `Generated` ou `Hardcoded` dans ActiveStore.
- **Inconnues reconnues** : durée de vie des `filterId`, révocation côté serveur des jetons Claude `setup-token` et Codex, exfiltration vers les domaines autorisés.

## 10. Verdicts

| Point | Verdict |
|---|---|
| Installation | **NO-GO** |
| Appels réels aux agents | **NO-GO** |
| Modification du pare-feu | **NO-GO** |
| Suppression automatique | **NO-GO** |
| Désactivation automatique | **NO-GO** |
| Modification directe de WFP | **NO-GO** |
| Retour arrière v1 | **Rapport d'inspection uniquement** |
| Tests | **Non autorisés** |
| Implémentation | **Non autorisée** |

**La v18 reste purement documentaire et ne vaut aucune autorisation d'exécution, d'installation, de test ou d'implémentation.**
