import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  try {
    const accounts = await prisma.bankAccount.findMany({
      where: { userId: (session.user as any).id },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    });
    return NextResponse.json(accounts);
  } catch (err) {
    console.error("Erreur DB /api/accounts GET:", err);
    return NextResponse.json([]);
  }
}

const ACCOUNT_TYPES = ["fixes", "variables", "epargne_investissement", "loisirs_autres", "autre"] as const;

const schema = z.object({
  name: z.string().min(1),
  type: z.enum(ACCOUNT_TYPES).optional(),
  balance: z.number().optional(),
  allocationPct: z.number().nullable().optional(),
  monthlyBudget: z.number().nullable().optional(),
});

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const userId = (session.user as any).id;

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const d = parsed.data;

  try {
    const account = await prisma.bankAccount.create({
      data: {
        userId,
        name: d.name,
        type: d.type ?? "autre",
        balance: d.balance ?? 0,
        allocationPct: d.allocationPct ?? null,
        monthlyBudget: d.monthlyBudget ?? null,
      },
    });
    return NextResponse.json(account, { status: 201 });
  } catch (err: any) {
    if (err?.code === "P2002") {
      return NextResponse.json({ error: "Un compte porte déjà ce nom" }, { status: 409 });
    }
    console.error("Erreur DB /api/accounts POST:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
