-- Country/City reference data tables. Structure only — the ~153k rows of
-- actual data are loaded by scripts/seedCountriesCities.ts (run once after
-- this migration), not baked into this SQL file.

CREATE TABLE "Country" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "iso2" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameFa" TEXT,
    "nameDe" TEXT,
    "emoji" TEXT
);
CREATE UNIQUE INDEX "Country_iso2_key" ON "Country"("iso2");

CREATE TABLE "City" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "countryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    CONSTRAINT "City_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "City_countryId_idx" ON "City"("countryId");
CREATE INDEX "City_name_idx" ON "City"("name");
