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
- Sessions: the login cookie lasts 15 minutes and a refresh cookie lasts 30 days. `apiFetch` (`src/lib/api.ts`) answers a 401 by calling `POST /users/refresh` once, shared by every request that needs it and taken in turns across browser tabs, then tries the request again once. Only a refused refresh counts as logged out. The start-up `GET /users/check` gets the same treatment, so someone returning after an hour stays logged in. Registration and login follow the backend's email codes: registering emails a 6-digit code (`CodeEntryForm`) that must be entered before the person is logged in; logging in from a browser the backend does not know asks for a code too, and an account whose email was never confirmed is sent to the confirm screen. `src/lib/accountApi.ts` wraps these calls. Forgot password (`/forgot-password`) and Change password (`/change-password`, linked from My orders and My store) use the same code and password rules. Logout opens a small dialog with "Log out" (this device) and "Log out on all devices".
- Administrator pages (`/admin/*`: complaints, refunds, recovery cases, owed by sellers) are only offered when `GET /users/check` says `isAdmin`. That only decides what to show: the backend checks it on every request. Make an administrator with `npx tsx scripts/makeAdmin.ts <email>` in the backend.
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

Rules for new screens:

- Use the variables in `tokens.css`. Do not write colours or sizes directly in a component or page.
- Anything tappable is at least 44px tall (`--tap-size`). Text is at least 16px, except small captions.
- Show every message with the `Notice` component, which pairs an icon with words so colour is never the only signal. Do not use `alert()`.
- Amber (`--color-amber`) is for badges and accents with charcoal text on it. Never use it as text colour; use `--color-amber-text`.
- Layouts are mobile first: one or two columns by default, with wider layouts added in `@media (min-width: ...)` blocks (about 640px, 900px and 1024px).
- Check contrast when adding a colour pair: 4.5:1 for text, 3:1 for input borders and graphics.
- The open dropdown list uses the browser's customizable-select feature where available (Chrome and Edge) and falls back to the browser's own list elsewhere.

Sign-in pages (`/login`, `/register`, `/consumer/register`, `/seller/register`) hide the site header and show a centred logo instead; the list is `AUTH_PATHS` in `Navbar.tsx`.

## Authentication

The backend sets a session cookie, and the app learns who is signed in from `GET /users/check` when it starts (`src/App.tsx`). That check has four outcomes: loading, authenticated, unauthenticated (a 401), and error (a network or server failure, which is not treated as being logged out and offers a retry).

- `src/components/RouteGuards.tsx` redirects logged-out users and users with the wrong role away from seller and cart routes, and sends signed-in users away from the login and registration pages.
- `apiFetch` forwards request options unchanged and does not add `credentials: "include"` for you. Requests that need the session must pass it. If one of those requests is answered with 401 (other than login, register and the session check), the app marks the session as expired and the guards redirect to the login page.
- `getErrorMessage` in `src/lib/api.ts` reads the backend's error message, which is either JSON or plain text.

Frontend route checks only improve the user experience. The backend enforces authentication and authorization.
