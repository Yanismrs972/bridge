<!-- Rapport extrait de la session Claude « Orchestrateur IA », 2026-11-18 00:48 UTC -->

# Annexe corrective v19.1 (Phase 0B)

Cette annexe complète le rapport v19 et ne le réécrit pas. Pour la préparer, j'ai seulement consulté la page Microsoft Learn sur l'ESU de Windows 10 (S7, mise à jour le 10 novembre 2026). Je n'ai lancé aucune commande, fait aucun test, démarré aucune VM ni modifié aucun fichier, et je n'ai accédé ni à Git ni à Fastclip.

---

## E66 : Windows 10 et ESU

Cette annexe remplace le point 11 de la partie 3 du rapport v19, en particulier la déduction « ne reçoit probablement plus aucune mise à jour ».

| Élément | Contenu | Statut |
|---|---|---|
| Fin du support standard | Fin du support de Windows 10 le **14 octobre 2025**. Après cette date, Microsoft ne fournit plus de support technique, de mises à jour de fonctionnalités ni de mises à jour de qualité, y compris les correctifs de sécurité, hors ESU. | [DOC, S7] |
| Condition pour recevoir l'ESU | Le PC doit exécuter Windows 10 version 22H2. | [DOC, S7] |
| ESU grand public | Ce programme existe et S7 renvoie vers la page grand public de Microsoft pour les particuliers et pour Windows 10 Famille. **La date de fin annoncée, le 13 octobre 2026, ne figure pas dans S7** et je n'ai pas consulté la page grand public. | Existence : [DOC, S7]. Date : [SUPPOSÉ, à vérifier sur la page grand public] |
| ESU commercial | Achat par année, cumulatif, la première année commençant en novembre 2025, pour **trois ans au maximum** après la fin du support des PC d'organisations. Gratuit pour certaines VM Windows 365 et Azure. Ne concerne pas un usage personnel. | [DOC, S7]. Applicabilité au PC cible : [DÉDUIT] non pertinente |
| PC cible : Windows 10 Famille 22H2, build 19045 | Information **rapportée** et non vérifiée. | [SUPPOSÉ] |
| Inscription réelle à l'ESU et état des mises à jour | **Inconnus.** Je n'en tire aucune conclusion, ni dans un sens ni dans l'autre. | [TEST], via un précontrôle en lecture seule (étape 1 de E68) |

**Conséquence :** l'état de mise à jour de l'hôte reste un risque **critique non qualifié**. Le blocage tient à ce que cet état est **inconnu**, et non à une absence de mises à jour, qui n'est pas démontrée.

---

## E67 : ce que signifie `divergentes` (complément à F65)

`divergentes` signifie **uniquement** qu'au moins deux lectures exploitables présentent au moins une différence observée sur une propriété comparée.

Ce résultat **ne prouve pas** :
- que les deux lectures portent sur la **même instance** de règle ;
- qu'une instance particulière **a changé** ;
- que la différence vient d'une **modification**, plutôt que d'objets observés différents.

**Pourquoi [DOC, S1] :**
- `Name` n'est unique qu'à l'intérieur d'un magasin. Lors de la fusion dans ActiveStore, des règles de même nom venant de magasins différents s'écrasent, et la règle visible peut changer selon la priorité des GPO.
- La provenance (`reportedPolicyStoreSource`, F64) n'identifie pas une instance.
- Une règle supprimée puis recréée sous le même `Name` est indiscernable de l'originale [DÉDUIT, F47].

**Formulation retenue dans le schéma :** le champ `result` est accompagné de

```
"interpretation": "différence observée entre lectures ; aucune conclusion sur l'identité, le changement ou sa cause"
```

`concordantes` garde, de son côté, ses limites (F60 et F65).

---

## E68 : trois étapes futures séparées

Cette section remplace l'ordre implicite des parties 5 et 6 du rapport v19.

