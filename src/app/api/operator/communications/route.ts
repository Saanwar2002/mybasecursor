import { NextResponse } from "next/server";
import * as z from "zod";

const communicationsSchema = z.object({
  targetAudience: z.enum(["all", "inactive", "specific"]),
  passengerIdInput: z.string().optional(),
  channelSms: z.boolean(),
  channelEmail: z.boolean(),
  emailSubject: z.string().optional(),
  messageBody: z.string().min(10),
  discountCode: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = communicationsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload", details: parsed.error.format() }, { status: 400 });
    }
    // TODO: Integrate with real messaging services (Twilio, SendGrid, etc.)
    // For now, just log the request and return success
    console.log("[COMMUNICATIONS API] Would send:", JSON.stringify(parsed.data, null, 2));
    return NextResponse.json({ message: "Messages queued for delivery.", details: parsed.data }, { status: 200 });
  } catch (err) {
    return NextResponse.json({ error: "Internal server error", details: String(err) }, { status: 500 });
  }
}