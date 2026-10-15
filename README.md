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
- `src/components/`: shared components.
- `src/lib/api.ts`: `apiFetch`, which builds backend URLs from `VITE_API_BASE_URL`. Use it for every backend request instead of calling `fetch` with a hard-coded URL.
- `src/lib/uploadImage.ts`: direct browser upload to Cloudinary.
- `src/types/`: shared TypeScript types (`UserRole`, `Listing`, `SellerProfile` and others).

## Authentication

The backend sets a session cookie. Requests that need it must pass `credentials: "include"`; `apiFetch` forwards request options unchanged and does not add it for you. Frontend route checks only improve the user experience. The backend enforces authorization.
