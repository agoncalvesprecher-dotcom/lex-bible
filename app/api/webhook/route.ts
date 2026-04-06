import { NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { cert } from 'firebase-admin/app';
import Stripe from 'stripe';

// Initialize Firebase Admin
if (!getApps().length) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY!);
    initializeApp({
      credential: cert(serviceAccount),
    });
  } catch (e) {
    console.error('Firebase Admin initialization error:', e);
  }
}

const db = getFirestore();

export async function POST(req: Request) {
  const stripe = getStripe();
  const signature = req.headers.get('stripe-signature')!;
  const body = await req.text();

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: `Webhook Error: ${errorMessage}` }, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const metadata = session.metadata;
    if (!metadata) return NextResponse.json({ received: true });
    const { userId, planId } = metadata;
    const subscriptionId = session.subscription as string;
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);

    await db.collection('subscriptions').add({
      userId,
      planId,
      status: 'active',
      stripeSubscriptionId: subscriptionId,
      startDate: Timestamp.fromMillis(subscription.current_period_start * 1000),
      endDate: Timestamp.fromMillis(subscription.current_period_end * 1000),
      trialUsed: false,
      cancelAtPeriodEnd: false,
    });
  }

  if (event.type === 'invoice.payment_succeeded') {
    const invoice = event.data.object as Stripe.Invoice;
    const subscriptionId = invoice.subscription as string;
    if (!subscriptionId) return NextResponse.json({ received: true });
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);

    const q = await db.collection('subscriptions')
      .where('stripeSubscriptionId', '==', subscriptionId)
      .limit(1)
      .get();

    if (!q.empty) {
      await q.docs[0].ref.update({
        status: 'active',
        endDate: Timestamp.fromMillis(subscription.current_period_end * 1000),
      });
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object as Stripe.Subscription;
    const q = await db.collection('subscriptions')
      .where('stripeSubscriptionId', '==', subscription.id)
      .limit(1)
      .get();

    if (!q.empty) {
      await q.docs[0].ref.update({
        status: 'expired',
      });
    }
  }

  return NextResponse.json({ received: true });
}
