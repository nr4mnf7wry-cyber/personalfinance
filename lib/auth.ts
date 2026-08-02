import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "Email et mot de passe",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Mot de passe", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        // Compte démo — ne touche jamais la base de données.
        // Permet de voir l'interface même si la DB n'est pas encore opérationnelle.
        if (credentials.email === "demo@demo.com" && credentials.password === "demo1234") {
          return { id: "demo-user", email: "demo@demo.com", name: "Démo" };
        }

        try {
          const user = await prisma.user.findUnique({
            where: { email: credentials.email.toLowerCase().trim() },
          });
          if (!user) return null;

          const valid = await bcrypt.compare(credentials.password, user.passwordHash);
          if (!valid) return null;

          return { id: user.id, email: user.email, name: user.name ?? undefined };
        } catch (err) {
          // Base de données indisponible — évite un crash 500 silencieux côté client
          console.error("Erreur DB pendant l'authentification:", err);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.id = (user as any).id;
      return token;
    },
    async session({ session, token }) {
      if (session.user) (session.user as any).id = token.id;
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
