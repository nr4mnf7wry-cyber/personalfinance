import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  try {
    const goals = await prisma.goal.findMany({
      where: { userId: (session.user as any).id },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json(goals);
  } catch (err) {
    console.error("Erreur DB /api/goals GET:", err);
    return NextResponse.json([]);
  }
}

const schema = z.object({
  name: z.string().min(1),
  targetAmount: z.number(),
  targetDate: z.string().nullable().optional(),
});

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const d = parsed.data;

  const goal = await prisma.goal.create({
    data: {
      userId: (session.user as any).id,
      name: d.name,
      targetAmount: d.targetAmount,
      targetDate: d.targetDate ? new Date(d.targetDate) : null,
    },
  });

  return NextResponse.json(goal, { status: 201 });
}
