import { catalogSql, ensureCatalogSchema } from "@/lib/catalog-schema";
import {
  ensureCompetitivePricingSchema,
  runCompetitiveRepricing,
} from "@/lib/competitive-pricing";

const BOOTSTRAP_KEY = "competitor-aware-pricing-v1-bootstrap";

let bootstrapPromise:
  | Promise<Awaited<ReturnType<typeof runCompetitiveRepricing>> | null>
  | null = null;

export async function bootstrapCompetitivePricing() {
  if (!bootstrapPromise) {
    bootstrapPromise = (async () => {
      await ensureCatalogSchema();
      const sql = catalogSql();

      const existing = await sql`
        SELECT migration_key
        FROM store_policy_migrations
        WHERE migration_key = ${BOOTSTRAP_KEY}
        LIMIT 1
      `;

      if (existing.length > 0) return null;

      await ensureCompetitivePricingSchema();

      // Claim the one-time bootstrap before repricing so simultaneous homepage
      // requests cannot run the same catalogue-wide update more than once.
      const claimed = await sql`
        INSERT INTO store_policy_migrations (migration_key)
        VALUES (${BOOTSTRAP_KEY})
        ON CONFLICT (migration_key) DO NOTHING
        RETURNING migration_key
      `;

      if (claimed.length === 0) return null;

      try {
        return await runCompetitiveRepricing({ trigger: "benchmark" });
      } catch (error) {
        // Allow a later request to retry if the first bootstrap failed.
        await sql`
          DELETE FROM store_policy_migrations
          WHERE migration_key = ${BOOTSTRAP_KEY}
        `;
        throw error;
      }
    })().catch((error) => {
      bootstrapPromise = null;
      throw error;
    });
  }

  return bootstrapPromise;
}
