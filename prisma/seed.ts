/**
 * Chart of accounts seed. Requires a direct PostgreSQL URL (see below).
 */
import "dotenv/config";
import { AccountType, PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

const accounts: { code: string; name: string; type: AccountType }[] = [
  { code: "1000", name: "Cash", type: AccountType.ASSET },
  { code: "1010", name: "Bank — Operating", type: AccountType.ASSET },
  { code: "1200", name: "Accounts Receivable", type: AccountType.ASSET },
  { code: "2000", name: "Accounts Payable", type: AccountType.LIABILITY },
  { code: "2100", name: "Sales Tax Payable", type: AccountType.LIABILITY },
  { code: "3000", name: "Retained Earnings", type: AccountType.EQUITY },
  { code: "4000", name: "Subscription Revenue", type: AccountType.REVENUE },
  { code: "4100", name: "Services Revenue", type: AccountType.REVENUE },
  { code: "5000", name: "Software & SaaS Expense", type: AccountType.EXPENSE },
  { code: "5100", name: "Bank Fees", type: AccountType.EXPENSE },
];

function explainDbUrl(): string {
  const url = process.env.DATABASE_URL ?? "";
  if (url.startsWith("prisma+postgres:") || url.startsWith("prisma://")) {
    return [
      "DATABASE_URL uses a Prisma Data Proxy / prisma+postgres URL.",
      "The seed talks to Postgres directly: use a standard URL, e.g.",
      '  DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/autonomous_accounting"',
      "Then run: npx prisma migrate deploy",
      "",
      "If you use Prisma Local development database, start it first, or switch to Docker Postgres.",
    ].join("\n");
  }
  return [
    "Could not connect to the database.",
    "Check DATABASE_URL, that PostgreSQL is running, and that migrations are applied:",
    "  npx prisma migrate deploy",
  ].join("\n");
}

async function main() {
  if (!process.env.DATABASE_URL?.trim()) {
    throw new Error(
      'DATABASE_URL is missing. Set it in .env (see .env.example).',
    );
  }

  for (const a of accounts) {
    await prisma.account.upsert({
      where: { code: a.code },
      create: a,
      update: { name: a.name, type: a.type },
    });
  }

  console.log(`Seeded ${accounts.length} accounts.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === "P5010" || e.code === "P1001") {
        console.error(explainDbUrl());
        console.error("\n(Prisma error code: %s)", e.code);
      } else if (e.code === "P2021") {
        console.error(
          [
            "Tables are missing. Apply migrations first:",
            "  npx prisma migrate deploy",
          ].join("\n"),
        );
      } else {
        console.error(e);
      }
    } else {
      console.error(e);
    }
    prisma.$disconnect();
    process.exit(1);
  });
