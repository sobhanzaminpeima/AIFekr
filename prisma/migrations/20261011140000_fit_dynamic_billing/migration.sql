-- CreateTable
CREATE TABLE "BillingExchangeRate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "source" TEXT NOT NULL DEFAULT 'USD',
    "target" TEXT NOT NULL,
    "rate" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "rateType" TEXT NOT NULL,
    "approvedBy" TEXT,
    "validUntil" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "BillingQuote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "planCode" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "amountToman" INTEGER NOT NULL,
    "snapshot" TEXT NOT NULL,
    "paymentId" TEXT,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BillingQuote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FitnessProfile" (
    "userId" TEXT NOT NULL PRIMARY KEY,
    "age" INTEGER NOT NULL,
    "goal" TEXT NOT NULL,
    "level" TEXT NOT NULL DEFAULT 'BEGINNER',
    "equipment" TEXT NOT NULL DEFAULT '[]',
    "limitations" TEXT NOT NULL DEFAULT '',
    "dietaryPreferences" TEXT NOT NULL DEFAULT '',
    "allergens" TEXT NOT NULL DEFAULT '',
    "consentAt" DATETIME NOT NULL,
    "entitlementExpiry" DATETIME,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FitnessProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FitnessTrainer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'HUMAN',
    "status" TEXT NOT NULL DEFAULT 'DEMO',
    "biography" TEXT NOT NULL,
    "specializations" TEXT NOT NULL DEFAULT '[]',
    "languages" TEXT NOT NULL DEFAULT '[]',
    "country" TEXT NOT NULL DEFAULT '',
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "image" TEXT NOT NULL,
    "certifications" TEXT NOT NULL DEFAULT '[]',
    "consentAt" DATETIME,
    "priceMinor" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "capacity" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FitnessTrainer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FitnessExercise" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "instructions" TEXT NOT NULL,
    "equipment" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "videoUrl" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "FitnessProgram" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "trainerId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "content" TEXT NOT NULL,
    "minutes" INTEGER NOT NULL DEFAULT 30,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FitnessProgram_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "FitnessTrainer" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FitnessSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "programSnapshot" TEXT NOT NULL,
    "clientKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "revision" INTEGER NOT NULL DEFAULT 0,
    "recovery" INTEGER NOT NULL DEFAULT 3,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    CONSTRAINT "FitnessSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FitnessSession_programId_fkey" FOREIGN KEY ("programId") REFERENCES "FitnessProgram" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FitnessSetLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "setNumber" INTEGER NOT NULL,
    "repetitions" INTEGER NOT NULL,
    "weightGrams" INTEGER NOT NULL DEFAULT 0,
    "rpe" INTEGER,
    "rir" INTEGER,
    "completed" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "FitnessSetLog_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "FitnessSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FitnessDiary" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "day" DATETIME NOT NULL,
    "kind" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FitnessDiary_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FitnessProduct" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "trainerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "priceMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "inventory" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT NOT NULL,
    "digitalAsset" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FitnessProduct_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "FitnessTrainer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BillingPromotion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "configuration" TEXT NOT NULL,
    "startsAt" DATETIME NOT NULL,
    "endsAt" DATETIME NOT NULL,
    "maxRedemptions" INTEGER NOT NULL DEFAULT 1000
);

-- CreateTable
CREATE TABLE "BillingPromotionRedemption" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "promotionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BillingPromotionRedemption_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "BillingPromotion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Package" (
    "category" TEXT NOT NULL DEFAULT 'PERSONAL',
    "publicationStatus" TEXT NOT NULL DEFAULT 'PUBLISHED',
    "publicVisible" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT NOT NULL DEFAULT '',
    "baseCurrency" TEXT NOT NULL DEFAULT 'USD',
    "termPrices" TEXT NOT NULL DEFAULT '{}',
    "entitlements" TEXT NOT NULL DEFAULT '{}',
    "badge" TEXT NOT NULL DEFAULT '',
    "studentEligibility" TEXT NOT NULL DEFAULT 'ACCOUNT_TYPE',
    "creditAllocation" TEXT NOT NULL DEFAULT 'TERM',
    "mediaCredits" INTEGER NOT NULL DEFAULT 0,
    "voiceMinutes" INTEGER NOT NULL DEFAULT 0,
    "crmContactLimit" INTEGER NOT NULL DEFAULT 0,
    "trialEligible" BOOLEAN NOT NULL DEFAULT false,
    "promoEligible" BOOLEAN NOT NULL DEFAULT false,
    "id" TEXT NOT NULL PRIMARY KEY,
    "planCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "priceUsd" INTEGER,
    "priceTry" INTEGER,
    "market" TEXT NOT NULL DEFAULT 'IR',
    "duration" INTEGER NOT NULL DEFAULT 30,
    "credits" INTEGER NOT NULL,
    "features" TEXT NOT NULL,
    "featuresEn" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "color" TEXT NOT NULL DEFAULT '#ea580c',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "crmSeatLimit" INTEGER,
    "teamSeatLimit" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Package" ("color", "createdAt", "credits", "crmSeatLimit", "duration", "features", "featuresEn", "id", "isActive", "isFeatured", "market", "name", "nameEn", "planCode", "price", "priceTry", "priceUsd", "sortOrder", "teamSeatLimit", "updatedAt") SELECT "color", "createdAt", "credits", "crmSeatLimit", "duration", "features", "featuresEn", "id", "isActive", "isFeatured", "market", "name", "nameEn", "planCode", "price", "priceTry", "priceUsd", "sortOrder", "teamSeatLimit", "updatedAt" FROM "Package";
