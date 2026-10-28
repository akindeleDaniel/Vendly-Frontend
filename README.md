# Vendly Frontend

React, TypeScript and Vite frontend for Vendly, a multi-vendor marketplace where sellers present listings and shoppers discover shops and products. It talks to the separate `Vendly-Backend` API.

## Setup

1. Install dependencies:

   ```
   npm install
   ```

2. Create your local environment file and fill it in:

   ```
   cp .env.example .env
   ```

   | Variable | Required | Purpose |
   |---|---|---|
   | `VITE_API_BASE_URL` | Yes | Base URL of the backend API, for example `http://localhost:3000`. The app throws at startup if it is missing. |
   | `VITE_CLOUDINARY_CLOUD_NAME` | For image uploads | Cloudinary cloud name. |
   | `VITE_CLOUDINARY_UPLOAD_PRESET` | For image uploads | Cloudinary unsigned upload preset. |

   Vite reads `.env` only when it starts, so restart `npm run dev` after changing it. `.env` is git-ignored; do not commit it.

   Vite inlines `VITE_*` values at build time. `npm run build` still succeeds if `VITE_API_BASE_URL` is missing, but the resulting bundle only throws the configuration error, so set the variable in the environment of any build you intend to deploy.

3. Start the backend (see the `Vendly-Backend` repository). Locally it listens on port 3000 and only allows requests from `http://localhost:5173` with credentials, so run this frontend on Vite's default port.

4. Start the frontend:

   ```
   npm run dev
   ```

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Starts the Vite dev server. |
| `npm run build` | Type-checks (`tsc -b`) and builds for production. |
| `npm run lint` | Runs ESLint. |
| `npm run preview` | Serves the production build locally. |

There is no automated test suite yet.

## Project layout

- `src/App.tsx`: routes, session check and logout.
- `src/pages/`: route-level pages.
- `src/components/`: shared components (`Logo`, `Navbar`, `Notice`, `ImagePicker`, `ListingCard`, route guards and others).
- `src/styles/`: the design system. See "Styling" below.
- `src/lib/api.ts`: `apiFetch`, which builds backend URLs from `VITE_API_BASE_URL`, plus `getErrorMessage`. Use `apiFetch` for every backend request instead of calling `fetch` with a hard-coded URL.
- `/seller/payouts` (`PayoutSettingsPage`): the seller adds the bank account sales are paid into. `src/lib/payoutApi.ts` wraps the four `/seller/payout/*` endpoints, and `BankPicker` is the type-to-search bank list. Full account numbers are only sent, never stored or shown again.
- Complaints and refunds: shoppers report a problem from an order (`/orders/:checkoutId/seller-orders/:orderId/complaint`) and follow it at `/disputes`; sellers answer at `/seller/disputes`, offer a refund from an order (`/seller/orders/:id/refund-offer`) and see money kept back to recover refunds at `/seller/liabilities`. `DisputeDetailPage` and `DisputeListPage` serve all three roles through a `viewer` prop, and `src/lib/disputeApi.ts` wraps the endpoints with `apiRequest` (`src/lib/apiRequest.ts`), which keeps the backend's error codes.
- Product pages: `/product/:id` (`ProductPage`) shows one product with a larger photo, the full description, stock and Add to cart. On a storefront a card opens its product page; on the browsing pages a card still opens the shop. `useAddToCart` (the quantity, the request and the message) and `usePendingCartAdd` (adding the chosen product after a visitor logs in) are shared by the cards, the shop page and the product page. Any address that matches no route shows `NotFoundPage`.
- Sessions: the login cookie lasts 15 minutes and a refresh cookie lasts 30 days. `apiFetch` (`src/lib/api.ts`) answers a 401 by calling `POST /users/refresh` once, shared by every request that needs it and taken in turns across browser tabs, then tries the request again once. Only a refused refresh counts as logged out. The start-up `GET /users/check` gets the same treatment, so someone returning after an hour stays logged in. `Continue with Google` (`GoogleSignInButton`) uses Google's own button, drawn as an outlined pill, because only that button gives the browser the sign-in token the backend checks. It needs `VITE_GOOGLE_CLIENT_ID` (without it the button is hidden), and the site's address must be listed under "Authorized JavaScript origins" in the Google Cloud console. `useGoogleSignIn` handles the four answers: logged in, choose buyer or seller (new people), enter the emailed code to link an existing account, or the administrator's code. An account made with Google has no password: `GET /users/check` says so (`hasPassword`), the Logout dialog's password option says "Set a password" (`SetPasswordPage`), and a one-time pop-up (`SetPasswordPrompt`) suggests it after login, and changing a payout bank account asks for one first. Registration and login follow the backend's email codes: registering emails a 6-digit code (`CodeEntryForm`) that must be entered before the person is logged in; logging in from a browser the backend does not know asks for a code too, and an account whose email was never confirmed is sent to the confirm screen. `src/lib/accountApi.ts` wraps these calls. Forgot password (`/forgot-password`) and Change password (`/change-password`, reached from the Logout dialog) use the same code and password rules. Logout opens a small dialog with "Log out" (this device) and "Log out on all devices".
- Seller extras: `/seller/earnings` is the Sales page, with one period for two tabs. Overview (`GET /seller/summary`) compares the period with the one before, with visits, a day-by-day chart, best sellers and most viewed. Money is the sales record from the figures the providers reported (totals, orders by status and the last twelve months). "Download orders" saves the period's paid orders as a CSV file (`GET /seller/orders/export`). `/seller/customers` lists who has bought from the shop (`GET /seller/customers`), with names shown as on reviews and no contact details. My store offers Archive when a listing cannot be deleted because it has history, and an Archived tab with Restore. Many products at once: `/seller/products/from-photos` makes a draft from each photo (`POST /listings/drafts`), `/seller/products/import` checks and adds a CSV file, the StoreHatch template or a Shopify export (`POST /listings/import`, with a dry run first), and `/seller/products/quick-edit` changes prices, stock, alerts and categories together (`PATCH /listings/bulk`). My store's Drafts tab (`GET /listings/Mylisting?drafts=only`) fills drafts in place, sets one category for many, and publishes the ready ones (`POST /listings/drafts/publish`). A shop page shows its delivery cost. Seller orders can be filtered by complaint, and complaint lists mark replies the person has not opened ("New"), with counts in the header.
- Listing and shop limits (title 120, description 5000, shop name 80, price above 0 with two decimals up to 100,000,000, stock 0 to 1,000,000) are checked in `src/lib/limits.ts` before sending; the backend's message is shown for anything else, including its 429 "Too many attempts" answer. The backend only accepts changes from `FRONTEND_URL`, so that setting must equal the address the frontend runs on.
- Administrator pages (`/admin/*`: an overview of what needs attention, order and people search, complaints, refunds, recovery cases, owed by sellers, and reviews with the buyers' photos; "Issue a refund" can start from an order's page) are only offered when `GET /users/check` says `isAdmin`. That only decides what to show: the backend checks it on every request. Make an administrator with `npx tsx scripts/makeAdmin.ts <email>` in the backend.
- `src/lib/uploadImage.ts`: direct browser upload to Cloudinary. `src/lib/imageFile.ts` checks a chosen image first (JPG, PNG, WebP or GIF, at most 10 MB). `ImagePicker` then opens `ImageCropDialog` (a square crop with drag, zoom and rotate, no extra package) and uploads only the cropped copy, saved as a JPEG, or a PNG when the original was a PNG or GIF.
- `src/lib/money.ts`: display arithmetic for prices, in whole minor units.
- `src/lib/useDocumentTitle.ts`: sets the browser tab title for a page.
- `src/types/`: shared TypeScript types (`UserRole`, `Listing`, `SellerProfile` and others).

