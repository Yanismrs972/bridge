<!-- Rapport extrait de la session Claude « Orchestrateur IA », 2026-11-18 00:13 UTC -->

# Rapport Phase 0B v19 : corrections F63 à F65, consolidation et revue transversale

Je n'ai lancé aucune commande ni aucun script, créé aucun fichier de projet, démarré aucune VM, touché ni au pare-feu ni à WFP, et je n'ai appelé aucun agent ni accédé à Fastclip ou à Git. J'ai consulté quatre pages Microsoft Learn et relu l'historique de la conversation pour retrouver les intitulés F1 à F62.

**Signalement préalable : un point de F63 n'est pas confirmé par la documentation.** La page dédiée à `Stopwatch.GetElapsedTime` ne s'applique qu'à .NET 7 à 11, pas à .NET Framework 4.8 (détails en 1.1). Je n'ai donc pas écrit que la méthode est disponible en 4.8. Je ne l'ai pas non plus présentée comme certainement indisponible.

---

## Partie 1 : corrections F63 à F65 et précision F62

### 1.1 F63 : `Stopwatch` (H2 remplacée)

**Sources consultées en v19 :**
- S3 : classe `Stopwatch`, vue `netframework-4.8` ;
- S3b : `Stopwatch.GetTimestamp` ;
- S3c : `Stopwatch.GetElapsedTime`.

**Ce que dit la documentation sur `GetElapsedTime` [DOC, S3c] :**
- Les métadonnées de la page dédiée ne listent que `net-7.0` à `net-11.0`.
- Les deux surcharges, `GetElapsedTime(Int64)` et `GetElapsedTime(Int64, Int64)`, sont encadrées par la plage « net-7.0 … net-11.0 ».
- La page de classe récupérée (S3) affichait la vue par défaut `net-11.0` (`defaultMoniker: net-11.0`). Sa liste de membres ne prouve donc pas que ces méthodes existent en 4.8 [DÉDUIT].

**Nouvelle formulation de H2 :**
- La documentation consultée n'établit pas que `GetElapsedTime` existe en .NET Framework 4.8. La page dédiée ne cible que .NET 7 et versions ultérieures [DOC].
- Je n'affirme pas pour autant son absence à l'exécution : seule une inspection de l'assembly réellement chargé trancherait [TEST].
- Si tu disposes d'une autre page officielle qui indique l'inverse, elle prime sur cette conclusion. Je ne l'ai pas trouvée.

**Choix de spécification :** la durée se calcule à la main, (tics de fin − tics de début) / `Frequency`. Ce calcul ne dépend pas de l'existence de `GetElapsedTime`.

**Les deux modes de `GetTimestamp` [DOC, S3b].** La page dit :

> « If the Stopwatch class uses the system timer, GetTimestamp returns the current DateTime.Ticks property of the DateTime.UtcNow instance. »

| Mode | `IsHighResolution` | Valeur renvoyée par `GetTimestamp` | Ce que la valeur ne prouve pas |
|---|---|---|---|
| Haute résolution | `true` | Valeur courante du compteur de performance [DOC]. Ce n'est pas une date. | Aucune date UTC. Monotonie non garantie par S3, qui signale des écarts entre processeurs dus au BIOS ou à la couche HAL [DOC]. |
| Minuteur système | `false` | `DateTime.UtcNow.Ticks` [DOC] | Ce sont des tics d'horloge murale. Ils peuvent sauter ou reculer si l'horloge est ajustée [DÉDUIT]. Ce n'est ni une mesure monotone, ni une date UTC fiable, ni une preuve certifiée. |

**Conséquences pour le schéma :**
- `monotonic` devient `elapsedCounter`, avec un champ `mode`. Le nom « monotone » laissait croire à une garantie que la documentation ne donne dans aucun des deux modes.
- `mode` prend la valeur `performanceCounter` ou `systemTimerUtcTicks`.
- Dans le mode `systemTimerUtcTicks`, les durées sont qualifiées de `nonFiable_horlogeMurale`.
- Dans aucun mode, `Stopwatch` ne fournit une date UTC fiable ou certifiée.

### 1.2 F64 : `PolicyStoreSource`, et nouveau nom de champ

