# TrackerX hourly leave limit — 12 September 2026

## Outcome

Hourly leave requests are limited to 2 hours 30 minutes. A request for 2 hours 30 minutes is accepted; any longer request is rejected and the employee is instructed to use `Full day(s)`.

## Enforcement

- The leave form explains the limit before data entry and provides a direct `Switch to full day` action.
- Hour selection defaults to a valid 2-hour-30-minute window.
- Changing the start time keeps the end-time window within the permitted maximum.
- The requested duration changes to an error state when it exceeds the limit, and submission is disabled.
- The API independently validates the duration in minutes, so direct or altered API requests cannot bypass the UI rule.
- The same rule applies to all internal accounts that can request leave: owner, administrators, project managers, and employees. Clients remain excluded from attendance and leave.

## Cumulative leave record

The employee's `My requests` view now summarizes all approved TrackerX history as separate totals for vacation/leave days, sick-leave days, other absence days, and hourly leave. Pending and rejected requests are excluded. TrackerX reports recorded usage only; it does not invent an entitlement or annual-balance policy that has not been configured.

The employee's own profile contains the same cumulative totals plus a TrackerX-styled vacation planner with start date, end date, reason/handover context, normal approval routing, and recent vacation request details. The focused profile form creates full-day vacation requests; hourly, sick-leave, and absence workflows remain available through the full Leave center.

## Verification

- Exact 150-minute boundary: accepted.
- 151-minute request: rejected with the full-day instruction.
- Existing same-day, date-order, seven-day, permission, notification, approval, attendance-linking, and coverage logic remains in place.
