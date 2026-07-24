import Stripe from 'npm:stripe@17';
import { supabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { getAuthedUser } from '../_shared/auth.ts';
import { handleOptions, jsonResponse } from '../_shared/cors.ts';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, { apiVersion: '2025-01-27.acacia' });

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;

  try {
    const user = await getAuthedUser(req);
    if (!user) return jsonResponse({ error: 'Unauthorized' }, 401);

    const origin = req.headers.get('origin') || req.headers.get('Origin') || Deno.env.get('APP_URL') || '';

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer_email: user.email,
      line_items: [
        {
          price: Deno.env.get('STRIPE_PRICE_ID'),
          quantity: 1,
        },
      ],
      success_url: `${origin}/thank-you?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/membership`,
      metadata: { user_email: user.email },
    });

    await supabaseAdmin.from('memberships').insert({
      user_email: user.email,
      status: 'pending',
      checkout_session_id: session.id,
      plan: 'starter',
    });

    return jsonResponse({ redirectUrl: session.url });
  } catch (error) {
    console.error('createCheckout error:', (error as Error).message);
    return jsonResponse({ error: (error as Error).message }, 500);
  }
});
