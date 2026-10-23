# Admin todo

## Validate venues, lessons and events
Most venues, lessons and events have never been checked. Many are test data, and others are old and at places that have since closed, so they're all treated as not validated (decided 2026-10-15) until someone confirms them.

- Add a validation section: list unvalidated venues, weekly lessons (`ldco.lessons`), event types and stored event dates, oldest first, with the instructors linked to each. Actions: validate, edit, or retire (closed or test data).
- An instructor using their venues and classes in `line-dance-manager` (adding a venue, creating or editing a lesson or class, planning a night) validates them; the section shows who validated what and when. What it's really for is the stale case: an instructor who retires or stops using the app, so their venues are never touched again. Sort by how long since `verifiedAt`.
- Planned in `line-dance-manager`: dancers can challenge a venue's validity. A challenge clears `verifiedAt`, which puts the venue in its instructor's "Is this still current?" alert on their dashboard; challenges with no instructor response should surface here.
- How "not validated" is stored is still being decided. Today it's where a document lives (`ldco` = verified, the same-named `ldco-reviews` collection = unverified); see the open question in `ldco-database`'s `docs/decisions.md`.

## Venues with no instructor
A venue nobody teaches at (no `instructor_venues` link) no longer appears on `line-dance-manager`'s venues page, so a closed venue drops off on its own once its instructors remove it; instructors never mark venues closed (decision 17 in `ldco-database`). Add a review list of these venues so they can be kept, merged or retired for good. 11 are in this state today, mostly Stephen's former venues from `bld`.

## Schedule moved to `ldco-lessons`
Done on branch `feature/bld-to-ldco-lessons`: the `/api/admin/bld/*` routes read and write `ldco-lessons` (decision 18 in `ldco-database`), limited to Stephen's event types through `event_instructors`, and every event type created here is linked to him as its creator. The pages are unchanged: routes still send and accept "5:00 PM" times and translate to 24-hour frequency times and UTC event, lesson and history times. History is written once per lesson (keyed on its id) with a correct UTC `date`, fixing the hardcoded `-07:00`. Deploy it in the same sitting as `dance-folly-website` and migration `0013` on live.

## Social Posts
Hidden posts: add a component that lists every hidden (unpublished) post on the Page, each with its See hidden post link, and cleans them up with one click (delete the hidden copy from Facebook and the test entry from `bld.social_posts`). Today the hidden copies stay on Facebook, invisible, until `pnpm e2e -- --cleanup` is run in `beyond-line-dance-webhooks`; clearing a post on Social Posts only hides it in the admin.
