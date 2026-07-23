import { config } from "dotenv";

config({ path: ".env.local" });

async function main() {
  const {
    ensureCatalogueExpansionSchema,
    getCatalogueExpansionDashboard,
  } = await import("../lib/catalogue-expansion");

  await ensureCatalogueExpansionSchema();
  const dashboard = await getCatalogueExpansionDashboard();

  console.log("WHOKEAS safe catalogue expansion schema is ready.");
  console.log({
    target: dashboard.stats.targetTotal,
    realSupplierProducts: dashboard.stats.realSupplierProducts,
    queued: dashboard.stats.queued,
    trialCandidates: dashboard.stats.trialCandidates,
    batchSize: dashboard.config.processBatchSize,
    minimumInventory: dashboard.config.minimumInventory,
    fixedGrossMarginPercent: 30,
  });
}

main().catch((error) => {
  console.error("Catalogue expansion migration failed:", error);
  process.exitCode = 1;
});
