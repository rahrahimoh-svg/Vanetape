// ═══════════════════════════════════════════════════════════
//  VanEscale — Serveur Stripe (Node.js / Express)
//  Lance avec : node server.js
// ═══════════════════════════════════════════════════════════

const express = require('express');
const cors    = require('cors');
const stripe  = require('stripe')(process.env.STRIPE_SECRET_KEY);
//  ⚠️  Lance le serveur avec ta clé SECRÈTE Stripe :
//     STRIPE_SECRET_KEY=sk_live_... node server.js
//     (ou mets-la dans un fichier .env avec le package dotenv)

const app = express();
app.use(cors({ origin: '*' }));   // En prod, remplace * par ton domaine
app.use(express.json());

// ── Route principale : créer un PaymentIntent ──────────────
app.post('/create-payment-intent', async (req, res) => {
  const { amount, currency, customer_email, booking_id, van_name, owner } = req.body;

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount,                           // en centimes (5250 = 52,50 €)
      currency: currency || 'eur',
      receipt_email: customer_email,    // Stripe envoie le reçu automatiquement
      metadata: {
        booking_id,                     // Référence de réservation VanEscale
        van_name,                       // Nom du van
        owner,                          // Nom du propriétaire
        platform: 'VanEscale',
      },
      description: `VanEscale — Réservation ${booking_id} · ${van_name}`,
    });

    // Génère la ref de réservation
    const bookingRef = 'VESC-' + Date.now().toString().slice(-5);

    res.json({
      clientSecret: paymentIntent.client_secret,
      bookingRef,
    });

  } catch (err) {
    console.error('Stripe error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Webhook Stripe (optionnel mais recommandé) ─────────────
// Stripe appelle cette route pour confirmer les événements côté serveur
// Configure-le dans le dashboard Stripe : https://dashboard.stripe.com/webhooks
app.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  const sig     = req.headers['stripe-signature'];
  const secret  = process.env.STRIPE_WEBHOOK_SECRET; // Clé webhook du dashboard

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, secret);
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Gérer les événements importants
  switch (event.type) {
    case 'payment_intent.succeeded':
      const pi = event.data.object;
      console.log(`✅ Paiement reçu ! ${pi.amount / 100}€ — Réservation: ${pi.metadata.booking_id}`);
      // 👉 Ici : envoyer un e-mail au propriétaire, mettre à jour ta base de données, etc.
      break;

    case 'payment_intent.payment_failed':
      const failedPi = event.data.object;
      console.log(`❌ Paiement échoué — ${failedPi.metadata.booking_id}`);
      break;

    default:
      console.log(`Événement Stripe reçu: ${event.type}`);
  }

  res.json({ received: true });
});

// ── Démarrage ──────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`
  ╔══════════════════════════════════════╗
  ║   🚐  VanEscale — Serveur Stripe    ║
  ║   Écoute sur http://localhost:${PORT}  ║
  ╚══════════════════════════════════════╝
  `);
});

// ── Installation (à faire une seule fois) ──────────────────
// npm init -y
// npm install express cors stripe
// STRIPE_SECRET_KEY=sk_live_... node server.js