**Étape 1 : précontrôle de l'hôte, en lecture seule**
- Il ne comprend ni installation, ni VM, ni modification.
- Exemples d'objets à relever :
  - édition et build de Windows, état des mises à jour, inscription à l'ESU (E66) ;
  - profils du pare-feu et fusion des règles locales (F10) ;
  - magasins lisibles et leurs limites ;
  - version de .NET (`Release`) ;
  - mode de `Stopwatch` (F63) ;
  - VirtualBox présent ou non.
- Il demande **une autorisation distincte**, pas encore accordée.

**Étape 2 : laboratoire isolé**
- Il ne peut être créé qu'**après une autorisation humaine explicite** propre à cette étape.
- Objet : tester les réseaux host-only et NAT, le pivot de la VM vers l'hôte, SSH et le broker (`orch-gate`, `orch-priv`, sudoers), puis les snapshots et la restauration.
- Interdits : agent réel, jeton réel, donnée sensible, accès à Fastclip ou Git, API payante.
- Les tests qui demandent une VM **font partie de cette étape**. Ce ne sont **pas** des préalables à l'autorisation de créer la VM de laboratoire. Les préalables à cette autorisation se limitent aux résultats de l'étape 1 et à une décision humaine.

**Étape 3 : décision d'installation opérationnelle**
- Elle prend la forme d'une **décision humaine distincte**, fondée sur les résultats de l'étape 2.
- Les appels réels aux agents demandent ensuite une **autorisation séparée de plus**, aux conditions de la partie 6 du rapport v19 (exfiltration, révocation des jetons, absence de bascule vers une API payante).

Aucune de ces étapes n'est autorisée par ce document.

---

## E69 : noms des champs du schéma temporel

Ces champs remplacent `elapsedCounter.ticks` et `reads[].elapsedTicks` du schéma `/5`. Le schéma devient `orch-recovery-report/5.1`.

```json
"timeFields": {
  "utcIso8601": "horodatage d'horloge murale, DateTime.UtcNow formaté 'o' (Kind=Utc) — non certifié",
  "stopwatchTimestamp": "valeur brute de Stopwatch.GetTimestamp(), en unités du compteur — ce n'est PAS une durée ni une date",
  "stopwatchFrequency": "Stopwatch.Frequency, en unités du compteur par seconde",
  "stopwatchMode": "performanceCounter | systemTimerUtcTicks",
  "elapsedDuration": {
    "fromSequence": 0,
    "toSequence": 0,
    "value": "(stopwatchTimestamp_fin - stopwatchTimestamp_début) / stopwatchFrequency, en secondes",
    "reliability": "indicatif | nonFiable_horlogeMurale",
    "note": "valide uniquement entre deux valeurs du même processus et du même mode"
  }
}
```

**Réserves maintenues (F63) :**
- La valeur brute d'un compteur ne se confond jamais avec une durée.
- La documentation ne garantit pas la monotonie, et des écarts entre processeurs sont possibles [DOC].
- En mode `systemTimerUtcTicks`, la valeur provient de `DateTime.UtcNow.Ticks` [DOC]. Les durées sont alors exposées aux ajustements de l'horloge [DÉDUIT].
- Aucun champ ne constitue une preuve temporelle certifiée.

---

## Verdict documentaire

- **Maturité :** avec la v19 et cette annexe v19.1, la Phase 0B est **cohérente et suffisante comme cadrage documentaire des futurs tests**. Les points ouverts relèvent maintenant du précontrôle ou du laboratoire, plus de la documentation.
- **Archivage :** la Phase 0B **peut être archivée** comme cadrage documentaire. Deux réserves l'accompagnent :
  - la date de fin de l'ESU grand public reste à confirmer ;
  - le désaccord sur `GetElapsedTime` (F63) reste ouvert.
  
  Ces deux points peuvent être tranchés pendant l'étape 1, si elle est autorisée.
- **Ce que la Phase 0B ne démontre pas :** le fonctionnement réel de l'architecture.

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

**L'annexe v19.1 est documentaire et ne délivre aucune autorisation implicite ou explicite d'exécution, de précontrôle, de création de laboratoire, d'installation ou d'appel réel.**
