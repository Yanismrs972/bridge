<!-- Rapport extrait de la session Claude « Orchestrateur IA », 2026-11-17 23:41 UTC -->

# Rapport Phase 0B v15 : revue corrective F47 à F50

## 1. Cadre et limites de la mission

**Fait :**
- lecture en ligne de pages publiques de **Microsoft Learn** (liste en section 2) ;
- relecture locale, avec l'outil de lecture de fichiers, de l'extrait déjà téléchargé de la page `Remove-NetFirewallRule` ;
- analyse des rapports v5 à v14.

**Non fait :** aucune commande, aucun script, aucun code exécuté ; aucun fichier créé, modifié ou supprimé ; aucune installation ; aucune VM démarrée ; aucun agent ni aucune API contactés ; aucun accès à Fastclip ni à Git ; aucune modification du pare-feu ni de WFP.

**Limite méthodologique.** Une page non consultée, ou une information absente d'une page consultée, **ne prouve pas que la fonctionnalité n'existe pas**. Cette limite s'applique à toutes les conclusions qui suivent.

**Légende :** [DOC] documentation consultée · [DÉDUIT] déduction · [SUPPOSÉ] hypothèse · [TEST] à démontrer.

---

## 2. Sources officielles consultées

| Page | Affirmations qu'elle soutient |
|---|---|
| [`Remove-NetFirewallRule`](https://learn.microsoft.com/en-us/powershell/module/netsecurity/remove-netfirewallrule) | Jeux de paramètres, dont `InputObject (cdxml)` : `-InputObject <CimInstance[]>`, **sans `-PolicyStore`**. Description du paramètre : « l'objet d'entrée utilisé dans une commande de pipeline ». **Exemple 4** : un **filtre d'application**, et non une règle, est passé à `-InputObject` et l'opération « supprime toutes les règles associées ». La cmdlet « interroge les règles […] puis supprime la règle trouvée » |
| [`Get-NetFirewallRule`](https://learn.microsoft.com/en-us/powershell/module/netsecurity/get-netfirewallrule) | Liste des magasins : `PersistentStore`, `ActiveStore`, `RSOP`, `SystemDefaults`, `StaticServiceStore`, `ConfigurableServiceStore`, et les stratégies de groupe (`localhost`, nom de l'ordinateur, domaine). **Le magasin par défaut est `PersistentStore`**. Les règles d'isolation réseau des applications du Store, stockées sous `…\FirewallPolicy\RestrictedServices\AppIso\FirewallRules`, « **ne sont pas accessibles** avec `Get-NetFirewallRule` ». `PolicyStoreSourceType` vaut `Local`, `GroupPolicy`, `Dynamic`, `Generated` ou `Hardcoded` ; les trois derniers ne sont « **pas valides dans les cmdlets** ». **« La relation entre filtre et règle est toujours biunivoque et gérée automatiquement. »** `EdgeTraversalPolicy` « ne s'applique qu'aux règles entrantes » et sa valeur par défaut est `Block`. `-Name` accepte les jokers et n'est unique **que par magasin** |
| [WFP : gestion des objets](https://learn.microsoft.com/en-us/windows/win32/fwp/object-management) | Sessions, éventuellement dynamiques. **Transactions explicites ou implicites, à propriétés ACID**, une par session, avec un verrou et un délai de blocage d'**une heure** en mode utilisateur. Durées de vie des objets : dynamique, statique, persistant, prédéfini, au démarrage. **Le GUID est unique par type d'objet et peut être fourni par l'appelant ou attribué par le moteur.** Le LUID, lui, est **toujours attribué par le moteur**. Un objet ne peut pas être supprimé tant que d'autres objets y font référence |
| [`FWPM_FILTER0`](https://learn.microsoft.com/en-us/windows/win32/api/fwpmtypes/ns-fwpmtypes-fwpm_filter0) | `filterKey` (GUID, généré s'il est nul) ; `filterId` (LUID, renvoyé à la lecture ou à l'énumération) ; `providerKey` ; `providerData` ; indicateurs |
| [`FwpmFilterAdd0`](https://learn.microsoft.com/en-us/windows/win32/api/fwpmu/nf-fwpmu-fwpmfilteradd0) | Paramètre de sortie `id` : « l'identifiant d'exécution du filtre ». Certains champs sont attribués par le système. Fonction interdite dans une transaction en lecture seule |
| [`FwpmFilterDeleteByKey0`](https://learn.microsoft.com/en-us/windows/win32/api/fwpmu/nf-fwpmu-fwpmfilterdeletebykey0) | Suppression **par GUID**. Elle échoue (`FWP_E_WRONG_SESSION`, `FWP_E_DYNAMIC_SESSION_IN_PROGRESS`) selon la session dynamique d'origine. Elle exige le droit `DELETE` sur le filtre |
| [`FwpmFilterEnum0`](https://learn.microsoft.com/en-us/windows/win32/api/fwpmu/nf-fwpmu-fwpmfilterenum0) | L'énumération porte sur **un instantané des filtres pris à la création du descripteur d'énumération** |
| [`FwpmTransactionBegin0`](https://learn.microsoft.com/en-us/windows/win32/api/fwpmu/nf-fwpmu-fwpmtransactionbegin0) et [`FwpmTransactionCommit0`](https://learn.microsoft.com/en-us/windows/win32/api/fwpmu/nf-fwpmu-fwpmtransactioncommit0) | Transactions en lecture ou en lecture et écriture, **dans la session courante** ; validation obligatoirement à l'intérieur d'une transaction |

**Pages non consultées :** `FwpmFilterGetByKey0` et `FwpmTransactionAbort0`. Leur comportement n'est connu que par la page de gestion des objets : annuler une transaction revient à n'appliquer aucune des opérations.

---

## 3. F47 : `-InputObject` et identité de l'instance

| Point | Constat |
|---|---|
| **1. Type d'entrée accepté** | `CimInstance[]`, alimenté par le pipeline [DOC]. **Le type n'est pas limité aux règles** : l'exemple 4 lui passe un filtre d'application [DOC] |
| **2. Comportement documenté** | La cmdlet « interroge » puis supprime. Avec un filtre en entrée, elle supprime **toutes les règles associées** [DOC]. Le jeu de paramètres `InputObject` **n'a pas de `-PolicyStore`** [DOC]. Le magasin viserait donc celui de l'objet [SUPPOSÉ] |
| **3. Garantie d'identité documentée** | **Aucune.** Rien n'indique que passer une instance `MSFT_NetFirewallRule` supprime *cette* instance plutôt que l'objet qui porte la même clé au moment de l'appel |
| **4. Hypothèses** | Le mécanisme générique des cmdlets CDXML supprimerait l'instance **par ses clés** (le `Name`) [SUPPOSÉ]. L'exemple 4 pourrait aussi être une **erreur de documentation**, puisqu'un paramètre dédié `-AssociatedNetFirewallApplicationFilter` existe par ailleurs. **La documentation ne permet pas de trancher** |
| **5. Risque TOCTOU restant** | Si la suppression passe par la clé, une règle **supprimée puis recréée sous le même `Name`** serait supprimée à la place de l'originale [DÉDUIT de l'hypothèse 4]. **Le risque est entier** |

**Correction de la v14.** Elle proposait de supprimer « par l'objet de la relecture » pour **réduire** la course entre vérification et suppression. **Rien ne fonde cette réduction.**

---

## 4. F48 : modèle définitif de retour arrière assisté

| Mécanisme | Identité visée | TOCTOU | Peut toucher une règle recréée ou modifiée | Effets secondaires | Garanties documentées | Garanties absentes |
|---|---|---|---|---|---|---|
| Suppression par `-Name` | `Name`, réutilisable et unique seulement par magasin [DOC] | Oui | **Oui** | **Jokers acceptés** [DOC] : risque de suppressions multiples | Recherche par nom dans le magasin indiqué | Identité de l'instance ; condition préalable |
| Suppression par `-InputObject` | Inconnue (F47) | Oui | **Probablement** [SUPPOSÉ] | Suppression de **plusieurs** règles si l'entrée est un filtre [DOC, exemple 4] | Aucune sur l'identité | Identité ; périmètre exact |
| Suppression de filtres WFP | `filterKey` (GUID) [DOC] | Oui. Une transaction WFP ne couvre que la session WFP [DOC] | Oui, si le GUID est réattribué à l'identique par le créateur [DOC : l'appelant peut fournir le GUID] | **Incohérence entre la règle du pare-feu et WFP** ; droits requis ; filtres d'un autre fournisseur [DÉDUIT] | Suppression par GUID ; propriétés ACID **à l'intérieur de WFP** | Couverture des opérations NetSecurity ; lien entre règle et filtres |
| Désactivation d'une règle | Mêmes sélecteurs que la suppression [SUPPOSÉ] | Oui | Oui | Réversible, mais la règle reste en place [DOC] | La règle existe toujours et peut être réactivée [DOC] | Identité de l'instance |
| **Rapport de récupération, sans action sur le système** | Aucune action | **Aucune modification système** | Non : seul l'administrateur agit | Aucun sur le système | — | Le rapport peut devenir **périmé** entre sa production et son usage |

**Décision pour la version 1 de l'orchestrateur :**
- **Autorisé :** identifier les règles candidates ; produire un rapport détaillé ; afficher les empreintes et les preuves ; indiquer les vérifications manuelles.
- **Interdit :** supprimer une règle, désactiver une règle, modifier des filtres WFP.

**Cette solution n'est pas absolument sûre.** Elle supprime les actions automatiques dangereuses, mais une modification concurrente reste possible entre l'inspection humaine et l'action de l'administrateur.

**Format du rapport de récupération** (spécification, aucun fichier n'est créé) :
```
{
  "format": "orch-recovery-report/1",
  "operationId": "<runId, GUID aléatoire de l'exécution initiale>",
  "createdAtUtc": "<ISO 8601 UTC de l'installation>",
  "reportGeneratedAtUtc": "<ISO 8601 UTC>",
  "canonVersion": "<version de l'algorithme>",
  "runtime": { "<relevés T-FW-RUNTIME-COMPAT>" },
  "rules": [{
    "name": "ORCH-<runId>-<alias>-<n>",
    "displayName": "...", "group": "ORCH-<runId>",
    "expectedStore": "PersistentStore", "expectedSourceType": "Local",
    "expectedProperties": { "<forme normalisée lisible>" },
    "expectedFingerprint": "<SHA-256 du journal CRÉÉE>",
    "lastRead": {
      "atUtc": "...",
      "storesQueried": ["PersistentStore","ActiveStore","RSOP","SystemDefaults","StaticServiceStore","ConfigurableServiceStore","localhost"],
      "foundIn": ["..."], "sourceTypeObserved": "...",
      "observedFingerprint": "<SHA-256 ou null>",
      "stableAB": true,
      "wfpHints": { "note": "indices seulement, aucune preuve d'identité" }
    },
    "anomalies": ["ABSENTE", "EMPREINTE_DIFFERENTE", "NOM_DANS_AUTRE_MAGASIN", "SOURCE_NON_LOCALE", "LECTURE_INSTABLE"]
  }],
  "manualSteps": {
    "warning": "ÉTAPES À RÉALISER MANUELLEMENT PAR L'ADMINISTRATEUR. L'ORCHESTRATEUR NE LES EXÉCUTE JAMAIS.",
    "steps": [
      "1. Inspecter la règle : Get-NetFirewallRule -PolicyStore PersistentStore -Name '<nom exact>' | Format-List *",
      "2. Inspecter ses filtres (adresses, ports, interface…) et les comparer aux propriétés attendues de ce rapport.",
      "3. Si et seulement si tout correspond : de préférence la désactiver d'abord (Disable-NetFirewallRule), observer, puis la supprimer.",
      "4. Relire après l'action et vérifier qu'aucune autre règle n'a été touchée."
    ]
  },
  "limits": "Le nom d'une règle est réutilisable. Une empreinte identique ne prouve pas qu'il s'agit du même objet. Aucune suppression ne peut être atomique. Ce rapport peut être périmé au moment de son usage.",
  "reportFingerprint": "<SHA-256 du rapport sans ce champ>"
}
```

---

## 5. F49 : identité et cycle de vie des filtres WFP

| Élément | Statut |
|---|---|
| `filterKey` | GUID **unique par type d'objet** ; **fourni par l'appelant ou généré** par le moteur [DOC]. **Un créateur peut donc réutiliser un GUID** après une suppression [DÉDUIT]. La page de la structure dit qu'il identifie « la session », vraisemblablement une coquille [DOC, incohérence] |
| `filterId` | LUID « identifiant d'exécution », **toujours attribué par le moteur** [DOC]. **Sa durée de vie, sa réutilisation éventuelle et sa stabilité au redémarrage ne sont pas documentées** dans les pages lues |
| Suppression puis recréation | Une recréation laissée au moteur produit un nouveau `filterKey` ; une recréation qui fixe le GUID peut le reprendre [DOC et DÉDUIT]. **On ignore si le service du pare-feu fixe ses propres GUID** [SUPPOSÉ] |
| Persistance et filtres au démarrage | Persistants : « vivent jusqu'à leur suppression ». Au démarrage : ajoutés au démarrage du pilote TCP/IP, retirés après l'initialisation du moteur. Dynamiques : supprimés à la fin de la session [DOC] |
| Énumération | `FwpmFilterEnum0` porte sur **un instantané** pris à la création du descripteur d'énumération [DOC]. Cela donne une **lecture cohérente du côté WFP**, sans équivalent documenté pour NetSecurity |
| Suppression | `FwpmFilterDeleteByKey0`, par GUID, soumise aux droits et aux contraintes de session [DOC] |
| Transactions | ACID, **dans la session de l'appelant**, avec un verrou et un délai d'attente [DOC]. **Rien ne documente que les opérations NetSecurity, menées par le service du pare-feu, participent à notre transaction.** Une transaction en lecture et écriture prolongée pourrait **bloquer** d'autres écrivains jusqu'à une heure [DÉDUIT du verrou décrit] : à exclure |
| Lien entre filtre WFP et règle NetSecurity | **Non documenté.** Ne jamais supposer qu'un identifiant WFP permet de retrouver avec certitude la règle d'origine |

**Corrections et précisions apportées aux versions précédentes :**
- **E11.** La relation biunivoque est **documentée pour les filtres NetSecurity** (adresses, ports…). La v8 la traitait comme une hypothèse à vérifier ; elle reste vérifiée, mais par cohérence. **Elle ne vaut pas pour les filtres WFP.**
- **E12.** Le magasin par défaut de `Get-NetFirewallRule` est bien `PersistentStore` [DOC]. Cela confirme le risque signalé en F20.
- **E13.** `EdgeTraversalPolicy` ne s'applique qu'aux règles entrantes et vaut `Block` par défaut [DOC]. F13 est partiellement résolu : `Block` est attendu pour `IN-ALL`, et l'étalonnage reste nécessaire pour les règles sortantes.
- **E14.** Pour `-Name`, la description dit que les jokers sont acceptés, alors que le tableau des propriétés indique « Supports wildcards: False » [DOC, **contradiction**]. On retient l'interprétation prudente : les jokers sont possibles.
- **E15.** `PrimaryStatus` est décrit avec `OK`, `Degraded` et `Error`, alors que les valeurs acceptées sont `Unknown`, `OK`, `Inactive` et `Error` [DOC, **contradiction**]. Cette propriété ne peut pas servir de preuve.

---

## 6. F50 : exhaustivité des magasins de stratégie

| Magasin ou source | Lisible par NetSecurity | Remarque |
|---|---|---|
| `PersistentStore` | Oui [DOC] | Règles locales ; magasin par défaut |
| `ActiveStore` | Oui [DOC] | Résultat de la fusion : stratégies de groupe, `PersistentStore`, WSH statique et WSH configurable. **Les règles de même nom s'écrasent** |
| `RSOP` | Oui, en lecture seule [DOC] | Somme des stratégies de groupe appliquées |
| `SystemDefaults` | Oui, en lecture seule [DOC] | Valeurs par défaut fournies avec Windows |
| `StaticServiceStore` | Oui, en lecture seule [DOC] | WSH statique |
| `ConfigurableServiceStore` | Oui, en lecture et écriture [DOC] | WSH configurable |
| Stratégie de groupe de l'ordinateur (`localhost` ou nom de l'ordinateur) | Oui [DOC] | Effet réel sur une édition Famille [SUPPOSÉ] |
| Stratégies de groupe de domaine | Seulement dans un contexte de domaine [DOC] | Sans objet sur cette machine [SUPPOSÉ] |
| **Règles d'isolation des applications du Store (AppIso)** | **Non** : « pas accessibles avec `Get-NetFirewallRule` » [DOC] | Stockées dans le registre, sous une clé documentée |
| **Sources `Dynamic`, `Generated`, `Hardcoded`** | **Non** : « pas valides dans les cmdlets » [DOC] | Peuvent seulement **apparaître** dans `ActiveStore` lors de la surveillance |

**Il faut distinguer quatre absences :**
- absence dans `ActiveStore` : ce qui reste visible **après la fusion** ;
- absence dans `PersistentStore` : uniquement le magasin local ;
- absence dans les magasins WSH : uniquement les restrictions de services ;
- absence dans tous les magasins **lisibles**.

**Réponse à la question centrale. Non.** Aucun moyen documenté ne permet d'énumérer **tous** les magasins qui contribuent à la politique effective : les règles AppIso et les sources `Dynamic`, `Generated` et `Hardcoded` y échappent [DOC]. **La condition C9 ne peut donc pas être considérée comme prouvée.** On peut seulement établir l'absence d'un nom dans **les magasins lisibles**, ce qui reste partiel.

Le caractère aléatoire du `runId` contenu dans le nom rend une **collision accidentelle** improbable [DÉDUIT]. Il ne protège pas contre une **collision volontaire**.

---

## 7. Récapitulatif des garanties, hypothèses et inconnues

| Sujet | Documenté | Supposé | Inconnu |
|---|---|---|---|
| Identité d'une instance supprimée par `-InputObject` | Type `CimInstance[]` ; l'exemple 4 supprime « toutes les règles associées » | Suppression par clé | **Garantie d'identité** |
| Identité d'une règle | `Name` unique par magasin, réutilisable | — | Identifiant immuable, version |
| Identité d'un filtre WFP | GUID fourni ou généré ; LUID attribué par le moteur | Nouveau `filterId` en cas de recréation | Durée de vie et réutilisation du LUID ; GUID choisis par le service du pare-feu |
| Atomicité de la suppression | Transactions WFP limitées à la session | NetSecurity hors de ces transactions | Toute primitive atomique « vérifier puis supprimer » pour les règles |
| Cohérence de lecture | Instantané à l'énumération WFP | — | Instantané NetSecurity |
| Exhaustivité des magasins | Liste des magasins ; AppIso et sources dynamiques inaccessibles | — | Autres sources éventuelles |
| Relation entre une règle et ses filtres NetSecurity | **Biunivoque et automatique** | — | — |
| Lien entre une règle et ses filtres WFP | — | Plusieurs filtres par règle (IPv4, IPv6, couches) | Correspondance |

---

## 8. Tests proposés et critères de réussite

**Aucun test n'est exécuté.** Les tests WFP exigeraient un accès natif aux API, donc du code : ils relèvent d'une phase ultérieure.

| Test | Propriété à établir | Critère de réussite | Remarque |
|---|---|---|---|
| **T-FW-INPUTOBJECT-IDENTITY** | `-InputObject` supprime-t-il **l'instance lue** ou **la clé courante** ? | Lecture de la règle, suppression puis recréation sous le même `Name` avec des propriétés **différentes**, puis appel avec l'objet de la première lecture. Si la règle recréée disparaît, la suppression se fait par clé. **Le résultat sert à documenter, jamais à autoriser une suppression automatique** | Règles de test dédiées uniquement |
| **T-FW-WFP-FILTERKEY** | Stabilité des `filterKey` du service du pare-feu pour une règle : au redémarrage du service ou de la machine, après modification, après désactivation et réactivation, **après recréation sous le même `Name`** | Comportement relevé dans chaque cas | Indique si le `filterKey` peut distinguer une règle recréée |
| **T-FW-WFP-FILTERID** | Évolution et réutilisation des `filterId` dans les mêmes cas | Comportement relevé | Indique si le `filterId` peut servir d'identité pendant une session de démarrage |
| **T-FW-WFP-RECREATE** | Existe-t-il **une** différence observable dans WFP entre une règle originale et sa recréation identique ? | Comparaison complète : clés, identifiants, données du fournisseur, poids, conditions | En cas d'égalité : **identité indiscernable aussi dans WFP** |
| **T-FW-WFP-TRANSACTION-SCOPE** | Une transaction **en lecture seule** dans notre session voit-elle un état figé pendant qu'une modification NetSecurity a lieu ? Cette modification est-elle bloquée ou non ? | Comportement relevé. **Jamais de transaction en lecture et écriture** (risque de bloquer le service du pare-feu) | Établit la portée réelle des transactions |
| **T-FW-ALL-STORES** | Absence d'un nom dans **chaque magasin lisible** | Lecture de chaque magasin listé en section 6, avec les erreurs d'accès consignées ; relevé de l'existence de la clé de registre AppIso ; **conclusion limitée aux magasins lisibles** | Ne peut **pas** établir C9 |

---

## 9. Hypothèses restantes

**[SUPPOSÉ] :**
- suppression par clé avec `-InputObject` ;
- exemple 4 éventuellement erroné ;
- stratégie de GUID du service du pare-feu ;
- durée de vie des LUID ;
- plusieurs filtres WFP par règle ;
- absence de participation de NetSecurity aux transactions WFP ;
- effet de la stratégie de groupe locale sur une édition Famille ;
- **toutes** les hypothèses ouvertes depuis la v6 : canonicaliseur, CIM, fonctionnement à états, eBPF, jetons de Codex, révocation serveur, NAT de VirtualBox.

---

## 10. Verdicts de sécurité

| Décision | Verdict |
|---|---|
| **Installation** | **NO-GO** |
| **Appels réels aux agents** | **NO-GO** |
| **Modification du pare-feu** | **NO-GO** |
| **Suppression automatique de règles** | **NO-GO**. Aucune garantie d'identité (F47), aucune primitive atomique (F48, F49), exhaustivité impossible (F50) |
| **Désactivation automatique de règles** | **NO-GO**, pour les mêmes raisons |
| **Modification directe de WFP** | **NO-GO** |
| **Retour arrière, version 1** | **Rapport de récupération seulement**. Les actions restent manuelles et indépendantes, et ne sont pas présentées comme absolument sûres |
| **Exécution de tests** | **Non autorisée** |
| **Implémentation** | **Non autorisée** |
| **Cohérence documentaire** | Améliorée : rôle de `-InputObject`, magasins, relation entre règles et filtres et cycle de vie WFP sont désormais documentés ou leurs inconnues identifiées. Encore incomplète : pages `FwpmFilterGetByKey0`, `FwpmTransactionAbort0`, CIM et descriptions des cmdlets de filtre non lues |

Cette v15 est une revue documentaire. **Elle n'autorise pas, même implicitement, le passage à l'étape suivante.**
