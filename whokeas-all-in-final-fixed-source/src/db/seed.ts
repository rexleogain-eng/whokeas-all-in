import { eq } from "drizzle-orm";
import { db } from "../lib/db";
import { categories, products } from "./schema";

async function seed() {
  await db
    .insert(categories)
    .values([
      {
        name: "Tech",
        slug: "tech",
        description: "Technology and useful digital accessories.",
      },
      {
        name: "Study",
        slug: "study",
        description: "Study tools and productivity essentials.",
      },
      {
        name: "Fashion",
        slug: "fashion",
        description: "Style, apparel and WHOKEAS originals.",
      },
      {
        name: "Home",
        slug: "home",
        description: "Useful products for modern homes.",
      },
    ])
    .onConflictDoNothing({ target: categories.slug });

  const allCategories = await db.select().from(categories);
  const categoryId = Object.fromEntries(
    allCategories.map((category) => [category.slug, category.id]),
  );

  await db
    .insert(products)
    .values([
      {
        categoryId: categoryId.tech,
        name: "Wireless Earbuds",
        slug: "wireless-earbuds",
        shortDescription: "Compact wireless audio for calls, music and travel.",
        status: "active",
        price: "45000",
        baseCost: "28000",
        currency: "TZS",
        isFeatured: true,
      },
      {
        categoryId: categoryId.tech,
        name: "Foldable Laptop Stand",
        slug: "foldable-laptop-stand",
        shortDescription: "Portable adjustable support for work and study.",
        status: "active",
        price: "39000",
        baseCost: "24000",
        currency: "TZS",
        isFeatured: true,
      },
      {
        categoryId: categoryId.study,
        name: "Focus Study Lamp",
        slug: "focus-study-lamp",
        shortDescription: "A compact desk light for focused evening study.",
        status: "active",
        price: "32000",
        baseCost: "19000",
        currency: "TZS",
        isFeatured: true,
      },
      {
        categoryId: categoryId.study,
        name: "Desk Organizer",
        slug: "desk-organizer",
        shortDescription: "Keep study and office essentials arranged.",
        status: "active",
        price: "29000",
        baseCost: "17000",
        currency: "TZS",
        isFeatured: false,
      },
      {
        categoryId: categoryId.fashion,
        name: "WAI Signature Tee",
        slug: "wai-signature-tee",
        shortDescription: "Original WHOKEAS ALL IN branded apparel.",
        status: "active",
        price: "49000",
        baseCost: "30000",
        currency: "TZS",
        isFeatured: true,
      },
      {
        categoryId: categoryId.home,
        name: "Smart Storage Set",
        slug: "smart-storage-set",
        shortDescription: "Simple modular storage for everyday spaces.",
        status: "active",
        price: "36000",
        baseCost: "22000",
        currency: "TZS",
        isFeatured: false,
      },
    ])
    .onConflictDoNothing({ target: products.slug });

  const total = await db.select().from(products);

  console.log(`Seed completed. ${total.length} products are available.`);
}

seed()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });