-- CreateEnum
CREATE TYPE "RecordedPaymentStatus" AS ENUM ('PAID', 'UNPAID', 'UNRECORDED');

-- CreateEnum
CREATE TYPE "MonthlyPaymentKind" AS ENUM ('MONTHLY', 'PART_BOARD');

-- CreateTable
CREATE TABLE "LessonPaymentStatus" (
    "lessonId" TEXT NOT NULL,
    "status" "RecordedPaymentStatus" NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LessonPaymentStatus_pkey" PRIMARY KEY ("lessonId")
);

-- CreateTable
CREATE TABLE "RiderMonthlyPaymentStatus" (
    "riderId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "kind" "MonthlyPaymentKind" NOT NULL,
    "status" "RecordedPaymentStatus" NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RiderMonthlyPaymentStatus_pkey" PRIMARY KEY ("riderId","month","kind")
);

-- CreateIndex
CREATE INDEX "RiderMonthlyPaymentStatus_month_idx" ON "RiderMonthlyPaymentStatus"("month");

-- AddForeignKey
ALTER TABLE "LessonPaymentStatus" ADD CONSTRAINT "LessonPaymentStatus_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiderMonthlyPaymentStatus" ADD CONSTRAINT "RiderMonthlyPaymentStatus_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "Rider"("id") ON DELETE CASCADE ON UPDATE CASCADE;
