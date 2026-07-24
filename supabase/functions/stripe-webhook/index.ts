import Stripe from 'npm:stripe@17';
import { supabaseAdmin } from '../_shared/supabaseAdmin.ts';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, { apiVersion: '2025-01-27.acacia' });
const WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;

// No CORS / auth check here - Stripe calls this server-to-server and
// authenticates via the signed webhook payload instead of a user token.
Deno.serve(async (req) => {
  try {
    const signature = req.headers.get('stripe-signature');
    const body = await req.text();
    if (!signature) return new Response('Missing signature', { status: 400 });

    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, WEBHOOK_SECRET);
    } catch (err) {
      console.error('Webhook signature verification failed:', (err as Error).message);
      return new Response('Invalid signature', { status: 400 });
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const { data: memberships } = await supabaseAdmin
        .from('memberships').select('*').eq('checkout_session_id', session.id).limit(1);

      if (memberships?.[0]) {
        await supabaseAdmin.from('memberships').update({
          status: 'active',
          order_id: (session.subscription as string) || (session.payment_intent as string) || '',
          amount_paid: session.amount_total != null ? (session.amount_total / 100).toFixed(2) : null,
        }).eq('id', memberships[0].id);
      } else {
        console.warn('No pending membership found for checkout session:', session.id);
      }
    }

    return new Response('OK', { status: 200 });
  } catch (error) {
    console.error('stripe-webhook error:', (error as Error).message);
    return new Response('Error', { status: 500 });
  }
});
