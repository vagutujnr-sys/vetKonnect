# Mobile number + PIN login (no OTP at the door)

Notes for reusing VetKonnect’s sign-in on another app. The person enters a mobile number, then a 5-digit PIN they chose. Sign-in does not send an SMS, email, or WhatsApp message. The database columns `otp_code` and `otp_expires_at` stay empty.

The PIN opens the account on any phone or browser. It does not prove the person holds that SIM. WhatsApp does that later, after they are already inside. Do not make login wait for the WhatsApp reply.

In this repo the pieces live in:

- `src/routes/register.tsx` — number screen
- `src/routes/verify.tsx` — PIN screen
- `src/routes/settings.tsx` — Change PIN
- `src/services/userService.ts` — lookup, save, check
- `src/lib/pin.ts` — hash and compare

## Screens

1. **Number.** Country code plus the mobile number. Continue does not wait for the database.
2. **PIN.** Returning accounts see “Welcome back” and enter the existing PIN. New accounts enter a name, choose a PIN, then enter it again.
3. **App.** A matching PIN leaves the PIN screen at once. A wrong PIN returns to the number screen and says the PIN does not match.

## Account row

One row per phone number. Minimum columns:

| Column | Use |
| --- | --- |
| `id` | Account id, created in the browser with `crypto.randomUUID()` before insert |
| `phone` | Digits only, no spaces. Unique. |
| `country_code` | Dial code, such as `+263` |
| `full_name` | Empty until the new account confirms a PIN |
| `pin_hash` | Salted hash. Never the PIN itself. Empty until the PIN is chosen. |
| `whatsapp_opt_in` | They agreed to receive WhatsApp. Default false. Already in this app (`030_whatsapp_opt_in.sql`). |
| `whatsapp_verified_at` | Set only after a reply arrives from this same number. Not built yet. |

Lookup is `select * from accounts where phone = ?`. If a row exists, it is a returning account. If not, insert one row and treat it as new.

## How the PIN is stored

New PINs use a fast hash, not PBKDF2. PBKDF2 with a large iteration count freezes a phone and makes “Checking PIN…” sit there even when the PIN is correct.

```
sha256:<16-byte-salt-hex>:<sha256-hex of "salt:pin">
```

Create it in the browser with `crypto.subtle.digest("SHA-256", ...)`. Compare it in the browser the same way. The server only stores and returns the string. It never sees the raw PIN.

Older hashes in this app are `salt:hash` from PBKDF2 (120,000 rounds). Only verify those in a worker, then rewrite them to the `sha256:` form after a successful check. A new app should start on `sha256:` and skip the old path.

## Number screen

On Continue:

1. Start the phone lookup immediately and do not await it.
2. Save a small pending record in `sessionStorage` (`phone`, `countryCode`, `isNew: true`, `hasPin: false`).
3. Go to the PIN screen in the same tap.

The lookup and the PIN screen share one in-flight request, keyed by country code + phone. A second tap must not start a second insert. Drop the cached request if it fails, so Retry works. Drop a success after a short time (this app uses 20 seconds).

When the lookup finishes, replace the pending record with `accountId`, `profile`, `isNew`, `hasPin`, and `pinHash`. `pinHash` is only for the PIN step. Do not copy it into the long-lived session profile.

## PIN screen

Wait until `accountId` and `profile` are present before accepting a finished PIN. If the person types the 5 digits early, keep them and finish when the lookup returns.

### Returning account
The fifth digit checks `pinHash` locally. No second account fetch.

- Match: write the session, then `window.location.replace` to the home screen. Do not wait for the router, a notification, or another Supabase call. Those are what left people on “Checking PIN…”.
- No match: clear the pending record, remember a short message, and `window.location.replace` back to the number screen. Show that message there: “Incorrect PIN. That PIN does not match this number.”

