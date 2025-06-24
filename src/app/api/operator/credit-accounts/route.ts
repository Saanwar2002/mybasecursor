import { NextResponse } from "next/server";
import { z } from "zod";

const CreditAccountSchema = z.object({
  accountHolderName: z.string().min(3).max(100),
  associatedUserId: z.string().optional(),
  creditLimit: z.number().min(0),
  billingCycle: z.enum(["Weekly", "Fortnightly", "Monthly"]),
});

let creditAccounts: any[] = [
  { id: "acc_1", accountHolderName: "Corporate Client A", balance: -150.75, creditLimit: 500, status: "Active", billingCycle: "Monthly", createdAt: new Date(2023,0,15).toISOString() },
  { id: "acc_2", accountHolderName: "Regular VIP John Doe", associatedUserId: "user_vip_john", balance: 25.00, creditLimit: 200, status: "Active", billingCycle: "Fortnightly", lastBilledDate: new Date(2023,9,20).toISOString(), createdAt: new Date(2023,2,10).toISOString() },
  { id: "acc_3", accountHolderName: "Hotel Partnership X", balance: -450.00, creditLimit: 1000, status: "Suspended", billingCycle: "Monthly", createdAt: new Date(2022,11,1).toISOString() },
  { id: "acc_4", accountHolderName: "School Runs Account", balance: 0.00, creditLimit: 750, status: "Active", billingCycle: "Weekly", createdAt: new Date(2023,5,1).toISOString() },
];

export async function GET() {
  return NextResponse.json({ accounts: creditAccounts });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = CreditAccountSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid data", details: parsed.error.format() }, { status: 400 });
    }
    const newAccount = {
      id: `acc_${Date.now()}`,
      ...parsed.data,
      balance: 0,
      status: "Active",
      createdAt: new Date().toISOString(),
    };
    creditAccounts.unshift(newAccount);
    return NextResponse.json({ account: newAccount }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Failed to create account", details: error?.toString() }, { status: 500 });
  }
}