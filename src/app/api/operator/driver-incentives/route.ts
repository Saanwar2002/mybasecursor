import { NextResponse } from "next/server";
import { z } from "zod";

// Zod schema for incentive program
const IncentiveProgramSchema = z.object({
  name: z.string(),
  metric: z.string(),
  reward: z.string(),
  criteria: z.string(),
  rewardValue: z.string(),
  startDate: z.string(),
  endDate: z.string().optional(),
  operatorCode: z.string(),
});

// In-memory store for demonstration (replace with DB/Firestore integration)
let operatorPrograms: any[] = [];

export async function GET(req: Request) {
  // TODO: Replace with DB/Firestore fetch for operator's programs
  return NextResponse.json({ programs: operatorPrograms });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = IncentiveProgramSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid data", details: parsed.error.format() }, { status: 400 });
    }
    const newProgram = { ...parsed.data, id: `op_prog_${Date.now()}`, status: "Active", participants: 0 };
    operatorPrograms.unshift(newProgram);
    // TODO: Persist to DB/Firestore
    return NextResponse.json({ program: newProgram }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Failed to create program", details: error?.toString() }, { status: 500 });
  }
}