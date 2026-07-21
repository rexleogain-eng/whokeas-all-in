import { NextResponse } from "next/server";

import { isAdmin } from "@/lib/admin-auth";
import { cjNumber, cjRequest } from "@/lib/cj";

export const dynamic = "force-dynamic";

type CJSearchProduct = {
  id?: string;
  pid?: string;
  nameEn?: string;
  productNameEn?: string;
  sku?: string;
  productSku?: string;
  bigImage?: string;
  productImage?: string;
  sellPrice?: string | number;
  nowPrice?: string | number;
  discountPrice?: string | number;
  categoryId?: string;
  categoryName?: string;
  oneCategoryName?: string;
  twoCategoryName?: string;
  threeCategoryName?: string;
  supplierName?: string;
  warehouseInventoryNum?: number;
  totalVerifiedInventory?: number;
  listedNum?: number;
  deliveryCycle?: string;
};

type CJSearchGroup = {
  productList?: CJSearchProduct[];
};

type CJSearchResponse = {
  content?: CJSearchGroup[];
  list?: CJSearchProduct[];
  totalRecords?: number;
  total?: number;
  totalPages?: number;
};

export async function GET(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized." },
      { status: 401 },
    );
  }

  try {
    const url = new URL(request.url);
    const query = (url.searchParams.get("q") || "").trim().slice(0, 120);
    const page = Math.max(1, Math.min(1000, Number(url.searchParams.get("page") || 1)));

    if (query.length < 2) {
      return NextResponse.json(
        { ok: false, error: "Enter at least two search characters." },
        { status: 400 },
      );
    }

    const params = new URLSearchParams({
      page: String(page),
      size: "20",
      keyWord: query,
      orderBy: "0",
      sort: "desc",
    });

    const data = await cjRequest<CJSearchResponse>(
      `/v1/product/listV2?${params.toString()}`,
    );

    const products = Array.isArray(data.content)
      ? data.content.flatMap((group) =>
          Array.isArray(group.productList) ? group.productList : [],
        )
      : Array.isArray(data.list)
        ? data.list
        : [];

    const normalized = products
      .map((product) => {
        const pid = product.id || product.pid || "";
        const price = cjNumber(
          product.discountPrice ??
            product.nowPrice ??
            product.sellPrice,
        );

        return {
          pid,
          name:
            product.nameEn ||
            product.productNameEn ||
            "Unnamed CJ product",
          sku: product.sku || product.productSku || "",
          image: product.bigImage || product.productImage || "",
          priceUsd: price,
          category:
            product.threeCategoryName ||
            product.categoryName ||
            product.twoCategoryName ||
            product.oneCategoryName ||
            "General",
          supplierName: product.supplierName || "CJdropshipping",
          inventory:
            product.totalVerifiedInventory ??
            product.warehouseInventoryNum ??
            0,
          listedNum: product.listedNum ?? 0,
          deliveryCycle: product.deliveryCycle || null,
        };
      })
      .filter((product) => product.pid);

    return NextResponse.json({
      ok: true,
      products: normalized,
      page,
      total: data.totalRecords ?? data.total ?? normalized.length,
      totalPages: data.totalPages ?? null,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "CJ product search failed.",
      },
      { status: 500 },
    );
  }
}