# Absolute Equestrian Scheduler — Light Test Cases

## Scope

This is a short manual smoke-test checklist for the completed Iteration 4 application. Run it against a seeded development or staging database with fictional data. Do not use real customer data.

## Preparation

1. Apply migrations and seed the database using the commands in the README.
2. Open the scheduler and confirm the Schedule page loads.
3. Use a future test date so existing demo bookings are not unintentionally edited.

| ID | Area | Steps | Expected result |
| --- | --- | --- | --- |
| TC-01 | Application shell | Open Schedule, Horses, Riders, Coaches, and Part Board from the navigation. | Each page loads; navigation has no broken link. |
| TC-02 | Day navigation | Select Next, Previous, and Today on Day view. | The selected date changes and the displayed schedule changes with it. |
| TC-03 | Schedule views | Switch between Day, Week, and Month. | Each view loads the same planning data in its appropriate layout. |
| TC-04 | Horse CRUD | Add a fictional horse with valid capability and rider-level values, then edit its notes. | The horse is saved and the edited value persists after refresh. |
| TC-05 | Rider preferences | Add or edit a fictional rider and rank at least two preferred horses. | The rider page displays the horses in the saved order. |
| TC-06 | Coach CRUD | Add a fictional coach and edit the active status. | The coach appears in the list and the status persists after refresh. |
| TC-07 | Valid lesson | Add a valid Flat lesson using an eligible horse, rider, coach, date, time, and workload. | The lesson saves and appears in Day, Week, and Month views. |
| TC-08 | Horse double booking | Create a second overlapping lesson for the same horse. | Save is blocked with a horse double-booking error. |
| TC-09 | Rider/coach double booking | Create overlapping lessons for the same rider or coach. | Save is blocked with the applicable conflict error. |
| TC-10 | Workload | Book rides that exceed a horse's maximum daily ride units. | The workload is visible; an over-capacity booking is blocked. |
| TC-11 | Compatibility | Attempt a Jump lesson on a horse without Jump capability, or choose a rider outside the horse's level range. | Save is blocked with the applicable suitability error. |
| TC-12 | Recommendations | Open Add Lesson for a rider with preferred horses and enter a valid date/time. | Ranked horse cards show reasons, workload, and warnings or exclusions where relevant. |
| TC-13 | Availability | Add an unavailable override for a horse, rider, or coach, then attempt a matching booking. | The booking is blocked; removing or changing the override permits a valid booking. |
| TC-14 | Part board | Create or open an active agreement and schedule a valid part-board self-ride. | The linked horse is used; entitlement usage updates when selected. |
| TC-15 | Entitlement limit | Use an exhausted entitlement and try to consume another ride. | Save is blocked; a ride without consuming an entitlement can be saved when otherwise valid. |
| TC-16 | Recurrence | Create or use a weekly template and select Generate lessons. | A generation report identifies created, skipped, and failed occurrences without duplicate occurrences. |
| TC-17 | Manual status | Set a lesson or rider payment status to Paid, Unpaid, then Unrecorded. | The selected status persists and does not change the lesson schedule or entitlement balance. |
| TC-18 | Responsive view | Repeat Schedule navigation and Add Lesson on a narrow browser width. | Layout remains usable; key actions are reachable and save behavior is unchanged. |

## Automated regression commands

Run these before release. They complement, but do not replace, the manual cases above.

```bash
pnpm build
pnpm lint
pnpm typecheck
pnpm test
```

## Exit criteria

- All automated commands pass.
- TC-01 through TC-18 pass, or each failure has an agreed written exception.
- No real user, student, or payment data was used for testing.

