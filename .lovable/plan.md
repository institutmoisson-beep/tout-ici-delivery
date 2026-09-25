# Plan — Panneau Courtage & Séquestre Tout’ICI

## Objectif
Ajouter à Tout’ICI un espace distinct de courtage alimentaire, sans remplacer les commandes, restaurants, portefeuilles ni rôles actuels. Le nouveau parcours sécurise le paiement dans un séquestre jusqu’à la remise du plat confirmée par QR.

## Expérience livrée
- Un accès **Courtage sécurisé** depuis le tableau de bord et la navigation.
- Un espace client pour créer une commande sécurisée, suivre les étapes et présenter son QR de remise.
- Un espace restaurant pour accepter, préparer et remettre les commandes qui lui sont attribuées.
- Un espace livreur pour voir ses missions, prendre en charge une livraison et scanner/saisir le QR du client.
- Un espace administrateur pour superviser les commandes, affecter restaurants et livreurs, contrôler les paiements et consulter les répartitions.
- Des rôles courtage distincts et cumulables, attribués par le super-administrateur, sans donner d’accès global.

## Parcours de paiement
1. Le client choisit ses plats et valide une commande Courtage avec son portefeuille Tout’ICI.
2. Le montant total est débité et verrouillé dans le séquestre par une opération atomique.
3. La part restaurant, la part livreur et la commission Tout’ICI sont calculées et figées avec la commande.
4. Le client reçoit un QR/code unique uniquement lorsque la commande part en livraison.
5. Le livreur valide ce QR à la remise.
6. La validation libère une seule fois les parts restaurant et livreur, puis clôture la commande.
7. Une annulation autorisée rembourse le client une seule fois; toute répétition est bloquée.

## Sécurité et données
- Étendre les données existantes au lieu de créer un second système incompatible.
- Conserver les rôles dans les tables de rôles dédiées; aucun rôle ne sera stocké dans le profil.
- Ajouter des fonctions sécurisées pour créer, accepter, affecter, expédier, vérifier et rembourser les commandes.
- Vérifier côté serveur l’identité, le rôle, le propriétaire du restaurant, le livreur affecté et chaque transition de statut.
- Ne jamais exposer le secret QR brut dans les listes; stocker une empreinte et limiter l’accès au code de présentation au client concerné.
- Ajouter les droits et règles d’accès minimaux pour chaque nouvelle donnée.

## Écrans
- `/courtage` : accueil et récapitulatif personnel.
- `/courtage/commande` : validation sécurisée depuis le panier existant.
- `/courtage/commandes` : historique, statut en temps réel et QR client.
- `/courtage/restaurant` : commandes du ou des restaurants confiés à l’utilisateur.
- `/courtage/livreur` : missions et validation QR par caméra ou saisie manuelle.
- `/courtage/admin` : supervision, affectations, commissions et remboursements.

## Intégration
- Réutiliser les restaurants, plats, profils, portefeuille et calculs de livraison actuels.
- Ajouter l’association entre un gestionnaire restaurant et les restaurants qu’il peut gérer.
- Ajouter les domaines `courtage_restaurant`, `courtage_livreur` et `courtage_admin` au système d’attribution existant.
- Mettre à jour les types générés après la migration et conserver l’apparence violet/rosé kaki/noir de Tout’ICI, avec l’or comme signal de paiement sécurisé.

## Vérification
- Tester la création avec solde suffisant et insuffisant.
- Tester les accès client, restaurant, livreur et administrateur séparément.
- Tester les transitions de statut, la validation QR correcte/incorrecte, le double scan et le remboursement.
- Vérifier l’affichage et les actions sur mobile puis ordinateur, ainsi que les erreurs de compilation et d’exécution.
