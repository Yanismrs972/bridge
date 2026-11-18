<!-- Rapport extrait de la session Claude « Orchestrateur IA », 2026-11-17 00:20 UTC -->

# Rapport Phase 0B v9 : corrections F19 à F23

**Cadre :** je me suis appuyé uniquement sur les rapports v5 à v8 et sur les extraits de documentation déjà obtenus. Je n'ai fait aucune nouvelle consultation et rien exécuté.

**Légende :** [DOC] documentation lue · [DÉDUIT] déduction · [SUPPOSÉ] hypothèse · [TEST] à démontrer.

---

## 1. Défauts corrigés

### F19 : interprétation de A″

**Erreur de la v8.** J'avais écrit qu'une réussite avec la règle `Allow` temporaire prouvait que le blocage par défaut était la cause initiale. **C'est faux** : une règle `Allow` préexistante peut déjà autoriser ce trafic. La réussite ne dit alors rien de la cause du blocage observé auparavant [DÉDUIT].

**Correction :**
- A″ devient un **test de connectivité avec autorisation temporaire**. Une réussite montre seulement que la connexion est possible **pendant que la règle est en place**.
- **La cause initiale** ne peut être établie que **par la phase A′**, sans modification du pare-feu, à partir de trois éléments :
  - l'événement 5152 ou 5157 ;
  - l'identifiant de filtre, rapproché de `netsh wfp show filters` ;
  - l'arrivée du paquet sur l'adaptateur (pktmon) et dans la VM (tcpdump).
- **En cas d'échec d'A″**, on applique le même diagnostic (filtre responsable, fournisseur WFP, routage, écouteur).
- On ne modifie **jamais** une règle préexistante. **Une cause non établie rend le test non concluant.**

### F20 : `ActiveStore` dans les deux sens de lecture

**Constat :**
- `-PolicyStore` est documenté pour `New-NetFirewallRule`, y compris avec un magasin de stratégie [DOC].
- Pour `Get-NetFirewallRule` et les cmdlets de filtre, la forme `-PolicyStore ActiveStore` **n'a pas été lue** dans la documentation [SUPPOSÉ].
- **La propagation du magasin par le pipeline**, de la règle au filtre (`$Rule | Get-NetFirewall…Filter`), **n'est pas documentée** [SUPPOSÉ]. On ne peut pas supposer qu'elle a lieu.

**Correction.** La méthode F17 est **déclarée non utilisable tant que T-FW-STORE n'a pas réussi**. Le test vérifie que les cmdlets acceptent `-PolicyStore ActiveStore` dans **chaque** forme utilisée, et que les deux sens de lecture renvoient exactement les mêmes associations.

**Limite :** sur une machine sans aucune différence entre magasins, ce qui est probable sur Windows Famille [SUPPOSÉ], le test **ne peut pas prouver** que le magasin est bien propagé, faute d'un cas où les magasins divergent. Ce point restera alors **non démontré** et sera signalé comme tel.

**Solution de secours, si la méthode n'est pas validée :** les filtres WFP réels (`netsh wfp show filters`) servent de **référence de l'état effectif**. NetSecurity ne sert plus qu'aux métadonnées, et **les deux doivent concorder**. Une discordance entraîne un refus.

### F21 : présence dans WFP et validité de `Platform`

**Quatre niveaux distincts**, dont aucun n'implique le suivant :
1. **la règle est présente dans `ActiveStore`** ;
2. **des filtres WFP existent** pour elle ;
3. **leurs conditions de classification** (couches et conditions) correspondent à la règle ;
4. **le comportement est effectif** sur le système cible.

**`Platform` :**
- si cette propriété ne peut être vérifiée ni par NetSecurity, ni par les conditions WFP, elle est **déclarée non vérifiée** ;
- la présence de filtres WFP **n'en apporte pas la preuve** [DÉDUIT].

**Test comportemental discriminant (T-FW-COMPORT).** Pour **chacune** des huit règles, on envoie un stimulus que **seule cette règle** doit bloquer. Le blocage doit être observé **et attribué au filtre de cette règle** par son identifiant :

