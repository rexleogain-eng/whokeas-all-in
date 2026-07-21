"use client";

import { FormEvent, useState } from "react";

type Props = {
  orderNumber: string;
  existingReference: string | null;
};

export default function PaymentReferenceForm({
  orderNumber,
  existingReference,
}: Props) {
  const [reference, setReference] = useState(existingReference ?? "");
  const [message, setMessage] = useState(
    existingReference ? "Reference already submitted." : "",
  );
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setSubmitting(true);

    try {
      const response = await fetch(
        `/api/orders/${encodeURIComponent(orderNumber)}/payment-reference`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reference }),
        },
      );

      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.error ?? "Could not submit reference.");
      }

      setMessage("Reference submitted. Verification is pending.");
      setSubmitting(false);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not submit reference.",
      );
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-5">
      <label>
        <span className="mb-2 block text-sm font-bold">
          Transaction reference
        </span>
        <input
          required
          maxLength={180}
          value={reference}
          onChange={(event) => setReference(event.target.value)}
          placeholder="Example: ABC123XYZ"
          className="w-full rounded-lg border border-[#cfc4b1] px-4 py-3 outline-none focus:border-[#171512]"
        />
      </label>

      <button
        type="submit"
        disabled={submitting}
        className="mt-3 w-full rounded-full bg-[#171512] text-white px-5 py-3 text-sm font-bold hover:bg-[#9b762c] disabled:opacity-60"
      >
        {submitting ? "Submitting..." : "Submit Reference"}
      </button>

      {message && (
        <p className="mt-3 text-sm font-semibold text-emerald-700">{message}</p>
      )}

      {error && (
        <p className="mt-3 text-sm font-semibold text-red-700">{error}</p>
      )}
    </form>
  );
}