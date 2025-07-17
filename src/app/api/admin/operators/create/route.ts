import { NextResponse } from 'next/server';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';
import { z } from 'zod';

if (!getApps().length) {
  initializeApp({ credential: applicationDefault() });
}
const db = getFirestore();

// Strong password generator (simple example)
function generateTemporaryPassword(length = 12): string {
  const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+~`|}{[]:;?><,./-=";
  let password = "";
  for (let i = 0, n = charset.length; i < length; ++i) {
    password += charset.charAt(Math.floor(Math.random() * n));
  }
  // Ensure it has a mix of character types (basic check)
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password) || !/[!@#$%^&*()_+~`|}{[\]:;?><,./-=]/.test(password)) {
    return generateTemporaryPassword(length); // Regenerate if basic complexity not met
  }
  return password;
}

const createOperatorSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters." }),
  email: z.string().email({ message: "Invalid email address." }),
  phone: z.string().optional(),
  operatorCode: z.string().min(3, {message: "Operator Code must be at least 3 characters."}).regex(/^OP\d{3,}$/, {message: "Operator Code must be in format OPXXX (e.g. OP001)"}),
});

export async function POST(req: Request) {
  try {
    const data = await req.json();
    data.createdAt = Timestamp.now();
    const docRef = await db.collection('users').add(data);
    return NextResponse.json({ message: 'Operator created successfully', id: docRef.id });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create operator', details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
