# Prisma changes for OTP login

- Added `phone String? @unique` to `User`
- Made `password` optional
- Added `Otp` model with `phone`, `code`, `expiresAt`, `createdAt`

Run migrations:

- Development: `npm -w apps/backend run prisma:migrate`
- Production: `npm -w apps/backend run prisma:deploy`
