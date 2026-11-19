-- CreateTable
CREATE TABLE "Plan" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "priceCents" INTEGER NOT NULL,
    "pricePeriod" TEXT NOT NULL,
    "hstIncluded" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "effectiveFrom" DATE NOT NULL,
    "effectiveTo" DATE,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "durationMinutes" INTEGER,
    "includedQuantity" INTEGER,
    "additionalUnitPriceCents" INTEGER,
    "paymentMethodRule" TEXT NOT NULL DEFAULT 'UNRESTRICTED',
    "paymentInstructions" TEXT NOT NULL DEFAULT '',
    "daysPerWeek" INTEGER,
    "activityTypes" TEXT[],

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanEntitlement" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "activityTypes" TEXT[],
    "quantity" INTEGER NOT NULL,
    "period" TEXT NOT NULL DEFAULT 'MONTH',

    CONSTRAINT "PlanEntitlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiderPlanEnrollment" (
    "id" TEXT NOT NULL,
    "riderId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "agreementId" TEXT,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "RiderPlanEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityBooking" (
    "id" TEXT NOT NULL,
    "activityType" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "endDate" DATE,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "coachId" TEXT,
    "location" TEXT NOT NULL DEFAULT '',
    "capacity" INTEGER,
    "status" "LessonStatus" NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActivityBooking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityParticipant" (
    "id" TEXT NOT NULL,
    "relationshipOverrideReason" TEXT NOT NULL DEFAULT '',
    "bookingId" TEXT NOT NULL,
    "riderId" TEXT NOT NULL,
    "horseId" TEXT,
    "lessonId" TEXT,
    "planId" TEXT,
    "publishedPriceCents" INTEGER NOT NULL DEFAULT 0,
    "amountCents" INTEGER NOT NULL DEFAULT 0,
    "hstIncluded" BOOLEAN NOT NULL DEFAULT true,
    "paymentMethodRule" TEXT NOT NULL DEFAULT 'UNRESTRICTED',
    "paymentInstructions" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "ActivityParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanUsage" (
    "id" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "entitlementId" TEXT NOT NULL,
    "serviceDate" DATE NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'USED',
    "overrideReason" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "PlanUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Plan_code_key" ON "Plan"("code");

-- CreateIndex
CREATE INDEX "PlanEntitlement_planId_idx" ON "PlanEntitlement"("planId");

-- CreateIndex
CREATE INDEX "RiderPlanEnrollment_riderId_status_idx" ON "RiderPlanEnrollment"("riderId", "status");

-- CreateIndex
CREATE INDEX "RiderPlanEnrollment_agreementId_idx" ON "RiderPlanEnrollment"("agreementId");

-- CreateIndex
CREATE INDEX "ActivityBooking_date_endDate_idx" ON "ActivityBooking"("date", "endDate");

-- CreateIndex
CREATE UNIQUE INDEX "ActivityParticipant_lessonId_key" ON "ActivityParticipant"("lessonId");

-- CreateIndex
CREATE UNIQUE INDEX "ActivityParticipant_bookingId_riderId_key" ON "ActivityParticipant"("bookingId", "riderId");

-- CreateIndex
CREATE UNIQUE INDEX "PlanUsage_participantId_key" ON "PlanUsage"("participantId");

-- CreateIndex
CREATE INDEX "PlanUsage_enrollmentId_entitlementId_serviceDate_idx" ON "PlanUsage"("enrollmentId", "entitlementId", "serviceDate");

-- AddForeignKey
ALTER TABLE "PlanEntitlement" ADD CONSTRAINT "PlanEntitlement_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiderPlanEnrollment" ADD CONSTRAINT "RiderPlanEnrollment_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "Rider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiderPlanEnrollment" ADD CONSTRAINT "RiderPlanEnrollment_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiderPlanEnrollment" ADD CONSTRAINT "RiderPlanEnrollment_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "PartBoardAgreement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityParticipant" ADD CONSTRAINT "ActivityParticipant_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "ActivityBooking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityParticipant" ADD CONSTRAINT "ActivityParticipant_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "Rider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityParticipant" ADD CONSTRAINT "ActivityParticipant_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityParticipant" ADD CONSTRAINT "ActivityParticipant_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanUsage" ADD CONSTRAINT "PlanUsage_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "ActivityParticipant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanUsage" ADD CONSTRAINT "PlanUsage_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "RiderPlanEnrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanUsage" ADD CONSTRAINT "PlanUsage_entitlementId_fkey" FOREIGN KEY ("entitlementId") REFERENCES "PlanEntitlement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Operational constraints apply to configured prices and usage, independently of payment processing.
ALTER TABLE "Plan" ADD CONSTRAINT "Plan_prices_nonnegative" CHECK ("priceCents" >= 0 AND ("additionalUnitPriceCents" IS NULL OR "additionalUnitPriceCents" >= 0) AND ("includedQuantity" IS NULL OR "includedQuantity" >= 0));
ALTER TABLE "PlanEntitlement" ADD CONSTRAINT "PlanEntitlement_quantity_positive" CHECK ("quantity" > 0 AND "period" = 'MONTH');
ALTER TABLE "ActivityParticipant" ADD CONSTRAINT "ActivityParticipant_prices_nonnegative" CHECK ("publishedPriceCents" >= 0 AND "amountCents" >= 0);
ALTER TABLE "PlanUsage" ADD CONSTRAINT "PlanUsage_status_quantity" CHECK ("quantity" > 0 AND "status" IN ('USED', 'CANCELLED', 'RESTORED'));
ALTER TABLE "RiderPlanEnrollment" ADD CONSTRAINT "RiderPlanEnrollment_status_dates" CHECK ("status" IN ('ACTIVE', 'PAUSED', 'ENDED') AND ("endDate" IS NULL OR "endDate" >= "startDate"));
ALTER TABLE "Plan" ADD CONSTRAINT "Plan_cash_only_grooming" CHECK (NOT ('GROOMING_TACKING' = ANY("activityTypes")) OR "paymentMethodRule" = 'CASH_ONLY');
