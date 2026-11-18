<!-- Rapport extrait de la session Claude « Orchestrateur IA », 2026-11-17 23:48 UTC -->

# Rapport Phase 0B v16 : corrections F51 à F54

## 1. Cadre et limites

**Fait :**
- lecture en ligne d'une page publique de Microsoft Learn (`Disable-NetFirewallRule`) ;
- relecture locale, avec l'outil de lecture de fichiers, des extraits de documentation déjà téléchargés ;
- analyse des rapports v5 à v15.

**Non fait :** aucune commande, aucun script, aucun code, aucun test exécuté ; aucun fichier créé, modifié ou supprimé ; aucune installation ; aucune VM démarrée ; aucun agent ni aucune API contactés ; aucun accès à Fastclip ni à Git ; aucune modification du pare-feu Windows ni de WFP.

**Une information absente des pages lues ne prouve pas qu'elle n'existe pas.**

**Légende :** [DOC] documentation consultée · [DÉDUIT] déduction · [SUPPOSÉ] hypothèse · [TEST] à démontrer.

---

## 2. Sources officielles consultées

| Page | Affirmations soutenues |
|---|---|
| [`Disable-NetFirewallRule`](https://learn.microsoft.com/en-us/powershell/module/netsecurity/disable-netfirewallrule) (nouvelle) | Mêmes jeux de paramètres que `Remove-NetFirewallRule`, dont `InputObject (cdxml)` : `-InputObject <CimInstance[]>` **sans `-PolicyStore`**. La cmdlet « obtient » les règles par `Name`, `DisplayName`, propriétés, filtres ou objets associés, puis met `Enabled` à `False` sur « les règles **résultant de la requête** ». **« Lancée sans paramètre, elle désactive toutes les règles du pare-feu Windows »**. La désactivation dans une stratégie de groupe ne prend effet qu'à la prochaine application de cette stratégie. Exemple 4 : `-InputObject` reçoit des règles issues de `Get-NetFirewallRule -PolicyStore ActiveStore -PolicyStoreSourceType Dynamic` |
| [`Remove-NetFirewallRule`](https://learn.microsoft.com/en-us/powershell/module/netsecurity/remove-netfirewallrule) (v15) | Même logique « interroger puis agir » ; l'exemple 4 passe un **filtre d'application** à `-InputObject` |
| [`Get-NetFirewallRule`](https://learn.microsoft.com/en-us/powershell/module/netsecurity/get-netfirewallrule) (v15) | « Les conditions sont représentées dans des objets séparés appelés filtres. **La relation filtre-règle est toujours biunivoque et gérée automatiquement.** » Exemple 2 : `Get-NetFirewallProfile -Name Public \| Get-NetFirewallRule` renvoie **toutes** les règles du profil public. Classes d'entrée et de sortie : `root\StandardCimv2\MSFT_NetFirewallRule`, `MSFT_NetAddressFilter`, `MSFT_NetProtocolPortFilter`, `MSFT_NetApplicationFilter`, `MSFT_NetInterfaceFilter`, `MSFT_NetInterfaceTypeFilter`, `MSFT_NetServiceFilter`, `MSFT_NetNetworkLayerSecurityFilter`, `MSFT_NetFirewallProfile`. Aucun paramètre ni propriété de date de création n'y est documenté |
| [WFP : gestion des objets](https://learn.microsoft.com/en-us/windows/win32/fwp/object-management), [`FWPM_FILTER0`](https://learn.microsoft.com/en-us/windows/win32/api/fwpmtypes/ns-fwpmtypes-fwpm_filter0), [`FwpmFilterEnum0`](https://learn.microsoft.com/en-us/windows/win32/api/fwpmu/nf-fwpmu-fwpmfilterenum0) (v15) | Objets FWPM identifiés par GUID ; objets FWPS identifiés par LUID, toujours attribués par le moteur de filtrage (BFE) ; `filterId` est « le LUID qui identifie le filtre, aussi celui de la structure `FWPS_FILTER0` correspondante » ; l'énumération porte sur un instantané des filtres pris à la création du descripteur |

---

## 3. F51 : désactivation et suppression

| Point | `Disable-NetFirewallRule` | `Remove-NetFirewallRule` |
|---|---|---|
| Sélecteur `-Name` | Recherche par nom ; jokers acceptés ; unicité par magasin seulement [DOC] | Identique [DOC] |
| Sélecteurs par propriétés et par filtres associés | Oui [DOC] | Oui [DOC] |
| `-InputObject` | `CimInstance[]`, **sans `-PolicyStore`** [DOC] | Identique [DOC] |
| Comportement de recherche | « Obtient » les règles puis agit sur **le résultat de la requête** [DOC] | « Interroge » puis supprime **la règle trouvée** [DOC] |
| Garantie d'identité de l'instance | **Aucune documentée** | **Aucune documentée** |
| Effet | Réversible (la règle reste) [DOC] | Définitif [DOC] |
| Piège documenté | **Sans paramètre, désactive toutes les règles** [DOC] | Sans paramètre, supprime toutes les règles statiques locales (exemple 1) [DOC] |

**Réponse à la question centrale. Non.** La désactivation n'offre **ni meilleure garantie d'identité, ni meilleure protection contre la course entre vérification et action** que la suppression : les deux reposent sur le même mécanisme « requête puis action » [DOC]. Sa seule différence est d'être **réversible**. Mais désactiver une règle **recréée ou modifiée par un tiers** change quand même le comportement réseau [DÉDUIT].

**Décision appliquée dans la version 1 :**
- le rapport fournit **seulement des éléments d'inspection** ;
- **aucune séquence** de désactivation ou de suppression n'est recommandée, qu'elle soit automatique, semi-automatique ou suggérée ;
- **aucune commande de modification** n'est présentée comme sûre ;
- l'administrateur décide **seul** de son action ;
- l'orchestrateur n'exécute **ni suppression ni désactivation**.

**Risque maintenu.** Entre l'inspection et l'action de l'administrateur, la règle peut être **modifiée ou recréée** sous le même nom.

---

## 4. F52 : relation entre filtres NetSecurity et règles

**Formulation corrigée :**
1. **Un objet filtre NetSecurity donné est lié à une seule règle, et inversement pour une même catégorie de filtre.** La documentation dit : « la relation filtre-règle est toujours biunivoque et gérée automatiquement » [DOC]. Je l'interprète **catégorie par catégorie** [DÉDUIT].
2. **Catégories de filtres** (classes [DOC]) : adresse (`MSFT_NetAddressFilter`), port et protocole (`MSFT_NetProtocolPortFilter`), application (`MSFT_NetApplicationFilter`), interface (`MSFT_NetInterfaceFilter`), type d'interface (`MSFT_NetInterfaceTypeFilter`), service (`MSFT_NetServiceFilter`), sécurité (`MSFT_NetNetworkLayerSecurityFilter`).
3. **Une règle a donc plusieurs objets filtres**, un par catégorie. **Il serait faux de dire qu'une règle n'a qu'un seul filtre au total.**
4. **Le profil n'est pas un filtre biunivoque.** `MSFT_NetFirewallProfile` est un objet *associé* : un même profil couvre **plusieurs** règles, comme le montre l'exemple 2 [DOC].
5. **Relation avec les filtres internes de WFP : non documentée.** Aucune correspondance stable et univoque entre une règle NetSecurity et des filtres WFP n'est démontrée.

**Correction de E11 (v15).** La v15 écrivait « relation règle ↔ filtres NetSecurity : biunivoque ». Cette phrase est remplacée par les points 1 à 5 : la relation est biunivoque **par catégorie** de filtre, le profil est exclu, et rien n'est dit des filtres WFP.

---

## 5. F53 : portée de l'instantané WFP

**Ce que la documentation permet d'affirmer [DOC] :** les résultats de `FwpmFilterEnum0` proviennent d'**un instantané des filtres WFP**, pris **au moment où le descripteur d'énumération a été créé**.

**Ce qu'elle ne permet pas d'affirmer :**
- **les autres objets WFP** (fournisseurs, sous-couches, callouts, contextes de fournisseur) : la phrase ne parle que des **filtres** [DÉDUIT] ;
- **les règles NetSecurity** : elles ne font pas partie de cet instantané ;
- **le lien entre filtres WFP et règles** : non documenté ;
- **l'état courant** : par construction, il peut avoir changé depuis la création du descripteur. L'instantané est **périmé dès sa création** pour qui veut l'état présent ;
- **l'ensemble du pare-feu Windows** : ce n'est **pas** une photographie atomique de tout le pare-feu.

**Identifiants [DOC] :**
- les objets **FWPM** (mode utilisateur) sont identifiés par un **GUID**, unique par type d'objet, fourni par l'appelant ou attribué par le moteur ;
- les objets **FWPS** (mode noyau) sont identifiés par un **LUID**, toujours attribué par le moteur ;
- `FWPM_FILTER0.filterId` est le LUID du filtre, **identique** à celui de la structure `FWPS_FILTER0` correspondante.

**Ni la durée de vie ni la réutilisation de `filterId` ne sont documentées** dans les pages lues. Aucune extrapolation n'est faite à leur sujet.

---

## 6. F54 : schéma corrigé du rapport de récupération

Il s'agit d'une spécification : aucun fichier n'est créé.

```
{
  "format": "orch-recovery-report/2",
  "operation": {
    "operationId": "<runId : GUID aléatoire de l'exécution initiale>",
    "operationStartedAtUtc": "<horloge locale, début de l'opération d'installation, d'après le journal de l'orchestrateur>"
  },
  "timing": {
    "reportGeneratedAtUtc": "<horloge locale>",
    "clockSource": "horloge système locale, non certifiée"
  },
  "canonVersion": "<version de l'algorithme>",
  "runtime": { "<relevés T-FW-RUNTIME-COMPAT>" },
  "rules": [{
    "name": "ORCH-<runId>-<alias>-<n>",
    "displayName": "...",
    "group": "ORCH-<runId>",
    "ruleCreationTimeUtc": null,
    "ruleCreationTimeUnavailableReason": "Aucune date de création de règle documentée par NetSecurity dans les pages consultées",
    "createCallReturnedAtUtc": "<heure de retour de notre appel de création, d'après notre journal. Ce n'est PAS la date de création de la règle>",
    "expectedStore": "PersistentStore",
    "expectedSourceType": "Local",
    "expectedProperties": { "<forme normalisée lisible>" },
    "expectedRuleFingerprint": "<SHA-256 de la forme canonique attendue, d'après le journal CRÉÉE>",
    "lastObservation": {
      "lastReadAtUtc": "<horloge locale>",
      "storesQueried": ["PersistentStore", "ActiveStore", "RSOP", "SystemDefaults", "StaticServiceStore", "ConfigurableServiceStore", "localhost"],
      "storesUnreadable": [{ "store": "...", "error": "..." }],
      "foundIn": ["..."],
      "sourceTypeObserved": "...",
      "observedRuleFingerprint": "<SHA-256 ou null>",
      "readStable": true,
      "wfpHints": { "note": "indices seulement : aucune correspondance prouvée entre filtres WFP et règle" }
    },
    "anomalies": ["ABSENTE", "EMPREINTE_DIFFERENTE", "NOM_DANS_AUTRE_MAGASIN", "SOURCE_NON_LOCALE", "LECTURE_INSTABLE", "MAGASIN_ILLISIBLE"]
  }],
  "manualInspection": {
    "warning": "INSPECTION SEULEMENT. Ces recherches se font PAR NOM : elles n'établissent PAS l'identité de la règle. Le nom peut avoir été réutilisé, et la règle trouvée peut être une recréation. Ce rapport ne recommande aucune désactivation ni suppression. Toute action relève de la décision indépendante de l'administrateur. Rappel documenté : une cmdlet de modification lancée sans sélecteur peut toucher toutes les règles.",
    "lookupsByName": [
      "Get-NetFirewallRule -PolicyStore <magasin> -Name '<nom exact>' | Format-List *",
      "Get-NetFirewallRule -PolicyStore <magasin> -Name '<nom exact>' | Get-NetFirewallAddressFilter | Format-List *",
      "(idem pour les filtres de port, d'application, d'interface, de type d'interface, de service et de sécurité)"
    ],
    "compareWith": "expectedProperties et expectedRuleFingerprint de ce rapport"
  },
  "limits": "Nom réutilisable. Une empreinte identique ne prouve pas qu'il s'agit du même objet. Aucune action atomique. Énumération des magasins non exhaustive (C9 non prouvée). Rapport susceptible d'être périmé au moment de son usage.",
  "reportIntegrityDigest": {
    "algorithm": "SHA-256",
    "scope": "rapport sans ce champ",
    "meaning": "Contrôle d'intégrité contre une corruption accidentelle seulement. N'empêche PAS une falsification par une personne capable de modifier le rapport et de recalculer l'empreinte. Ne prouve ni l'authenticité ni la provenance."
  }
}
```

**Trois empreintes distinctes :**
- `expectedRuleFingerprint` : celle de la règle attendue ;
- `observedRuleFingerprint` : celle de la dernière observation ;
- `reportIntegrityDigest` : celle du rapport, qui ne sert qu'au contrôle d'intégrité.

**Signature ou MAC.** C'est une **évolution distincte**, qui demanderait une spécification de gestion des clés : création, stockage, protection, rotation et vérification. **Elle n'est ni spécifiée ni implémentée ici.**

**T-FW-ALL-STORES, volet AppIso, en trois niveaux distincts :**
1. **Présence ou absence de la clé de registre** documentée (`…\RestrictedServices\AppIso\FirewallRules`). Ce n'est qu'un **indice**.
2. **Inventaire effectif des règles AppIso**. Le format des valeurs n'est **pas documenté** dans les pages lues [SUPPOSÉ]. L'inventaire n'est donc **pas garanti exhaustif**.
3. **Contribution de ces règles à la politique effective**. Elle **ne peut pas être déterminée** par NetSecurity, qui ne donne pas accès à ces règles [DOC].

**La présence ou l'absence de la clé ne prouve pas que l'inventaire est complet. C9 reste non prouvée.**

---

## 7. Tableau des garanties, hypothèses et inconnues

| Sujet | Documenté | Supposé | Inconnu |
|---|---|---|---|
| Identité d'une instance avec `-InputObject` (suppression ou désactivation) | Type `CimInstance[]`, pas de `-PolicyStore`, logique « requête puis action » | Action par clé | **Garantie d'identité** |
| Désactivation plutôt que suppression | Réversible ; mêmes sélecteurs ; désactive tout sans paramètre | — | Avantage en termes d'identité ou de TOCTOU : **aucun documenté** |
| Relation entre filtres NetSecurity et règle | Biunivoque, par catégorie ; profil associé à plusieurs règles | Interprétation « par catégorie » | — |
| Lien entre règle et filtres WFP | — | Plusieurs filtres WFP par règle | **Correspondance** |
| Instantané WFP | Filtres, à la création du descripteur | Autres objets non inclus | État courant ; cohérence avec NetSecurity |
| `filterId` | LUID attribué par le moteur, égal à celui de `FWPS_FILTER0` | — | **Durée de vie, réutilisation** |
| Date de création d'une règle | — | — | **Disponibilité** : `null` dans le rapport |
| Inventaire AppIso | Clé documentée ; non accessible par NetSecurity | Format des valeurs | Exhaustivité ; contribution effective |
| Intégrité du rapport | — | — | Authenticité (aucun mécanisme spécifié) |

---

## 8. Corrections explicites des versions précédentes

| N° | Version | Erreur | Correction |
|---|---|---|---|
| E16 | v15 | Le rapport conseillait « de préférence désactiver d'abord, observer, puis supprimer » | **Retiré** (F51) |
| E17 | v15 (E11, tableau de la section 7) | « Relation règle ↔ filtres NetSecurity : biunivoque » | Reformulé : biunivoque **par catégorie**, profil exclu, sans conséquence sur WFP (F52) |
| E18 | v15 (F49) | « Lecture cohérente du côté WFP » | Limité à **l'instantané des seuls filtres WFP** au moment de la création du descripteur (F53) |
| E19 | v15 (schéma) | `createdAtUtc` décrit comme « date de l'installation » | Remplacé : quatre horodatages distincts, et `ruleCreationTimeUtc` à `null` avec sa justification (F54) |
| E20 | v15 (schéma) | `reportFingerprint` sans préciser sa portée | Renommé `reportIntegrityDigest`, **intégrité seulement** (F54) |
| E21 | v15 (étape manuelle 1) | « Inspecter la règle » par nom, sans avertissement d'identité à cet endroit | Recherches **explicitement présentées comme par nom, sans valeur d'identité** (F54) |
| E22 | v15 (tableau F48) | Désactivation : « mêmes sélecteurs que la suppression [SUPPOSÉ] » | Désormais **[DOC]** |
| E23 | v8 à v14 | Noms des classes CIM de règles et de filtres notés [SUPPOSÉ] | Désormais **[DOC]** (page `Get-NetFirewallRule`, sections Inputs et Outputs) |

---

## 9. Verdicts de sécurité

| Décision | Verdict |
|---|---|
| **Installation** | **NO-GO** |
| **Appels réels aux agents** | **NO-GO** |
| **Modification du pare-feu** | **NO-GO** |
| **Suppression automatique** | **NO-GO** |
| **Désactivation automatique** | **NO-GO** : aucune garantie d'identité supérieure à la suppression (F51) |
| **Modification directe de WFP** | **NO-GO** |
| **Retour arrière, version 1** | **Rapport d'inspection seulement**, sans aucune séquence d'action recommandée. Les risques de concurrence sont maintenus |
| **Tests** | **Non autorisés** |
| **Implémentation** | **Non autorisée** |

La v16 reste une revue documentaire. **Elle ne vaut pas autorisation de passer à l'exécution.**
