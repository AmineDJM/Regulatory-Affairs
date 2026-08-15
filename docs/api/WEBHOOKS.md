# WEBHOOKS — catalogue des événements

> **État : socle en place, émetteur à brancher.** Les tables `WebhookEndpoint` et
> `WebhookDelivery` existent et sont migrées ; l'émission et la signature restent à livrer
> (voir `API_COVERAGE.md` § 4.3). Ce document fixe le contrat pour que les consommateurs
> puissent être écrits en parallèle.

## Pourquoi

Un agent qui interroge en boucle coûte cher et arrive toujours en retard. L'événement inverse la
charge : l'ERP prévient.

## Signature

Chaque livraison porte `X-AMD-Signature: sha256=<hmac>` — HMAC-SHA256 du corps brut avec le
`secret` de l'abonnement. **Vérifier la signature avant de lire le corps** : sans cela, n'importe
qui connaissant l'URL peut injecter un faux événement.

Également : `X-AMD-Event`, `X-AMD-Delivery` (identifiant unique, pour dédoublonner un renvoi).

## Enveloppe

```json
{
  "event": "regulatory.dossier.status_changed",
  "deliveryId": "whd_…",
  "occurredAt": "2026-08-13T09:12:00.000Z",
  "actor": { "type": "human", "userId": "usr_…", "name": "Amina B." },
  "object": { "entity": "regulatory_dossier", "id": "…", "reference": "REG-2026-004" },
  "changes": { "status": { "from": "PRE_SUBMISSION", "to": "SUBMITTED" } },
  "links": { "self": "/api/v1/entities/regulatory_dossier/…", "workflow": "…/workflow" }
}
```

`actor.type` vaut `human` ou `agent` : un agent doit pouvoir ignorer ses propres effets pour ne
pas boucler sur lui-même.

## Catalogue

| Événement | Quand |
|---|---|
| `regulatory.dossier.created` | Nouveau dossier réglementaire |
| `regulatory.dossier.updated` | Champ descriptif modifié |
| `regulatory.dossier.status_changed` | Changement de niveau de process |
| `regulatory.dossier.assigned` | Personne chargée du dossier modifiée |
| `regulatory.step.completed` | Étape du processus ANPP marquée faite |
| `regulatory.decision.obtained` | **DE obtenue** — la fin du circuit |
| `regulatory.reserve.received` | Réserve ANPP enregistrée sur un dossier |
| `validation.requested` | Une validation est demandée à quelqu'un |
| `validation.completed` | Validation accordée ou refusée |
| `document.added` | Pièce jointe ajoutée à un objet |
| `deadline.approaching` | Échéance à moins de 7 jours |
| `deadline.passed` | Échéance dépassée |
| `expense_order.created` | Ordre de dépense émis |
| `expense_order.paid` | Ordre de dépense réglé |
| `leave.decided` | Congé tranché à l'un des trois étages |
| `petty_cash.low` | Caisse d'avance sous 20 % |

## Livraison

Au plus une tentative immédiate, puis reprises espacées. **Une livraison échouée est
conservée** (`WebhookDelivery.status = FAILED`, avec `lastError`) : un webhook perdu en silence
est pire qu'un webhook en erreur, parce que personne ne sait qu'il manque.