**Ce que dit la documentation de `-PolicyStoreSource` [DOC, S1] :**
- la valeur « contains a path to the policy store where the rule originated if the object is retrieved from the ActiveStore » avec l'option de traçage activée ;
- elle est « automatically generated » ;
- elle est « not completely compatible with the PolicyStore parameter » ;
- elle « cannot always be passed into the PolicyStore parameter » ;
- pour les GPO de domaine, elle « contains only the GPO name, not the domain name ».

**Ce que dit celle de `-TracePolicyStore` [DOC] :** le paramètre « Specifies that the name of the source GPO is queried and set to the PolicyStoreSource parameter value ».

**Correction :**
- **Renommage :** `sourcePath` devient `reportedPolicyStoreSource`, avec un champ `windowsProperty: "PolicyStoreSource"` qui garde la correspondance avec la propriété Windows.
  - Le mot « path » suggérait un chemin canonique et réutilisable.
  - « reported » dit qu'il s'agit d'une valeur **rapportée par Windows** au moment de la lecture.
  - De même, `sourceType` devient `reportedPolicyStoreSourceType`.
- **Ajout de `reusableAsPolicyStore` :** il vaut toujours `"non_établi"`. Le rapport n'essaie jamais de relire le magasin d'origine à partir de cette valeur, puisque la documentation dit qu'elle n'est pas toujours réutilisable.
- **Deux statuts toujours indépendants**, chacun avec sa valeur et sa raison. Le statut `non_demandée` est employé si la lecture d'ActiveStore n'a pas utilisé `-TracePolicyStore`.
- **Ce que la provenance ne fait pas :** elle n'identifie aucune instance de règle, ne relie à aucun objet WFP et ne garantit pas que toutes les sources ont été vues.
- **Remarque de vocabulaire [DOC] :** la page S1 décrit ces deux propriétés avec l'expression « TracePolicyStoreSource option ». Le paramètre réel reste `-TracePolicyStore`.

### 1.3 F65 : ordre de priorité des résultats de `observationsConcordant`

**Définitions préalables :**
- **Lecture exploitable :** elle a abouti au moins partiellement, sur la même requête, le même magasin et le même réglage `-TracePolicyStore` que la lecture de référence.
- **Lecture non comparable :** elle porte sur un autre magasin, une autre requête ou un autre réglage de traçage. Elle est exclue de la comparaison et listée dans `nonComparableReads`.
- **Erreur de collecte :** la lecture a pour issue `échec`. Elle est exclue et listée dans `collectionErrors`.
- **Valeur de propriété, trois états distincts :**
  - `observée` : une valeur a été lue ;
  - `observée_nulle` : Windows a renvoyé une valeur vide, et c'est documentable ;
  - `non_collectée` : erreur, propriété absente de l'objet ou lecture partielle.
- **Règle d'inconnu :** une valeur `non_collectée` n'est **jamais** traitée comme identique à une autre, ni comme différente. Elle rend la comparaison incomplète.
- **Différence réelle :** deux valeurs à l'état `observée` ou `observée_nulle` qui diffèrent sous la canonicalisation TLV déjà spécifiée. `observée_nulle` face à une valeur `observée` est une divergence.

**Ordre d'évaluation (le premier cas vrai l'emporte) :**

1. **`divergentes`** : au moins une différence réelle entre deux lectures exploitables. Ce résultat l'emporte même si d'autres lectures sont partielles ou en échec, et celles-ci restent listées.
2. **`lecture_incomplète`** : aucune divergence établie, mais au moins une lecture est partielle ou en échec, une propriété est `non_collectée`, une lecture n'est pas comparable, ou une seule lecture est exploitable.
3. **`concordantes`** : au moins deux lectures exploitables, toutes complètes, et toutes les propriétés comparées sont concordantes.
4. **`lecture_impossible`** : aucune lecture exploitable.

**Exclusion mutuelle [DÉDUIT] :** sans lecture exploitable, les cas 1 à 3 ne peuvent pas être établis. `lecture_impossible` n'entre donc pas en conflit avec eux.

**Limites inchangées :** même `concordantes` ne prouve ni l'absence de concurrence ni un instantané atomique.

### 1.4 Précision F62 : édition Home et domaine Active Directory

