import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

// GET /api/categories -> toutes les catégories de l'utilisateur (tous groupes confondus)
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  try {
    const categories = await prisma.category.findMany({
      where: { userId: (session.user as any).id },
      orderBy: [{ group: "asc" }, { order: "asc" }, { name: "asc" }],
    });
    return NextResponse.json(categories);
  } catch (err) {
    console.error("Erreur DB /api/categories GET:", err);
    return NextResponse.json([]);
  }
}

const schema = z.object({
  group: z.enum(["revenus", "fixes", "variables", "epargne"]),
  name: z.string().min(1),
  expiresAt: z.string().nullable().optional(), // ISO, pour un frais fixe temporaire
  isInvestment: z.boolean().optional(),
  isAdjustment: z.boolean().optional(),
});

// POST /api/categories -> créer une nouvelle catégorie pour l'utilisateur
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
    const category = await prisma.category.create({
      data: {
        userId,
        group: d.group,
        name: d.name.trim(),
        expiresAt: d.expiresAt ? new Date(d.expiresAt) : null,
        isInvestment: d.isInvestment ?? false,
        isAdjustment: d.isAdjustment ?? false,
      },
    });
    return NextResponse.json(category, { status: 201 });
  } catch (err: any) {
    if (err?.code === "P2002") {
      return NextResponse.json({ error: "Une catégorie de ce nom existe déjà dans ce groupe" }, { status: 409 });
    }
    console.error("Erreur DB /api/categories POST:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
