# Backend API (Nest-like minimal)

Routes
- POST /auth/register
- POST /auth/login
- GET /auth/me (Bearer token)
- CRUD: /users, /departments, /timesheets (Bearer token)

Setup
1. Copy .env.example to .env and update DATABASE_URL and JWT_SECRET
2. Install deps at repo root: `npm install`
3. Migrate DB: `npm -w apps/backend run prisma:migrate -- --name init`
4. Dev server: `npm -w apps/backend run start:dev`

## CORS configuration

The API reads the `CORS_ORIGIN` environment variable and splits it by commas.
Deploy scripts now emit only *http* origins; including `https://…` caused mixed
content errors when the frontend was served over HTTP, so the default is
HTTP-only.

You can control the behavior with the following variables:

- `CORS_INCLUDE_HTTPS=1` instructs `deploy.sh` to append the https domain to
the generated value.  
- `CORS_ONLY_HTTP=1` tells the runtime to ignore any origins that start with
`https://` (useful when you know the frontend will never be accessed over
HTTPS).

Adjust as needed before starting the server.
