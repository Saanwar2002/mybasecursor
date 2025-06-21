import { NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-admin';
import { PLATFORM_OPERATOR_CODE, PLATFORM_OPERATOR_NAME } from '@/lib/constants';

export async function GET() {
  try {
    const db = getDb();
    
    // Get all users with operator role and Active status
    const operatorsSnapshot = await db.collection('users')
      .where('role', '==', 'operator')
      .where('status', '==', 'Active')
      .get();

    const operators = operatorsSnapshot.docs
      .map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          operatorCode: data.operatorCode,
          name: data.name || 'Unknown Operator',
          email: data.email,
          status: data.status
        };
      })
      // Only include operators with valid operator codes
      .filter(op => op.operatorCode && op.operatorCode.startsWith('OP'));

    // Always include the platform operator (OP001) if not already in the list
    const platformOperatorExists = operators.some(op => op.operatorCode === PLATFORM_OPERATOR_CODE);
    
    if (!platformOperatorExists) {
      operators.unshift({
        id: 'platform',
        operatorCode: PLATFORM_OPERATOR_CODE,
        name: PLATFORM_OPERATOR_NAME,
        email: 'platform@mybase.com',
        status: 'Active'
      });
    }

    // Sort by operator code
    operators.sort((a, b) => a.operatorCode.localeCompare(b.operatorCode));

    return NextResponse.json({
      operators: operators.map(op => ({
        operatorCode: op.operatorCode,
        displayName: `${op.name} (${op.operatorCode})`
      }))
    });

  } catch (error) {
    console.error("Error fetching operators:", error);
    return NextResponse.json(
      { message: "Failed to fetch operators" }, 
      { status: 500 }
    );
  }
} 