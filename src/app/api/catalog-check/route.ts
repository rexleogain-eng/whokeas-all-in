import { neon } from "@neondatabase/serverless";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL missing");
    }

    const sql = neon(process.env.DATABASE_URL);

    const database = await sql`
      SELECT current_database() AS database_name, current_schema() AS schema_name
    `;

    const catalogue = await sql`
      SELECT slug, name, status::text AS status, price::text AS price
      FROM products
      ORDER BY name
    `;

    return NextResponse.json({
      ok: true,
      database: database[0],
      count: catalogue.length,
      catalogue,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}