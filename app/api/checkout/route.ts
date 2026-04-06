import { NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';

export async function POST(req: Request) {
  try {
    const { planId, userId, email } = await req.json();
    const stripe = getStripe();

    // Map planId to Stripe Price ID
    const priceMap: Record<string, string> = {
      'weekly': process.env.STRIPE_WEEKLY_PRICE_ID!,
      'monthly': process.env.STRIPE_MONTHLY_PRICE_ID!,
      'annual': process.env.STRIPE_ANNUAL_PRICE_ID!,
    };

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceMap[planId],
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/`,
      customer_email: email,
      metadata: {
        userId,
        planId,
      },
    });

    return NextResponse.json({ sessionId: session.id, url: session.url });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('Stripe error:', errorMessage);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
