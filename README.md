# wallet-frontend

A small React app for [wallet-platform](../wallet-platform): log in, see your accounts, their transfers,
deposits, holds and ledger postings, open accounts and create deposits. Admins also get the journal and
the outbox (with retry for failed events).

Built with Vite, React 19, TypeScript and react-router. No UI library; styles are in `src/styles.css`
(light and dark mode follow the OS setting).

## Running locally

1. Start the backend (`./gradlew bootRun` in wallet-platform). It listens on `http://localhost:8080`.
2. Start the frontend:

   ```sh
   npm install
   npm run dev
   ```

3. Open http://localhost:3000.

In development the app calls the API at `/backend/...`, and the Vite dev server forwards those requests to
the backend, so the browser never makes a cross-origin request. To point at a backend elsewhere, start
the dev server with `BACKEND_URL=http://host:port npm run dev`.

To see the admin pages, give a user the admin role in the database:

```sql
update app_user set role = 'ADMIN' where email = 'you@example.com';
```

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
  components/         layout, table, pager, status badge
  pages/              login/register, accounts, account detail, admin journal and outbox
  format.ts           money and date formatting
  usePaged.ts         hook for the backend's paged endpoints
```
