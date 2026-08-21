import type { Metadata } from "next";
import Link from "next/link";

import StoreHeader from "@/components/store/StoreHeader";
import {
  RETURN_POLICY_URL,
  SITE_NAME,
  SITE_URL,
  US_RETURN_DAYS,
} from "@/lib/seo";

export const metadata: Metadata = {
  title: "Returns and Refunds Policy",
  description:
    "Read the WHOKEAS ALL IN returns, refunds, exchanges and damaged-item policy for eligible purchases.",
  alternates: {
    canonical: RETURN_POLICY_URL,
  },
  openGraph: {
    type: "website",
    url: RETURN_POLICY_URL,
    siteName: SITE_NAME,
    title: "Returns and Refunds Policy | WHOKEAS ALL IN",
    description:
      "Clear information about return eligibility, the 14-day request window, return shipping and refund processing.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

const effectiveDate = "August 2, 2026";

export default function ReturnsRefundsPage() {
  const policyStructuredData = [
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      "@id": RETURN_POLICY_URL,
      name: "Returns and Refunds Policy",
      url: RETURN_POLICY_URL,
      isPartOf: {
        "@id": `${SITE_URL}/#website`,
      },
      dateModified: "2026-08-21",
      description:
        "WHOKEAS ALL IN returns and refunds policy, including eligibility, return shipping and refund processing.",
    },
    {
      "@context": "https://schema.org",
      "@type": "OnlineStore",
      "@id": `${SITE_URL}/#organization`,
      name: SITE_NAME,
      url: `${SITE_URL}/`,
      hasMerchantReturnPolicy: {
        "@type": "MerchantReturnPolicy",
        "@id": `${RETURN_POLICY_URL}#policy`,
        applicableCountry: "US",
        merchantReturnLink: RETURN_POLICY_URL,
        returnPolicyCategory:
          "https://schema.org/MerchantReturnFiniteReturnWindow",
        merchantReturnDays: US_RETURN_DAYS,
        itemCondition: "https://schema.org/NewCondition",
        returnMethod: "https://schema.org/ReturnByMail",
        returnFees:
          "https://schema.org/ReturnFeesCustomerResponsibility",
        refundType: "https://schema.org/FullRefund",
      },
    },
  ];

  return (
    <main className="min-h-screen bg-[#f4efe6] text-[#1d1914]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(policyStructuredData).replace(/</g, "\\u003c"),
        }}
      />

      <StoreHeader />

      <section className="border-b border-[#d8cfbf] bg-[#171512] text-white">
        <div className="mx-auto max-w-[1320px] px-5 py-14 sm:px-8 sm:py-20">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#d6bd7b]">
            Customer care
          </p>
          <h1 className="mt-4 max-w-4xl font-serif text-5xl font-semibold leading-[0.98] sm:text-7xl">
            Returns &amp; refunds,
            <br />
            explained clearly.
          </h1>
          <p className="mt-6 max-w-2xl text-sm leading-7 text-white/65 sm:text-base">
            Eligible return requests must be started within 14 calendar days
            after confirmed delivery. Please contact WHOKEAS before sending
            anything back so we can provide the correct instructions and
            return address.
          </p>

          <div className="mt-10 grid max-w-3xl gap-px border border-white/15 bg-white/15 sm:grid-cols-3">
            {[
              ["14 days", "Return-request window"],
              ["5–10 days", "Refund processing after approval"],
              ["Order first", "Authorization required before shipping"],
            ].map(([value, label]) => (
              <div key={label} className="bg-[#171512] p-5">
                <p className="font-serif text-2xl text-[#d6bd7b]">{value}</p>
                <p className="mt-2 text-[10px] uppercase tracking-[0.14em] text-white/50">
                  {label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-[1320px] gap-8 px-5 py-12 sm:px-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:py-16">
        <article className="space-y-7">
          <section className="border border-[#d8cfbf] bg-[#fffdf8] p-6 sm:p-9">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#9b762c]">
              01 · Eligibility
            </p>
            <h2 className="mt-3 font-serif text-3xl font-semibold">
              What may be returned
            </h2>
            <div className="mt-5 space-y-4 text-sm leading-7 text-[#625b52]">
              <p>
                A return request must be submitted within 14 calendar days
                after the order is marked delivered. The item must be unused,
                unworn, unwashed, complete, and returned with its original
                packaging, labels, accessories and proof of purchase.
              </p>
              <p>
                Eligible reasons include receiving a damaged, defective,
                incorrect or materially different item. Change-of-mind returns
                may also be accepted when the product remains in resalable
                condition and is not excluded below.
              </p>
            </div>
          </section>

          <section className="border border-[#d8cfbf] bg-[#fffdf8] p-6 sm:p-9">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#9b762c]">
              02 · Start a request
            </p>
            <h2 className="mt-3 font-serif text-3xl font-semibold">
              Contact us before returning the item
            </h2>
            <div className="mt-5 space-y-4 text-sm leading-7 text-[#625b52]">
              <p>
                Send your order number, the email or phone number used for the
                purchase, the reason for the request, and clear photos or video
                when the item is damaged, defective or incorrect.
              </p>
              <p>
                Use the support channel shown on your order confirmation or
                customer account. WHOKEAS will review the request and provide
                the correct return address and instructions. Do not send an
                item to a supplier, warehouse or other address without written
                authorization.
              </p>
            </div>

            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/account" className="classic-button-dark">
                Open customer account
              </Link>
              <Link href="/#support" className="classic-button-light">
                View store support
              </Link>
            </div>
          </section>

          <section className="border border-[#d8cfbf] bg-[#fffdf8] p-6 sm:p-9">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#9b762c]">
              03 · Return shipping
            </p>
            <h2 className="mt-3 font-serif text-3xl font-semibold">
              Who pays the return cost
            </h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="border border-[#d8cfbf] bg-[#f7f2e9] p-5">
                <h3 className="font-serif text-xl font-semibold">
                  WHOKEAS error or product fault
                </h3>
                <p className="mt-3 text-sm leading-7 text-[#625b52]">
                  When an approved claim concerns a damaged, defective,
                  incorrect or materially different item, WHOKEAS will arrange
                  a replacement, refund or reasonable return-shipping solution.
                </p>
              </div>
              <div className="border border-[#d8cfbf] bg-[#f7f2e9] p-5">
                <h3 className="font-serif text-xl font-semibold">
                  Change of mind
                </h3>
                <p className="mt-3 text-sm leading-7 text-[#625b52]">
                  The customer is responsible for approved change-of-mind
                  return shipping. Original delivery charges, when separately
                  charged, are not refundable unless WHOKEAS caused the issue.
                </p>
              </div>
            </div>
          </section>

          <section className="border border-[#d8cfbf] bg-[#fffdf8] p-6 sm:p-9">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#9b762c]">
              04 · Refunds and replacements
            </p>
            <h2 className="mt-3 font-serif text-3xl font-semibold">
              What happens after approval
            </h2>
            <div className="mt-5 space-y-4 text-sm leading-7 text-[#625b52]">
              <p>
                After the returned item or required evidence has been received
                and inspected, approved refunds are initiated within 5–10
                business days. Your bank, card provider or mobile-money
                provider may require additional time to post the funds.
              </p>
              <p>
                Refunds are sent to the original payment method where possible.
                For manual bank or mobile-money payments, WHOKEAS may request
                verification before sending funds to an account belonging to
                the purchaser. Replacement availability depends on supplier
                stock.
              </p>
            </div>
          </section>

          <section className="border border-[#d8cfbf] bg-[#fffdf8] p-6 sm:p-9">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#9b762c]">
              05 · Exclusions
            </p>
            <h2 className="mt-3 font-serif text-3xl font-semibold">
              Items that cannot normally be returned
            </h2>
            <ul className="mt-5 space-y-3 text-sm leading-7 text-[#625b52]">
              <li>• Personalized or custom-made products.</li>
              <li>
                • Opened hygiene-sensitive, personal-care or intimate products
                where return would be unsafe.
              </li>
              <li>
                • Products damaged through misuse, improper installation,
                unauthorized modification or normal wear.
              </li>
              <li>
                • Items missing essential packaging, accessories, labels or
                serial-number information.
              </li>
              <li>
                • Final-sale items when the product page clearly identified
                them as non-returnable before purchase.
              </li>
            </ul>
            <p className="mt-5 text-sm leading-7 text-[#625b52]">
              These exclusions do not remove rights that cannot legally be
              excluded. WHOKEAS reviews damaged, defective and incorrect-item
              claims individually.
            </p>
          </section>

          <section className="border border-[#d8cfbf] bg-[#fffdf8] p-6 sm:p-9">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#9b762c]">
              06 · Cancellations
            </p>
            <h2 className="mt-3 font-serif text-3xl font-semibold">
              Contact us as soon as possible
            </h2>
            <p className="mt-5 text-sm leading-7 text-[#625b52]">
              Cancellation requests are considered before supplier fulfilment
              begins. Once an order has entered processing, shipped or incurred
              supplier costs, cancellation may no longer be possible and the
              return rules above will apply after delivery.
            </p>
          </section>
        </article>

        <aside className="space-y-5 lg:sticky lg:top-44 lg:h-fit">
          <section className="border border-[#2a261f] bg-[#171512] p-6 text-white">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#d6bd7b]">
              Return checklist
            </p>
            <ol className="mt-5 space-y-4 text-sm leading-6 text-white/65">
              <li>
                <span className="mr-2 text-[#d6bd7b]">01</span>
                Keep the item and packaging.
              </li>
              <li>
                <span className="mr-2 text-[#d6bd7b]">02</span>
                Take clear photos or video.
              </li>
              <li>
                <span className="mr-2 text-[#d6bd7b]">03</span>
                Send the order number and reason.
              </li>
              <li>
                <span className="mr-2 text-[#d6bd7b]">04</span>
                Wait for written return instructions.
              </li>
            </ol>
          </section>

          <section className="border border-[#d8cfbf] bg-[#fffdf8] p-6">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#9b762c]">
              Policy details
            </p>
            <dl className="mt-5 space-y-4 text-sm">
              <div>
                <dt className="text-[#857d72]">Return window</dt>
                <dd className="mt-1 font-semibold">14 calendar days</dd>
              </div>
              <div>
                <dt className="text-[#857d72]">Return method</dt>
                <dd className="mt-1 font-semibold">
                  By mail after authorization
                </dd>
              </div>
              <div>
                <dt className="text-[#857d72]">Restocking fee</dt>
                <dd className="mt-1 font-semibold">None</dd>
              </div>
              <div>
                <dt className="text-[#857d72]">Effective date</dt>
                <dd className="mt-1 font-semibold">{effectiveDate}</dd>
              </div>
            </dl>
          </section>
        </aside>
      </div>

      <footer className="border-t border-white/10 bg-[#12110f] text-white">
        <div className="mx-auto flex max-w-[1320px] flex-col gap-4 px-5 py-8 text-sm text-white/55 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p>© 2026 WHOKEAS ALL IN</p>
          <div className="flex flex-wrap gap-5">
            <Link href="/products" className="hover:text-white">
              Products
            </Link>
            <Link href="/account" className="hover:text-white">
              Account
            </Link>
            <Link href="/returns-refunds" className="text-[#d6bd7b]">
              Returns &amp; refunds
            </Link>
            <Link href="/shipping-delivery" className="hover:text-white">
              Shipping
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
