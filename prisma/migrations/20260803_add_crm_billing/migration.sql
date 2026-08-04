-- Hand-written (not `prisma migrate diff` output). This project's SQLite
-- migration engine fully redefines (DROP+CREATE+re-INSERT) any table that
-- gains a new FK-bearing column pointed at it from elsewhere — adding these
-- brand-new tables via plain CREATE TABLE avoids touching any existing table
-- at all, so there is no rewrite risk on production data.

CREATE TABLE "CrmProduct" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "sku" TEXT,
  "description" TEXT,
  "price" REAL NOT NULL,
  "unit" TEXT,
  "taxRate" REAL NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "CrmProduct_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "CrmDealProduct" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "dealId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "quantity" REAL NOT NULL DEFAULT 1,
  "priceAtSale" REAL NOT NULL,
  CONSTRAINT "CrmDealProduct_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "CrmDeal" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CrmDealProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "CrmProduct" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "CrmInvoice" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "contactId" TEXT NOT NULL,
  "dealId" TEXT,
  "invoiceNumber" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "issueDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "dueDate" DATETIME,
  "paidAt" DATETIME,
  "subtotal" REAL NOT NULL DEFAULT 0,
  "taxTotal" REAL NOT NULL DEFAULT 0,
  "discount" REAL NOT NULL DEFAULT 0,
  "total" REAL NOT NULL DEFAULT 0,
  "currency" TEXT NOT NULL DEFAULT 'IRT',
  "notes" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "CrmInvoice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CrmInvoice_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "CrmContact" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CrmInvoice_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "CrmDeal" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "CrmInvoice_invoiceNumber_key" ON "CrmInvoice"("invoiceNumber");

CREATE TABLE "CrmInvoiceItem" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "invoiceId" TEXT NOT NULL,
  "productId" TEXT,
  "description" TEXT NOT NULL,
  "quantity" REAL NOT NULL DEFAULT 1,
  "unitPrice" REAL NOT NULL,
  "taxRate" REAL NOT NULL DEFAULT 0,
  "lineTotal" REAL NOT NULL,
  CONSTRAINT "CrmInvoiceItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "CrmInvoice" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CrmInvoiceItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "CrmProduct" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "CrmContractTemplate" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "industrySlug" TEXT,
  "content" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CrmContractTemplate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "CrmContract" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "contactId" TEXT NOT NULL,
  "dealId" TEXT,
  "templateId" TEXT,
  "title" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "signedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "CrmContract_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CrmContract_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "CrmContact" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CrmContract_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "CrmDeal" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CrmContract_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "CrmContractTemplate" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "CrmNote" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "contactId" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "isPinned" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "CrmNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CrmNote_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "CrmContact" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "CrmProduct_userId_idx" ON "CrmProduct"("userId");
CREATE INDEX "CrmDealProduct_dealId_idx" ON "CrmDealProduct"("dealId");
CREATE INDEX "CrmDealProduct_productId_idx" ON "CrmDealProduct"("productId");
CREATE INDEX "CrmInvoice_userId_idx" ON "CrmInvoice"("userId");
CREATE INDEX "CrmInvoice_contactId_idx" ON "CrmInvoice"("contactId");
CREATE INDEX "CrmInvoice_dealId_idx" ON "CrmInvoice"("dealId");
CREATE INDEX "CrmInvoiceItem_invoiceId_idx" ON "CrmInvoiceItem"("invoiceId");
CREATE INDEX "CrmContractTemplate_userId_idx" ON "CrmContractTemplate"("userId");
CREATE INDEX "CrmContract_userId_idx" ON "CrmContract"("userId");
CREATE INDEX "CrmContract_contactId_idx" ON "CrmContract"("contactId");
CREATE INDEX "CrmContract_dealId_idx" ON "CrmContract"("dealId");
CREATE INDEX "CrmNote_userId_idx" ON "CrmNote"("userId");
CREATE INDEX "CrmNote_contactId_idx" ON "CrmNote"("contactId");
