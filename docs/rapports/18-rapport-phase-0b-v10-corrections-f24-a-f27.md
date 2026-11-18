<!-- Rapport extrait de la session Claude « Orchestrateur IA », 2026-11-17 00:24 UTC -->

# Rapport Phase 0B v10 : corrections F24 à F27

**Contexte.** L'orchestrateur tourne sur l'hôte Windows et pilote une VM agents (Codex en superviseur, Claude Code en exécutant) et une VM passerelle. Le contrôle passe par deux réseaux host-only, `orch-ctl` (192.168.60.0/24, VM agents en .10) et `orch-adm` (192.168.61.0/24). Huit règles de pare-feu Windows `ORCH-*` par interface bloquent tout, sauf le SSH ouvert par l'hôte vers la VM. Un retour arrière fondé sur des instantanés S0 protège les règles préexistantes.

**Base de travail.** Les rapports v5 à v9 et les seuls extraits de documentation déjà obtenus. Je n'ai fait aucune nouvelle consultation.

**Légende :** [DOC] documentation lue · [DÉDUIT] déduction · [SUPPOSÉ] hypothèse · [TEST] à démontrer.

---

## 1. Corrections

### F24 : canonicalisation stricte des propriétés complexes

**Défaut v9.** La v9 remplaçait toute valeur non sérialisable par `COMPLEXE:<type>`. Deux contenus différents de même type donnaient donc la même empreinte.

**Correction : la sérialisation devient stricte.** Toute valeur est sérialisée intégralement. Sinon, une exception est levée et **aucun instantané valide n'est produit**. Il n'y a plus aucun remplacement par le type seul.

**Quelles propriétés sont pertinentes ?** Par défaut, **toutes**. Une propriété inconnue n'est jamais considérée comme inoffensive.
- La source sérialisée est **l'ensemble des propriétés de l'instance CIM** (`CimInstanceProperties` : nom, type CIM, indicateurs, valeur). Les valeurs du fournisseur NetSecurity sont censées y figurer entièrement [DÉDUIT, à vérifier].
- **Une propriété apparue après une mise à jour de Windows est donc incluse automatiquement.** Elle modifie l'empreinte, provoque une dérive et entraîne un refus suivi d'une revue.
- Les membres ajoutés par PowerShell (propriétés calculées, alias) servent aux contrôles sémantiques. Leur cohérence avec les données CIM brutes est vérifiée par T-FW-CANON.

