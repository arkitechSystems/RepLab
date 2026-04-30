import { Router } from 'express';
import getStripe from '../stripe.js';
import db from '../db.js';
import pool from '../dbPool.js';
import config from '../config.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

// Create Stripe Checkout session
router.post('/create-checkout-session', authMiddleware, async (req, res) => {
  try {
    const { plan, billing } = req.body;
    if (!plan || !['Pro', 'Elite'].includes(plan)) {
      return res.status(400).json({ error: 'Invalid plan' });
    }
    if (!billing || !['monthly', 'yearly'].includes(billing)) {
      return res.status(400).json({ error: 'Invalid billing interval' });
    }

    const priceMap = {
      'Pro-monthly': process.env.STRIPE_PRO_MONTHLY_PRICE_ID,
      'Pro-yearly': process.env.STRIPE_PRO_YEARLY_PRICE_ID,
      'Elite-monthly': process.env.STRIPE_ELITE_MONTHLY_PRICE_ID,
      'Elite-yearly': process.env.STRIPE_ELITE_YEARLY_PRICE_ID,
    };
    const priceId = priceMap[`${plan}-${billing}`];
    if (!priceId) {
      return res.status(400).json({ error: 'Price not configured for this plan' });
    }

    // Get or create Stripe customer
    const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [req.userId]);
    const user = rows[0];
    let customerId = user.stripe_customer_id;

    if (!customerId) {
      const customer = await getStripe().customers.create({
        email: user.email,
        metadata: { userId: String(user.id) },
      });
      customerId = customer.id;
      await db.setUserStripeCustomerId(user.id, customerId);
    }

    const baseUrl = process.env.NODE_ENV === 'production'
      ? config.APP_URL
      : 'http://localhost:5173';

    const session = await getStripe().checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${baseUrl}/upgrade?success=true`,
      cancel_url: `${baseUrl}/upgrade?canceled=true`,
      client_reference_id: String(user.id),
      metadata: { plan, billing },
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('Checkout session error:', err);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

// Stripe webhook
router.post('/webhook', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = getStripe().webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = parseInt(session.client_reference_id, 10);
        const plan = session.metadata.plan;
        const billing = session.metadata.billing;

        // Retrieve the subscription to get period end
        const subscription = await getStripe().subscriptions.retrieve(session.subscription);

        await db.createSubscription({
          userId,
          stripeSubscriptionId: subscription.id,
          stripeCustomerId: session.customer,
          plan,
          billingInterval: billing === 'yearly' ? 'year' : 'month',
          status: subscription.status,
          currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        });

        await db.updateUserPlan(userId, plan);
        break;
      }

      case 'invoice.paid': {
        const invoice = event.data.object;
        if (invoice.subscription) {
          const subscription = await getStripe().subscriptions.retrieve(invoice.subscription);
          await db.updateSubscriptionByStripeId(invoice.subscription, {
            status: subscription.status,
            currentPeriodEnd: new Date(subscription.current_period_end * 1000),
          });
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        if (invoice.subscription) {
          await db.updateSubscriptionByStripeId(invoice.subscription, {
            status: 'past_due',
          });
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        await db.updateSubscriptionByStripeId(subscription.id, {
          status: subscription.status,
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
          currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        });
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        await db.updateSubscriptionByStripeId(subscription.id, {
          status: 'canceled',
        });
        // Reset user plan to Free
        const user = await db.getUserByStripeCustomerId(subscription.customer);
        if (user) {
          await db.updateUserPlan(user.id, 'Free');
        }
        break;
      }
    }
  } catch (err) {
    console.error('Webhook handler error:', err);
  }

  res.json({ received: true });
});

// Create Stripe Customer Portal session
router.post('/create-portal-session', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT stripe_customer_id FROM users WHERE id = $1', [req.userId]);
    const customerId = rows[0]?.stripe_customer_id;

    if (!customerId) {
      return res.status(400).json({ error: 'No billing account found' });
    }

    const baseUrl = process.env.NODE_ENV === 'production'
      ? config.APP_URL
      : 'http://localhost:5173';

    const session = await getStripe().billingPortal.sessions.create({
      customer: customerId,
      return_url: `${baseUrl}/profile`,
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('Portal session error:', err);
    res.status(500).json({ error: 'Failed to create portal session' });
  }
});

// Get current subscription
router.get('/subscription', authMiddleware, async (req, res) => {
  try {
    const sub = await db.getSubscriptionByUserId(req.userId);
    if (!sub) return res.json(null);
    res.json({
      plan: sub.plan,
      billing: sub.billing_interval,
      status: sub.status,
      currentPeriodEnd: sub.current_period_end,
      cancelAtPeriodEnd: sub.cancel_at_period_end,
    });
  } catch (err) {
    console.error('Get subscription error:', err);
    res.status(500).json({ error: 'Failed to fetch subscription' });
  }
});

export default router;
