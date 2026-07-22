import { NextResponse } from "next/server";

import { isAdmin } from "@/lib/admin-auth";
import {
  CJProductAlreadyImportedError,
  importCJProduct,
} from "@/lib/cj-import";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type ImportInput = {
  pid?: string;
  usdToTzsRate?: number;
  marginPercent?: number;
  reserveTzs?: number;
  inventoryHint?: number;
};

export async function POST(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized." },
      { status: 401 },
    );
  }

  try {
    const body = (await request.json()) as ImportInput;
    const product = await importCJProduct({
      pid: String(body.pid || ""),
      inventoryHint: body.inventoryHint,
      source: "manual",
      autoPublish: false,
      usdToTzsRate: body.usdToTzsRate,
      marginPercent: body.marginPercent,
      reserveTzs: body.reserveTzs,
    });

    return NextResponse.json({ ok: true, product });
  } catch (error) {
    if (error instanceof CJProductAlreadyImportedError) {
      return NextResponse.json(
        {
          ok: false,
          error: error.message,
          existingProductId: error.existingProductId,
          existingSlug: error.existingSlug,
        },
        { status: 409 },
      );
    }

    const message = error instanceof Error ? error.message : String(error);
    console.error("CJ import failed", { message, error });

    return NextResponse.json(
      {
        ok: false,
        error: `CJ import failed: ${message}`,
      },
      { status: 500 },
    );
  }
}