**Propriétés système CIM :**
- **incluses :** l'espace de noms et la classe, qui identifient le type d'objet ;
- **exclues :** le nom du serveur et le chemin, qui identifient la connexion à la machine et non la portée de la règle [SUPPOSÉ quant à leur contenu exact] ;
- **exclus aussi :** les métadonnées de session PowerShell (nom de l'ordinateur) et le schéma de classe (`CimClass`), qui décrivent la classe et non l'instance ;
- **cette liste d'exclusions est fermée, versionnée et revue.** Tout autre élément est inclus.

**Comportement par type :**

| Type | Traitement |
|---|---|
| `null` | `NULL` |
| Chaîne | Préfixée par sa longueur |
| Booléen | Valeur explicite |
| Énumération | Type et nom |
| Entier ou décimal | Type et valeur en notation invariante |
| Flottant | Type et forme aller-retour (`R`) |
| GUID | Forme `D` |
| Date | UTC ISO 8601 et `Kind` |
| Tableau d'octets | Hexadécimal |
| Dictionnaire | Clés canonisées triées en ordre ordinal ; clés en double après canonisation : exception |
| Objet PowerShell simple | Propriétés de note triées ; tout autre type de membre : exception |
| Instance CIM imbriquée | Récursion |
| Tableau ou énumérable | Ordre conservé, chaque élément préfixé par sa longueur |
| Profondeur supérieure à 16 (cycles) | Exception |
| **Tout autre type** | **Exception** |

```powershell
$OrchCanonVersion = 'canon-v10'          # inscrit dans chaque empreinte ; un changement de version invalide la comparaison
function ConvertTo-OrchCanon($Value, [int]$Depth = 0) {
  if ($Depth -gt 16) { throw "Profondeur excessive : instantané refusé" }
  if ($null -eq $Value) { return 'NULL' }
  $t = $Value.GetType()
  if ($Value -is [string])  { return 'S' + $Value.Length + ':' + $Value }
  if ($Value -is [bool])    { return $(if ($Value) { 'B:1' } else { 'B:0' }) }
  if ($Value -is [enum])    { return 'E:' + $t.FullName + ':' + $Value.ToString() }
  if ($Value -is [byte[]])  { return 'X' + $Value.Length + ':' + (-join ($Value | ForEach-Object { $_.ToString('x2') })) }
  $ints = [type[]]@([byte],[sbyte],[int16],[uint16],[int32],[uint32],[int64],[uint64],[decimal])
  if ($ints -contains $t)   { return 'N:' + $t.Name + ':' + [System.Convert]::ToString($Value, [Globalization.CultureInfo]::InvariantCulture) }
  if ($Value -is [double] -or $Value -is [single]) { return 'F:' + $t.Name + ':' + $Value.ToString('R', [Globalization.CultureInfo]::InvariantCulture) }
  if ($Value -is [guid])    { return 'G:' + $Value.ToString('D') }
  if ($Value -is [datetime]){ return 'D:' + $Value.ToUniversalTime().ToString('o') + ':' + $Value.Kind }
  if ($Value -is [Microsoft.Management.Infrastructure.CimInstance]) {
    $names = [string[]]@($Value.CimInstanceProperties | ForEach-Object { $_.Name }); [Array]::Sort($names, [StringComparer]::Ordinal)
    $parts = foreach ($n in $names) {
      $p = $Value.CimInstanceProperties[$n]
      $e = 'P' + $n.Length + ':' + $n + '|T:' + $p.CimType + '|F:' + $p.Flags + '|V:' + (ConvertTo-OrchCanon $p.Value ($Depth + 1))
      [string]$e.Length + ':' + $e
    }
    $id = $Value.CimSystemProperties.Namespace + '|' + $Value.CimSystemProperties.ClassName
    return 'C' + $id.Length + ':' + $id + '[' + (-join $parts) + ']'
  }
  if ($Value -is [System.Collections.IDictionary]) {
    $pairs = @{}
    foreach ($k in $Value.Keys) {
      $kc = ConvertTo-OrchCanon $k ($Depth + 1)
      if ($pairs.ContainsKey($kc)) { throw "Clés de dictionnaire ambiguës : instantané refusé" }
      $pairs[$kc] = ConvertTo-OrchCanon $Value[$k] ($Depth + 1)
    }
    $keys = [string[]]@($pairs.Keys); [Array]::Sort($keys, [StringComparer]::Ordinal)
    return 'M' + $keys.Count + '[' + (-join ($keys | ForEach-Object { $e = $_ + '=' + $pairs[$_]; [string]$e.Length + ':' + $e })) + ']'
  }
  if ($t -eq [System.Management.Automation.PSCustomObject]) {
    $members = @($Value.PSObject.Properties)
    if (@($members | Where-Object { $_.MemberType -ne 'NoteProperty' }).Count) { throw "Objet personnalisé avec membres calculés : instantané refusé" }
    $names = [string[]]@($members | ForEach-Object Name); [Array]::Sort($names, [StringComparer]::Ordinal)
    return 'O' + $names.Count + '[' + (-join ($names | ForEach-Object { $e = $_ + '=' + (ConvertTo-OrchCanon $Value.$_ ($Depth + 1)); [string]$e.Length + ':' + $e })) + ']'
  }
  if ($Value -is [System.Collections.IEnumerable]) {
    $items = foreach ($i in $Value) { $e = ConvertTo-OrchCanon $i ($Depth + 1); [string]$e.Length + ':' + $e }
    return 'A' + @($items).Count + '[' + (-join @($items)) + ']'
  }
  throw "Type non pris en charge : $($t.FullName) — instantané refusé"
}
```

**Ce fragment n'a jamais été exécuté.** Ses points incertains :
- l'indexeur par nom de `CimInstanceProperties` [SUPPOSÉ] ;
- la forme textuelle de `CimType` et de `Flags` [SUPPOSÉ] ;
- la stabilité des indicateurs d'une lecture à l'autre [TEST]. Si elle fait défaut, il faudra une **exclusion explicite et revue**, jamais implicite ;
- le comportement de `-is [enum]` sur des valeurs CIM converties [SUPPOSÉ].

### F25 : validité des stimuli de T-FW-COMPORT

**Défaut v9.** La v9 tenait pour acquis que le sortant est autorisé par défaut.

**Correction.**

**1. Politique effective.**
- Pour chaque profil : relever `Enabled`, `DefaultOutboundAction`, `DefaultInboundAction` et l'autorisation des règles locales dans `ActiveStore`. Les actions par défaut sont des réglages documentés de `Set-NetFirewallProfile` [DOC]. Leur lecture dans `ActiveStore` et le sens de `NotConfigured` sont [SUPPOSÉ].
- **Relever aussi le profil réellement appliqué à chaque adaptateur host-only** (`Get-NetConnectionProfile` [DOC]). Le profil Public est appliqué par défaut aux réseaux non identifiés [DOC].
- **Si le sortant effectif n'est pas « autoriser », les stimuli sortants sont invalides** : un blocage ne prouverait rien.

**2. Règles concurrentes.**
- Avant chaque stimulus, on calcule, avec le moteur d'intervalles et les formes canoniques, **toutes** les règles actives d'`ActiveStore` en `Block` qui pourraient correspondre : sens, protocole, adresses, ports, interface (la nôtre ou `Any`), programme. Le résultat attendu est **la seule règle testée**.
- Au niveau WFP, les filtres d'**autres fournisseurs** aux couches concernées sont inventoriés. Leurs conditions ne sont pas toutes interprétables [SUPPOSÉ], d'où une couverture **partielle**.

**3. Attribution.**
- On relève l'événement 5157 ou 5152, son identifiant de filtre et sa couche (champs [SUPPOSÉ]) ;
- on retrouve ce filtre dans `netsh wfp show filters`, relevé juste **avant et après** le stimulus, avec un rapprochement identique dans les deux relevés ;
- on remonte au fournisseur, puis à la règle `ORCH`.

**4. Plusieurs filtres possibles.**
- Si l'événement désigne le filtre de la règle attendue et qu'aucun autre candidat ne peut correspondre : **attribution établie**.
- Si d'autres candidats existent : **attribution partielle**. Le blocage est réel, mais l'efficacité propre de la règle n'est pas démontrée.
- Si l'événement désigne un autre filtre : **échec pour cette règle**.
- S'il n'y a aucun événement : **non concluant**.

**5. Règles IPv4 mappées, traitées séparément.** Le paquet sur le réseau est toujours de l'IPv4 [DÉDUIT]. tcpdump et pktmon **ne peuvent donc pas** distinguer les chemins : **seule la couche WFP signalée par l'événement le peut.**
- **`OUT-V6M-TCP-HORS22`.**
  - Stimulus : client .NET `Socket` en `InterNetworkV6`, `Stream`/`Tcp`, avec `DualMode = $true` [SUPPOSÉ : propriété .NET], connexion à `::ffff:192.168.60.10` sur le port 23.
  - Valide **seulement si** l'événement indique une **couche IPv6** et une adresse distante mappée [SUPPOSÉ : champs], **et** l'identifiant de filtre de `OUT-V6M-TCP-HORS22`.
  - Si la couche est IPv4, ou si le blocage est attribué à `OUT-V4-TCP-HORS22` : **test non valide pour la règle IPv6**. La règle reste en place, mais elle est déclarée **non démontrée**.
- **`OUT-V6M-UDP`** : même procédure en `Dgram`/`Udp`, avec `SendTo` vers `::ffff:192.168.60.10` sur un port fixe. Mêmes critères de validité.

**Une connectivité réussie ou un blocage ne prouvent jamais à eux seuls la classification IPv6.**

### F26 : fiabilité de la phase A′

**Conditions préalables :**
1. **Audit actif.** Relevé de l'état des sous-catégories `Filtering Platform Connection` et `Filtering Platform Packet Drop` (`auditpol /get`, droits d'administrateur probables [SUPPOSÉ]). **L'activation (`auditpol /set`) modifie la configuration** : elle exige une **autorisation distincte**, l'enregistrement des valeurs initiales, puis leur restauration et un nouveau relevé pour vérifier la restauration.
2. **Événements réellement produits.** Contrôle positif : un stimulus connu pour être bloqué doit produire l'événement attendu. **Sans événement au contrôle positif, l'audit est déclaré non fiable**, et aucune absence d'événement n'a alors de sens.
3. **Corrélation.** L'identifiant de filtre de l'événement doit être retrouvé dans des relevés `netsh wfp show filters` faits **au même démarrage, avant et après**. Les identifiants changent avec les redémarrages et les changements de stratégie [SUPPOSÉ].
4. **Fournisseur, puis règle.** On rattache le filtre à son fournisseur (`netsh wfp show state` [SUPPOSÉ]), puis, **si possible**, à la règle. Le lien d'un filtre WFP vers une règle NetSecurity n'est pas documenté dans le dossier [SUPPOSÉ].
5. **pktmon.** Il observe le paquet **au point de capture choisi** : composants du pilote ou de l'adaptateur [SUPPOSÉ]. Il prouve l'**arrivée** du paquet à ce point, **pas** la décision de WFP. Il faut préciser le point de capture.
6. **Trois absences à ne pas confondre :**
   - **absence d'événement** : audit inactif, limité en volume, ou filtre non décisif ;
   - **absence de paquet** : rien au point de capture ;
   - **absence de blocage** : l'écouteur de l'application a bien reçu la connexion.

   **Une absence d'événement ne prouve jamais que le pare-feu n'a pas bloqué.**

