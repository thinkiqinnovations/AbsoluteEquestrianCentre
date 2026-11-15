import { addDays, civilDate } from '../packages/shared/src/scheduling.js';
import { sampleOverrides, sampleRules } from '../apps/api/src/availability-store.js';
import { prisma } from '../apps/api/src/database.js';
import { demoAgreements, demoPartBoardLessons, demoTemplates, demoUsage, PlanningRepository } from '../apps/api/src/planning-repository.js';
import { demoTimestamp, store } from '../apps/api/src/store.js';

async function seed() {
  if (!prisma || process.env.DEMO_SEED !== '1' || process.env.NODE_ENV === 'production' ||
    (process.env.BILLING_ENABLED && process.env.BILLING_ENABLED !== 'false')) {
    throw new Error('Set DATABASE_URL and DEMO_SEED=1 for a development database with billing disabled.');
  }

  const timestamp = new Date(demoTimestamp);
  await prisma.$transaction(async (db) => {
    const planning = new PlanningRepository(db);
    for (const { id, createdAt, updatedAt, ...fields } of store.horses) {
      await db.horse.upsert({ where: { id }, create: { id, ...fields, createdAt, updatedAt }, update: { ...fields, updatedAt } });
    }
    for (const { id, createdAt, updatedAt, preferences, ...fields } of store.riders) {
      await db.rider.upsert({ where: { id }, create: { id, ...fields, createdAt, updatedAt }, update: { ...fields, updatedAt } });
      for (const preference of preferences) {
        await db.riderHorsePreference.upsert({
          where: { riderId_horseId: { riderId: id, horseId: preference.horseId } },
          create: { riderId: id, ...preference }, update: preference,
        });
      }
    }
    for (const { id, createdAt, updatedAt, ...fields } of store.coaches) {
      await db.coach.upsert({ where: { id }, create: { id, ...fields, createdAt, updatedAt }, update: { ...fields, updatedAt } });
    }
    for (const rule of sampleRules) {
      await db.availabilityRule.upsert({ where: { id: rule.id }, create: rule, update: rule });
    }
    for (const override of sampleOverrides) {
      const data = { ...override, date: civilDate(override.date) };
      await db.availabilityOverride.upsert({ where: { id: override.id }, create: data, update: data });
    }

    for (const { id, startDate, endDate, preferredRideTimes, ...fields } of demoAgreements) {
      const data = { ...fields, startDate: civilDate(startDate), endDate: endDate ? civilDate(endDate) : null, updatedAt: timestamp };
      await db.partBoardAgreement.upsert({ where: { id }, create: { id, createdAt: timestamp, ...data }, update: data });
      for (const preference of preferredRideTimes) {
        const { preferenceRank } = preference;
        await db.partBoardPreferredRideTime.upsert({
          where: { agreementId_preferenceRank: { agreementId: id, preferenceRank } },
          create: { id: `preference-${id}-${preferenceRank}`, agreementId: id, ...preference },
          update: preference,
        });
      }
    }
    const templateIds = new Set((await planning.templates()).map(({ id }) => id));
    for (const template of demoTemplates) {
      await planning.saveTemplate(template, templateIds.has(template.id));
      await db.recurringLessonTemplate.update({ where: { id: template.id }, data: { createdAt: timestamp, updatedAt: timestamp } });
    }

    for (const { id, createdAt, updatedAt, date, occurrenceDate, ...fields } of [...store.lessons, ...demoPartBoardLessons]) {
      const data = { ...fields, date: civilDate(date), occurrenceDate: occurrenceDate ? civilDate(occurrenceDate) : null, updatedAt };
      await db.lesson.upsert({ where: { id }, create: { id, createdAt, ...data }, update: data });
    }
    for (const { agreementId, lessonId, entitlementDate, quantity } of demoUsage) {
      const data = { agreementId, entitlementDate: civilDate(entitlementDate), quantity, reversedAt: null };
      await db.partBoardEntitlementUsage.upsert({
        where: { lessonId }, create: { id: `usage-${lessonId}`, lessonId, ...data, createdAt: timestamp }, update: data,
      });
    }

    // Persist the second occurrence of each template. The first self ride conflicts with Sassy's rest override.
    for (const { id, startDate, lesson, partBoardAgreementId } of demoTemplates) {
      const lessonId = `seed-occurrence-${id}`;
      const date = civilDate(addDays(startDate, 7));
      const existing = await db.lesson.findUnique({
        where: { recurringTemplateId_occurrenceDate: { recurringTemplateId: id, occurrenceDate: date } },
        select: { id: true },
      });
      if (existing && existing.id !== lessonId) continue;
      const data = { ...lesson, date, occurrenceDate: date, recurringTemplateId: id, partBoardAgreementId, updatedAt: timestamp };
      await db.lesson.upsert({ where: { id: lessonId }, create: { id: lessonId, createdAt: timestamp, ...data }, update: data });
      if (partBoardAgreementId && lesson.consumeEntitlement) {
        const usage = { agreementId: partBoardAgreementId, entitlementDate: date, reversedAt: null, quantity: 1 };
        await db.partBoardEntitlementUsage.upsert({
          where: { lessonId }, create: { id: `usage-${lessonId}`, lessonId, createdAt: timestamp, ...usage }, update: usage,
        });
      }
    }
  }, { timeout: 30000 });
  console.log('Seeded fictional scheduling, availability, part-board, and recurrence demos.');
}

void seed().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => prisma?.$disconnect());
