import { db, query, collection, where, getDocs, limit, orderBy, doc, getDoc, setDoc, updateDoc, Timestamp, addDoc } from './firebase';
import { addDays, format } from 'date-fns';

export interface Subscription {
  id: string;
  userId: string;
  planId: string;
  status: 'active' | 'cancelled' | 'expired' | 'trialing';
  startDate: Date;
  endDate: Date;
  trialUsed: boolean;
  cancelAtPeriodEnd: boolean;
}

export interface Plan {
  id: string;
  name: string;
  price: number;
  currency: string;
  durationDays: number;
  features: {
    lexicalQueriesLimit?: number;
    allBibleVersions: boolean;
    originalLanguages: boolean;
  };
  stripePriceId?: string;
}

export const FREE_PLAN: Plan = {
  id: 'free',
  name: 'Free',
  price: 0,
  currency: 'USD',
  durationDays: 0,
  features: {
    lexicalQueriesLimit: 5,
    allBibleVersions: false,
    originalLanguages: false,
  },
};

export const PREMIUM_FEATURES = {
  lexicalQueriesLimit: Infinity,
  allBibleVersions: true,
  originalLanguages: true,
};

export async function getUserSubscription(userId: string): Promise<Subscription | null> {
  const q = query(
    collection(db, 'subscriptions'),
    where('userId', '==', userId),
    where('status', 'in', ['active', 'trialing']),
    orderBy('endDate', 'desc'),
    limit(1)
  );
  
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  
  const data = snapshot.docs[0].data();
  return {
    id: snapshot.docs[0].id,
    ...data,
    startDate: data.startDate.toDate(),
    endDate: data.endDate.toDate(),
  } as Subscription;
}

export async function checkUsageLimit(userId: string): Promise<boolean> {
  const today = format(new Date(), 'yyyy-MM-dd');
  const limitDocRef = doc(db, 'usage_limits', `${userId}_${today}`);
  const limitDoc = await getDoc(limitDocRef);
  
  if (!limitDoc.exists()) {
    await setDoc(limitDocRef, {
      userId,
      date: today,
      lexicalQueriesCount: 0,
    });
    return true;
  }
  
  const data = limitDoc.data();
  const sub = await getUserSubscription(userId);
  const limit = sub ? Infinity : FREE_PLAN.features.lexicalQueriesLimit!;
  
  return data.lexicalQueriesCount < limit;
}

export async function incrementUsage(userId: string) {
  const today = format(new Date(), 'yyyy-MM-dd');
  const limitDocRef = doc(db, 'usage_limits', `${userId}_${today}`);
  const limitDoc = await getDoc(limitDocRef);
  
  if (limitDoc.exists()) {
    await updateDoc(limitDocRef, {
      lexicalQueriesCount: limitDoc.data().lexicalQueriesCount + 1,
    });
  } else {
    await setDoc(limitDocRef, {
      userId,
      date: today,
      lexicalQueriesCount: 1,
    });
  }
}

export async function startTrial(userId: string, planId: string) {
  const startDate = new Date();
  const endDate = addDays(startDate, 4);
  
  await addDoc(collection(db, 'subscriptions'), {
    userId,
    planId,
    status: 'trialing',
    startDate: Timestamp.fromDate(startDate),
    endDate: Timestamp.fromDate(endDate),
    trialUsed: true,
    cancelAtPeriodEnd: false,
  });
}
