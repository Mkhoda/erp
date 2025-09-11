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
