# wallet-frontend

A small React app for [wallet-platform](../wallet-platform)'s wallet-service: log in, see your accounts, their
transfers, deposits, holds and ledger postings, open one account per currency, send money between accounts and
top up through the bank. Merchants place holds on a customer's account and capture or release them. Admins manage
user roles (make merchants), open any user's account, reverse transfers, expire overdue holds, and get the
read-only journal and the outbox (with retry for failed events).

bank-sim and notification-service have no UI: bank-sim is only called by wallet-service, and deposits show the
bank's result once its webhook arrives (the deposits tab refreshes itself while one is pending).

Built with Vite, React 19, TypeScript and react-router. No UI library; styles are in `src/styles.css`
(light and dark mode follow the OS setting).

## Running locally

1. Start the backend. In wallet-platform, `docker compose --profile app up --build` runs everything;
   wallet-service listens on `http://localhost:8080`.
2. Start the frontend:

   ```sh
   npm install
   npm run dev
   ```

3. Open http://localhost:3000.

In development the app calls the API at `/backend/...`, and the Vite dev server forwards those requests to
the backend, so the browser never makes a cross-origin request. To point at a backend elsewhere, start
the dev server with `BACKEND_URL=http://host:port npm run dev`.

Everyone who registers is a regular user. The only admin is created by the backend on startup from
environment variables:

```sh
ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD='Change-me-1!' docker compose --profile app up --build
```

That admin makes merchants on the **Users** page.

A few backend rules the UI follows:

- One account per currency. Transfers only work in USD and EUR (the currencies with a transfer limit);
  other accounts can only be topped up.
- Deposits and transfers keep a 2% fee; a transfer's fee comes out of what the recipient gets.
- Transfers are booked immediately and come back `COMPLETED` or `FAILED`. Each one is sent with an
  `Idempotency-Key`, reused when the same transfer is resubmitted after a network error, so it is never booked
  twice.
- Holds last at most 7 days. Only the merchant who placed a hold can capture it (into one of their own accounts
  in the same currency) or release it. There is no endpoint that lists a merchant's holds, so the Holds page
  remembers the ones placed from this browser, and others can be added by number.
- The ledger has no write endpoints; corrections are transfer reversals.

## Production build

```sh
VITE_API_URL=https://api.example.com npm run build   # output in dist/
```

`VITE_API_URL` is the backend's public URL. The site serving `dist/` must be listed in the backend's
`CORS_ALLOWED_ORIGINS`, and the web server must send every unknown path to `index.html` so links like
`/accounts/3` work after a reload.

## How authentication works

- Login and register return an access token (short-lived) and a refresh token.
- The access token is kept in memory only. The refresh token is stored in `localStorage` so a reload
  stays logged in; any script on the page could read it, so an httpOnly cookie would be safer if the
  backend adds support for one.
- When a request gets a 401, the client refreshes once and retries (`src/api/client.ts`). Refreshes are
  shared between concurrent requests, because the backend rotates refresh tokens and treats a second use
  of the same token as theft, logging the user out everywhere.
- Logout sends both tokens to the backend so the access token stops working immediately.

## Layout

```
src/
  api/client.ts       fetch wrapper, token handling, refresh
  api/endpoints.ts    one function per backend endpoint
  api/types.ts        response types (amounts are integers in minor units, e.g. cents)
  auth/AuthContext.tsx
  components/         layout, table, pager, status badge, account picker
  pages/              login/register, accounts, account detail, merchant holds, admin users, journal and outbox
  currencies.ts       currencies offered in the forms, transfer currencies, fee
  usePolling.ts       refreshes pending deposits
  format.ts           money and date formatting
  usePaged.ts         hook for the backend's paged endpoints
```

## Test ids

Elements tests interact with carry a `data-testid`, in kebab-case as `<area>-<element>`: `login-email`,
`transfer-submit`, `nav-journal`. Repeated rows append the record id: `transfers-table-row-42`,
`account-card-7`. Inside a row, elements share one id (`transfer-status`, `hold-release`), so scope the
lookup to the row first, e.g. `page.getByTestId('transfers-table-row-42').getByTestId('transfer-status')`.

The shared components take a `testId` and derive their children's ids from it:

- `DataTable` (required): `<testId>` on the table, `<testId>-row-<key>`, `<testId>-detail-<key>`,
  `<testId>-empty`, `<testId>-loading`, `<testId>-error`
- `Pager`: `<testId>`, `<testId>-newer`, `<testId>-older`, `<testId>-info`
- `AccountPicker` (required): `<testId>` on the input, `<testId>-list`, `<testId>-option-<accountId>`
- `ErrorMessage`, `SuccessMessage`, `StatusBadge`: `<testId>` on the element
