import Link from "next/link";

export default function ProductNotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#eaeded] p-6">
      <div className="max-w-lg bg-white p-10 text-center shadow-sm">
        <h1 className="text-4xl font-black">Product not found</h1>
        <p className="mt-4 text-slate-600">
          This product may be unavailable, archived or incorrectly linked.
        </p>
        <Link
          href="/#products"
          className="mt-7 inline-block rounded-full bg-[#ffd814] px-6 py-3 text-sm font-bold hover:bg-[#f7ca00]"
        >
          Return to products
        </Link>
      </div>
    </main>
  );
}