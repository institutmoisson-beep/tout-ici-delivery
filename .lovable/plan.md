## 1. Bouton partage sur chaque plat

Sur `src/routes/restaurants.$id.tsx` (DishCard), ajouter un bouton "Partager" (icône) visible sur chaque carte de plat pour tout visiteur, même non connecté. Il ouvre un petit menu avec :

- **WhatsApp** — `https://wa.me/?text=…`
- **Facebook** — `https://www.facebook.com/sharer/sharer.php?u=…`
- **X (Twitter)** — `https://twitter.com/intent/tweet?…`
- **Copier le lien**
- **Partager…** (Web Share API natif si `navigator.share` est disponible — permet Instagram/TikTok/Snapchat sur mobile) — inclut aussi le fichier image du plat quand `navigator.canShare({ files })` est supporté.

Le texte partagé inclut : nom du plat, prix formaté, description courte, nom + quartier du restaurant, et l'URL profonde `/restaurants/:id#dish-:dishId`. La carte reçoit `id="dish-<id>"` pour l'ancrage.

Aucune modification côté admin : le bouton s'affiche automatiquement dès qu'un plat existe.

## 2. Système multi-rôles

### Schéma (migration)

Étendre l'enum `app_role` avec les valeurs :

- `restaurant_manager` — gère `restaurants` + `dishes`
- `relais_manager` — gère `points_relais`
- `orders_manager` — gère `orders` (statuts, partage WhatsApp/SMS)
- `finance_manager` — gère `wallets`, `wallet_transactions`, `financial_transactions`, `recharge_requests`, `delivery_pricing`
- `payments_manager` — gère `payment_gateways`
- `holidays_manager` — gère `public_holidays`
- `profiles_manager` — consulte `profiles` + `user_roles` (lecture seule sur user_roles, sauf super-admin)

Politiques RLS mises à jour sur chaque table concernée : en plus de `has_role(auth.uid(), 'admin')`, autoriser le rôle-métier correspondant via `has_role(auth.uid(), '<role>')` en SELECT/INSERT/UPDATE/DELETE. `admin` reste super-admin (peut tout, y compris attribuer les rôles). Seul `admin` peut écrire dans `user_roles`.

Les rôles sont cumulables : un utilisateur peut avoir `restaurant_manager` + `orders_manager` par exemple.

### Attribution (super-admin)

Dans `src/routes/_authenticated/admin.tsx`, nouvelle section **Rôles & équipe** :

- Liste des utilisateurs (via `profiles`) avec leurs rôles actuels sous forme de badges.
- Recherche par email/nom.
- Pour chaque utilisateur : cases à cocher pour chaque rôle (cumul possible). Sauvegarde via RPC `admin_set_user_roles(user_id, roles[])` (SECURITY DEFINER, vérifie `has_role(auth.uid(),'admin')`, remplace l'ensemble des rôles de l'utilisateur).

### Dashboard utilisateur

Sur `src/routes/_authenticated/dashboard.tsx`, ajouter en haut une section **Mes espaces de gestion** qui n'apparaît que si l'utilisateur possède au moins un rôle non-`user`. Un bouton/carte par rôle attribué :

- 🍽️ Espace Restaurants → `/manage/restaurants`
- 📍 Espace Points relais → `/manage/relais`
- 📦 Espace Commandes → `/manage/orders`
- 💰 Espace Finance → `/manage/finance`
- 💳 Espace Passerelles → `/manage/payments`
- 📅 Espace Jours fériés → `/manage/holidays`
- 👥 Espace Profils → `/manage/profiles`

### Pages de gestion par rôle

Créer sous `src/routes/_authenticated/manage.*.tsx` une route par rôle. Chaque page :

1. Vérifie côté client que l'utilisateur possède le rôle (ou est admin), sinon redirige vers `/dashboard` avec un toast.
2. Réutilise directement les composants/sections existants de `admin.tsx` (extraits en composants partagés dans `src/components/admin-sections/`) pour ne pas dupliquer le code.
3. Affiche un en-tête « Tableau de bord — <Rôle> » avec les mêmes outils CRUD que le super-admin, limités à son domaine.

Le super-admin conserve `/admin` avec tout, ces routes sont des vues focalisées pour les managers.

## Fichiers touchés

- **Nouveau** : `supabase/migrations/<ts>_role_system.sql` (enum, RLS, RPC `admin_set_user_roles`)
- **Nouveau** : `src/components/share-menu.tsx` (menu de partage réutilisable)
- **Nouveau** : `src/components/admin-sections/{restaurants,dishes,relais,orders,finance,payments,holidays,profiles,roles}.tsx` (extractions depuis admin.tsx)
- **Nouveau** : `src/routes/_authenticated/manage.{restaurants,relais,orders,finance,payments,holidays,profiles}.tsx`
- **Modifié** : `src/routes/restaurants.$id.tsx` (bouton partager sur DishCard)
- **Modifié** : `src/routes/_authenticated/admin.tsx` (import des sections extraites + nouvelle section Rôles)
- **Modifié** : `src/routes/_authenticated/dashboard.tsx` (grille « Mes espaces de gestion »)
- **Modifié** : `src/hooks/use-auth.tsx` (exposer `roles: string[]` en plus de `isAdmin`)

## Notes techniques

- Cumul des rôles : `user_roles` a déjà `UNIQUE(user_id, role)`, aucun changement de structure.
- `admin_set_user_roles` fait un `DELETE` puis `INSERT` en transaction, en refusant de retirer le dernier `admin` du système (garde-fou).
- L'enum PostgreSQL nécessite `ALTER TYPE ... ADD VALUE` hors transaction ; la migration utilise plusieurs statements séparés.
- Les RLS existantes basées sur `has_role(auth.uid(),'admin')` restent en place ; on ajoute des policies additionnelles `OR has_role(auth.uid(),'<role_manager>')` via de nouvelles policies séparées (RLS = OR entre policies permissives).