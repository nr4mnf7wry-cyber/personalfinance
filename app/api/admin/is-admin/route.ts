import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";

export async function GET() {
  const session = await getServerSession(authOptions);
  return NextResponse.json({ isAdmin: isAdminEmail(session?.user?.email) });
}
