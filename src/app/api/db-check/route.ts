import { neon } from "@neondatabase/serverless";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
      throw new Error("DATABASE_URL is missing");
    }

    const sql = neon(connectionString);
    const result = await sql`SELECT NOW() AS server_time`;

    return NextResponse.json({
      ok: true,
      database: "connected",
      serverTime: result[0].server_time,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
