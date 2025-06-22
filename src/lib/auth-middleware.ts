import { NextRequest, NextResponse } from 'next/server';
import * as fbAdmin from 'firebase-admin';
import { getAuth, getAdmin } from './firebase-admin';

type ApiHandler = (
  req: NextRequest, 
  context: { params: any; user?: fbAdmin.auth.DecodedIdToken }
) => Promise<NextResponse>;

type AuthenticatedApiHandler = (
    req: NextRequest, 
    context: { params: any; user: fbAdmin.auth.DecodedIdToken }
) => Promise<NextResponse>;


export const withAuth = (handler: AuthenticatedApiHandler): ApiHandler => {
  return async (req: NextRequest, { params }: { params: any }) => {
    // Ensure Firebase Admin is initialized
    if (!getAdmin().apps.length) {
      console.error('withAuth Middleware: Firebase Admin App is not initialized!');
      return new NextResponse('Internal Server Error: App configuration failed', { status: 500 });
    }

    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new NextResponse('Unauthorized: Missing or invalid Authorization header', { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    
    try {
      const auth = getAuth();
      const decodedToken = await auth.verifyIdToken(token);
      return handler(req, { params, user: decodedToken });
    } catch (error) {
      console.error('Error verifying auth token:', error);
      return new NextResponse('Unauthorized: Invalid token', { status: 401 });
    }
  };
};

export const withAdminAuth = (handler: AuthenticatedApiHandler) => withAuth(async (req, context) => {
    const { user } = context;
    
    // Check for admin custom claim
    if (user.admin === true) {
        return handler(req, context);
    }

    // Fallback: check user record from Auth just in case claims aren't in the token
    try {
        const auth = getAuth();
        const userRecord = await auth.getUser(user.uid);
        if (userRecord.customClaims?.admin === true) {
            return handler(req, context);
        }
        return new NextResponse('Forbidden: Admin access required', { status: 403 });
    } catch (error) {
        console.error('Error fetching user record for admin check:', error);
        return new NextResponse('Internal Server Error', { status: 500 });
    }
});

export const withOperatorAuth = (handler: AuthenticatedApiHandler) => withAuth(async (req, context) => {
    const { user } = context;
    
    // Check for operator custom claim
    if (user.operator === true) {
        return handler(req, context);
    }

    // Fallback: check user record from Auth
    try {
        const auth = getAuth();
        const userRecord = await auth.getUser(user.uid);
        if (userRecord.customClaims?.operator === true) {
            return handler(req, context);
        }
        return new NextResponse('Forbidden: Operator access required', { status: 403 });
    } catch (error) {
        console.error('Error fetching user record for operator check:', error);
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}); 