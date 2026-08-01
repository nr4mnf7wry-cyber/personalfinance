import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";

/** Returns the current user id, or null if unauthenticated (also protected by middleware). */
export async function getCurrentUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  return session?.user?.id ?? null;
}

export function unauthorized() {
  return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
}
