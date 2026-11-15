-- CreateEnum
CREATE TYPE "PartBoardAgreementStatus" AS ENUM ('ACTIVE', 'PAUSED', 'ENDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "EntitlementPeriod" AS ENUM ('WEEK', 'MONTH');

-- CreateEnum
CREATE TYPE "RecurringTemplateStatus" AS ENUM ('ACTIVE', 'PAUSED', 'ENDED');

-- AlterTable
ALTER TABLE "Lesson" ADD COLUMN     "consumeEntitlement" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "occurrenceDate" DATE,
ADD COLUMN     "partBoardAgreementId" TEXT,
ADD COLUMN     "recurringTemplateId" TEXT,
ALTER COLUMN "coachId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "PartBoardAgreement" (
    "id" TEXT NOT NULL,
    "riderId" TEXT NOT NULL,
    "horseId" TEXT NOT NULL,
    "status" "PartBoardAgreementStatus" NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "freeRidesPerPeriod" INTEGER NOT NULL,
    "entitlementPeriod" "EntitlementPeriod" NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartBoardAgreement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartBoardPreferredRideTime" (
    "id" TEXT NOT NULL,
    "agreementId" TEXT NOT NULL,
    "dayOfWeek" "DayOfWeek" NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "preferenceRank" INTEGER NOT NULL,
    "notes" TEXT,

    CONSTRAINT "PartBoardPreferredRideTime_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartBoardEntitlementUsage" (
    "id" TEXT NOT NULL,
    "agreementId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "entitlementDate" DATE NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "reversedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartBoardEntitlementUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecurringLessonTemplate" (
    "id" TEXT NOT NULL,
    "riderId" TEXT NOT NULL,
    "horseId" TEXT NOT NULL,
    "coachId" TEXT,
    "partBoardAgreementId" TEXT,
    "dayOfWeek" "DayOfWeek" NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "lessonType" "LessonType" NOT NULL,
    "discipline" "Discipline" NOT NULL,
    "rideUnits" DECIMAL(4,2) NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "status" "RecurringTemplateStatus" NOT NULL,
    "schedulingPriority" INTEGER NOT NULL,
    "consumeEntitlement" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecurringLessonTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PartBoardAgreement_riderId_status_idx" ON "PartBoardAgreement"("riderId", "status");

-- CreateIndex
CREATE INDEX "PartBoardAgreement_horseId_status_idx" ON "PartBoardAgreement"("horseId", "status");

-- CreateIndex
CREATE INDEX "PartBoardAgreement_horseId_startDate_endDate_idx" ON "PartBoardAgreement"("horseId", "startDate", "endDate");

-- CreateIndex
CREATE UNIQUE INDEX "PartBoardPreferredRideTime_agreementId_preferenceRank_key" ON "PartBoardPreferredRideTime"("agreementId", "preferenceRank");

-- CreateIndex
CREATE UNIQUE INDEX "PartBoardEntitlementUsage_lessonId_key" ON "PartBoardEntitlementUsage"("lessonId");

-- CreateIndex
CREATE INDEX "PartBoardEntitlementUsage_agreementId_entitlementDate_idx" ON "PartBoardEntitlementUsage"("agreementId", "entitlementDate");

-- CreateIndex
CREATE INDEX "RecurringLessonTemplate_status_startDate_endDate_idx" ON "RecurringLessonTemplate"("status", "startDate", "endDate");

-- CreateIndex
CREATE UNIQUE INDEX "Lesson_recurringTemplateId_occurrenceDate_key" ON "Lesson"("recurringTemplateId", "occurrenceDate");

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_partBoardAgreementId_fkey" FOREIGN KEY ("partBoardAgreementId") REFERENCES "PartBoardAgreement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_recurringTemplateId_fkey" FOREIGN KEY ("recurringTemplateId") REFERENCES "RecurringLessonTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartBoardAgreement" ADD CONSTRAINT "PartBoardAgreement_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "Rider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartBoardAgreement" ADD CONSTRAINT "PartBoardAgreement_horseId_fkey" FOREIGN KEY ("horseId") REFERENCES "Horse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartBoardPreferredRideTime" ADD CONSTRAINT "PartBoardPreferredRideTime_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "PartBoardAgreement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartBoardEntitlementUsage" ADD CONSTRAINT "PartBoardEntitlementUsage_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "PartBoardAgreement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartBoardEntitlementUsage" ADD CONSTRAINT "PartBoardEntitlementUsage_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringLessonTemplate" ADD CONSTRAINT "RecurringLessonTemplate_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "Rider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringLessonTemplate" ADD CONSTRAINT "RecurringLessonTemplate_horseId_fkey" FOREIGN KEY ("horseId") REFERENCES "Horse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringLessonTemplate" ADD CONSTRAINT "RecurringLessonTemplate_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "Coach"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringLessonTemplate" ADD CONSTRAINT "RecurringLessonTemplate_partBoardAgreementId_fkey" FOREIGN KEY ("partBoardAgreementId") REFERENCES "PartBoardAgreement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
