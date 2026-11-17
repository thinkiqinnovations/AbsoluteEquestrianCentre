# Absolute Equestrian Scheduler — User Guide

## Purpose

Absolute Equestrian Scheduler helps barn staff plan lessons and self-rides while keeping horse workload, rider suitability, availability, and booking conflicts visible. This guide covers the completed Iteration 4 features.

> This application currently has no sign-in or roles. Only use it in a trusted staff environment. Payment collection and billing are not included.

## Start here

1. Open **Schedule**.
2. Use **Today**, **Previous**, and **Next** to choose the planning date.
3. Switch between **Day**, **Week**, and **Month** for the level of detail you need.
4. Use the coach, horse, rider, discipline, and lesson-type filters to focus the view.

The calendar uses the barn's configured local time zone. Lessons use a start and end time on the same calendar day.

## Schedule views

### Day

Day view is the main operational view. It shows the day's lessons grouped by coach and then by matching start and end times, each scheduled horse's workload, and any scheduling attention items. Coaches appear alphabetically, with riding times in chronological order. Coach-less bookings appear under Self ride.

- Select **+ Add Lesson** to create a booking.
- Select an existing lesson to edit it.
- Review the workload bar before adding another ride to a horse.
- Read errors as blockers and warnings as staff-review items.

### Week

Week view is useful for short-term planning. Select an empty time slot to start a lesson at that date and time, or select a lesson to edit it. The view expands when a lesson falls outside the usual daytime range. On phones and smaller tablets, a scrollable agenda lists all seven days with lessons ordered by riding time. Select a lesson to edit it, or use a day's Add lesson button to create a booking.

### Month

Month view shows lesson counts and compact daily indicators. Select a date, lesson, or **+N more** to open the relevant day. On a phone it appears as a scrollable agenda.

## Create or edit a lesson

1. Select **+ Add Lesson**, an empty Week slot, or an existing lesson.
2. Select the activity type, date, time, coach, and optional location. Add every participating rider. For mounted activities select discipline, ride units, and a horse for each rider.
3. Review each rider's eligible packages and current monthly usage. Choose the entitlement source or individual purchase. Published prices include HST. An exhausted entitlement requires an override reason.
4. Review the horse recommendation cards, then save the activity. All participants are saved together. Existing unassigned lessons open the legacy edit form.

The server is the final authority. It prevents invalid bookings such as a horse, rider, or coach being booked twice at overlapping times; a horse going over daily workload; an incompatible rider/horse pairing; or a jump lesson on a non-jumping horse.

### Understanding recommendations

Recommendations consider active status, rider level, discipline capability, overlaps, workload, availability, rider preferences, active part-board links, and recent assignments. A green/eligible card is a recommendation, not a guarantee: saving validates the latest schedule again.

Warnings request attention, for example an availability period that has not been configured. Errors must be resolved before the lesson can be saved.

### Shared lessons

For a new shared session, add all riders and their assigned horses in one activity. Semi-private requires exactly two riders for 30 minutes. Group requires three to six riders for 60 minutes. The application checks every rider and horse individually and saves the whole session atomically.

## Manage horses, riders, and coaches

### Horses

Open **Horses** to add, view, or edit a horse. Keep these fields accurate:

- active status
- walk, trot, canter, Flat, and Jump capability
- minimum and maximum rider level
- maximum daily ride units

Ride units measure workload, not lesson count. For example, a 0.5-unit ride plus a 1.0-unit ride uses 1.5 units of capacity.

### Riders

Open **Riders** to add, view, or edit riders. Set the overall, Flat, and Jump levels independently where needed. Maintain preferred horses in rank order; recommendations use these ranks as one input. Use **Plans & Entitlements** to enroll in a lesson package, edit enrollment dates/status, and review monthly usage. Part-board package enrollments are managed through their agreement.

### Coaches

Open **Coaches** to add, view, or edit coaches and see their lessons for the selected day. Coach availability is managed separately through Availability.

## Availability

Open **Availability** from a rider, horse, or coach context to manage:

- recurring weekly availability windows
- dated available or unavailable overrides

An override takes precedence over a recurring rule. A resource with recurring rules cannot be booked outside those rules unless an override opens the time. A resource with no configured recurring availability can still be booked, but the application displays a warning so staff can confirm it.

## Part Board

Open **Part Board** to manage rider–horse agreements, preferred ride times, and free-ride entitlements.

Select a Part Board package when creating or editing an agreement to establish its matching enrollment and monthly allowances. Existing unassigned agreements retain their legacy free-ride configuration.

- An agreement can be active, paused, ended, or cancelled.
- Free rides are scheduling entitlements, not payments.
- A part-board self-ride can be coach-less, but it still follows availability, compatibility, double-booking, and workload rules.
- New package-backed practice rides consume the selected monthly practice entitlement. Staff must provide a reason to override an exhausted package. Legacy unassigned rides retain their existing optional **consume entitlement** behavior.

## Recurring lessons

Create and manage weekly recurring templates from the Part Board area. Use **Generate lessons** to create valid future occurrences. The generation report identifies created, skipped, and failed dates. Resolve the reported issue (for example, an unavailable horse) and run generation again as needed.

Changing, pausing, or ending a template affects future generation; previously generated lessons remain on the calendar for historical accuracy.

## Manual payment status

Lesson and rider screens can record **Paid**, **Unpaid**, or **Unrecorded** as a manual operational note. These statuses do not collect money, create invoices, change bookings, or change free-ride entitlement use.

## Plans, services, and cancellations

Open **Plans & Pricing** to view published prices, package quantities, effective dates, and payment rules. All supplied prices include HST. Prices are operational classifications and saving an activity does not charge a rider.

Assessments last 30 minutes. Grooming & Tacking lasts 90 minutes and displays **Cash only - exact change please.** Birthday parties reserve two hours and include up to six riders for the configured base price, with the configured additional price for each extra rider. Camps can reserve up to seven consecutive dates with a daily time window, riders, capacity, and status. Party horse allocation and detailed camp administration remain future work.

To cancel a package activity, edit it and set its status to **CANCELLED**. Select **Restore package entitlements for this cancellation** only when staff have approved restoring the allowance. Keeping that box clear retains the consumption. Completed activity records retain their history.

## Daily operating checklist

1. Open Day view and select the date.
2. Review **Scheduling Attention** and workload bars.
3. Add or edit bookings, resolving all errors before saving.
4. Confirm horses, riders, and coaches have accurate capability and availability information.
5. Review active part-board agreements before scheduling a self-ride.
6. Generate recurring occurrences when preparing future weeks and address any failures in the report.

## Current limits

- No authentication or roles are implemented.
- Automatic schedule generation is planned for a future iteration; staff choose the final booking.
- Recurrence is weekly and generated on demand.
- The application has no payment processing, invoices, or billing integration.

