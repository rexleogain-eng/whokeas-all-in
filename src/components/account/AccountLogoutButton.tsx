"use client";

import { useState } from "react";

export default function AccountLogoutButton() {
  const [busy, setBusy] = useState(false);

  async function logout() {
    setBusy(true);

    try {
      await fetch("/api/customer/logout", {
        method: "POST",
      });
    }
    finally {
      window.location.href = "/";
    }
  }

  return (
    <button
      type="button"
      onClick={logout}
      disabled={busy}
      className="border border-[#2a261f] bg-[#2a261f] px-4 py-2.5 text-xs font-black uppercase tracking-[0.14em] text-white disabled:opacity-60"
    >
      {busy ? "Signing out…" : "Sign out"}
    </button>
  );
}