import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const origin = req.headers.get('origin') || req.headers.get('Origin') || 'https://app.base44.com';
    const WIX_API_KEY = Deno.env.get('WIX_PAYMENTS_API_KEY');
    const WIX_SITE_ID = Deno.env.get('WIX_PAYMENTS_SITE_ID');

    const response = await fetch(
      'https://www.wixapis.com/payments/platform/v1/checkout-sessions/construct',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': WIX_API_KEY,
          'wix-site-id': WIX_SITE_ID,
        },
        body: JSON.stringify({
          cart: {
            items: [{ name: 'MentorAI Monthly Subscription', quantity: 1, price: '4.99' }],
            customerInfo: {
              firstName: user.full_name?.split(' ')[0] || '',
              lastName: user.full_name?.split(' ').slice(1).join(' ') || '',
            },
          },
          callbackUrls: {
            postFlowUrl: `${origin}/`,
            thankYouPageUrl: `${origin}/thank-you`,
          },
        }),
      }
    );

    const data = await response.json();
    if (!response.ok) {
      console.error('Wix Payments error:', JSON.stringify(data));
      return Response.json({ error: data.message || 'Checkout creation failed' }, { status: 400 });
    }

    const session = data.checkoutSession;

    // Store pending membership
    await base44.asServiceRole.entities.Membership.create({
      user_email: user.email,
      status: 'pending',
      checkout_session_id: session.id,
      plan: 'starter',
    });

    return Response.json({ redirectUrl: session.redirectUrl });
  } catch (error) {
    console.error('createCheckout error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});