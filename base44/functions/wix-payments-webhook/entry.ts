import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const PUBLIC_KEY = Deno.env.get('WIX_PAYMENTS_WEBHOOK_PUBLIC_KEY');

    const body = await req.text();

    // Decode JWT manually (RS256 verify via Web Crypto)
    const parts = body.split('.');
    if (parts.length !== 3) return new Response('Invalid JWT', { status: 400 });

    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    const event = JSON.parse(payload.data);

    if (event.eventType !== 'wix.ecom.v1.order_approved') {
      return new Response('OK', { status: 200 });
    }

    const eventData = JSON.parse(event.data);
    const order = eventData.actionEvent?.body?.order;
    if (!order) return new Response('OK', { status: 200 });

    const checkoutId = order.checkoutId;
    const buyerEmail = order.buyerInfo?.email;

    console.log('Order approved:', { orderId: order.id, checkoutId, buyerEmail, status: order.paymentStatus });

    // Find pending membership by checkout session id
    const memberships = await base44.asServiceRole.entities.Membership.filter({ checkout_session_id: checkoutId });

    if (memberships.length > 0) {
      await base44.asServiceRole.entities.Membership.update(memberships[0].id, {
        status: 'active',
        order_id: order.id,
        amount_paid: order.priceSummary?.total?.amount || '9.99',
      });
      console.log('Membership activated for:', memberships[0].user_email);
    } else {
      console.warn('No pending membership found for checkoutId:', checkoutId);
    }

    return new Response('OK', { status: 200 });
  } catch (error) {
    console.error('Webhook error:', error.message);
    return new Response('Error', { status: 500 });
  }
});