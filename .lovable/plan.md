## Tout'ICI — Plan de construction

Marketplace de livraison de restaurants ivoiriens avec moteur de distance GPS, wallet interne, et centre admin.

### Étape 1 — Backend (Lovable Cloud + PostGIS)
Activer Lovable Cloud, puis créer les tables :
- `profiles` (user_id, full_name, phone, cgu_accepted_at)
- `user_roles` + enum `app_role` ('admin','user') + fonction `has_role`
- `restaurants` (nom, ville, quartier, lat, lng, price_per_km, logo, banner, description, hours)
- `dishes` (restaurant_id, nom, prix, image, description, catégorie)
- `points_relais` (ville, quartier, adresse, détails, horaires)
- `orders` (mode livraison, point_relais_id, cooking_instructions jsonb, scheduled_date/time, client lat/lng, distance_km, delivery_fee, total, payment_method, status, rating, review)
- `wallets` (user_id, balance)
- `wallet_transactions` (type: recharge/debit/credit, montant, statut, preuve)
- `recharge_requests` (montant, méthode, preuve, statut)
- Extension PostGIS + fonction SQL `calculate_distance_km(lat1,lng1,lat2,lng2)`
- RLS partout, GRANTs, policies par rôle

### Étape 2 — Design system violet/rosé kaki/noir
`src/styles.css` en oklch : violet profond primaire, rosé kaki accent, noir léger surfaces, tokens gradients + shadows premium. Fonts distinctes (display + body via Google Fonts en `<link>`).

### Étape 3 — Routes publiques
- `/` — landing (hero, restaurants populaires, comment ça marche)
- `/restaurants` — recherche + filtres ville/quartier
- `/restaurants/$id` — vitrine + menu grouped par catégorie + drawer plat
- `/auth` — login/signup
- `/cgu` — page CGU complète

### Étape 4 — Parcours commande (`_authenticated`)
- Panier + drawer plat avec consignes spéciales (checklist + texte libre)
- Checkout : mode livraison (Express GPS / Point Relais), calendar+time picker, capture GPS navigator.geolocation, calcul distance via RPC PostGIS, affichage frais dynamique, warning interurbain
- **Règle >15km : désactiver Paiement à la livraison**
- **Checkbox CGU obligatoire** (persistée sur profile)
- Modes paiement : Wallet / SmartPay / Cash (selon distance)
- `/orders` — historique + notation post-livraison
- `/wallet` — solde + formulaire de recharge

### Étape 5 — Admin (`_authenticated/admin`, gated par has_role)
- Gestion restaurants (form + pin carte simple lat/lng)
- Gestion plats
- Gestion Points Relais
- Ledger commandes temps réel (statut, distance, GPS, instructions)
- Validation recharges wallet (approuver/rejeter)
- Kit partage social (génération texte+lien Facebook/WhatsApp)

### Étape 6 — Distance & IA
- Fonction SQL PostGIS pour distance haversine précise
- Server function classifiant "Inter-City" si distance>50km ou villes différentes
- Message d'avertissement UI

### Détails techniques
- Server functions (`createServerFn`) pour : calcul distance, création commande, débit wallet, admin approve recharge
- Realtime Supabase pour ledger admin
- Cartes : affichage simple avec coordonnées (pas de Mapbox pour éviter clé externe) — lien vers Google Maps
- Mobile-first, layouts compacts

### Livrables ordonnés
1. Enable Cloud + migrations schéma
2. Design system + layout racine + auth
3. Landing + browse + fiche restaurant
4. Checkout complet avec GPS + CGU + distance
5. Wallet + recharges
6. Admin center complet
7. Notation + partage social

Prêt à lancer ?
