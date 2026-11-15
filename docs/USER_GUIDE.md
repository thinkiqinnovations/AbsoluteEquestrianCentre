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

Day view is the main operational view. It shows the day's lessons, each scheduled horse's workload, and any scheduling attention items.

- Select **+ Add Lesson** to create a booking.
- Select an existing lesson to edit it.
- Review the workload bar before adding another ride to a horse.
- Read errors as blockers and warnings as staff-review items.

### Week

Week view is useful for short-term planning. Select an empty time slot to start a lesson at that date and time, or select a lesson to edit it. The view expands when a lesson falls outside the usual daytime range.

### Month

Month view shows lesson counts and compact daily indicators. Select a date, lesson, or **+N more** to open the relevant day. On a phone it appears as a scrollable agenda.

## Create or edit a lesson

1. Select **+ Add Lesson**, an empty Week slot, or an existing lesson.
2. Enter the date, start and end time, rider, lesson type, discipline, horse, coach (when applicable), ride units, status, and optional notes.
3. Review the horse recommendation cards. They explain why a horse is suitable or needs attention; they do not reserve the horse.
4. Select a horse and save.

The server is the final authority. It prevents invalid bookings such as a horse, rider, or coach being booked twice at overlapping times; a horse going over daily workload; an incompatible rider/horse pairing; or a jump lesson on a non-jumping horse.

### Understanding recommendations

Recommendations consider active status, rider level, discipline capability, overlaps, workload, availability, rider preferences, active part-board links, and recent assignments. A green/eligible card is a recommendation, not a guarantee: saving validates the latest schedule again.

Warnings request attention, for example an availability period that has not been configured. Errors must be resolved before the lesson can be saved.

### Shared lessons

For a semi-private or group session, create one lesson for each rider/horse combination using the same coach, date, time, discipline, and lesson type. The application allows the matching shared-coach session while still checking each rider and horse individually.

## Manage horses, riders, and coaches

### Horses

Open **Horses** to add, view, or edit a horse. Keep these fields accurate:

- active status
- walk, trot, canter, Flat, and Jump capability
- minimum and maximum rider level
- maximum daily ride units

Ride units measure workload, not lesson count. For example, a 0.5-unit ride plus a 1.0-unit ride uses 1.5 units of capacity.

### Riders

Open **Riders** to add, view, or edit riders. Set the overall, Flat, and Jump levels independently where needed. Maintain preferred horses in rank order; recommendations use these ranks as one input.

### Coaches

Open **Coaches** to add, view, or edit coaches and see their lessons for the selected day. Coach availability is managed separately through Availability.

## Availability

Open **Availability** from a rider, horse, or coach context to manage:

- recurring weekly availability windows
- dated available or unavailable overrides

An override takes precedence over a recurring rule. A resource with recurring rules cannot be booked outside those rules unless an override opens the time. A resource with no configured recurring availability can still be booked, but the application displays a warning so staff can confirm it.

## Part Board

Open **Part Board** to manage rider–horse agreements, preferred ride times, and free-ride entitlements.

- An agreement can be active, paused, ended, or cancelled.
- Free rides are scheduling entitlements, not payments.
- A part-board self-ride can be coach-less, but it still follows availability, compatibility, double-booking, and workload rules.
- An exhausted entitlement blocks a ride only when **consume entitlement** is selected. Staff may record a ride without using an entitlement when appropriate.

## Recurring lessons

Create and manage weekly recurring templates from the Part Board area. Use **Generate lessons** to create valid future occurrences. The generation report identifies created, skipped, and failed dates. Resolve the reported issue (for example, an unavailable horse) and run generation again as needed.

Changing, pausing, or ending a template affects future generation; previously generated lessons remain on the calendar for historical accuracy.

## Manual payment status

Lesson and rider screens can record **Paid**, **Unpaid**, or **Unrecorded** as a manual operational note. These statuses do not collect money, create invoices, change bookings, or change free-ride entitlement use.

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

