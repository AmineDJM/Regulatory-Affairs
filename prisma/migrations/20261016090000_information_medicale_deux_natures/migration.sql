-- ════════════════════════════════════════════════════════════════════════════════════════════
-- LE PRIM N'OUVRE PLUS QUE DEUX NATURES DE DOSSIER — MIP, ou demande de visa publicitaire.
--
-- ── LA CONFUSION QU'ON CORRIGE ──────────────────────────────────────────────────────────────
--
-- « Bon de versement » était proposé comme une TROISIÈME nature à l'ouverture. C'était une
-- confusion de niveau : le bon de versement n'est pas ce qu'on OUVRE, c'est une ÉTAPE du circuit
-- du matériel promotionnel — un bon par support, validés ensemble, payés séparément. Le proposer
-- à l'ouverture faisait choisir entre un dossier et l'une de ses propres pièces.
--
-- ── POURQUOI LE RECLASSEMENT NE CHANGE RIEN AU TRAVAIL EN COURS ─────────────────────────────
--
-- Les deux natures ouvraient DÉJÀ exactement le même circuit (`circuitOfKind` : tout ce qui n'est
-- pas MIP relève du matériel promotionnel). Un dossier reclassé de « bon de versement » vers
-- « demande de visa publicitaire » garde donc ses matériels, ses bons, ses validations et ses
-- quittances — à la lettre. Seul son libellé change, et il devient celui de ce qu'il est.
--
-- C'est ce qui rend cette reprise sûre : elle ne déplace aucun dossier d'un chemin vers un autre.
-- Un reclassement vers MIP, lui, aurait fait perdre les bons en cours — il n'a pas lieu.
--
-- La nature reste RECONNUE en lecture côté application (`DECLARATION_KINDS`) : si une ligne
-- échappait à cette reprise, elle continuerait de suivre son circuit au lieu de retomber sur le
-- circuit par défaut. On ne se repose pas sur la migration pour la correction du code.
-- ════════════════════════════════════════════════════════════════════════════════════════════

UPDATE "MedicalInfoDeclaration"
   SET "declarationKind" = 'AD_VISA'
 WHERE "declarationKind" = 'PAYMENT_SLIP';
