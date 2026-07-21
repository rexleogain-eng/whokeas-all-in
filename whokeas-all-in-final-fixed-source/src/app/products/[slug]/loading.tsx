export default function ProductLoading() {
  return (
    <main className="min-h-screen animate-pulse bg-[#eaeded] p-6">
      <div className="mx-auto grid max-w-[1500px] gap-8 bg-white p-6 lg:grid-cols-3">
        <div className="aspect-square rounded-lg bg-slate-200" />
        <div className="space-y-5">
          <div className="h-6 w-1/3 rounded bg-slate-200" />
          <div className="h-12 rounded bg-slate-200" />
          <div className="h-10 w-1/2 rounded bg-slate-200" />
          <div className="h-44 rounded bg-slate-200" />
        </div>
        <div className="h-96 rounded-xl bg-slate-200" />
      </div>
    </main>
  );
}