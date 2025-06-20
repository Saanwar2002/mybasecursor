import { NextResponse } from "next/server";

// In-memory store for favorite drivers
const favoriteDrivers = [
  { id: "driver_fav_1", name: "John Smith", avatarText: "JS", vehicleInfo: "Silver Toyota Camry - LS67 FGE" },
  { id: "driver_fav_2", name: "Maria Garcia", avatarText: "MG", vehicleInfo: "Black Mercedes E-Class - MV20 XYZ" },
  { id: "driver_fav_3", name: "David Wilson", avatarText: "DW", vehicleInfo: "Blue Ford Mondeo Estate - DW21 ABC" },
];

export async function GET() {
  // In a real application, you would fetch this from a database
  // for the currently authenticated user.
  return NextResponse.json(favoriteDrivers);
} 