| Règle | Stimulus |
|---|---|
| `IN-ALL` | Connexion de la VM vers l'hôte |
| `OUT-V4-AUTRES` | Hôte vers 192.168.60.11 |
| `OUT-V4-TCP-HORS22` | Hôte vers .10, port TCP 23 |
| `OUT-V4-UDP` | Hôte vers .10 en UDP |
| `OUT-V4-ICMP4` | `ping .10` |
| `OUT-V6-AUTRES` | Hôte vers l'adresse IPv6 locale au lien de la VM |
| `OUT-V6M-TCP-HORS22` | Client double pile vers l'adresse mappée de .10, port 23 |
| `OUT-V6M-UDP` | Idem en UDP |

Le sortant étant autorisé par défaut [DOC], un blocage prouve qu'**une** règle a agi, et l'attribution prouve **laquelle**.

**Portée :** cela démontre que la règle est **active sur cette machine pour ce stimulus**. **Cela ne démontre pas** une couverture exhaustive.

### F22 : portée du test de protocoles

**Changement de nom :** `T-FW-PROTO-RES` devient **`T-FW-PROTO-ECH` (échantillon de protocoles représentatifs)**.

**Résultat attendu, reformulé :** le trafic de la VM (ICMPv6, GRE, SCTP, IP brut) **ne parvient à aucune application ni à aucun service de l'hôte**, et l'hôte n'émet **aucune réponse** vers la VM. **La pile réseau et WFP traitent bien ces paquets**, puisqu'ils les examinent pour les rejeter. L'ancienne formulation « rien n'est traité par l'hôte » est retirée.

**Conclusion autorisée :** « aucun des protocoles testés n'atteint l'hôte dans cette configuration ». **Ce n'est pas une preuve pour tous les protocoles IP.**

**Ce qu'exigerait une garantie exhaustive (T-FW-PROTO-EXH, facultatif et lourd) :**
- envoyer les **256 numéros de protocole**, en IPv4 et en IPv6, dans les deux sens ;
- observer côté hôte avec un récepteur sur socket brut, qui demande les droits d'administrateur [SUPPOSÉ] ;
- attribuer chaque rejet par événement WFP ;
- vérifier dans WFP que les filtres d'`IN-ALL` n'ont **aucune condition de protocole** aux couches concernées [SUPPOSÉ].

Même ainsi, la preuve ne vaudrait que pour cette version de Windows.

### F23 : instantanés A et B sur les propriétés complètes

**Défaut.** Des instantanés fondés sur les seuls `Name` ne détectent pas une règle ou un filtre **modifiés sans changement de nom**.

**Correction.** Chaque instantané contient, pour chaque règle d'`ActiveStore`, une **forme canonique déterministe** de **toutes** ses propriétés et de **tous** ses filtres associés, puis son empreinte SHA-256 :
- **règle** : `Name`, `Group`, `DisplayName`, `Direction`, `Action`, `Enabled`, `Profile`, `PolicyStoreSourceType`, `PolicyStoreSource`, `EdgeTraversalPolicy`, `Platform`, `LooseSourceMapping`, `LocalOnlyMapping`, `Owner` ;
- **filtres** : adresses locales et distantes, ports locaux et distants, protocole, type ICMP, cible dynamique, interface, type d'interface, programme, paquet, service, authentification, chiffrement, `OverrideBlockRules`, utilisateurs local et distant, machine distante, mots-clés dynamiques.

Ces noms correspondent pour partie à des paramètres documentés de `New-NetFirewallRule` [DOC]. **Que les objets renvoyés portent les mêmes noms est [SUPPOSÉ].** Toutes les autres propriétés présentes sont sérialisées elles aussi (voir le code), afin qu'aucune ne soit oubliée.

**Règles de normalisation :**
- les six cas sont distincts : `ABSENT`, `NULL`, chaîne vide, `Any`, tableau d'un élément, tableau de plusieurs éléments ;
- **l'ordre des tableaux est conservé tel quel**, et toute réorganisation compte comme un changement : c'est le choix prudent. La comparaison sémantique des adresses et des ports reste confiée aux intervalles ;
- **tri ordinal** des noms de propriétés et de règles ;
- **type** inscrit dans chaque valeur ;
- **chaînes préfixées par leur longueur**, ce qui rend la forme canonique non ambiguë.

**Stabilité :**
- A différent de B : **une seule** relecture (A′ et B′) ;
- encore différent : **refus**.
- Un `Name` en double dans `ActiveStore` entraîne aussi un refus.

---

## 2. Fragments de code corrigés

**Ni exécutés, ni testés.**

