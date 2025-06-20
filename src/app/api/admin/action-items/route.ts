import { NextRequest, NextResponse } from 'next/server';
import { getAdminActionItems } from '@/ai/flows/admin-action-items-flow';

export async function GET(request: NextRequest) {
  // TODO: Replace with real platform metrics
  const mockMetrics = {
    pendingOperatorApprovals: 2,
    activeSystemAlerts: 1,
    unresolvedSupportTickets: 3,
    recentFeatureFeedbackCount: 7,
    platformLoadPercentage: 45,
  };
  try {
    const items = await getAdminActionItems(mockMetrics);
    return NextResponse.json({ items });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to generate action items' }, { status: 500 });
  }
} 