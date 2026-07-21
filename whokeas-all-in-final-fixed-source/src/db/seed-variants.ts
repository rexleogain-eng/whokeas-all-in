import { db } from "../lib/db";
import { products, productVariants } from "./schema";

const variantMap: Record<
  string,
  Array<{ name: string; sku: string; stockQuantity: number }>
> = {
  "wireless-earbuds": [
    { name: "Black", sku: "WAI-EARBUD-BLK", stockQuantity: 25 },
    { name: "White", sku: "WAI-EARBUD-WHT", stockQuantity: 18 },
  ],
  "foldable-laptop-stand": [
    { name: "Silver", sku: "WAI-STAND-SLV", stockQuantity: 30 },
    { name: "Black", sku: "WAI-STAND-BLK", stockQuantity: 22 },
  ],
  "focus-study-lamp": [
    { name: "White", sku: "WAI-LAMP-WHT", stockQuantity: 20 },
    { name: "Black", sku: "WAI-LAMP-BLK", stockQuantity: 16 },
  ],
  "desk-organizer": [
    { name: "Black", sku: "WAI-ORG-BLK", stockQuantity: 20 },
    { name: "Beige", sku: "WAI-ORG-BGE", stockQuantity: 14 },
  ],
  "wai-signature-tee": [
    { name: "Black / Small", sku: "WAI-TEE-BLK-S", stockQuantity: 12 },
    { name: "Black / Medium", sku: "WAI-TEE-BLK-M", stockQuantity: 18 },
    { name: "Black / Large", sku: "WAI-TEE-BLK-L", stockQuantity: 16 },
    { name: "Black / XL", sku: "WAI-TEE-BLK-XL", stockQuantity: 10 },
  ],
  "smart-storage-set": [
    { name: "3-piece set", sku: "WAI-STORAGE-3PC", stockQuantity: 15 },
  ],
};

async function seedVariants() {
  const allProducts = await db.select().from(products);

  for (const product of allProducts) {
    const variants = variantMap[product.slug] ?? [
      {
        name: "Standard",
        sku: `WAI-${product.slug.toUpperCase().slice(0, 20)}`,
        stockQuantity: 10,
      },
    ];

    await db
      .insert(productVariants)
      .values(
        variants.map((variant) => ({
          productId: product.id,
          name: variant.name,
          sku: variant.sku,
          cost: product.baseCost ?? "0",
          price: product.price,
          stockQuantity: variant.stockQuantity,
          isActive: true,
        })),
      )
      .onConflictDoNothing({ target: productVariants.sku });
  }

  console.log("Product variants seeded successfully.");
}

seedVariants()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });