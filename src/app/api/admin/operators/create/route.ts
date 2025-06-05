
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { auth, db } from '@/lib/firebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, getDocs, query, where, collection, serverTimestamp, Timestamp } from 'firebase/firestore';
import { z } from 'zod';

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

export async function POST(request: NextRequest) {
  // TODO: Implement robust admin authentication/authorization here.
  // For example, verify an admin ID token or session.
  // const adminUser = await getAuthenticatedAdminUser(request);
  // if (!adminUser || adminUser.id !== PLATFORM_ADMIN_UID) {
  //   return NextResponse.json({ message: 'Unauthorized: Only platform admin can create operators.' }, { status: 403 });
  // }

  let payload;
  try {
    payload = await request.json();
  } catch (e) {
    return NextResponse.json({ message: 'Invalid JSON payload.' }, { status: 400 });
  }
  
  const parsedPayload = createOperatorSchema.safeParse(payload);

  if (!parsedPayload.success) {
    return NextResponse.json({ message: 'Invalid input data.', errors: parsedPayload.error.format() }, { status: 400 });
  }

  const { name, email, phone, operatorCode } = parsedPayload.data;

  try {
    // Check if operatorCode (as customId) is already in use by another operator
    const usersRef = collection(db, "users");
    const qOpCode = query(usersRef, where("customId", "==", operatorCode), where("role", "==", "operator"));
    const opCodeSnapshot = await getDocs(qOpCode);
    if (!opCodeSnapshot.empty) {
      return NextResponse.json({ message: `Operator Code "${operatorCode}" is already in use.` }, { status: 409 });
    }

    // Create Firebase Auth user
    // IMPORTANT: In a real app, this temporary password handling needs a secure strategy.
    // (e.g., send a password reset, or require immediate change)
    const temporaryPassword = generateTemporaryPassword(); 
    if (!auth) {
        throw new Error("Firebase Auth is not initialized. Cannot create operator.");
    }
    const userCredential = await createUserWithEmailAndPassword(auth, email, temporaryPassword);
    const firebaseUser = userCredential.user;

    // Create Firestore user document
    const userProfile = {
      uid: firebaseUser.uid,
      name,
      email,
      phone: phone || null,
      role: 'operator',
      status: 'Pending Approval',
      createdAt: serverTimestamp() as Timestamp,
      customId: operatorCode, // Using operatorCode as customId for operators
      operatorCode: operatorCode, // Also store as operatorCode for clarity/consistency
      // No 'vehicleCategory' or 'driverIdentifier' for operators
    };

    await setDoc(doc(db, "users", firebaseUser.uid), userProfile);
    
    // Do NOT return the temporaryPassword in the response.
    return NextResponse.json({ 
        message: 'Operator account created successfully. Status is "Pending Approval".', 
        operator: { uid: firebaseUser.uid, name, email, operatorCode, status: 'Pending Approval' }
    }, { status: 201 });

  } catch (error: any) {
    console.error('Error creating operator:', error);
    let errorMessage = 'Failed to create operator account.';
    if (error.code === 'auth/email-already-in-use') {
      errorMessage = 'This email address is already registered.';
      return NextResponse.json({ message: errorMessage }, { status: 409 });
    } else if (error.code === 'auth/invalid-email') {
      errorMessage = 'The email address is not valid.';
       return NextResponse.json({ message: errorMessage }, { status: 400 });
    } else if (error.code) {
      errorMessage = `An error occurred: ${error.code} - ${error.message}`;
    } else if (error.message) {
        errorMessage = error.message;
    }
    return NextResponse.json({ message: errorMessage, details: String(error) }, { status: 500 });
  }
}

