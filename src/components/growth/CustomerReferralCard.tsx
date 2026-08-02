"use client";

import { useState } from "react";

type Props = {
  referralCode: string;
  referralLink: string;
  storeCreditBalance: number;
};

function formatTzs(value: number) {
  return `TZS ${Math.round(value || 0).toLocaleString("en-US")}`;
}

export default function CustomerReferralCard({
  referralCode,
  referralLink,
  storeCreditBalance,
}: Props) {
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    }
    catch {
      setCopied(false);
    }
  }

  const message = encodeURIComponent(
    `Shop with WHOKEAS ALL IN using my referral link: ${referralLink}`,
  );

  return (
    <article className="border border-[#d8cfbf] bg-[#171512] p-6 text-white">
      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#d6bd7b]">
        Refer and earn
      </p>

      <h2 className="mt-3 font-serif text-3xl font-normal">
        Share WHOKEAS. Earn store credit.
      </h2>

      <p className="mt-4 text-sm leading-6 text-white/65">
        A new customer receives a first-order referral discount.
        Your reward is posted after their order is delivered.
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <div className="border border-white/15 bg-white/[0.04] p-4">
          <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-white/45">
            Referral code
          </p>
          <p className="mt-2 font-mono text-lg font-bold text-[#d6bd7b]">
            {referralCode}
          </p>
        </div>

        <div className="border border-white/15 bg-white/[0.04] p-4">
          <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-white/45">
            Available store credit
          </p>
          <p className="mt-2 font-serif text-2xl text-[#d6bd7b]">
            {formatTzs(storeCreditBalance)}
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={copyLink}
          className="border border-[#d6bd7b] bg-[#d6bd7b] px-4 py-3 text-[10px] font-black uppercase tracking-[0.14em] text-[#171512]"
        >
          {copied ? "Link copied" : "Copy referral link"}
        </button>

        <a
          href={`https://wa.me/?text=${message}`}
          target="_blank"
          rel="noreferrer"
          className="border border-white/20 px-4 py-3 text-[10px] font-black uppercase tracking-[0.14em] text-white hover:border-white/50"
        >
          Share on WhatsApp
        </a>
      </div>
    </article>
  );
}