### New account
Require a name (at least 2 characters). First 5 digits are the choice. Second entry must match. Then hash locally, write the session, save `pin_hash` and `full_name` in the background, and `window.location.replace` to the app. If the write is still running when the page closes, retry it on the next app load from a `localStorage` pending-save record.

Do not show a “Checking PIN…” or “Saving PIN…” line that stays up while the next page loads. The PIN screen either leaves or returns to the number screen.

## Session

After a match, store only:

- `localStorage` account id
- `localStorage` profile (no `pin_hash`)

Route guards read that cache. They must not `await` a network `getUser()` before the page can render. Refresh the profile from Supabase after the screen is already up.

Sign-out deletes the account id, the profile, and any cached lists for that account.

## Change PIN

This belongs in Settings, not on the login screen.

1. Load `pin_hash` once when Change PIN opens.
2. Current PIN is checked locally on the fifth digit. A wrong one stays on that step and says so.
3. New PIN, then the same 5 digits again. Reject a new PIN that equals the current one.
4. Wait for the `pin_hash` update before saying it changed. A failed write must not look successful.
5. Cancel closes the pad and changes nothing.

## WhatsApp validation, after sign-in

Sign-in and WhatsApp are two steps. The first gets them in. The second checks that WhatsApp on that number is actually theirs.

What this app does today:

- Settings has a WhatsApp receipts switch. It writes `whatsapp_opt_in`.
- A vet visit can send a receipt with Twilio only when that switch is on (`src/routes/api.whatsapp.send.ts`).
- The Twilio sandbox still needs the person to send the join code to the sandbox number once. That join is not proof they own the account phone. It only lets the sandbox deliver.

What to add when validation is required:

1. Leave them signed in with the PIN. Show a WhatsApp step in Settings, or the first time a WhatsApp feature is used. Do not put it on the number screen or the PIN screen.
2. They opt in first (`whatsapp_opt_in = true`). Without that, do not send.
3. Send one WhatsApp message to `country_code` + `phone` through Twilio. The message asks them to reply with a short code, or with YES, from that same chat.
4. Accept the number only when the inbound WhatsApp sender digits match the account phone. A reply from a different phone does not count.
5. Set `whatsapp_verified_at` to that time. Until then, treat the number as unverified. The PIN session stays valid either way.
6. If they never reply, they can keep using the app. WhatsApp receipts and anything else that must be delivered to that number stay off until the reply matches.

Do not use the login `otp_code` column for this. That path is unused on purpose. Store the WhatsApp challenge on its own columns, for example `whatsapp_code` and `whatsapp_code_expires_at`, and clear them when the matching reply arrives or the code expires.

## Rules that keep it fast

- Continue never waits on Supabase.
- The PIN check for a `sha256:` hash is one local digest, using the hash already returned with the phone lookup.
- A correct PIN unloads the PIN document with `location.replace`. Client-side navigation left the old screen mounted, still saying “Checking PIN…”, until the next route finished loading.
- A wrong PIN also leaves that screen. It does not sit on the pad with no message.
- Do not run a slow hash on the main thread. It blocks timers, so a timeout never fires and the screen looks frozen.
- Do not `await` notifications, analytics, or a profile refresh before leaving the PIN screen.

## Checklist for another app

- [ ] Unique phone column, empty `pin_hash` until the person chooses a PIN
- [ ] No SMS, email, or OTP provider in this path
- [ ] Number screen navigates first, lookup overlaps the PIN screen
- [ ] One in-flight lookup per phone
- [ ] New PIN stored as `sha256:salt:hash`
- [ ] Fifth digit checks that hash locally
- [ ] Match replaces the page; mismatch returns to the number screen with a sentence
- [ ] Session cache has no PIN and no hash
- [ ] Guards do not block on a fresh fetch
- [ ] Settings can change the PIN only after the current one matches
- [ ] WhatsApp opt-in is separate from login, and login does not wait for it
- [ ] The number is marked verified only after a WhatsApp reply from those same digits
