CREATE TYPE "AvailabilityResourceType" AS ENUM ('RIDER', 'COACH', 'HORSE');
CREATE TYPE "AvailabilityType" AS ENUM ('AVAILABLE', 'UNAVAILABLE');
CREATE TYPE "DayOfWeek" AS ENUM ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY');

CREATE TABLE "AvailabilityRule" (
  "id" TEXT NOT NULL,
  "resourceType" "AvailabilityResourceType" NOT NULL,
  "resourceId" TEXT NOT NULL,
  "dayOfWeek" "DayOfWeek" NOT NULL,
  "startTime" TEXT NOT NULL,
  "endTime" TEXT NOT NULL,
  "availabilityType" "AvailabilityType" NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AvailabilityRule_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AvailabilityRule_resourceType_resourceId_dayOfWeek_idx" ON "AvailabilityRule"("resourceType", "resourceId", "dayOfWeek");

CREATE TABLE "AvailabilityOverride" (
  "id" TEXT NOT NULL,
  "resourceType" "AvailabilityResourceType" NOT NULL,
  "resourceId" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "startTime" TEXT NOT NULL,
  "endTime" TEXT NOT NULL,
  "availabilityType" "AvailabilityType" NOT NULL,
  "notes" TEXT,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AvailabilityOverride_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AvailabilityOverride_resourceType_resourceId_date_idx" ON "AvailabilityOverride"("resourceType", "resourceId", "date");
