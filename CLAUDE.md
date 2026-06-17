# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

A single-page static website — the digital menu and ordering page for "VORAZ Sushi", a
sushi delivery / takeaway business in Santiago Centro, Chile (it is not a sit-down
restaurant; pickup is from a single address). All UI text and product data are in
Spanish; prices are in Chilean pesos (CLP). There is no backend: orders are placed by
handing off a prefilled message to WhatsApp.

## Running / developing

There is no build system, no dependency install, and no tests. **Serve the folder over
HTTP** — opening `index.html` as a `file://` URL works for the menu but breaks the
service worker (PWA / offline support), which needs an `http(s)` origin:

```
python3 -m http.server
```

Third-party libraries load from CDNs at runtime (Tailwind CSS via `cdn.tailwindcss.com`,
SweetAlert2, Font Awesome 6, Google Fonts) — there is nothing to `npm install`. Keeping
the Tailwind CDN (instead of a compiled build) is a deliberate choice to avoid a build
step; the trade-off is a brief flash before styles apply.

## Structure

- `index.html` (~4700 lines) — the whole app: an inline `<style>` block, a `tailwind.config`
  script, the HTML body, and one large inline `<script>`.
- `manifest.json` — PWA manifest (install metadata, icons, theme colors).
- `sw.js` — service worker (offline support, asset caching).
- `img/` — product photos and the logo (e.g. `promo-frita.jpeg`, `promo-fria.jpeg` for the
  current Día del Sushi campaign).
- `README.md` — one line.

## Visual design / theming

The site uses a warm dark "ink & ember" aesthetic (deep warm charcoal, gold accent, a
touch of vermillion). Two things drive it, and **both must stay in sync** when changing
colors:

- The `tailwind.config` script in `<head>` **remaps Tailwind's `slate` and `amber` color
  scales** to the warm palette. So utility classes like `bg-slate-900` or `text-amber-500`
  throughout the markup render warm tones, not Tailwind's defaults. Edit the scales there
  to retone the whole site.
- The inline `<style>` block uses matching hardcoded hex values for custom component
  classes (cart, selects, modals, hero, tabs, etc.).

Fonts: **Shippori Mincho** (display / headings — `h1,h2,h3`) and **Zen Kaku Gothic New**
(body), loaded from Google Fonts. The hero is the `.site-header` / `.wordmark` block.

## Architecture

- The menu is a series of `<section>` blocks, each with an `id` used by the mobile tab
  nav: `hotRolls`, `freshRolls`, `pokes`, `clasicos`, `combos`, `promos`, `entradas`,
  `salsas`, `bebidas`. (`vorazCreativo` exists but is commented out / hidden.) Tabs call
  `scrollToSection(id, btn)`. The flag-gated `diaSushi` section (see **Promotional
  campaign system** below) is the first `<section>` in `<main>` and is hidden by default.

- Each product is a card with a quantity stepper and an "AGREGAR" button. **Product names
  and prices are hardcoded as literal arguments in inline `onclick` handlers** — e.g.
  `addWithQty('Tentation Roll', 6900, 'qtyTentation')`. There is no central data source,
  so adding or editing a product means editing both the visible card markup and the
  literal price in its handler.

- **Cart state** is the in-memory `cart` array; items are objects with these shapes:
  - normal product — `{name, price, id}`
  - premium salsa — `{name, price: 600, isPremiumSalsa: true, id}`
  - Fusión combo — `{name, price: fullPrice, isCombo: true, comboDiscount, id}`

- **Cart persistence**: the cart is saved to `localStorage` under `voraz_cart_v1` on every
  change (`saveCart()` runs inside `updateCartUI()`), wrapped as `{items, savedAt}`.
  `loadCart()` restores it on `DOMContentLoaded` but **discards it after a 10-minute TTL**
  (`CART_TTL_MS`) — the timer resets on each cart change.

- **Add-to-cart entry points**: `addToCart(name, price)` is the base; others wrap it —
  `addWithQty`, `addRollWithSalsa`, `addGyosa`, the simple combo builders (`addComboDuo`,
  `addComboMix`, `addVorazCreativo`), and `addSalsaPremium`. The Fusión combos use a
  separate base, `addCombo(name, fullPrice, discount, qty)`. Combo builders read
  selections from `<select>` dropdowns, custom-styled by `initCustomDropdowns()`.

- **Discount pricing** — two mechanisms, both shown in the cart as a green "Descuento"
  card and as a line in the WhatsApp message:
  - Premium salsas use tiered pricing in `calcularPrecioSalsasPremium()` (pairs cost less
    than singles). Stored at `600` each; the real total is recomputed there.
  - Fusión combos (`addComboFusionX2` / `addComboFusion`) are stored at their **full
    price** with the savings in `comboDiscount`; `calcularDescuentoCombos()` sums it.

