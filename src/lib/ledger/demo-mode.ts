/**
 * In-memory demo when no real Postgres is used (or when forced).
 * - Set USE_DATABASE=true + postgresql:// DATABASE_URL for Prisma.
 * - DEMO_MODE=1 forces demo even if DATABASE_URL is set.
 */
export function isDemoStoreEnabled(): boolean {
  if (process.env.DEMO_MODE === "1" || process.env.DEMO_MODE === "true") {
    return true;
  }
  if (process.env.USE_DATABASE === "true") return false;
  const url = process.env.DATABASE_URL?.trim() ?? "";
  if (!url) return true;
  if (url.startsWith("prisma+postgres:") || url.startsWith("prisma://")) {
    return true;
  }
  return false;
}
