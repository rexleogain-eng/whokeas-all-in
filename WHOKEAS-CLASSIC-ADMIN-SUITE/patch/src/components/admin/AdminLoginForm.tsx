"use client";

import { FormEvent, useState } from "react";

export default function AdminLoginForm() {
  const [secret, setSecret] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret }),
      });

      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.error ?? "Login failed.");
      }

      window.location.href = "/admin";
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Login failed.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <label>
        <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.2em] text-[#665e54]">
          Administrator secret
        </span>
        <div className="flex border border-[#cfc5b5] bg-white focus-within:border-[#9a7534] focus-within:ring-2 focus-within:ring-[#b9944d]/15">
          <input
            required
            type={showSecret ? "text" : "password"}
            autoComplete="current-password"
            value={secret}
            onChange={(event) => setSecret(event.target.value)}
            className="min-w-0 flex-1 bg-transparent px-4 py-3.5 text-sm outline-none"
            placeholder="Enter private access secret"
          />
          <button
            type="button"
            onClick={() => setShowSecret((current) => !current)}
            className="border-l border-[#ddd4c7] px-4 text-[10px] font-black uppercase tracking-[0.13em] text-[#756d62] hover:bg-[#f7f3eb]"
          >
            {showSecret ? "Hide" : "Show"}
          </button>
        </div>
      </label>

      {error && (
        <div className="mt-4 border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="mt-5 w-full border border-[#1b1814] bg-[#1b1814] px-5 py-3.5 text-xs font-black uppercase tracking-[0.18em] text-white transition hover:bg-[#2a251e] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? "Verifying access..." : "Enter management office"}
      </button>
    </form>
  );
}
