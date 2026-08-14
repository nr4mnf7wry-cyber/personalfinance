import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export const SHARING_MODULES = ["entries", "investments", "private_investments", "debts", "accounts", "goals"] as const;

// GET /api/household/sharing -> mes paramètres de partage, avec valeur par défaut
// (false = privé) pour les modules que je n'ai pas encore configurés explicitement
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const userId = (session.user as any).id;

  const settings = await prisma.sharingSetting.findMany({ where: { userId } });
  const map = new Map(settings.map((s) => [s.module, s.visible]));

  const result = SHARING_MODULES.map((m) => ({ module: m, visible: map.get(m) ?? false }));
  return NextResponse.json(result);
}

const schema = z.object({
  module: z.enum(SHARING_MODULES),
  visible: z.boolean(),
});

// PATCH /api/household/sharing -> change la visibilité d'UN module pour l'utilisateur courant
// (toujours soi-même : impossible de modifier le paramètre d'un autre membre)
export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const userId = (session.user as any).id;

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const { module: mod, visible } = parsed.data;

  const setting = await prisma.sharingSetting.upsert({
    where: { userId_module: { userId, module: mod } },
    update: { visible },
    create: { userId, module: mod, visible },
  });

  return NextResponse.json(setting);
}
