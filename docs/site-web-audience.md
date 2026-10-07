# Mesure d'audience du site — complément au contrat d'intégration (`docs/ERP-INTEGRATION.md` du site)

Le site public (adventumdz.com) envoie son audience à l'ERP **depuis le navigateur de ses visiteurs**.
Aucune clé : la route est publique par nature, fermée par l'**origine** du site.

## 1. La balise — une fois, dans le gabarit commun (avant `</body>`)

```html
<script src="https://<ERP>/api/site-web/v1/audience.js" defer></script>
```

`<ERP>` = l'adresse publique de l'ERP (celle de `ERP_BASE_URL`). La balise exacte, prête à copier, est
affichée dans **Administration › Site web (connexion)**, encart « Mesure d'audience », avec l'heure du
dernier événement reçu.

Le script (≈ 4 Ko, mis en cache 1 h) :

- envoie une **page vue** au chargement et à chaque changement de route (`pushState`, `replaceState`,
  `popstate`) — chemin **sans paramètres**, titre, hôte du référent, `utm_source` / `utm_medium` /
  `utm_campaign` de l'arrivée ;
- envoie un **clic** sur tout élément marqué `data-adventum-track="…"`, et d'office sur : les boutons
  ou liens « Postuler » (texte, ou lien `/carrieres/…` contenant « postuler »), `tel:`, `mailto:`,
  WhatsApp (`wa.me`), les liens externes, les téléchargements (pdf, docx, xlsx, pptx, odt, zip, csv…) ;
- envoie un **LEAVE** avec le temps passé **visible** sur la page quand l'onglet est caché ou quitté
  (`navigator.sendBeacon`) ;
- regroupe les envois par lots (10 événements ou 4 s ; immédiat pour un clic ou une sortie) ;
- ne pose **aucun cookie**, n'utilise pas `localStorage` ; seul un identifiant de session vit en
  `sessionStorage` (il meurt avec l'onglet) ;
- n'envoie **rien** si le navigateur demande de ne pas être suivi (`navigator.doNotTrack === "1"`,
  Global Privacy Control).

## 2. Marquer un élément

```html
<a href="/contact" data-adventum-track="cta-contact">Nous écrire</a>
<button data-adventum-track="newsletter">S'abonner</button>
```

La valeur devient le **libellé** du clic (minuscules, chiffres, `-`, `_`, 40 caractères). Les libellés
`postuler`, `telephone`, `email`, `whatsapp`, `externe`, `telechargement`, `cta` sont reconnus et nommés
à l'écran ; les autres apparaissent tels quels.

## 3. Le format (pour qui enverrait sans le script)

`POST /api/site-web/v1/audience` — `Content-Type: text/plain` (requête simple, sans pré-vérification ;
`OPTIONS` est servi pour les autres cas). En-tête `Origin` = l'origine du site (`ADVENTUM_BASE_URL`, avec
ou sans `www.`), sinon **403**.

```json
{ "events": [
  { "type": "PAGEVIEW", "path": "/carrieres/delegue-medical-alger", "title": "Délégué médical — Alger",
    "referrer": "www.linkedin.com", "utmSource": "linkedin", "utmMedium": "social", "utmCampaign": "rentree-2026",
    "session": "9f2c1a0b7d3e4f5a6b7c8d9e" },
  { "type": "CLICK", "path": "/carrieres/delegue-medical-alger", "label": "postuler", "target": "/carrieres/delegue-medical-alger/postuler", "session": "…" },
  { "type": "LEAVE", "path": "/carrieres/delegue-medical-alger", "durationMs": 48200, "session": "…" }
] }
```

- au plus **50** événements par lot, **64 Ko** par corps ; `type` ∈ `PAGEVIEW | CLICK | LEAVE` ;
- `path` : chemin **relatif** (`/…`), coupé au `?` et au `#`, ≤ 300 caractères ; sinon l'événement est ignoré ;
- `durationMs` (LEAVE) : > 0, plafonné à 30 min ; `session` : 8 à 64 caractères `[A-Za-z0-9_-]` ;
- débit : **120 événements par minute et par adresse** (au-delà : **429**) ;
- réponse **204** (y compris pour un robot connu ou un en-tête `DNT: 1` : rien n'est écrit).

## 4. Ce que l'ERP garde — et ne garde pas

Gardé : type, chemin, titre, **hôte** du référent, source (utm, sinon déduite du référent : Google, Bing,
LinkedIn, Facebook, Instagram, X, WhatsApp, Emploitic, E-mail, Direct, Autre), medium, campagne,
appareil / navigateur / système (trois mots tirés de l'agent), pays (en-tête de l'hébergeur s'il existe),
libellé et cible du clic (sans paramètres), durée.

Jamais gardé : l'**adresse IP**, l'**agent utilisateur**, les paramètres d'adresse. `visitor` est le
sha256 d'un **sel du jour** (secret serveur + date), de l'IP et de l'agent : il compte les visiteurs du
jour sans pouvoir les relier d'un jour à l'autre. L'identifiant de session est condensé de même.

Les événements de plus de **13 mois** sont purgés chaque jour.
