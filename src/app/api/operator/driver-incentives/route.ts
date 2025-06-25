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

import { db } from "@/lib/firebase";
import { collection, getDocs, addDoc, serverTimestamp, query, where } from "firebase/firestore";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const operatorCode = searchParams.get("operatorCode");
    if (!db) {
      return NextResponse.json({ error: "Firestore (db) is not initialized!" }, { status: 500 });
    }
    let q = collection(db, "operatorIncentivePrograms");
    if (operatorCode) {
      q = query(q, where("operatorCode", "==", operatorCode));
    }
    const snapshot = await getDocs(q);
    const programs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return NextResponse.json({ programs });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch programs", details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    if (!db) {
      return NextResponse.json({ error: "Firestore (db) is not initialized!" }, { status: 500 });
    }
    const body = await req.json();
    const parsed = IncentiveProgramSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid data", details: parsed.error.format() }, { status: 400 });
    }
    const newProgram = {
      ...parsed.data,
      status: "Active",
      participants: 0,
      createdAt: serverTimestamp()
    };
    const docRef = await addDoc(collection(db, "operatorIncentivePrograms"), newProgram);
    return NextResponse.json({ program: { id: docRef.id, ...newProgram } }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Failed to create program", details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}