## Styling

Vendly uses plain CSS with no styling library. `src/index.css` imports these files in order:

| File | What it holds |
|---|---|
| `styles/tokens.css` | Every colour, font size, spacing step, radius and layout value as a CSS variable. Change a value here and it changes everywhere. |
| `styles/base.css` | The look of plain HTML elements (headings, links, forms, buttons, dropdown lists), the focus ring, and reduced-motion handling. |
| `styles/components.css` | Shared classes: buttons, cards, messages, badges, the site header, the skip link. |
| `styles/browse.css` | Search field, category tiles, product cards, shop rows, storefront header. |
| `styles/cart.css` | Cart and checkout cards, money rows, summary columns. |
| `styles/forms.css` | Login, registration and seller pages, the account-type cards, the image picker. |
| `styles/shop.css` | A shop's own home page (its colour, header, banner and footer). |
| `styles/product.css` | A product's page, inside its shop. |
| `styles/cart-page.css` | The cart, grouped by shop. |
| `styles/checkout-page.css` | Checkout's two steps and the payment result. |
| `styles/browse-page.css` | The home page, a category, new products and search results. |

Rules for new screens:

- Use the variables in `tokens.css`. Do not write colours or sizes directly in a component or page.
- Anything tappable is at least 44px tall (`--tap-size`). Text is at least 16px, except small captions.
- Show every message with the `Notice` component, which pairs an icon with words so colour is never the only signal. Do not use `alert()`.
- Amber (`--color-amber`) is for badges and accents with charcoal text on it. Never use it as text colour; use `--color-amber-text`.
- Layouts are mobile first: one or two columns by default, with wider layouts added in `@media (min-width: ...)` blocks (about 640px, 900px and 1024px).
- Check contrast when adding a colour pair: 4.5:1 for text, 3:1 for input borders and graphics.
- The open dropdown list uses the browser's customizable-select feature where available (Chrome and Edge) and falls back to the browser's own list elsewhere.

Sign-in pages (`/login`, `/register`, `/consumer/register`, `/seller/register`) hide the site header and show a centred logo instead; the list is `AUTH_PATHS` in `Navbar.tsx`.

### Category tiles on the home page

"Shop by category" shows a tile for every category, each in one of the shop colours with a photo in a round window, and each a link to that category (`src/data/categoryTiles.ts`, `src/components/CategoryTiles.tsx`). The page-not-found page shows the first four. The photos are in `public/images/categories/`, all from Unsplash, free for commercial use with no credit required (credit is kind but optional); do not resell them as they are.

