import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { doc, setDoc, Timestamp } from "firebase/firestore";
import { notifyDriverEmergency } from '@/lib/notifications';

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const { hazardType, location, reportedByDriverId, reportedAt, status } = data;
    if (!hazardType || !location || !reportedByDriverId || !reportedAt) {
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
    }
    if (!db) {
      return NextResponse.json({ error: "Firestore not initialized." }, { status: 500 });
    }
    const hazardId = `${reportedByDriverId}_${Date.now()}`;
    const hazardDocRef = doc(db, "hazardReports", hazardId);
    await setDoc(hazardDocRef, {
      hazardType,
      location,
      reportedByDriverId,
      reportedAt: Timestamp.fromDate(new Date(reportedAt)),
      status,
      resolved: false,
      createdAt: Timestamp.now(),
    });
    // Trigger notification for admin(s) and operator(s)
    await notifyDriverEmergency({
      toRole: 'admin',
      driverName: reportedByDriverId,
      location: typeof location === 'string' ? location : JSON.stringify(location),
      link: '/admin/server-monitoring'
    });
    return NextResponse.json({ success: true, hazardId });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}