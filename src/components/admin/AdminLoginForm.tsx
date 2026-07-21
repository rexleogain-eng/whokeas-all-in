"use client";

import { FormEvent, useState } from "react";

export default function AdminLoginForm() {
  const [secret, setSecret] = useState("");
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

      window.location.href = "/admin/orders";
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Login failed.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-7">
      <label>
        <span className="mb-2 block text-sm font-bold">Admin secret</span>
        <input
          required
          type="password"
          autoComplete="current-password"
          value={secret}
          onChange={(event) => setSecret(event.target.value)}
          className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-[#e49b00]"
        />
      </label>

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="mt-5 w-full rounded-full bg-[#ffd814] px-5 py-3 text-sm font-bold hover:bg-[#f7ca00] disabled:opacity-60"
      >
        {submitting ? "Signing in..." : "Open Admin"}
      </button>
    </form>
  );
}