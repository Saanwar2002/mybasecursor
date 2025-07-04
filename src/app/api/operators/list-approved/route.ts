import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

export async function GET(request: NextRequest) {
  try {
    // Defensive: Check db
    if (!db) {
      console.error('Firestore db is not initialized');
      return NextResponse.json({ error: 'Database not initialized' }, { status: 500 });
    }
    // Query for all approved operators
    const operatorsRef = collection(db, 'users');
    // Log: Check if collection exists (cannot check directly, but log for debugging)
    console.log('Fetching operators from Firestore: users collection');
    // Defensive: Log query parameters
    const roleField = 'role';
    const statusField = 'status';
    const roleValue = 'operator';
    const statusValue = 'Active';
    console.log('Querying for', roleField, '=', roleValue, 'and', statusField, '=', statusValue);
    // Defensive: Query only if fields are valid
    if (!roleField || !statusField || !roleValue || !statusValue) {
      return NextResponse.json({ error: 'Invalid query parameters' }, { status: 400 });
    }
    const q = query(
      operatorsRef,
      where(roleField, '==', roleValue),
      where(statusField, '==', statusValue)
    );
    let querySnapshot;
    try {
      querySnapshot = await getDocs(q);
    } catch (queryError) {
      console.error('Firestore query error:', queryError);
      return NextResponse.json({ error: 'Firestore query error', details: queryError instanceof Error ? queryError.message : String(queryError) }, { status: 500 });
    }
    const operators = querySnapshot.docs.map(doc => {
      const data = doc.data();
      // Defensive: Only include if required fields exist
      if (!data.operatorCode || !data.name) {
        console.warn('Skipping operator with missing fields:', doc.id, data);
        return null;
      }
      return {
        id: doc.id,
        operatorCode: data.operatorCode,
        name: data.companyName || data.name,
        email: data.email,
        phone: data.phone,
        status: data.status
      };
    });
    // Filter out nulls before sorting
    const filteredOperators = operators.filter((op): op is NonNullable<typeof op> => op !== null);
    // Sort by operator code
    filteredOperators.sort((a, b) => a.operatorCode.localeCompare(b.operatorCode));
    return NextResponse.json({ 
      success: true, 
      operators: filteredOperators 
    });
  } catch (error) {
    console.error('Error fetching approved operators:', error);
    return NextResponse.json({ error: 'Internal server error', details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
} 