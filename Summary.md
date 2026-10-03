# VetKonnect — Current State Summary

**Generated:** 2026-09-09 17:18 (UTC+02:00)  
**Repository:** https://github.com/vagutujnr-sys/vetKonnect.git  
**Branch tip (at generation):** `9e06815`  
**Live app (Vercel):** https://vetkonnect-ochre.vercel.app  
**Intended app domain:** https://app.vetkonnect.org (DNS to Vercel in progress)  
**Marketing site:** https://vetkonnect.org (separate landing; not this repo)

---

## What VetKonnect is

VetKonnect is a digital pet-care platform connecting **pet owners**, **veterinary practices**, **City Council animal-control officials**, and **platform admins**. It supports pet identity (tags/QR), health records, community, discovery of services, vet practice tools, and municipal licensing / revenue analytics for Harare City Council.

The product is mobile-first for owners and vets, with a desktop municipal dashboard for council, and a separate admin control centre.

---

## Technology stack

| Layer | Choice |
|--------|--------|
| App framework | TanStack Start (React + file routes) |
| UI | Tailwind CSS, Radix UI, Lucide icons |
| Backend / data | Supabase (Postgres, storage, realtime notifications) |
| Auth model | Custom (not Supabase Auth sessions) |
| Maps | Mapbox GL |
| Deploy | Vercel (`tanstack-start` / Nitro) |
| Connected editor | Lovable (avoid rewriting published git history) |

**Database migrations present:** `001`–`012` under `supabase/migrations/` (auth/community, photos, vet accounts, geo, dashboard requests, surgery link, council tables).

---

## Audiences & access

### 1. Pet owners
- **Login:** phone + one-time access code (device-bound after verify).
- **Home nav:** Home, Pets, Community, Discover, Profile.
- Register / manage pets, photos, health timeline, VetSure membership flag.
- Map nearby clinics (Discover → Map Vets).
- Community feed (posts, likes, comments).
- Notifications (realtime + poll).

### 2. Veterinary accounts
- Same phone OTP login; `account_type = vet`.
- Practice features gated until **admin verification** (`vet_verified`).
- **Nav:** Patients, Impact, Discover, Community, Profile.
- **Patients:** scan collar/pet QR tags (camera + jsQR fallback) or enter tag ID; open pet records.
- **Impact:** full-screen map of nearby owners (pet counts; **owner phones hidden**).
- Align profile with a **surgery** from the directory (searchable).
- Can request practice dashboard access (tracked for admin).

### 3. Platform admin
- **Routes:** `/admin-login` (PIN) → `/admin`.
- Manage app accounts, elevate/verify/demote vets, surgeries, pets, services, tag inventory, community, notice board, billing overview, device unbind.
- **Council tab:** register council officials (email/password), sync municipal sample data.
- Pending elevate + dashboard-request queues.

### 4. City Council officials
- **Independent auth:** email + password (`council_accounts`), not phone OTP.
- **Routes:** `/council-login`, `/council`, `/city` → redirects to `/council`.
- Branding: faint Harare crest on login; “In Association with VetKonnect”.
- Crest assets also stored as `Harare.svg` / `city_logo.jpg` (and `src/assets/harare-council-logo.jpg`).

#### Council — mobile (field portal)
Bottom nav: **Scan · Discover · Community · Profile**
- Scan pet tags → **Registered / Not registered**, licence status, owner + phone when linked.
- Discover services + clinics map.
- Read community feed.
- Profile + sign out; analytics are desktop-only.

#### Council — desktop (same URL)
Sidebar dashboard:
- **Revenue** (default) — official Harare dog-licence fees  
  - Male dog licence: **USD 5**  
  - Bitch (female): **USD 10**  
  - Replacement badge: **USD 0**  
  - Unlicensed dog penalty: **USD 20**  
  - Source: Harare City Council (Dog Licensing and Control) By-laws (USD-indexed / interbank).
- **Projections** — monthly, quarterly, bi-annual, annual (expected / growth / full compliance).
- **Reports** — date-range system report → **PDF** or **Excel**.
- Overview, licences, cases, rabies, full-bleed geography map.
- Notify all app accounts; post to community (optional app-wide notify).
- Field scan also available on desktop.

---

## Core product capabilities (today)

1. **Device-bound phone login** for owners/vets; white register/verify UX.
2. **Pet registry** with VetKonnect IDs, collar tags, QR payloads, photos, timelines.
3. **Herd / tag inventory** managed in admin.
4. **Community** social feed with media, tags (Story / Education / Rescue / Breeding).
5. **Discover** services listing + Mapbox clinic map (owners).
6. **Vet patients + Impact map** for practice outreach (privacy: no owner phones on Impact).
7. **Surgeries directory** — admin create/edit; vets align to a surgery.
8. **Notifications** board + realtime delivery to accounts.
9. **Council municipal layer** — licences, animal-control cases, revenue, reports, field scan.
10. **Admin elevation** of vets and council official provisioning.

---

## Data notes (council)

Tables (migration `012`):
- `council_accounts`
- `pet_licences` (`pet_id` UUID → `pets.id`)
- `animal_control_cases` (lost / found / impound / incident)

Revenue analytics are derived from registered dogs, licence status, and the official fee schedule (not a full payments ledger yet).

---

## Known ops / deployment notes

- Prefer **`app.vetkonnect.org`** CNAME → Vercel for this app; keep apex **`vetkonnect.org`** for the separate landing host.
- Vercel preview/production URL in use: **vetkonnect-ochre.vercel.app**.
- Apply Supabase migrations (especially `009`–`012`) in the project SQL editor when columns/tables are missing; app has some fallbacks.
- Camera QR scan requires HTTPS (or localhost).
- Project is Lovable-connected: do not force-push or rewrite published history on the shared branch.

---

## Recent delivery themes (late Aug–Sep 2026 context)

- Council portal (mobile + desktop), official licence fees, revenue/projections/reports.
- Vet Impact privacy, surgery alignment, dashboard-request admin UX.
- Safari/Firefox QR scan via jsQR.
- Pure white backgrounds on register / mobile shell.

---

*End of summary — snapshot of the product as implemented in this repository at the timestamp above.*
