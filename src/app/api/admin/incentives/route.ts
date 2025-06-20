import { NextRequest, NextResponse } from 'next/server';
import { addDays } from 'date-fns';

interface Incentive {
  id: number;
  title: string;
  description: string;
  rideTarget: number;
  rewardAmount: number;
  dateRange: { from: Date | string, to: Date | string };
}

let incentives: Incentive[] = [
    { id: 1, title: "Weekend Warrior", description: "Complete 20 rides this weekend for a bonus.", rideTarget: 20, rewardAmount: 50, dateRange: { from: new Date(), to: addDays(new Date(), 2) } },
    { id: 2, title: "Weekday Hustle", description: "Complete 50 rides during the week for a big bonus.", rideTarget: 50, rewardAmount: 150, dateRange: { from: addDays(new Date(), 3), to: addDays(new Date(), 7) } },
];

export async function GET() {
  return NextResponse.json(incentives);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const newIncentive: Incentive = { ...body, id: Date.now() };
    incentives.push(newIncentive);
    return NextResponse.json({ success: true, incentive: newIncentive });
  } catch (error) {
    console.error('Error creating incentive:', error);
    return NextResponse.json({ error: 'Failed to create incentive' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
    try {
      const { searchParams } = new URL(request.url);
      const id = searchParams.get('id');
      if (!id) {
          return NextResponse.json({ error: 'Missing id parameter' }, { status: 400 });
      }
      
      const initialLength = incentives.length;
      incentives = incentives.filter(inc => inc.id !== Number(id));

      if (incentives.length === initialLength) {
        return NextResponse.json({ error: 'Incentive not found' }, { status: 404 });
      }

      return NextResponse.json({ success: true });
    } catch (error) {
      console.error('Error deleting incentive:', error);
      return NextResponse.json({ error: 'Failed to delete incentive' }, { status: 500 });
    }
  } 