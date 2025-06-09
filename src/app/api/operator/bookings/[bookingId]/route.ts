
import { NextResponse } from 'next/server';
// import type { NextRequest } from 'next/server'; // Intentionally commented out for extreme simplification

interface PostContext {
  params: {
    bookingId?: string; // Make bookingId optional in type for safety
  };
}

export async function POST(request: any, context: PostContext) { // Using `any` for request as a diagnostic step
  console.log("!!!! API POST /api/operator/bookings/[bookingId] - SIMPLIFIED HANDLER v4 (request: any, context: PostContext) ENTERED !!!!");
  let bookingIdFromContext: string | undefined = undefined;

  try {
    if (context && context.params && typeof context.params.bookingId === 'string' && context.params.bookingId.trim() !== '') {
      bookingIdFromContext = context.params.bookingId;
      console.log(`SIMPLIFIED v4: Successfully extracted bookingId: ${bookingIdFromContext} from context.params`);
      
      return NextResponse.json({
        message: `Simplified test response v4 for bookingId: ${bookingIdFromContext}`,
        bookingIdReceived: bookingIdFromContext,
        status: "ok_from_simplified_handler_v4"
      }, { status: 200 });

    } else {
      const errorMessage = 'Booking ID missing or invalid in request path context (v4).';
      console.error(`SIMPLIFIED v4 CRITICAL: ${errorMessage} Context object:`, context ? JSON.stringify(context, null, 2) : "context is undefined/null");
      
      // Attempt to get it from the request URL as a last resort if context.params is not working as expected
      // This is highly unconventional for App Router API routes but is for extreme debugging.
      if (request && request.nextUrl && typeof request.nextUrl.pathname === 'string') {
        const urlParts = request.nextUrl.pathname.split('/');
        const bookingIdFromUrl = urlParts[urlParts.length -1]; // Last segment
        if (bookingIdFromUrl && bookingIdFromUrl !== '[bookingId]' && !bookingIdFromUrl.includes('route.js')) { // Defensive check
            console.warn(`SIMPLIFIED v4: Fallback - Extracted bookingId from URL: ${bookingIdFromUrl}`);
            return NextResponse.json({
                message: `Simplified test response v4 (URL Fallback) for bookingId: ${bookingIdFromUrl}`,
                bookingIdReceived: bookingIdFromUrl,
                status: "ok_from_simplified_handler_v4_url_fallback"
            }, { status: 200 });
        } else {
             console.error(`SIMPLIFIED v4: Fallback from URL also failed or gave placeholder. Path: ${request.nextUrl.pathname}`);
        }
      }

      return NextResponse.json({
        message: "Simplified test response v4 - ERROR.",
        error: errorMessage,
        bookingIdReceived: "ExtractionFailed",
        status: "error_extracting_bookingId_from_context_v4"
      }, { status: 400 });
    }

  } catch (error: any) {
    console.error(`!!! UNHANDLED CRITICAL ERROR IN SIMPLIFIED API POST v4 /api/operator/bookings/[bookingId=${bookingIdFromContext || 'UNKNOWN'}] !!!`, error);
    return NextResponse.json({
        error: true,
        message: "A severe unexpected server error occurred in the simplified request handler v4.",
        bookingIdAttempted: bookingIdFromContext || "ExtractionFailedOrNotReached",
        errorName: error?.name || "UnknownError",
        errorMessageFromCatch: error?.message || "No specific error message in catch.",
    }, { status: 500 });
  }
}

// GET handler (if it was present before, keep it or ensure it's also simplified/correct)
// Example:
interface GetContext {
  params: {
    bookingId: string;
  };
}
export async function GET(request: any, context: GetContext) {
  const { bookingId } = context.params;
  try {
    if (!bookingId || typeof bookingId !== 'string' || bookingId.trim() === '') {
      return NextResponse.json({ error: true, message: 'A valid Booking ID path parameter is required for GET.' }, { status: 400 });
    }
    // Dummy GET response for testing the route file itself
    return NextResponse.json({ message: `GET request received for booking ID: ${bookingId}`, bookingId }, { status: 200 });

  } catch (error: any) {
    console.error(`Error in simplified GET /api/operator/bookings/[bookingId=${bookingId || 'UNKNOWN'}]`, error);
    return NextResponse.json({ error: true, message: "Error in simplified GET handler." }, { status: 500 });
  }
}
