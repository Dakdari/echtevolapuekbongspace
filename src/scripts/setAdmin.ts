// @ts-nocheck
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, updateDoc } from 'firebase/firestore';

const setAdmin = async (email: string) => {
  const usersRef = collection(db, 'users');
  const q = query(usersRef, where('email', '==', email));
  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    console.log(`User with email ${email} not found.`);
    process.exit(1);
  }

  const doc = snapshot.docs[0];
  await updateDoc(doc.ref, { role: 'admin' });
  console.log(`Successfully set ${email} to admin.`);
  process.exit(0);
};

setAdmin('jusigmaeniae1@gmail.com').catch(console.error);