**Trois conclusions possibles :**
1. **Cause identifiée** : contrôle positif d'audit réussi, paquet observé à l'arrivée, événement présent, filtre rapproché de façon cohérente avant et après, fournisseur identifié, et **un seul** candidat possible.
2. **Cause partiellement identifiée** : il manque un élément (rattachement à la règle impossible, plusieurs candidats, ou point de capture ambigu), sans contradiction.
3. **Cause non établie** : contrôle positif en échec, contradiction entre les observations, ou absence d'événement sans autre preuve.

Seule la conclusion 1 permet de décider. Les conclusions 2 et 3 rendent le test **non concluant**.

### F27 : chaîne des empreintes et retour arrière

**Une empreinte n'est valide que si les neuf conditions suivantes sont toutes réunies :**

| N° | Condition |
|---|---|
| V1 | **F20 validé** : T-FW-STORE réussi |
| V2 | **Énumération complète et stable** : les instantanés canoniques A et B sont identiques, avec au plus une relecture |
| V3 | **Exactement un filtre de chacun des sept types** par règle, avec concordance des deux sens de lecture : ni orphelin, ni ambiguïté, ni règle sans filtre |
| V4 | **Sérialisation stricte réussie** pour la règle et ses sept filtres (F24), **sans aucune exception** |
| V5 | **Même version** de l'algorithme de canonicalisation et de la liste d'exclusions pour S0 et pour l'état courant |
| V6 | **Empreinte individuelle** : SHA-256 de la version, de la forme canonique de la règle et des sept formes canoniques des filtres, dans un ordre fixe des types |
| V7 | **Empreinte globale** : SHA-256 de la liste des couples (`Name`, empreinte individuelle) triée en ordre ordinal, avec le nombre de règles |
| V8 | **S0 relevé dans `ActiveStore` et dans `PersistentStore`**, selon V1 à V7 |
| V9 | **Aucun `Name` en double** dans un même magasin |

