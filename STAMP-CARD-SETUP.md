# Stamp card setup

The stamp card on the website keeps its data in a Google Sheet. A small Google Apps Script
(`apps-script/Code.gs`) sits between the website and the sheet. Until it is connected, the card
runs in **preview mode** (saved on each phone only, daily limit off, staff PIN `0000`).

## How it works

- Customers tap **Stamp card** on the left edge, then sign up with name, phone number and a 4–6 digit PIN.
- After paying, they scan the QR code at the counter. It opens the website and adds one stamp
  (one per day, Kundasang time).
- 10 stamps = one free drink of any kind. Staff type the **staff PIN** on the customer's phone to give it,
  and a new card starts.
- A card lasts one month from its first stamp. If it isn't full by then, its stamps clear and the next
  purchase starts a new card on the same account.

## One-time setup (about 10 minutes)

1. Create a new Google Sheet, for example "Brew Addict stamp cards".
2. In the sheet: **Extensions → Apps Script**. Delete what's there, paste all of `apps-script/Code.gs`, and save.
3. Choose **setup** in the function menu at the top and press **Run**. Allow the permissions it asks for.
   This creates the Customers, Stamps and FreeDrinks tabs.
4. **Project Settings** (gear icon) → **Script properties** → add two properties:
   - `STAMP_CODE`: the code inside your counter QR code (Claude gave you this separately; keep it private).
   - `STAFF_PIN`: a PIN only your staff know, used to give out free drinks.
5. **Deploy → New deployment → Web app**. Set *Execute as*: **Me**, *Who has access*: **Anyone**. Deploy and copy
   the **Web app URL** (it ends in `/exec`).
6. Paste that URL into `stamp-card.js` as `STAMP_API` (or send it to Claude to do).
7. Print the counter QR code and put it by the till.

If you change `Code.gs` later, use **Deploy → Manage deployments → Edit → New version** so the URL stays the same.

## Good to know

- The QR code never changes, so anyone with a photo of it could stamp. The one-stamp-a-day rule per account
  limits this. To change the code, set a new `STAMP_CODE` and print a new QR code.
- PINs are stored hashed (SHA-256 with a salt), never as plain text. Five wrong PINs lock an account for 15 minutes.
- Signing in on a new phone signs the old phone out.
- The Stamps and FreeDrinks tabs are a log of every stamp and every free drink given.
