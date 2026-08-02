import { config } from "dotenv";

config({ path: ".env.local" });

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is missing from .env.local",
    );
  }

  const {
    ensureGrowthSchema,
  } = await import("../lib/growth-revenue");

  await ensureGrowthSchema();

  console.log(
    "WHOKEAS Growth & Revenue schema is ready.",
  );
}

main().catch((error: unknown) => {
  console.error(
    "WHOKEAS Growth & Revenue schema migration failed:",
    error,
  );
  process.exitCode = 1;
});