DROP TABLE "Package";
ALTER TABLE "new_Package" RENAME TO "Package";
CREATE UNIQUE INDEX "Package_planCode_key" ON "Package"("planCode");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "BillingExchangeRate_target_createdAt_idx" ON "BillingExchangeRate"("target", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "BillingQuote_paymentId_key" ON "BillingQuote"("paymentId");

-- CreateIndex
CREATE INDEX "BillingQuote_userId_expiresAt_idx" ON "BillingQuote"("userId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "FitnessTrainer_slug_key" ON "FitnessTrainer"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "FitnessTrainer_userId_key" ON "FitnessTrainer"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "FitnessExercise_slug_key" ON "FitnessExercise"("slug");

-- CreateIndex
CREATE INDEX "FitnessSession_userId_startedAt_idx" ON "FitnessSession"("userId", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "FitnessSession_userId_clientKey_key" ON "FitnessSession"("userId", "clientKey");

-- CreateIndex
CREATE UNIQUE INDEX "FitnessSetLog_sessionId_exerciseId_setNumber_key" ON "FitnessSetLog"("sessionId", "exerciseId", "setNumber");

-- CreateIndex
CREATE INDEX "FitnessDiary_userId_day_idx" ON "FitnessDiary"("userId", "day");

-- CreateIndex
CREATE UNIQUE INDEX "BillingPromotionRedemption_paymentId_key" ON "BillingPromotionRedemption"("paymentId");

-- CreateIndex
CREATE UNIQUE INDEX "BillingPromotionRedemption_promotionId_userId_key" ON "BillingPromotionRedemption"("promotionId", "userId");


UPDATE Package SET category='BUSINESS' WHERE planCode LIKE 'TEAM_%' OR planCode LIKE 'CRM_%' OR planCode LIKE 'VOICE_%';
UPDATE Package SET category='STUDENT',baseCurrency='TRY' WHERE planCode LIKE 'STUDENT_%';
UPDATE Package SET publicVisible=0 WHERE planCode LIKE 'CREDITS_%' OR planCode='STUDENT_FIRST_TWO_MONTHS' OR planCode='STUDENT_FIRST_THREE_MONTHS' OR planCode='STUDENT_QUARTERLY';
UPDATE Package SET priceUsd=21900,baseCurrency='USD',termPrices='{"monthly":21900,"quarterly":57900}' WHERE planCode='TEAM_BUSINESS_GROW';
UPDATE Package SET priceUsd=34900,baseCurrency='USD',termPrices='{"monthly":34900,"quarterly":94900}' WHERE planCode='TEAM_BUSINESS_SCALE';
UPDATE Package SET priceTry=119900,baseCurrency='TRY',termPrices='{"monthly":119900,"quarterly":279900}',duration=30,isActive=1,publicVisible=1,publicationStatus='PUBLISHED',category='STUDENT',nameEn='AIFekr Student' WHERE planCode='STUDENT_MONTHLY';
UPDATE Package SET priceTry=279900 WHERE planCode='STUDENT_QUARTERLY';
INSERT INTO Package(id,planCode,name,nameEn,price,priceUsd,market,duration,credits,features,featuresEn,category,baseCurrency,termPrices,entitlements,publicationStatus,publicVisible,isActive,isFeatured,updatedAt) VALUES('fit-standard-v1','FIT_MONTHLY','AIFekr FIT','AIFekr FIT',0,5000,'BOTH',30,1000,'مربی AI، برنامه تمرین، ثبت ست، تاریخچه، دفتر تغذیه','AI coaches, workout programs, set logging, history, nutrition diary','FITNESS','USD','{"monthly":5000,"quarterly":15000,"semiannual":30000}','{"modules":["fitness.workspace"],"agents":["fitness.coach"],"limits":{}}','PUBLISHED',1,1,0,CURRENT_TIMESTAMP);
INSERT INTO FitnessTrainer(id,slug,name,type,status,biography,image,languages,specializations) VALUES('fika','fika','FIKA FIT','AI','ACTIVE','AI coach for general fitness, strength foundations, mobility and healthy habits.','/fitness/fika.png','["en", "fa", "tr", "ar"]','["General fitness", "Strength", "Mobility"]');
INSERT INTO FitnessTrainer(id,slug,name,type,status,biography,image,languages,specializations) VALUES('fiko','fiko','FIKO FIT','AI','ACTIVE','AI coach for general strength training, workout education and consistent habits.','/fitness/fiko.png','["en", "fa", "tr", "ar"]','["General fitness", "Strength", "Mobility"]');
INSERT INTO FitnessTrainer(id,slug,name,type,status,biography,image,languages,specializations) VALUES('gel4re','gel4re','Gel4re','HUMAN','DEMO','Demonstration profile. No verified human credentials or bookings are available.','/fitness/gel4re.png','["en", "fa", "tr", "ar"]','["General fitness", "Strength", "Mobility"]');
INSERT INTO FitnessTrainer(id,slug,name,type,status,biography,image,languages,specializations) VALUES('misagh','misagh','Misagh','HUMAN','DEMO','Demonstration profile. Pending actual trainer consent and credential review.','/fitness/misagh.png','["en", "fa", "tr", "ar"]','["General fitness", "Strength", "Mobility"]');
INSERT INTO FitnessExercise(id,slug,name,instructions,equipment,category) VALUES('squat','squat','Bodyweight squat','Stand with feet comfortable. Sit back within a pain-free range. Keep breathing; use a chair if needed.','BODYWEIGHT','STRENGTH');
INSERT INTO FitnessExercise(id,slug,name,instructions,equipment,category) VALUES('push','push','Wall / incline push-up','Use a stable wall or incline. Keep a straight trunk. Lower slowly within a comfortable range.','BODYWEIGHT','STRENGTH');
INSERT INTO FitnessExercise(id,slug,name,instructions,equipment,category) VALUES('row','row','Light dumbbell row','Support the trunk. Draw the elbow back without twisting. Use a light manageable weight.','DUMBBELL','STRENGTH');
INSERT INTO FitnessExercise(id,slug,name,instructions,equipment,category) VALUES('hinge','hinge','Unloaded hip hinge','Soften knees and move hips back while keeping a neutral trunk. Do not force range.','BODYWEIGHT','STRENGTH');
INSERT INTO FitnessExercise(id,slug,name,instructions,equipment,category) VALUES('bridge','bridge','Glute bridge','Lie on the back, knees bent. Lift hips comfortably without arching the lower back.','BODYWEIGHT','STRENGTH');
INSERT INTO FitnessExercise(id,slug,name,instructions,equipment,category) VALUES('march','march','Easy standing march','March slowly on a stable surface. Keep a comfortable pace and use support if needed.','BODYWEIGHT','CARDIO');
INSERT INTO FitnessExercise(id,slug,name,instructions,equipment,category) VALUES('mobility','mobility','Gentle shoulder mobility','Move shoulders slowly through a comfortable pain-free range. Never force a stretch.','BODYWEIGHT','MOBILITY');
INSERT INTO FitnessExercise(id,slug,name,instructions,equipment,category) VALUES('calf','calf','Supported calf raise','Hold stable support. Rise onto toes smoothly and lower with control.','BODYWEIGHT','STRENGTH');
INSERT INTO FitnessProgram(id,title,description,level,status,content,minutes) VALUES('fit-program-0','Beginner Full Body','Editable starter template for adults. Start conservatively; stop for pain. Rest between sessions. General education, not an individualized medical prescription.','BEGINNER','PUBLISHED','[{"exerciseId": "squat", "sets": 2, "reps": 8, "rest": 75, "tempo": "Controlled; comfortable range"}, {"exerciseId": "push", "sets": 2, "reps": 8, "rest": 75, "tempo": "Controlled; comfortable range"}, {"exerciseId": "row", "sets": 2, "reps": 8, "rest": 75, "tempo": "Controlled; comfortable range"}, {"exerciseId": "bridge", "sets": 2, "reps": 8, "rest": 75, "tempo": "Controlled; comfortable range"}]',30);
INSERT INTO FitnessProgram(id,title,description,level,status,content,minutes) VALUES('fit-program-1','Strength Foundations','Editable starter template for adults. Start conservatively; stop for pain. Rest between sessions. General education, not an individualized medical prescription.','BEGINNER','PUBLISHED','[{"exerciseId": "squat", "sets": 2, "reps": 8, "rest": 75, "tempo": "Controlled; comfortable range"}, {"exerciseId": "hinge", "sets": 2, "reps": 8, "rest": 75, "tempo": "Controlled; comfortable range"}, {"exerciseId": "row", "sets": 2, "reps": 8, "rest": 75, "tempo": "Controlled; comfortable range"}, {"exerciseId": "push", "sets": 2, "reps": 8, "rest": 75, "tempo": "Controlled; comfortable range"}]',30);
INSERT INTO FitnessProgram(id,title,description,level,status,content,minutes) VALUES('fit-program-2','Hypertrophy','Editable starter template for adults. Start conservatively; stop for pain. Rest between sessions. General education, not an individualized medical prescription.','BEGINNER','PUBLISHED','[{"exerciseId": "squat", "sets": 2, "reps": 8, "rest": 75, "tempo": "Controlled; comfortable range"}, {"exerciseId": "row", "sets": 2, "reps": 8, "rest": 75, "tempo": "Controlled; comfortable range"}, {"exerciseId": "push", "sets": 2, "reps": 8, "rest": 75, "tempo": "Controlled; comfortable range"}, {"exerciseId": "bridge", "sets": 2, "reps": 8, "rest": 75, "tempo": "Controlled; comfortable range"}]',30);
INSERT INTO FitnessProgram(id,title,description,level,status,content,minutes) VALUES('fit-program-3','Home Training','Editable starter template for adults. Start conservatively; stop for pain. Rest between sessions. General education, not an individualized medical prescription.','BEGINNER','PUBLISHED','[{"exerciseId": "squat", "sets": 2, "reps": 8, "rest": 75, "tempo": "Controlled; comfortable range"}, {"exerciseId": "push", "sets": 2, "reps": 8, "rest": 75, "tempo": "Controlled; comfortable range"}, {"exerciseId": "bridge", "sets": 2, "reps": 8, "rest": 75, "tempo": "Controlled; comfortable range"}, {"exerciseId": "calf", "sets": 2, "reps": 8, "rest": 75, "tempo": "Controlled; comfortable range"}]',30);
INSERT INTO FitnessProgram(id,title,description,level,status,content,minutes) VALUES('fit-program-4','Low Impact Cardio','Editable starter template for adults. Start conservatively; stop for pain. Rest between sessions. General education, not an individualized medical prescription.','BEGINNER','PUBLISHED','[{"exerciseId": "march", "sets": 2, "reps": 8, "rest": 75, "tempo": "Controlled; comfortable range"}, {"exerciseId": "calf", "sets": 2, "reps": 8, "rest": 75, "tempo": "Controlled; comfortable range"}, {"exerciseId": "mobility", "sets": 2, "reps": 8, "rest": 75, "tempo": "Controlled; comfortable range"}]',30);
INSERT INTO FitnessProgram(id,title,description,level,status,content,minutes) VALUES('fit-program-5','Mobility and Recovery','Editable starter template for adults. Start conservatively; stop for pain. Rest between sessions. General education, not an individualized medical prescription.','BEGINNER','PUBLISHED','[{"exerciseId": "mobility", "sets": 2, "reps": 8, "rest": 75, "tempo": "Controlled; comfortable range"}, {"exerciseId": "march", "sets": 2, "reps": 8, "rest": 75, "tempo": "Controlled; comfortable range"}]',30);
INSERT INTO FitnessProgram(id,title,description,level,status,content,minutes) VALUES('fit-program-6','Functional Fitness','Editable starter template for adults. Start conservatively; stop for pain. Rest between sessions. General education, not an individualized medical prescription.','BEGINNER','PUBLISHED','[{"exerciseId": "squat", "sets": 2, "reps": 8, "rest": 75, "tempo": "Controlled; comfortable range"}, {"exerciseId": "hinge", "sets": 2, "reps": 8, "rest": 75, "tempo": "Controlled; comfortable range"}, {"exerciseId": "row", "sets": 2, "reps": 8, "rest": 75, "tempo": "Controlled; comfortable range"}, {"exerciseId": "calf", "sets": 2, "reps": 8, "rest": 75, "tempo": "Controlled; comfortable range"}]',30);
INSERT INTO FitnessProgram(id,title,description,level,status,content,minutes) VALUES('fit-program-7','General Fitness Conditioning','Editable starter template for adults. Start conservatively; stop for pain. Rest between sessions. General education, not an individualized medical prescription.','BEGINNER','PUBLISHED','[{"exerciseId": "march", "sets": 2, "reps": 8, "rest": 75, "tempo": "Controlled; comfortable range"}, {"exerciseId": "squat", "sets": 2, "reps": 8, "rest": 75, "tempo": "Controlled; comfortable range"}, {"exerciseId": "push", "sets": 2, "reps": 8, "rest": 75, "tempo": "Controlled; comfortable range"}, {"exerciseId": "bridge", "sets": 2, "reps": 8, "rest": 75, "tempo": "Controlled; comfortable range"}]',30);
