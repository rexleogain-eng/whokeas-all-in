"use client";

import Link from "next/link";
import {
  FormEvent,
  useState,
} from "react";

type Props = {
  mode: "login" | "register";
};

export default function AccountAuthForm({
  mode,
}: Props) {
  const registering = mode === "register";

  const [fullName, setFullName] =
    useState("");

  const [email, setEmail] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [busy, setBusy] =
    useState(false);

  const [error, setError] =
    useState("");

  async function submit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setError("");
    setBusy(true);

    try {
      const response = await fetch(
        registering
          ? "/api/customer/register"
          : "/api/customer/login",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            fullName,
            email,
            password,
          }),
        },
      );

      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(
          result.error ||
            "Customer authentication failed.",
        );
      }

      window.location.href = "/account";
    }
    catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Customer authentication failed.",
      );

      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="border border-[#d8cfbf] bg-[#fffdf8] p-6 shadow-[0_18px_55px_rgba(39,31,21,.06)] sm:p-8"
    >
      {registering && (
        <label className="block">
          <span className="mb-2 block text-xs font-bold uppercase tracking-[0.12em]">
            Full name
          </span>

          <input
            required
            autoComplete="name"
            value={fullName}
            onChange={(event) =>
              setFullName(event.target.value)
            }
            className="w-full border border-[#cfc4b1] bg-white px-4 py-3 outline-none focus:border-[#9b762c]"
          />
        </label>
      )}

      <label
        className={
          registering
            ? "mt-5 block"
            : "block"
        }
      >
        <span className="mb-2 block text-xs font-bold uppercase tracking-[0.12em]">
          Email address
        </span>

        <input
          required
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) =>
            setEmail(event.target.value)
          }
          className="w-full border border-[#cfc4b1] bg-white px-4 py-3 outline-none focus:border-[#9b762c]"
        />
      </label>

      <label className="mt-5 block">
        <span className="mb-2 block text-xs font-bold uppercase tracking-[0.12em]">
          Password
        </span>

        <input
          required
          type="password"
          autoComplete={
            registering
              ? "new-password"
              : "current-password"
          }
          value={password}
          onChange={(event) =>
            setPassword(event.target.value)
          }
          className="w-full border border-[#cfc4b1] bg-white px-4 py-3 outline-none focus:border-[#9b762c]"
        />

        {registering && (
          <span className="mt-2 block text-xs leading-5 text-[#746d62]">
            Use at least eight characters, including a
            letter and a number.
          </span>
        )}
      </label>

      {error && (
        <div className="mt-5 border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={busy}
        className="mt-6 w-full bg-[#171512] px-5 py-3.5 text-xs font-black uppercase tracking-[0.16em] text-white hover:bg-[#9b762c] disabled:opacity-60"
      >
        {busy
          ? registering
            ? "Creating account…"
            : "Signing in…"
          : registering
            ? "Create customer account"
            : "Sign in"}
      </button>

      <p className="mt-6 text-center text-sm text-[#746d62]">
        {registering
          ? "Already registered?"
          : "New to WHOKEAS?"}{" "}

        <Link
          href={
            registering
              ? "/account/login"
              : "/account/register"
          }
          className="font-bold text-[#9b762c] hover:text-[#171512]"
        >
          {registering
            ? "Sign in"
            : "Create an account"}
        </Link>
      </p>
    </form>
  );
}