- **Total** (in both `updateCartUI()` and `checkout()`): non-salsa items at face value
  `+ calcularPrecioSalsasPremium() - calcularDescuentoCombos()`. Keep these two in sync.

- The Fusión combo dropdowns show a preview card per selected roll, driven by the
  `rollsInfo` object (roll name → `{img, desc}`). Add new combo-eligible rolls there too.

- `checkout()` validates the cart and delivery type, builds a plain-text order message,
  and opens WhatsApp via `https://wa.me/${phoneNumber}?text=...`.

## Things to know when editing

- The WhatsApp destination number is the `phoneNumber` const in the `<script>`; it also
  appears in `wa.me/...` links in the markup and in the JSON-LD `telephone`. Update every
  occurrence.
- Currency is formatted with `toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })`.
- **Service worker**: `sw.js` uses a stale-while-revalidate strategy under cache name
  `voraz-v2` (the `CACHE` const). To force returning visitors to fully refresh cached
  assets, bump that version string (e.g. `voraz-v2` → `voraz-v3`).
- The `<head>` contains JSON-LD structured data typed as `Restaurant` and absolute URLs
  under `https://vorazsushi.cl/` — update the domain/type if it changes.
- Changing a Fusión combo's price means editing **both** the card's displayed prices
  (full + discounted) and the literal `fullPrice`/`discount` args in its `addCombo(...)`
  call; they must stay consistent (`fullPrice - discount = advertised price`).
- **"Nuevo" badge** — `.badge-nuevo` (defined in the inline `<style>`) is a reusable
  diagonal blue corner ribbon for flagging a product as new. It is universal: it works
  on **any** product card. To apply it, add `relative` to the card's outer `<div>` class
  list (cards already have `overflow-hidden`, which clips the ribbon ends) and insert
  `<span class="badge-nuevo">Nuevo</span>` as that div's first child, before the `<img>`.
  Remove the span when the product is no longer new. The ribbon is blue by deliberate
  choice (a conventional "new" cue) — it is the one accent that intentionally departs
  from the warm "ink & ember" palette.

## Promotional campaign system ("Día del Sushi")

A reusable, flag-gated promo campaign. Everything lives in `index.html` and is built so a
campaign can be fully prepared while invisible, then switched on. Originally built for the
Día del Sushi (18 June) promo with two products at $7.490 / 20 rolls each ("Promo Frita",
"Promo Fría").

- **Master switches** — one `DIA_SUSHI` config object near the `phoneNumber` const in the
  `<script>` drives three **independent** parts; flip any to `true`/`false`:
  - `modal` — the popup poster that opens on every page load / refresh (just the artwork,
    no buttons).
  - `modalBoton` — the two "AGREGAR" buttons rendered **inside** the modal (add the promo
    straight to cart and close the modal).
  - `seccion` — the `diaSushi` menu section **and** its mobile tab (`tabDiaSushi`). The
    section's own per-card "AGREGAR" buttons are part of the section, so they appear/hide
    with it (no separate flag).
  `applyDiaSushiFlags()` (run on `DOMContentLoaded`) reads the object and shows/hides the
  section, tab and modal buttons, and opens the modal. To retire/reuse the campaign, set
  all three to `false`; the markup stays in place for next time.

- **Modal** — `#diaSushiModal` (markup near the end of `<body>`, just after the delivery
  modal) uses the `.dia-sushi-modal` / `.open` CSS pattern (in the inline `<style>`,
  mirroring `.delivery-modal`). Helpers: `openDiaSushiModal()`, `closeDiaSushiModal()`,
  and `addDiaSushiPromo(name, price)` (adds via `addToCart` then closes).

- **The poster is an inline `<svg>`** (not a raster image) so it renders with the real
  Shippori Mincho font and the ink & ember palette. It embeds the real product photos via
  `<image href="img/promo-*.jpeg">` clipped to rounded frames (`dsClip1`/`dsClip2` in
  `<defs>`). To swap a photo, change the `href`; to replace the whole poster with a
  finished raster, swap the `<svg>…</svg>` for `<img src="…">`.

- **Section cards** mirror the normal product-card markup but use `aspect-[11/10]`
  (near-square, matching the poster's 330×300 frames) instead of the menu's usual
  `h-48 object-contain`, so the portrait promo photos show fully without an ugly crop.

- **Exporting the poster as a shareable image**: extract the `<svg viewBox="0 0 800 1060"…>`
  block, render it (e.g. macOS `qlmanage -t -s 2000 -o <dir> poster.svg` with the `img/`
  photos beside it), then crop the square padding QuickLook adds back to the 800:1060
  ratio (`sips -c 2000 1510`).

## Known tech debt / not yet done

- Product data is not centralized — names/prices are duplicated between card markup and
  `onclick` handlers (and `rollsInfo`). A central data array + render loop is recommended
  but not implemented.
- CSS and JS are still inline in `index.html`; splitting them into `style.css` / `script.js`
  is recommended but not done.
