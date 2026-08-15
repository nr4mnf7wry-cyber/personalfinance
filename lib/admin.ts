// Liste d'emails admin définie via la variable d'environnement ADMIN_EMAILS
// (séparés par des virgules), plutôt qu'un flag en base — évite qu'un bug applicatif
// puisse accorder ce statut à quelqu'un ; seul quelqu'un ayant accès aux variables
// d'environnement Vercel peut le faire.
export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  const admins = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return admins.includes(email.toLowerCase());
}