**Une règle n'est supprimée lors d'un retour arrière que si toutes ces conditions sont remplies :**
- **S0 et l'état courant sont valides** (V1 à V9) ;
- la règle est journalisée `CRÉÉE`, et son empreinte courante est **égale** à celle du journal ;
- son `Name` est **absent de S0** dans les deux magasins ;
- elle est présente dans `PersistentStore`, avec une source locale et `Group = ORCH-<runId>` ;
- **toutes les règles de S0 ont une empreinte courante identique** à celle de S0, ce qui exclut une modification concurrente ;
- après chaque suppression, une nouvelle mesure montre que **seule** cette règle a disparu.

**Arrêt sans aucune suppression**, avec la liste présentée à vous, dans chacun de ces cas :
- F20 non validé ;
- association ambiguë ;
- propriété non sérialisable ;
- propriété ou filtre modifié ;
- instantanés instables ;
- journal `INTENTION` sans `CRÉÉE` ;
- règle portant l'identifiant d'exécution sans être journalisée ;
- version de canonicalisation différente.

**Garantie de conception [DÉDUIT] :**
- une règle préexistante est **dans S0**, et S0 n'est valide que si l'énumération est complète (V2, V3) ;
- **l'installation elle-même est interdite si S0 n'est pas valide** ;
- une règle d'origine incertaine ne remplit pas les conditions de suppression.

