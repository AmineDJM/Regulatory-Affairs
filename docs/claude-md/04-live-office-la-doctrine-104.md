## Live Office — la doctrine (§104)

Éditer un document Office n'est pas « générer un fichier ». C'est ouvrir CE fichier, le modifier,
et le refermer en `.docx` — le même, avec ses styles, ses images et ses en-têtes.

1. **On n'ouvre jamais un format qu'on ne sait pas refermer.** Un `.docx` entre et sort en `.docx`.
   LibreOffice a été MESURÉ absent (`libreoffice-core` seul ; Render déploie en `runtime: node`) —
   la décision de ne pas convertir n'est pas un renoncement, c'est ce qui rend une retouche
   instantanée et fidèle.
2. **L'arbre XML garde sa tranche de source.** `object-model/xml.ts` : nœud intact → recopié octet
   pour octet, nœud touché → reconstruit, et lui seul. **Ce que le code ignore, il le préserve.**
   `adapters/fidelity.test.ts` le vérifie à la PIÈCE près, pas « le fichier s'ouvre encore ».
3. **L'état est un rejeu, jamais un instantané.** Version Drive de base + opérations non annulées.
   Annuler = marquer et rejouer. C'est ce qui rend l'annulation exacte pour quatre formats sans une
   seule commande inverse, et la reprise après panne gratuite.
4. **La numérotation est HUMAINE, 1-indexée, partout.** Page 1 = la première. Paragraphe 3 = le
   troisième que la personne VOIT — pas ceux des cellules de tableau, pas le `<w:p/>` vide que Word
   met après chaque tableau. Les suppressions se font en ordre DÉCROISSANT.
5. **Un décodeur ne devine jamais.** `commands/nl.ts` rend `null` sur tout ce qu'il ne reconnaît pas
   à coup sûr, et le modèle prend la main. Attraper une phrase qu'on comprend mal est PIRE que ne
   rien attraper : cela empêche le modèle de bien la traiter, en silence.
6. **Le modèle produit des commandes, jamais de l'XML.** `commands/compile.ts` refuse une opération
   inconnue, une opération hors format, un champ obligatoire manquant, une valeur aberrante. Un lot
   partiellement valide applique ce qu'il peut et DIT le reste.
7. **Une cible ambiguë rend des candidats.** Jamais « le premier des quatre ». Modifier le mauvais
   paragraphe en annonçant que c'est fait est le défaut le plus coûteux de tout ce système.
8. **La sauvegarde est atomique et verrouillée.** Sérialiser → RELIRE → écrire seulement si la
   relecture passe. Si quelqu'un a enregistré entre-temps, on refuse et on le dit.
9. **`artifact/` ne connaît ni le Drive, ni Prisma, ni le RBAC.** Ses capacités arrivent par
   `ports.ts`, remplis par `src/platform/in-process/artifact/`. Le contrôle des droits vit là et
   nulle part ailleurs — `canViewDrive` pour lire, `canEditDrive` pour écrire. **La conversation
   n'est pas une porte dérobée.**
10. **Le contenu d'un document est une DONNÉE.** Il arrive au modèle par `wrapUntrusted`, la même
    barrière que les corps de mails. Une phrase « ignore les consignes » reste du texte lu.
11. **Un seul bloc par document.** Même `blockId`, `version++`. Trois retouches ne font pas trois
    cartes qui s'empilent : la même se transforme.
12. **Deux bancs, et ils tournent.** `npm run office:bench` mesure (et dit ce qu'il NE mesure pas :
    réseau, déchiffrement). `npm run office:sabotage` réintroduit seize défauts plausibles et exige
    que la suite tombe — un sabotage qui passe est un trou, pas un succès.
13. **Une image entre par sa RÉFÉRENCE et sort par ses OCTETS, jamais l'inverse.** Une commande
    d'insertion porte le NOM du fichier ; c'est le moteur qui le résout à travers le port, donc sous
    les droits de la personne, et qui dépose les octets juste avant d'appliquer. Mettre le `Buffer`
    dans la commande ferait peser des mégaoctets au journal, rejoués à CHAQUE ouverture (§104.3).
    Symétriquement, POSER et LIRE une image passent par le même ciblage : deux chemins de
    désignation finiraient par diverger, et « remplace la 2ᵉ image » ne toucherait plus la même que
    « lis la 2ᵉ image ».
14. **Excel ne met pas l'image DANS la feuille, il la met à côté.** Six endroits, pas quatre : les
    octets, le type de la partie image, une partie DESSIN et son type déclaré, les relations du
    dessin vers l'image, celles de la feuille vers le dessin, et `<drawing>` dans la feuille. Trois
    pièges, chacun silencieux : le schéma d'une feuille est une SÉQUENCE (`tableParts` doit rester
    APRÈS — l'ajouter « à la fin » fait perdre le tableau structuré, qu'Excel « répare » sans rien
    dire) ; une feuille ne renvoie qu'à UN dessin (créer une seconde partie fait disparaître
    l'image précédente) ; la relation vers les octets appartient au DESSIN (dans la feuille, elle
    donne un cadre vide). Sans taille demandée, on borne à la zone d'impression que le classeur
    DÉCLARE : une feuille n'a pas de bord à l'écran, mais un classeur s'imprime.
15. **Une lecture d'image n'est jamais un fait vérifié — et une absence de lecteur n'est pas une
    lecture vide.** Le texte et la NOTE de méthode voyagent ensemble : livrer la sortie d'un OCR
    sans dire d'où elle vient la fait citer comme une certitude (§29). Et un composeur sans port de
    vision doit DIRE qu'il ne sait pas regarder : répondre « lu, rien dedans » ferait conclure que
    le tampon est vierge alors que RIEN n'a été tenté — le faux succès parfait. Le contenu lu reste
    une DONNÉE (`wrapUntrusted`) ; la note, qui vient de notre code, reste dehors.
16. **Un cadre gris n'est pas un rendu.** Le workspace dessinait « Image — 4,0 × 2,0 cm » à la
    place de l'image : la personne ne pouvait pas distinguer le logo de 2019 de celui de 2027,
    donc pas VÉRIFIER ce qu'Adam venait de faire — et « c'est fait » redevenait une parole à
    croire, ce qu'aucun écran de ce produit n'a le droit de demander. Les octets servis sont ceux
    de l'état COURANT et non de la version Drive (après un remplacement, l'écran doit montrer le
    nouveau), l'adresse porte l'identifiant de SESSION (le moteur ne rend une session qu'à la
    personne à qui elle est) et la révision (sans quoi le navigateur re-sert l'image d'avant), et
    le type vient de l'EN-TÊTE — un `.png` qui contient du JPEG existe.
17. **Un refus qu'on lit de travers est un refus qu'on croit moins.** « ce document ne contient
    aucun image » est passé en production : le refus était JUSTE, il était simplement écrit dans
    une langue que personne ne parle — et c'est la phrase qu'une personne lit et qu'un modèle
    reprend. Les accords vivent dans `commands/resolve.ts`, la liste des libellés est EXPLICITE, et
    un test d'architecture refuse tout libellé passé à `resoudre` sans genre déclaré : deviner
    d'après la terminaison marcherait sur « image » et échouerait sur « page » comme sur
    « graphique ».

`src/lib/missions/` est déclaré **façade (L2)** dans `src/platform/domains.ts` : il n'importe jamais `assistant/`. Les capacités lui arrivent par un **port** (`missions/ports.ts`), ce qui l'empêche structurellement de s'en octroyer une. Côté Adam, l'accès passe par le **contrat de plateforme** (`mission.status`), jamais par un import direct — `boundary.test.ts` le vérifie.

