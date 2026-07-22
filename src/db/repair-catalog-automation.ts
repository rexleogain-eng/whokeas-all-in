import { config } from "dotenv";

config({ path: ".env.local" });

async function main() {
  const {
    ensureCatalogAutomationSchema,
    getAutomationDashboardData,
  } = await import("@/lib/catalog-automation");
  const { syncFxRates } = await import("@/lib/global-markets");

  await ensureCatalogAutomationSchema();

  let fxStatus: unknown = "cached/fallback";
  try {
    fxStatus = await syncFxRates({ force: true });
  } catch (error) {
    fxStatus = error instanceof Error ? error.message : String(error);
  }

  const data = await getAutomationDashboardData();

  console.log("WHOKEAS global catalogue automation schema is ready.");
  console.log({
    enabled: data.config.enabled,
    autoPublish: data.config.autoPublish,
    categoryRules: data.config.categoryRules.length,
    enabledMarkets: data.config.markets.filter((market) => market.enabled).length,
    primaryMarket: data.config.markets.find((market) => market.primary)?.name,
    cjProducts: data.stats.cjProducts,
    fxStatus,
  });
}

main().catch((error) => {
  console.error("WHOKEAS automation schema repair failed:", error);
  process.exitCode = 1;
});