- `fashion-dress.jpg`: unsplash.com/photos/young-woman-in-a-patterned-dress-smiles-6EvUrguVz7s
- `food-market.jpg`: unsplash.com/photos/a-market-with-a-lot-of-fruits-and-vegetables-xs0gVDr02ag
- `beauty-serum.jpg`: unsplash.com/photos/amber-glass-bottle-on-wooden-pedestal-Mxy5gokl8mE
- `phones-phone.jpg`: unsplash.com/photos/a-samsung-smartphone-on-a-table-VD9Hsvg3DVQ
- `jewelry-pieces.jpg`: unsplash.com/photos/gold-and-silver-beaded-necklace-uf_IDewI6iQ
- `home-armchair.jpg`: unsplash.com/photos/a-comfortable-armchair-with-blankets-and-pillows-3eFjPyC9qyw
- `electronics-headphones.jpg`: unsplash.com/photos/lUMj2Zv5HUE
- `health-supplements.jpg`: unsplash.com/photos/6IfOjsRKtCg
- `computers-laptop.jpg`: unsplash.com/photos/RSCirJ70NDM
- `sports-sneakers.jpg`: unsplash.com/photos/a-pair-of-sneakers-hanging-on-a-wall-sSaQ7_pArx8
- `baby-clothes.jpg`: unsplash.com/photos/AkPas1rErdE
- `books-stack.jpg`: unsplash.com/photos/a-stack-of-books-sitting-next-to-each-other-b53HdbIUOhM
- `toys-collection.jpg`: unsplash.com/photos/gDiRwIYAMA8
- `crafts-paints.jpg`: unsplash.com/photos/flat-lay-photography-of-assorted-color-painting-tool-lot-lPqICZuSUpw
- `pets-dog-toy.jpg`: unsplash.com/photos/g2FtlFrc164
- `automotive-dashboard.jpg`: unsplash.com/photos/SkKTh9ZyTxU
- `tools-hammer.jpg`: unsplash.com/photos/Z3vFp7szCAY
- `other-gift.jpg`: unsplash.com/photos/f94JPVrDbnY

The sign-in pages show three other photos, in `public/images/auth/`, beside the forms (`src/components/AuthShell.tsx`). Keep them different from the category photos and the landing page's. Also from Unsplash, on the same terms:

- `shopper-phone.jpg`: unsplash.com/photos/a-woman-in-a-green-dress-holding-a-cell-phone-86h-VV5jYmg
- `shopper-bags.jpg`: unsplash.com/photos/woman-holding-shopping-bag-in-a-mall-b93xqmwDOv0
- `tailor.jpg`: unsplash.com/photos/a-tailor-sews-at-his-sewing-machine-bhRcP1KqS0g

## Authentication

The backend sets a session cookie, and the app learns who is signed in from `GET /users/check` when it starts (`src/App.tsx`). That check has four outcomes: loading, authenticated, unauthenticated (a 401), and error (a network or server failure, which is not treated as being logged out and offers a retry).

- `src/components/RouteGuards.tsx` redirects logged-out users and users with the wrong role away from seller and cart routes, and sends signed-in users away from the login and registration pages.
- `apiFetch` forwards request options unchanged and does not add `credentials: "include"` for you. Requests that need the session must pass it. If one of those requests is answered with 401 (other than login, register and the session check), the app marks the session as expired and the guards redirect to the login page.
- `getErrorMessage` in `src/lib/api.ts` reads the backend's error message, which is either JSON or plain text.

Frontend route checks only improve the user experience. The backend enforces authentication and authorization.

### Your data and account

`/account` (opened from the "Your account" pop-up behind Logout) lets anyone signed in download everything StoreHatch holds about them (`GET /users/me/data`) or delete their account. The page asks `GET /users/me/deletion-check` first and lists anything that has to be finished before deleting, with a link to where it is sorted out. Deleting needs the account's password (`POST /users/me/delete`), so an account made with Google is sent to set one first. Afterwards the app forgets the login and shows `/account/deleted`, which needs no login. The backend checks the password and decides whether an account can be deleted; the page only explains.

### Downloads

The orders export, "Download my data" and the import template are plain links to the backend (`openDownload` in `src/lib/api.ts`), so the browser saves the file itself. The login cookie goes with the link only while the backend's `COOKIE_SAME_SITE` is `lax` (its default) or `none`; with `strict`, these downloads fail. The access cookie lasts 15 minutes, so the session is checked (and renewed) just before each download.

### Nigerian time

Dates and times are shown in Nigerian time (`Africa/Lagos`, UTC+1 all year) whatever the device's time zone, with the helpers in `src/lib/lagosTime.ts`. The backend counts days the same way. The pre-order "Ready on" box is read as Nigerian time too.

### robots.txt

`robots.txt` is written by the build (`vite.config.ts`), with a `Sitemap:` line pointing at the backend's `/sitemap.xml` from `VITE_API_BASE_URL`, so no address is typed into `public/`.