**Le retour arrière ne peut donc pas viser une règle préexistante ou d'origine incertaine, sous réserve que les tests confirment ces conditions.**

---

## 2. Documentation restant à consulter

Lors d'une future mission documentaire autorisée à le faire :
- **`New-NetFirewallRule`** : descriptions de `-EdgeTraversalPolicy`, `-Platform`, `-Name` et `-Group` ;
- **`Get-NetFirewallRule` et les sept cmdlets de filtre** : valeurs de `-PolicyStore`, sens d'`ActiveStore`, paramètre d'association, propriétés renvoyées ;
- **`Get-NetFirewallProfile`** : `DefaultOutboundAction`, sens de `NotConfigured`, autorisation des règles locales ; **`Get-NetConnectionProfile`** ;
- **événements 5152 et 5157** : description de leurs champs (identifiant de filtre, couche, adresses) ;
- **`auditpol`** : syntaxe de `/get` et `/set`, droits nécessaires ;
- **`netsh wfp show filters` et `show state`** : structure des données renvoyées ;
- **`pktmon`** : points de capture et signalement des rejets ;
- **.NET** : `Socket.DualMode` ; `CimInstance`, `CimProperty` et indicateurs CIM ; `New-CimInstance -ClientOnly` ;
- **`Remove-NetFirewallRule`** : comportement avec `-Name` et `-PolicyStore`.

---

## 3. Hypothèses restantes

**[SUPPOSÉ] :**
- complétude des propriétés CIM pour la portée d'une règle ;
- stabilité des indicateurs CIM ;
- noms et contenu des propriétés système exclues ;
- lecture de la politique effective et sens de `NotConfigured` ;
- champs des événements ;
- lien entre un filtre WFP et une règle NetSecurity ;
- points de capture de pktmon ;
- `DualMode` ;
- droits nécessaires pour `auditpol /get` ;
- **toutes** les hypothèses ouvertes des v6 à v9 : `-PolicyStore` et sa propagation, `Platform`, `EdgeTraversalPolicy`, fonctionnement à états, eBPF, jetons de Codex, révocation serveur, NAT de VirtualBox.

---

## 4. Tests ajoutés ou modifiés

**Aucun de ces tests n'a été exécuté.**

| Test | Objectif | Préconditions | Observations attendues | Réussite | Échec | Effet sur les verdicts |
|---|---|---|---|---|---|---|
| **T-FW-CANON-COMPLEX** | Détecter une modification **interne** d'un objet complexe de même type | Objets de test **locaux**, sans aucune modification système : instance CIM côté client [SUPPOSÉ : `-ClientOnly`], dictionnaire, objet personnalisé, tableau d'objets | Deux objets identiques sauf un champ interne ; un objet avec un membre calculé ; un type non pris en charge ; une structure trop profonde | Empreintes **différentes** pour le champ modifié ; exceptions pour les trois autres cas | Empreintes égales, ou type remplacé silencieusement | Échec : installation NO-GO |
| **T-FW-POLICY-EFFECTIVE** | Établir la politique sortante effective et le profil des adaptateurs | Lecture seule | Profils, actions par défaut, profil de chaque adaptateur host-only | Valeurs relevées et non ambiguës ; sortant effectif « autoriser » sur le profil concerné | Valeur ambiguë, ou sortant bloqué | Stimuli sortants invalides ; T-FW-COMPORT non concluant |
| **T-FW-DUALSTACK** | Prouver le chemin IPv6 mappé pour `OUT-V6M-TCP-HORS22` et `OUT-V6M-UDP`, séparément | Audit fiable (T-FW-AUDIT), règles en place | Événement avec couche IPv6, adresse mappée, et filtre de la règle V6M | Les trois éléments concordent pour **chaque** règle | Couche IPv4, ou attribution à une règle V4 : test **non valide** pour la règle V6M | Règle V6M non démontrée ; appels réels NO-GO tant que la décision n'est pas documentée |
| **T-FW-AUDIT** | Vérifier l'audit et la production réelle d'événements | Lecture de l'état de l'audit ; activation **seulement** sur autorisation distincte | Contrôle positif produisant un événement | Événement présent et complet ; état initial restauré et vérifié | Pas d'événement au contrôle positif | Toute conclusion fondée sur les événements devient non concluante |
| **T-FW-CORRELATION** | Rattacher l'événement au filtre WFP, au fournisseur et à la règle | T-FW-AUDIT réussi ; filtres relevés avant et après | Même identifiant présent dans les deux relevés ; fournisseur identifié ; règle identifiée si possible | Conclusion 1 (F26) | Conclusion 2 ou 3 | Tests qui en dépendent non concluants |
| **T-FW-ROLLBACK** (modifié) | Refuser toute suppression dès qu'une seule propriété ou un seul filtre ne peut pas être comparé | Règle de test dédiée ; S0 valide | Cas provoqués : propriété non sérialisable, filtre manquant, filtre modifié, instabilité, version de canonicalisation différente | **Arrêt sans aucune suppression** dans chaque cas ; état égal à S0 | Une suppression quelconque | Échec : installation NO-GO |

