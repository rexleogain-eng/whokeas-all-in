WHOKEAS ALL IN — Admin Hydration Fix, 30% Gross Margin and Publish

1. Stop npm run dev with Ctrl+C.
2. Extract this ZIP completely.
3. Open the extracted folder.
4. Double-click RUN-WHOKEAS-30-MARGIN-AND-PUBLISH.cmd.
5. Keep the window open until it reports success or a visible error.

What this fixes
- Product Control hydration mismatch and stale Turbopack output.
- Product Control is mounted after browser hydration only.
- Fixed approximately 30% gross profit margin after payment fees.
- Existing international offers, products and variants are repriced in Neon.
- Only products that pass stock and market safety gates are published.
- A successful build is required before GitHub push.

Pricing formula
Selling price = landed cost / (1 - 30% target margin - payment fee rate)
The result is rounded upward using each market's configured increment, so the
actual margin may be slightly above 30%.

Publication
The installer pushes the verified source to GitHub main. If Vercel is connected
to that repository, Vercel should automatically create the production deploy.
