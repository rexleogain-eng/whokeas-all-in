import type { Metadata } from "next";
import Link from "next/link";

import StoreHeader from "@/components/store/StoreHeader";
import StoreProductCard from "@/components/store/StoreProductCard";
import { getStoreProducts } from "@/lib/store-catalog";
import { storefrontFocusScore } from "@/lib/store-copy";
import { SITE_URL } from "@/lib/seo";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Bluetooth FM Transmitter With Car Charger | WHOKEAS Buyer Guide",
  description:
    "A practical guide to choosing a Bluetooth FM transmitter with car charging, including signal setup, ports, hands-free use and everyday convenience.",
  alternates: { canonical: `${SITE_URL}/guides/bluetooth-fm-transmitter-car-charger` },
  robots: { index: true, follow: true },
  openGraph: {
    title: "Bluetooth FM Transmitter With Car Charger | WHOKEAS Buyer Guide",
    description:
      "What to look for when adding Bluetooth audio and charging to an older car through an FM transmitter.",
    url: `${SITE_URL}/guides/bluetooth-fm-transmitter-car-charger`,
    type: "article",
  },
};

export default async function BluetoothFmGuide() {
  const products = await getStoreProducts({ query: "fm transmitter", limit: 16, sort: "newest" });
  const picks = products
    .filter((product) => /fm\s*transmitter/i.test(String(product.name || "")))
    .sort((a, b) => storefrontFocusScore(b) - storefrontFocusScore(a))
    .slice(0, 4);

  return (
    <main className="min-h-screen bg-[#f4efe6] text-[#1d1914]">
      <StoreHeader />

      <article>
        <header className="border-b border-[#d8cfbf] bg-[#171512] px-6 py-16 text-white sm:py-20">
          <div className="mx-auto max-w-4xl">
            <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#d6bd7b]">WHOKEAS BUYER GUIDE · CAR AUDIO</p>
            <h1 className="mt-5 text-4xl font-normal leading-[1.05] tracking-[-0.03em] sm:text-6xl">
              Bluetooth FM Transmitter With Car Charger: What to Look For
            </h1>
            <p className="mt-6 max-w-3xl text-sm leading-8 text-white/70 sm:text-base">
              An FM transmitter can add wireless audio to an older car without replacing the stereo. The useful models also keep charging simple and put the controls where you can reach them easily.
            </p>
          </div>
        </header>

        <div className="mx-auto max-w-4xl px-6 py-12 sm:py-16">
          <section className="space-y-5 text-sm leading-8 text-[#5f584d] sm:text-base">
            <h2 className="text-3xl font-normal text-[#1d1914]">How it works</h2>
            <p>
              The transmitter plugs into the car&apos;s accessory power socket, connects to your phone over Bluetooth and sends the audio to an unused FM frequency. You tune the car radio to the same frequency, then use the car speakers for music, podcasts or calls.
            </p>
            <p>
              The experience depends heavily on setup. A clear unused frequency, stable Bluetooth connection and easy-to-reach controls matter more than a long list of marketing features.
            </p>
          </section>

          <section className="mt-12 border-y border-[#d8cfbf] py-10">
            <h2 className="text-3xl font-normal">The features that matter most</h2>
            <div className="mt-7 grid gap-5 sm:grid-cols-2">
              {[
                ["Clear frequency controls", "Changing the FM frequency should be quick and obvious so you can move away from local radio interference when needed."],
                ["USB charging ports", "A transmitter with useful USB-A or USB-C charging can replace a separate car charger and keep the power socket doing two jobs."],
                ["Hands-free controls", "Large, simple call and playback controls are easier to use than tiny multi-function buttons while parked or before you start driving."],
                ["Readable display", "A small display should show the selected frequency clearly without becoming distracting at night."],
                ["Secure fit", "The plug should sit firmly in the accessory socket so bumps and normal driving do not interrupt power or audio."],
                ["Simple pairing", "A transmitter that reconnects reliably to your phone reduces setup friction every time you get into the car."],
              ].map(([title, text]) => (
                <div key={title} className="border border-[#d8cfbf] bg-[#fffdf8] p-5">
                  <h3 className="text-lg font-normal text-[#1d1914]">{title}</h3>
                  <p className="mt-2 text-sm leading-7 text-[#746d62]">{text}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-12 space-y-5 text-sm leading-8 text-[#5f584d] sm:text-base">
            <h2 className="text-3xl font-normal text-[#1d1914]">When an FM transmitter makes sense</h2>
            <p>
              It is especially useful when the car stereo still works well but does not have Bluetooth audio. It can be a simpler and lower-cost upgrade than replacing the head unit just to stream audio from a phone.
            </p>
            <p>
              If your car already has reliable Bluetooth audio, Apple CarPlay or Android Auto, an FM transmitter may add little value unless you specifically need extra charging ports.
            </p>
          </section>

          {picks.length > 0 && (
            <section className="mt-14">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#9b762c]">CURRENT WHOKEAS OPTIONS</p>
                  <h2 className="mt-3 text-3xl font-normal">Current FM transmitter picks</h2>
                </div>
                <Link href="/shop/car-fm-transmitters" className="classic-button-light">See all car audio</Link>
              </div>
              <div className="mt-7 grid grid-cols-2 gap-3 md:grid-cols-4">
                {picks.map((product) => (
                  <StoreProductCard key={product.id} product={product} />
                ))}
              </div>
            </section>
          )}

          <section className="mt-14 border border-[#c9b98f] bg-[#fffdf8] p-7 sm:p-9">
            <h2 className="text-2xl font-normal">The simple decision rule</h2>
            <p className="mt-4 text-sm leading-7 text-[#746d62]">
              Choose the transmitter that gives you stable Bluetooth, easy frequency control and the charging ports you actually need. Those everyday details are usually more important than extra modes you may never use.
            </p>
            <Link href="/shop/car-fm-transmitters" className="mt-7 inline-block text-xs font-bold uppercase tracking-[0.14em] text-[#8a6824] hover:text-[#171512]">
              Shop Bluetooth FM transmitters →
            </Link>
          </section>
        </div>
      </article>
    </main>
  );
}