**Tests v9 toujours nécessaires :** T-FW-PLAN, T-FW-STORE, T-FW-CANON, T-FW-JOIN, T-FW-COMPORT (désormais conditionné par T-FW-POLICY-EFFECTIVE et T-FW-CORRELATION), T-FW-PROTO-ECH, T-FW-PROTO-EXH (facultatif), T-NET-03, T-EBPF-*, T-SYSD-COMPAT, T-NAT-WIN, T-CRED-NOWB et T-REVOKE.

---

## 5. Risques résiduels

1. La canonicalisation stricte peut **refuser des états légitimes** si une représentation est instable. C'est prudent, mais cela peut bloquer le fonctionnement.
2. Le **lien filtre WFP → règle** n'est pas documenté : une attribution peut rester partielle.
3. Les **règles IPv6 mappées** peuvent rester non démontrées.
4. Les **filtres de fournisseurs tiers** ne sont que partiellement interprétables.
5. **Restent ouverts depuis les versions précédentes :**
   - exfiltration vers les domaines autorisés ;
   - absence de révocation serveur documentée ;
   - rotation des jetons de Codex ;
   - protocoles résiduels ;
   - faille de l'hyperviseur ;
   - compromission de la passerelle ;
   - hôte Windows 10 à migrer avant le 12 octobre 2027 ;
   - erreur humaine.

---

## 6. Verdicts

| Périmètre | Verdict |
|---|---|
| **Cohérence documentaire** | **Améliorée, incomplète** : F24 à F27 traités sur le papier ; documentation listée en section 2 non consultée ; aucun code exécuté |
| **0B.1** : contrôles en lecture seule | **GO conditionnel**, qui **ne vaut pas autorisation**. Une autorisation explicite et distincte est nécessaire. `auditpol /get` demande probablement des droits d'administrateur [SUPPOSÉ] : il doit être exclu de 0B.1 ou faire l'objet d'une décision explicite |
| **0B.2** : décisions d'architecture | **GO conditionnel** : choix A/B/C, sort des règles V6M si elles restent non démontrées, activation de l'audit, comptes dédiés, VBS, repli NAT, superviseur de remplacement |
| **Installation** | **NO-GO** : 0B.1 et 0B.2 non validés ; hôte non vérifié ; T-FW-PLAN, T-FW-STORE, T-FW-CANON, T-FW-CANON-COMPLEX, T-FW-JOIN et T-FW-ROLLBACK non exécutés |
| **Appels réels aux agents** | **NO-GO** : révocation serveur non documentée ; T-FW-AUDIT, T-FW-CORRELATION, T-FW-POLICY-EFFECTIVE, T-FW-COMPORT, T-FW-DUALSTACK, T-FW-PROTO-ECH, T-NET-03, T-EBPF-*, T-SYSD-COMPAT, T-NAT-WIN et T-CRED-NOWB non démontrés |

---

## Déclaration

**Fait :** une revue documentaire des rapports v5 à v9 et la rédaction de ce rapport v10, à partir des seuls extraits de documentation déjà obtenus dans cette conversation.

**Non fait :**
- aucune commande, même en lecture seule ;
- aucun fichier créé, modifié ou supprimé ;
- aucune installation, aucune VM démarrée ;
- aucun agent, aucune API ni aucun service externe contacté, aucune documentation nouvelle consultée ;
- aucun accès à Fastclip ni à Git ;
- aucun test exécuté, et aucun résultat présenté comme vérifié.

**Aucune autorisation d'exécution n'est présumée.**
