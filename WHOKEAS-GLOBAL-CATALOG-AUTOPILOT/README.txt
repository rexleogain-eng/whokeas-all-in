WHOKEAS ALL IN — GLOBAL CATALOGUE AUTOPILOT

WHAT THIS INSTALLS
- Daily CJ product discovery using rotating category rules.
- Automatic rejection of restricted, unsuitable, low-stock and poor-margin products.
- Automatic classification into Tech, Study, Fashion, Home, Beauty and Lifestyle.
- Automatic supplier-cost, freight, payment-fee, reserve and profit calculations.
- Global market-price records for Tanzania, United States, United Kingdom,
  European Union, Canada, Australia, UAE, Kenya and South Africa.
- Exact CJ freight checks for priority markets and conservative estimates for
  secondary markets.
- Daily USD exchange-rate synchronization with cached fallback rates.
- Automatic CJ stock/price synchronization and repricing.
- Automatic publication only after inventory, image, shipping, market-count,
  maximum-price and profit gates pass.
- Admin control centre at /admin/automation.

SAFE DEFAULTS
- 3 products maximum per sourcing run.
- 3 rotating categories per daily run.
- At least 3 viable markets required before automatic publication.
- Products that fail a safety gate stay as drafts instead of being published.
- Restricted-product keywords are blocked.

INSTALLATION
1. Stop npm run dev with Ctrl+C.
2. Extract this ZIP completely.
3. Double-click RUN-WHOKEAS-GLOBAL-AUTOPILOT.cmd.
4. Wait for the successful build message.
5. Start the app with npm run dev.
6. Open http://localhost:3000/admin/automation.
7. Review the generated WHOKEAS-ADD-TO-VERCEL.txt file on the Desktop.
8. Add those variables to Vercel and redeploy.

DAILY PRODUCTION SCHEDULE (UTC)
00:15 — Currency-rate synchronization
02:00 — Existing CJ product price and stock synchronization
03:30 — New product discovery, classification, pricing and guarded publishing

IMPORTANT COMMERCIAL BOUNDARY
This package automates sourcing, classification and international product pricing.
International customer currency selection, country-aware checkout, taxes, duties
and global payment processing are the next release and are not silently assumed.
