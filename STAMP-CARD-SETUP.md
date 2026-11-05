# Stamp card setup

The stamp card needs no sign-up. Each customer's phone gets a card that is a random code, shown as a QR code.
After paying, the customer shows the QR code and staff scan it with the cafe phone. That opens the **staff page**,
where staff tap **Add stamp** or **Give free drink**. The customer's card updates within a few seconds.

- 10 stamps = one free drink of any kind. One stamp per card per day (Kundasang time).
- A card lasts one month from its first stamp. If it isn't full by then, it clears and starts again.
- No names or phone numbers are collected. The Google Sheet keeps only a scrambled copy of each card code
  (it can't be turned back into the code), the stamp count and dates.
- Cards with no activity for 6 months are deleted automatically every night.

Until the setup below is done, the website runs the card in **preview mode**: it's saved on that phone only,
and buttons pretend to be the staff.

## Before you start

Use the cafe's own Google account, and turn on **2-Step Verification** for it
(Google Account → Security → 2-Step Verification). This account is the only one that can stamp cards.

## One-time setup (about 15 minutes)

1. Create a new Google Sheet in the cafe Google account, for example "Brew Addict stamp cards".
2. In the sheet: **Extensions → Apps Script**. Delete what's there, paste all of `apps-script/Code.gs`, and save.
3. Choose **setup** in the function menu at the top and press **Run**. Allow the permissions it asks for.
   This makes the Summary, Cards and Log tabs and a nightly clean-up.
4. **Deploy → New deployment → Web app** with *Execute as*: **Me** and *Who has access*: **Anyone**.
   Deploy and copy the URL (it ends in `/exec`). This is the **public link**: it can only look up a card's stamps.
5. **Deploy → New deployment → Web app** again, this time with *Who has access*: **Only myself**.
   Copy this URL too. This is the **staff link**.
6. Send both links to Claude, or paste them into `stamp-card.js` as `STAMP_API` (public) and `STAFF_URL` (staff).

## Setting up the cafe phone

1. In the phone's browser, sign in to the cafe Google account, and make sure it is the **only** Google account
   signed in to that browser (Google's staff pages get confused by several accounts).
2. Open the website with `#staff-phone=on` at the end, for example
   `https://nyleworks.github.io/Brew-Addict-Cafe/#staff-phone=on`. The card will say this phone is now the staff phone.
3. Open the staff link once and bookmark it. It shows the numbers from the Summary tab.
4. Test it: open the stamp card on your own phone, scan its QR code with the cafe phone's camera, and tap **Add stamp**.

To stop a phone being the staff phone, open the website with `#staff-phone=off`.
If the cafe phone is lost, sign it out from the cafe Google account (Google Account → Security → Your devices).
Without that sign-in, nobody can stamp cards, even if they have the phone.

## The numbers

The **Summary** tab updates by itself: members, active members in the last 30 days, stamps this week and month,
free drinks given, cards that reached 10, cards that expired, average days to fill a card, busiest days and hours,
and which drinks people take free. Counts are close but not exact: a customer whose phone lost their card and
who had no screenshot shows up as two cards.

## Good to know

- If you change `Code.gs` later, update **both** deployments: **Deploy → Manage deployments → Edit → New version**,
  so the links stay the same.
- Please don't type in the Cards or Log tabs. To fix a mistake, ask Claude.
