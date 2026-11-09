CREATE TYPE "RiderLevel" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED');
CREATE TYPE "LessonType" AS ENUM ('PRIVATE', 'GROUP', 'PART_BOARD_RIDE');
CREATE TYPE "Discipline" AS ENUM ('FLAT', 'JUMP');
CREATE TYPE "LessonStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'COMPLETED', 'CANCELLED');

CREATE TABLE "Horse" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "description" TEXT,
  "walkCapable" BOOLEAN NOT NULL DEFAULT true,
  "trotCapable" BOOLEAN NOT NULL DEFAULT true,
  "canterCapable" BOOLEAN NOT NULL DEFAULT false,
  "supportsFlat" BOOLEAN NOT NULL DEFAULT true,
  "supportsJumping" BOOLEAN NOT NULL DEFAULT false,
  "minimumRiderLevel" "RiderLevel" NOT NULL,
  "maximumRiderLevel" "RiderLevel" NOT NULL,
  "maximumDailyRideUnits" DECIMAL(4,2) NOT NULL DEFAULT 1.5,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Horse_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Rider" (
  "id" TEXT NOT NULL,
  "firstName" TEXT NOT NULL,
  "lastName" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "overallLevel" "RiderLevel" NOT NULL,
  "flatLevel" "RiderLevel" NOT NULL,
  "jumpLevel" "RiderLevel" NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Rider_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Coach" (
  "id" TEXT NOT NULL,
  "firstName" TEXT NOT NULL,
  "lastName" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Coach_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RiderHorsePreference" (
  "riderId" TEXT NOT NULL,
  "horseId" TEXT NOT NULL,
  "preferenceOrder" INTEGER NOT NULL,
  "notes" TEXT,
  CONSTRAINT "RiderHorsePreference_pkey" PRIMARY KEY ("riderId", "horseId")
);

CREATE TABLE "Lesson" (
  "id" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "startTime" TEXT NOT NULL,
  "endTime" TEXT NOT NULL,
  "riderId" TEXT NOT NULL,
  "horseId" TEXT NOT NULL,
  "coachId" TEXT NOT NULL,
  "lessonType" "LessonType" NOT NULL,
  "discipline" "Discipline" NOT NULL,
  "rideUnits" DECIMAL(4,2) NOT NULL,
  "status" "LessonStatus" NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Lesson_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RiderHorsePreference_riderId_preferenceOrder_key" ON "RiderHorsePreference"("riderId", "preferenceOrder");
CREATE INDEX "Lesson_date_horseId_idx" ON "Lesson"("date", "horseId");
CREATE INDEX "Lesson_date_riderId_idx" ON "Lesson"("date", "riderId");
CREATE INDEX "Lesson_date_coachId_idx" ON "Lesson"("date", "coachId");
ALTER TABLE "RiderHorsePreference" ADD CONSTRAINT "RiderHorsePreference_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "Rider"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RiderHorsePreference" ADD CONSTRAINT "RiderHorsePreference_horseId_fkey" FOREIGN KEY ("horseId") REFERENCES "Horse"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "Rider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_horseId_fkey" FOREIGN KEY ("horseId") REFERENCES "Horse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "Coach"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