```powershell
# Sérialisation typée, déterministe et non ambiguë (F23)
function ConvertTo-OrchCanon($Value) {
  if ($null -eq $Value) { return 'NULL' }
  if ($Value -is [string]) { return 'S' + $Value.Length + ':' + $Value }
  if ($Value -is [bool])   { return $(if ($Value) { 'B:1' } else { 'B:0' }) }
  if ($Value -is [enum])   { return 'E:' + $Value.GetType().FullName + ':' + $Value.ToString() }
  if ($Value -is [System.ValueType] -and $Value -isnot [char]) {
    return 'N:' + $Value.GetType().FullName + ':' + [System.Convert]::ToString($Value, [System.Globalization.CultureInfo]::InvariantCulture)
  }
  if ($Value -is [System.Collections.IEnumerable]) {
    $items = New-Object System.Collections.Generic.List[string]
    foreach ($i in $Value) { $e = ConvertTo-OrchCanon $i; $items.Add([string]$e.Length + ':' + $e) }
    return 'A' + $items.Count + '[' + ($items -join '') + ']'          # longueur de chaque élément : pas d'ambiguïté
  }
  throw "Type non normalisable : $($Value.GetType().FullName)"
}
function Get-OrchObjectCanon($Obj, [string[]]$Required) {
  $names = [string[]]@($Obj.PSObject.Properties | ForEach-Object { $_.Name })
  [Array]::Sort($names, [StringComparer]::Ordinal)
  $parts = New-Object System.Collections.Generic.List[string]
  foreach ($r in $Required) { if ($names -cnotcontains $r) { throw "Propriété requise absente : '$r'" } }
  foreach ($n in $names) {
    $v = $Obj.PSObject.Properties[$n].Value
    try { $c = ConvertTo-OrchCanon $v } catch { $c = 'COMPLEXE:' + $(if ($null -eq $v) { 'NULL' } else { $v.GetType().FullName }) }
    $parts.Add($n + '=' + $c)
  }
  $parts -join "`n"
}
function Get-OrchSha256([string]$Text) {
  $sha = [System.Security.Cryptography.SHA256]::Create()
  try { -join ($sha.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($Text)) | ForEach-Object { $_.ToString('x2') }) }
  finally { $sha.Dispose() }
}
```

**Instantané (sans code) :** pour chaque règle, triée par `Name` dans l'ordre ordinal, on calcule l'empreinte de sa forme canonique et de la forme canonique de chacun de ses sept filtres. Les filtres sont obtenus **par la méthode F20, une fois validée**. On calcule ensuite une empreinte globale de l'ensemble.

**Limite de ce choix :** les propriétés complexes (objets imbriqués) ne sont représentées que par leur type, notées `COMPLEXE:<type>`. **Une modification à l'intérieur d'un tel objet ne serait pas détectée** [DÉDUIT]. T-FW-CANON doit vérifier qu'**aucune propriété utile à la portée** d'une règle ne tombe dans ce cas.

---

## 3. Effets sur le retour arrière

- **Empreintes :** celles des journaux `CRÉÉE` et de S0 sont désormais celles de la forme canonique complète, filtres compris. Toute modification d'une règle ou de ses filtres est détectée, et entraîne un **arrêt sans suppression**.
- **Magasins :**
  - S0 est relevé dans **`PersistentStore` et `ActiveStore`** ;
  - la suppression ne vise que `PersistentStore`, par `Name` exact ;
  - les règles de S0 et les règles issues de stratégies de groupe ne sont jamais concernées.
- **Dépendance nouvelle :** sans la méthode F20 validée, les filtres ne peuvent pas être comparés. **Le retour arrière ne peut donc pas vérifier leur état, et doit s'arrêter sans supprimer.** L'installation reste en NO-GO jusqu'à la réussite de T-FW-STORE.
- **État instable** (A′ différent de B′) pendant un retour arrière : arrêt sans suppression.
- **Conclusion :** les corrections F19 à F23 **renforcent** le retour arrière (empreintes plus complètes). Elles le rendent aussi **dépendant** de F20 [DÉDUIT].

---

## 4. Hypothèses restantes

**Pare-feu :**
- `-PolicyStore ActiveStore` sur `Get-NetFirewallRule` et sur les cmdlets de filtre ;
- propagation du magasin par le pipeline ;
- noms des propriétés des objets renvoyés ;
- `Platform`, `EdgeTraversalPolicy` ;
- représentation des énumérations ;
- stabilité de la forme (tableau ou valeur seule) d'une lecture à l'autre. Une instabilité donnerait de **faux refus**, ce qui est prudent mais gênant.

**Points des v6 à v8 toujours ouverts :**
- fonctionnement à états face à un blocage explicite ;
- pktmon ;
- traitement des sockets double pile ;
- blocage en entrée des protocoles bruts ;
- eBPF ;
- jetons de Codex ;
- révocation serveur des deux jetons ;
- NAT de VirtualBox.

---

## 5. Tests nécessaires

Ils s'ajoutent à ceux de la v8 ou les remplacent. **Aucun n'a été exécuté.**

| Test | Objet | Réussite | Échec |
|---|---|---|---|
| **T-FW-STORE** | `-PolicyStore ActiveStore` accepté dans chaque forme ; les deux sens de lecture donnent des associations identiques | Acceptation et concordance totale. Si aucune différence entre magasins n'existe : propagation **déclarée non démontrée** | Méthode F17 inutilisable : solution de secours WFP |
| **T-FW-CANON** | Cas `ABSENT`, `NULL`, chaîne vide, `Any`, un élément, plusieurs éléments ; deux lectures successives sans changement ; aucune propriété utile à la portée en `COMPLEXE` | Formes distinctes, lectures identiques | Normalisation à corriger |
| **T-FW-JOIN** | Sur une **règle de test dédiée**, jamais une règle préexistante, avec une pause provoquée entre A et B : (1) modification d'une propriété de règle (par exemple `Enabled`), (2) modification d'un filtre associé (par exemple `RemoteAddress`), sans changer le `Name` | Les deux changements sont détectés ; une seule relecture ; refus si l'instabilité persiste | Méthode non fiable : installation interdite |
| **T-FW-COMPORT** | Stimuli discriminants de la section F21 | Chaque stimulus bloqué **et** attribué au filtre de sa règle | Règle non effective : NO-GO réseau |
| **T-FW-PROTO-ECH** | Échantillon de protocoles (section F22) | Aucune atteinte d'une application ou d'un service, aucune réponse de l'hôte | NO-GO pour les appels réels |
| **T-FW-PROTO-EXH** (facultatif) | 256 numéros × 2 familles × 2 sens | Section F22 | Selon votre décision en 0B.2 |
| **T-FW-ROLLBACK** | Cas de la v8, plus une modification d'un filtre d'une règle `ORCH` avant le retour arrière | Arrêt sans suppression | Installation interdite |

---

## 6. Risques résiduels

Ils sont inchangés depuis la v8, avec quatre ajouts :
- la **propagation du magasin peut rester indémontrable** sur cette machine ;
- les **propriétés complexes** ne sont comparées que par leur type ;
- la **couverture des protocoles** repose sur un échantillon, sauf si T-FW-PROTO-EXH est réalisé ;
- `Platform` peut rester **non vérifié**. Seul T-FW-COMPORT en compense une partie, pour les stimuli testés.

---

## 7. Verdicts

| Périmètre | Verdict |
|---|---|
| **Cohérence documentaire** | **Améliorée, incomplète** : F19 à F23 traités ; méthode F20 non démontrée ; `Platform` et `EdgeTraversalPolicy` non documentés dans le dossier |
| **0B.1** : contrôles en lecture seule | **GO conditionnel**. **Ce n'est pas une autorisation** : une autorisation distincte et explicite de votre part reste nécessaire |
| **0B.2** : décisions d'architecture | **GO conditionnel** : choix A/B/C, T-FW-PROTO-EXH ou non, comptes dédiés, VBS, repli NAT, superviseur de remplacement |
| **Installation** | **NO-GO** : 0B.1 et 0B.2 non validés ; hôte non vérifié ; T-FW-PLAN, T-FW-STORE, T-FW-CANON, T-FW-JOIN et T-FW-ROLLBACK non exécutés |
| **Appels réels aux agents** | **NO-GO** : révocation serveur non documentée ; T-FW-COMPORT, T-FW-PROTO-ECH, T-NET-03, T-EBPF-*, T-SYSD-COMPAT, T-NAT-WIN et T-CRED-NOWB non démontrés |

---

**Déclaration.** Cette mission est restée strictement documentaire. Je n'ai exécuté aucune commande, même en lecture seule, ni créé, modifié ou supprimé aucun fichier. Je n'ai rien installé, démarré aucune VM, contacté aucun agent, aucune API ni aucun service externe, et je n'ai accédé ni à Fastclip ni à Git. **Aucune autorisation d'exécution n'est présumée.**