| Élément | Statut |
|---|---|
| Les éditions Windows Home ne peuvent pas joindre un domaine Active Directory | Limitation générale largement connue. **La source officielle n'a pas été reconsultée en v19** [SUPPOSÉ fort ; à citer avant toute phase ultérieure]. |
| Édition du PC cible : Windows 10 Famille 22H2, build 19045 | **Information rapportée** (environnement de session et déclarations antérieures), non vérifiée indépendamment dans cette mission [SUPPOSÉ]. |
| Conséquence : les GPO de domaine sont probablement sans objet sur ce poste | [DÉDUIT], sous réserve des deux lignes ci-dessus. |
| Stratégies locales (GPO de l'ordinateur local via `-PolicyStore localhost`, ou paramètres qui désactivent la fusion des règles locales, cf. F10) | Elles restent **à prendre en compte**. Une absence de domaine n'implique pas une absence de stratégie. Leur applicabilité exacte sur une édition Home est [TEST]. |
| Politiques déjà appliquées | Leur visibilité éventuelle dans RSOP ou ActiveStore reste celle décrite en v18 [DÉDUIT / TEST]. |
| Exhaustivité de la provenance | Jamais déclarée. |

### 1.5 Schéma `orch-recovery-report/5` (différences avec la version 4)

```json
{
  "schema": "orch-recovery-report/5",
  "timestampFormat": {
    "elapsedCounter": {
      "mode": "performanceCounter | systemTimerUtcTicks",
      "isHighResolution": "Stopwatch.IsHighResolution",
      "frequency": "Stopwatch.Frequency",
      "ticks": "Stopwatch.GetTimestamp()",
      "durationReliability": "indicatif | nonFiable_horlogeMurale",
      "note": "aucune date UTC fiable, aucune monotonie documentée, aucune preuve certifiée ; durée = (fin - début) / frequency"
    }
  },
  "lastObservation": {
    "queries": [{
      "provenance": {
        "reportedPolicyStoreSource": {
          "windowsProperty": "PolicyStoreSource",
          "status": "relevée | non_demandée | indisponible | ambiguë",
          "value": null,
          "reason": "string",
          "reusableAsPolicyStore": "non_établi",
          "note": "valeur rapportée par Windows ; peut ne contenir que le nom de GPO ; pas un identifiant de magasin"
        },
        "reportedPolicyStoreSourceType": {
          "windowsProperty": "PolicyStoreSourceType",
          "status": "relevée | non_demandée | indisponible | ambiguë",
          "value": "Local | GroupPolicy | Dynamic | Generated | Hardcoded | null",
          "reason": "string"
        }
      }
    }]
  },
  "observationsConcordant": {
    "readCount": 0,
    "exploitableReadCount": 0,
    "reads": [{ "sequence": 0, "utcIso8601": "", "elapsedTicks": 0, "query": "", "store": "", "tracePolicyStore": true, "outcome": "aboutie | partielle | échec" }],
    "comparedProperties": [{ "name": "", "states": ["observée | observée_nulle | non_collectée"] }],
    "differences": [],
    "nonComparableReads": [],
    "collectionErrors": [],
    "evaluationOrder": ["divergentes", "lecture_incomplète", "concordantes", "lecture_impossible"],
    "result": "divergentes | lecture_incomplète | concordantes | lecture_impossible",
    "limits": "inconnu ≠ identique ; aucune preuve d'absence de concurrence ; aucun instantané atomique"
  },
  "hostContext": {
    "windowsEditionReported": "string",
    "windowsEditionVerified": false,
    "domainJoinApplicable": "probablement_non | inconnu"
  }
}
```

Les autres champs de la version 4 (`operation`, `coverage` avec `c9: "non prouvée"`, `domainPolicy`, `reportIntegrityDigest` limité à l'intégrité, `certified: false`) restent inchangés.

---

## Partie 2 : récapitulatif des corrections F1 à F65

**Lecture du tableau :**
- Les versions sont reconstituées à partir de l'ordre des missions [DÉDUIT] ; elles peuvent être décalées d'une unité.
- Chaque statut « corrigé » l'est **sur le papier uniquement**. Aucune correction n'a été validée par un test.

| Réf. | Objet | Statut |
|---|---|---|
| F1 | ICMP : l'expression renvoyait `$null` en IPv6 dans `Assert-OrchCoverage` | Corrigé (papier) |
| F2 | Liste de ports vide ou nulle traduite en « tous les ports » | Corrigé : un absent n'est jamais « Any » |
| F3 | `-shl` et `-band` sur `UInt64` en PS 5.1 | Corrigé : plus d'opérateurs binaires |
| F4 | Ports à zéros initiaux acceptés | Corrigé |
| F5 | Adresses IPv4 mappées en IPv6 écrites en notation pointée | Corrigé : notation hexadécimale |
| F6 | `-InterfaceAlias` est un `WildcardPattern[]` | Corrigé : échappement exigé |
| F7 | Filtres lus sans contrôle « exactement un » | Corrigé |
| F8 | Propriétés de portée non contrôlées | Corrigé |
| F9 | Alias d'interface comparé seulement à l'identique | Corrigé |
| F10 | Une GPO peut désactiver la fusion des règles locales | Corrigé ; vérification sur l'hôte : [TEST] |
| F11 | Lectures règle par règle lentes et incohérentes | Corrigé : lecture en bloc (sans atomicité) |
| F12 | Identification des règles par `DisplayName` non unique | Corrigé : `Name`, avec les limites de F47 et F50 |
| F13 | `EdgeTraversalPolicy` | Corrigé (v8 env.) |
| F14 | `Platform` | Corrigé |
| F15 | Variante A″ de T-NET-03 | Corrigé, puis précisé en F19 |
| F16 | Protocoles résiduels | Corrigé, portée limitée en F22 |
| F17 | Jointure des filtres | Corrigé, puis reformulé en F52 |
| F18 | Compatibilité PowerShell 5.1 | Corrigé |
| F19 | Interprétation de A″ | Corrigé |
| F20 | `ActiveStore` dans les deux sens de lecture | Corrigé |
| F21 | Présence dans WFP n'est pas validité de `Platform` | Corrigé |
| F22 | Portée de T-FW-PROTO-RES | Corrigé |
| F23 | Instantanés A et B sur les propriétés complètes | Corrigé |
| F24 | Canonicalisation des propriétés complexes | Corrigé : TLV |
| F25 | Validité des stimuli de T-FW-COMPORT | Corrigé |
| F26 | Fiabilité de la phase A′ | Corrigé |
| F27 | Chaîne des empreintes et retour arrière | Corrigé, durci par F42 à F48 |
| F28 | Dictionnaires et comparateurs | Corrigé |
| F29 | Tableaux multidimensionnels | Corrigé |
| F30 | Inventaire des propriétés système CIM | Corrigé |
| F31 | Règles concurrentes et attribution | Corrigé : attribution non prouvable |
| F32 | Identité et stabilité des filtres WFP | Corrigé, puis précisé en F49 |
| F33 | Dates et métadonnées CIM | Corrigé, puis repris en F57 et F61 |
| F34 | Ordre des octets des flottants | Corrigé ; erreur E1 (v13) corrigée par F39 |
| F35 | Dates locales invalides | Corrigé |
| F36 | Empreinte du schéma CIM | Corrigé |
| F37 | Validation UTF-8 de la représentation complète | Corrigé |
| F38 | Extraction exacte des clés de dictionnaire | Corrigé |
| F39 | Motifs IEEE 754 exacts (`IsLittleEndian` exigé, NaN refusé) | Corrigé |
| F40 | Cohérence des lectures de dictionnaires | Corrigé : déclaration explicite de l'appelant |
| F41 | Encodeur UTF-8 strict vérifié avant usage | Corrigé ; comportement réel : [TEST] |
| F42 | Limites de stabilité et conditions de suppression | Corrigé |
| F43 | Course TOCTOU dans le retour arrière | Corrigé : risque reconnu, sans parade |
| F44 | Preuve de propriété exclusive des données | Corrigé : non prouvable |
| F45 | Séparation des NaN et des valeurs acceptées | Corrigé |
| F46 | Applicabilité exacte de .NET (`Release`) | Corrigé ; valeur réelle : [TEST] |
| F47 | `Remove-NetFirewallRule -InputObject` sans identité d'instance | Corrigé : suppression automatique NO-GO |
| F48 | Retour arrière assisté | Corrigé : rapport d'inspection seulement |
| F49 | Identité et cycle de vie WFP (GUID, LUID) | Corrigé |
| F50 | Exhaustivité des magasins | Corrigé : C9 non prouvée |
| F51 | Retrait de « désactiver puis supprimer » | Corrigé (v16) |
| F52 | Relation filtre-règle biunivoque par catégorie, profil exclu | Corrigé |
| F53 | Instantané `FwpmFilterEnum0` limité aux filtres | Corrigé |
| F54 | Schéma du rapport de récupération | Corrigé, puis remplacé |
| F55 | Sémantique des magasins | Corrigé (v17) |
| F56 | Provenance des règles | Corrigé, puis précisé en F59 et F64 |
| F57 | Horodatages et horloge | Corrigé, puis précisé en F61 et F63 |
| F58 | Limites de l'inventaire | Corrigé |
| F59 | Deux statuts de provenance indépendants | Corrigé (v18), renommé en v19 |
| F60 | `observationsConcordant` | Corrigé (v18), complété par F65 |
| F61 | Trois mesures du temps | Corrigé (v18), précisé par F63 |
| F62 | GPO de domaine, RSOP, ActiveStore, contrôleur de domaine | Corrigé (v18), précisé en v19 |
| F63 | `Stopwatch` : modes et `GetElapsedTime` | **Corrigé (v19), avec désaccord documenté** sur la disponibilité de `GetElapsedTime` en 4.8 |
| F64 | Sémantique de `PolicyStoreSource` | Corrigé (v19) : `reportedPolicyStoreSource` |
| F65 | Priorité des résultats de concordance | Corrigé (v19) |

**Erreurs réintroduites ou contradictions repérées pendant la relecture :**
- **H2 (v18) contredisait F63, et F63 contredit S3c.** Le désaccord est explicité en 1.1 au lieu d'être résolu arbitrairement.
- **« The filter-to-rule relationship is always one-to-one » est une phrase littérale de S1** [DOC]. La lecture « par catégorie, profil exclu » (F52) reste notre interprétation [DÉDUIT]. Elle n'a pas été réintroduite sous une forme plus forte.
- **Champ `monotonic` (v18) :** la v18 avait déjà noté que S3 ne garantit pas la monotonie, mais le nom du champ contredisait cette réserve. Renommé en v19.
- **Aucune réintroduction détectée** de la suppression automatique, de l'unicité de `Name` dans ActiveStore, de la lecture cohérente WFP, de la provenance traitée comme une identité ou d'une authenticité par SHA-256.

---

## Partie 3 : revue transversale v1 à v19

**Abréviations utilisées ci-dessous :** DOC = établi par documentation, DÉD = déduit, SUP = supposé, TEST = nécessiterait un test, Cons. = conséquence pour la sécurité, Bloq. = blocage avant une phase d'exécution.

1. **Sémantique des propriétés NetSecurity et WFP**
   - DOC : les magasins, `PolicyStoreSource`, `PolicyStoreSourceType`, `Name` unique par magasin avec écrasement à la fusion, AppIso inaccessible.
   - DÉD : la relation par catégorie, la visibilité dans RSOP.
   - SUP : le comportement de `Dynamic`, `Generated` et `Hardcoded`.
   - TEST : les valeurs réelles relevées sur l'hôte.
   - Cons. : l'interprétation d'une règle peut être fausse sans que rien ne le signale.
   - Bloq. : **oui** pour toute modification du pare-feu.

2. **Identité des règles et TOCTOU**
   - DOC : aucune primitive atomique ni identifiant d'instance documenté.
   - DÉD : course entre vérification et action toujours possible.
   - TEST : non pertinent, un test ne prouverait pas l'absence de course.
   - Cons. : risque de supprimer ou modifier une règle d'autrui.
   - Bloq. : **oui**. Suppression et désactivation automatiques restent NO-GO de façon permanente dans ce modèle.

3. **Inventaire des magasins et règles AppIso**
   - DOC : les règles AppIso sont stockées dans le registre et inaccessibles par la cmdlet.
   - DÉD : aucun inventaire exhaustif n'est possible.
   - TEST : comparaison avec le registre, en lecture seule.
   - Cons. : une règle d'autorisation peut exister hors du champ de vue.
   - Bloq. : oui, au moins comme réserve écrite. C9 n'est pas prouvable.

4. **Correspondance NetSecurity et WFP**
   - DOC : GUID et LUID, instantané limité aux filtres, transactions bornées à la session.
   - DÉD : aucune jointure fiable entre les deux couches.
   - TEST : observation de la correspondance, sans garantie de stabilité.
   - Cons. : l'état effectif du filtrage ne peut pas être déduit des règles NetSecurity.
   - Bloq. : **oui** pour toute modification de WFP, qui reste NO-GO.

5. **Interfaces host-only et réseau de la VM**
   - DOC (v2 à v6, non relu en v19) : options NAT de VirtualBox, dont `--nat-localhostreachable1=off`.
   - DÉD : les réseaux `orch-ctl` et `orch-adm` exposent l'hôte à la VM.
   - SUP : effet réel des 8 règles `ORCH-*`.
   - TEST : balayage depuis la VM.
   - Cons. : surface de pivot vers l'hôte.
   - Bloq. : **oui**.

6. **Pivot de la VM vers l'hôte**
   - DÉD : protections sur le papier (SSH à commande imposée, pare-feu par interface, pas de dossiers partagés).
   - SUP : absence de faille de l'hyperviseur.
   - TEST : tentatives contrôlées depuis la VM.
   - Cons. : une compromission de la VM pourrait atteindre l'hôte.
   - Bloq. : **oui**.

7. **Proxy et exfiltration**
   - DÉD : une liste blanche squid n'empêche pas l'exfiltration vers les domaines autorisés, qui restent un canal ouvert.
   - SUP : pas d'inspection TLS, donc aucun contrôle du contenu.
   - TEST : contournement par DNS, IP directe, IPv6 ou CONNECT.
   - Cons. : du code ou des données peuvent fuir vers les API des agents.
   - Bloq. : **oui pour les appels réels**. Risque accepté à formaliser.

8. **Privilèges SSH et broker**
   - DÉD : commande imposée, `orch-priv` avec sudoers strict, unités systemd confinées.
   - SUP : robustesse de l'analyse des arguments de `orch-gate`.
   - TEST : fuzzing des arguments et tentatives d'échappement du shell.
   - Cons. : élévation de privilèges dans la VM.
   - Bloq. : **oui**.

9. **Snapshots, persistance et restauration**
   - DOC (antérieur) : le disque immuable et le disque write-through ont une sémantique VirtualBox.
   - DÉD : le disque d'identifiants survit à la restauration, donc les jetons persistent.
   - TEST : cycle complet de restauration.
   - Cons. : une compromission peut persister dans les jetons.
   - Bloq. : **oui**.

10. **Jetons OAuth : renouvellement et révocation**
    - DOC : révocation côté serveur **non documentée** pour Claude `setup-token` et pour Codex (constat antérieur).
    - SUP : durée de vie des jetons.
    - TEST : impossible sans appels réels.
    - Cons. : un jeton volé reste peut-être valable sans recours.
    - Bloq. : **oui pour les appels réels**.
    - Rappel : `~/.codex/auth.json` n'est jamais lu.

11. **Sécurité de l'hôte Windows**
    - DOC (v2, non relu en v19) : fin de support de Windows 10 au 14 octobre 2025 ; programme ESU grand public annoncé jusqu'au 13 octobre 2026.
    - DÉD : à la date du jour (18 novembre 2026), un poste Windows 10 Famille ne reçoit **probablement plus aucune mise à jour de sécurité**, sauf prolongation que je n'ai pas vérifiée.
    - SUP : état réel des mises à jour du poste.
    - TEST : inventaire en lecture seule.
    - Cons. : l'hôte est la base de confiance de toute l'architecture.
    - Bloq. : **oui, critique**.

12. **Preuve des journaux et des rapports de récupération**
    - DOC : `UtcNow`, `Stopwatch`, format `"o"`.
    - DÉD : la séquence ordonne le journal, pas les événements ; SHA-256 n'assure que l'intégrité.
    - Cons. : aucune valeur probante ni temporelle certifiée.
    - Bloq. : non pour une phase de tests ; oui si une preuve est exigée.

13. **Canonicalisation et encodage (F24 à F46)**
    - DOC : endianness, encodeur strict, `Dictionary`.
    - TEST : vecteurs de test.
    - Cons. : des empreintes divergentes produiraient des faux positifs ou des faux négatifs de modification.
    - Bloq. : oui pour l'implémentation.

**Rappel :** cette revue documentaire ne démontre pas que l'architecture fonctionne réellement.

---

## Partie 4 : risques encore ouverts, par criticité

- **Critique**
  - Hôte Windows 10 probablement hors support de sécurité (point 11).
  - Pivot de la VM vers l'hôte non testé (points 5 et 6).
  - Exfiltration possible vers les domaines autorisés (point 7).
  - Révocation des jetons non documentée (point 10).
- **Élevé**
  - TOCTOU et absence d'identité d'instance (point 2).
  - Robustesse non testée de `orch-gate` et `orch-priv` (point 8).
  - Persistance des jetons après restauration (point 9).
- **Moyen**
  - Inventaire non exhaustif, dont AppIso (point 3).
  - Absence de correspondance NetSecurity et WFP (point 4).
  - Stratégies locales pouvant désactiver la fusion des règles (F10).
  - Désaccord documentaire sur `GetElapsedTime` (F63).
- **Faible**
  - Absence de valeur probante des journaux (point 12).
  - Canonicalisation non testée (point 13).

## Partie 5 : conditions préalables à toute future installation

1. Une **autorisation humaine distincte et explicite** pour une phase de tests, puis une autre pour l'installation.
2. La vérification, en lecture seule, de l'édition et de la version de Windows ainsi que de son **état de mises à jour de sécurité**, et une décision écrite sur le cas d'un hôte hors support.
3. Un relevé, en lecture seule, du pare-feu (profils, fusion des règles locales, magasins lisibles), avec ses limites écrites.
4. Une validation, en environnement de test, des règles réseau host-only et NAT, et des tests de pivot.
5. Des tests de `orch-gate`, `orch-priv` et sudoers.
6. Un cycle de snapshot et de restauration validé.
7. La confirmation qu'aucune ressource de Fastclip n'est utilisée et qu'aucun accès Git en écriture n'existe.
8. Le maintien du retour arrière sous forme de rapport d'inspection uniquement.

## Partie 6 : conditions préalables aux appels réels aux agents (distinctes)

1. Toutes les conditions de la partie 5 remplies **et** une autorisation séparée.
2. Une décision écrite sur le risque d'exfiltration vers les domaines autorisés.
3. Une documentation officielle de la révocation des jetons, ou l'acceptation écrite de son absence.
4. La garantie qu'aucune bascule vers une API payante n'est possible, vérifiée dans la configuration.
5. Codex limité à un rôle non écrivain, vérifié.
6. Des secrets jamais exposés dans les journaux, et `auth.json` jamais lu.

## Partie 7 : maturité documentaire de la Phase 0B

La Phase 0B est **documentairement mature pour cadrer de futurs tests**. Les invariants sont stables depuis plusieurs versions, et les dernières corrections portent sur le nommage et la précision, plus sur l'architecture.

Elle **n'est pas mature pour une exécution**. Les risques critiques de la partie 4 ne peuvent pas être levés sur papier. Une version v20 purement documentaire apporterait peu, en dehors de la résolution du désaccord F63.

## Partie 8 : ce qui reste impossible à garantir sans tests

- l'efficacité réelle des règles de pare-feu et du NAT ;
- l'absence de pivot de la VM vers l'hôte ;
- le contrôle effectif du proxy ;
- la robustesse du broker SSH ;
- la persistance et la restauration réelles ;
- l'existence de `GetElapsedTime` sur le runtime installé ;
- le mode réel de `Stopwatch` sur l'hôte ;
- les valeurs de provenance réellement rapportées ;
- le comportement de l'encodeur et de la canonicalisation.

Certains points restent **impossibles à garantir même avec des tests** :
- l'absence de concurrence ;
- l'identité d'instance ;
- l'exhaustivité de l'inventaire ;
- la non-exfiltration vers les domaines autorisés.

Tout test futur est un travail ultérieur soumis à une autorisation distincte.

---

## Verdicts

| Point | Verdict |
|---|---|
| Installation | **NO-GO** |
| Implémentation | **NO-GO** |
| Tests | **Non autorisés** |
| Appels réels aux agents | **NO-GO** |
| Modification du pare-feu | **NO-GO** |
| Suppression ou désactivation automatique | **NO-GO** |
| Modification directe de WFP | **NO-GO** |
| Retour arrière v1 | **Rapport d'inspection uniquement** |

**Le rapport v19 est purement documentaire et ne constitue aucune autorisation d'exécution, d'installation, d'implémentation, de test ou d'appel réel.**
