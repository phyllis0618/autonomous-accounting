# Autonomous accounting pipeline

Multi-stage AI agent for accounting: **extract** → **chart-of-accounts match** → **auditor** → **ledger** (Next.js 15, Prisma, Zod, optional OpenAI/Anthropic).

## Quick start (demo, no database)

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). In-memory demo includes two sample traces; new runs use the mock LLM unless API keys are set.

## PostgreSQL

Copy `.env.example` to `.env`, set `USE_DATABASE=true` and `DATABASE_URL`, then:

```bash
npx prisma migrate deploy
npm run db:seed
npm run dev
```

## Scripts

| Command | Description |
|--------|-------------|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run db:setup` | `migrate deploy` + `seed` |

## License

Private / your choice.
