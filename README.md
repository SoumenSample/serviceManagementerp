This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Environment Variables

Create a `.env.local` file in the project root (see `.env.example` for template). Copy example and fill values:

```bash
cp .env.example .env.local
```

| Variable | Required | Default | Description |
|---|---|---|---|
| `MONGODB_URI` | **Yes** | — | MongoDB connection string. App throws if missing (`lib/db.ts:21`). Example: `mongodb://localhost:27017/espsoln` or Atlas URI |
| `MONGODB_DB` | No | — (from URI) | MongoDB database name. If unset, uses DB from URI (`lib/db.ts:28`). Recommended: `espsoln` |
| `JWT_SECRET` | **Yes (prod)** | `dev-secret-change-...` | Secret for signing JWTs (`lib/jwt.ts:4`, `middleware.ts:5`). Must be ≥32 random chars in production |
| `JWT_EXPIRES_IN` | No | `7d` | JWT expiry (`lib/jwt.ts:5`). e.g. `7d`, `24h` |
| `NEXT_PUBLIC_APP_URL` | No | `http://localhost:3000` | Public app URL used for links/QR (`app/dashboard/page.tsx:11`) |
| `CLOUDINARY_CLOUD_NAME` | No* | — | Cloudinary cloud name (`lib/cloudinary.ts:3`). *Required if using file/image uploads |
| `CLOUDINARY_API_KEY` | No* | — | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | No* | — | Cloudinary API secret |
| `SMTP_HOST` | No* | — | SMTP host for emails (`lib/notifications/email-service.ts:4`). *Required for real email sending; without it emails are just logged to console |
| `SMTP_PORT` | No | `587` | SMTP port (`465` = SSL) |
| `SMTP_USER` | No* | — | SMTP username |
| `SMTP_PASSWORD` | No* | — | SMTP password |
| `EMAIL_FROM` | No | `SMTP_USER` or `noreply@espsoln.local` | Sender address (`lib/notifications/email-service.ts:18`) |
| `SEED_EMAIL` | No | `admin@gmail.com` | Email for `npm run seed` super_admin user (`scripts/seed.ts:11`) |
| `SEED_PASSWORD` | No | `admin123` | Password for seed user (`scripts/seed.ts:12`) |

Minimal local setup (without Cloudinary/Email):

```env
MONGODB_URI=mongodb://localhost:27017/espsoln
MONGODB_DB=espsoln
JWT_SECRET=change-this-to-a-long-random-string-min-32-chars
JWT_EXPIRES_IN=7d
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
