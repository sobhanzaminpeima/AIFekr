# Hostinger deployment

AIFekr's existing production server uses SQLite. Hostinger Web Apps uses the
managed MySQL database instead. The application models remain defined once in
`prisma/schema.prisma`; the Hostinger build creates a temporary MySQL variant
and generates the Prisma client from it.

## Web App settings

- Repository: `sobhanzaminpeima/AIFekr`
- Branch: `main`
- Framework: Next.js
- Node.js: 22.x
- Root directory: `./`
- Build command: `npm run build:hostinger`
- Start command: `npm run start`
- Output directory: `.next`

Set `DATABASE_URL` to the URL-encoded Hostinger MySQL connection string. Set
`NEXTAUTH_URL` and `NEXT_PUBLIC_APP_URL` to `https://aifekr.com`.

`build:hostinger` validates the generated schema, generates the MySQL Prisma
client, applies the schema with `prisma db push`, and creates the Next.js
production build. It is safe for the first deployment to an empty database.
Back up the database before later schema deployments.

## Data migration

GitHub contains source code only. Before switching DNS, export the authoritative
SQLite database and private uploads from the existing server, transform/import
the records into Hostinger MySQL, and verify record counts and login flows.
Do not point the production domain at the new Web App while its database is
empty.
