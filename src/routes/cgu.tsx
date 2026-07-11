import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/cgu")({
  head: () => ({
    meta: [
      { title: "Conditions Générales — Tout'ICI" },
      { name: "description", content: "CGU/CGV de la plateforme Tout'ICI." },
    ],
  }),
  component: CguPage,
});

function CguPage() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-3xl">
      <h1 className="font-display text-4xl font-bold mb-2">Conditions Générales</h1>
      <p className="text-sm text-muted-foreground mb-8">Dernière mise à jour : Juillet 2026</p>
      <div className="space-y-6 text-sm leading-relaxed text-foreground/90">
        <p>Bienvenue sur Tout'ICI. L'application Tout'ICI est une plateforme numérique de mise en relation et de gestion logistique qui connecte des utilisateurs avec des restaurants et stands gastronomiques partenaires en Côte d'Ivoire.</p>
        <p>En cochant la case « J'ai lu et j'accepte les Conditions Générales d'Utilisation et de Vente » avant de valider votre panier, vous acceptez l'intégralité des clauses détaillées ci-dessous.</p>

        <Section title="ARTICLE 1 : STATUT JURIDIQUE (MISE EN RELATION)">
          <p>Tout'ICI agit exclusivement en tant qu'intermédiaire numérique. Nous ne possédons aucun des restaurants listés, nous ne cuisinons pas les plats, et nous ne produisons pas les ingrédients.</p>
          <p>La responsabilité de la qualité des repas, du respect des normes d'hygiène, de la fraîcheur des aliments et de la conformité avec vos "Consignes Spéciales" incombe uniquement et intégralement au restaurant sélectionné. Tout'ICI ne pourra être tenu responsable des intoxications, allergies ou déceptions culinaires.</p>
        </Section>

        <Section title="ARTICLE 2 : GÉOLOCALISATION ET FRAIS DE LIVRAISON">
          <p>Pour bénéficier de la livraison à domicile, l'Utilisateur doit obligatoirement activer la géolocalisation GPS de son appareil.</p>
          <p>Les frais sont calculés automatiquement au kilomètre sur la base de la distance réelle séparant le restaurant et vos coordonnées GPS.</p>
        </Section>

        <Section title="ARTICLE 3 : RÈGLE SUR LES LONGUES DISTANCES (INTERURBAIN)">
          <p><strong>Livraisons locales :</strong> l'utilisateur peut payer via son wallet, par SmartPay, ou en espèces à la livraison.</p>
          <p><strong>Livraisons longues distances (&gt; 15 km) :</strong> le paiement complet est strictement obligatoire avant le départ du livreur. L'option "Paiement à la livraison" est automatiquement désactivée.</p>
        </Section>

        <Section title="ARTICLE 4 : LIVRAISONS PLANIFIÉES ET POINTS RELAIS">
          <p><strong>Horaires programmés :</strong> Tout'ICI s'efforce de respecter le créneau. Les aléas du trafic ou les retards de cuisine ne donnent pas lieu à indemnités.</p>
          <p><strong>Points Relais :</strong> les repas non récupérés le jour même ne seront pas remboursés (produits périssables).</p>
        </Section>

        <Section title="ARTICLE 5 : WALLET ET RECHARGES">
          <p>Les recharges doivent faire l'objet d'une validation par l'administrateur sur présentation d'une preuve de transfert. Les fonds sont exclusivement destinés à l'achat de repas et aux services de livraison.</p>
        </Section>

        <Section title="ARTICLE 6 : MODIFICATION ET ANNULATION">
          <p>Une fois le statut « En préparation » atteint, aucune annulation n'est possible et le montant total reste dû.</p>
        </Section>

        <Section title="ARTICLE 7 : DROIT APPLICABLE">
          <p>Les présentes conditions sont soumises aux lois en vigueur en République de Côte d'Ivoire. En cas de litige, une solution amiable sera prioritairement recherchée avant toute action devant les tribunaux compétents d'Abidjan.</p>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="font-display text-xl font-semibold text-primary-glow mb-2 mt-6">{title}</h2>
      <div className="space-y-2">{children}</div>
    </div>
  );
}