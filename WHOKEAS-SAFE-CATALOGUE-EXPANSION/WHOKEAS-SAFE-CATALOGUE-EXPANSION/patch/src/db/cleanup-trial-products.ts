import { config } from "dotenv";

config({ path: ".env.local" });

async function main() {
  const { cleanTrialProducts } = await import("../lib/catalogue-expansion");
  const report = await cleanTrialProducts({ trigger: "installer" });

  console.log("WHOKEAS trial-product cleanup completed.");
  console.log(report);
}

main().catch((error) => {
  console.error("Trial-product cleanup failed:", error);
  process.exitCode = 1;
});
