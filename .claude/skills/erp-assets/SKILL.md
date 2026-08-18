---
name: erp-assets
description: Deep context for the Arzesh ERP asset-management module (apps/backend/src/modules/assets/ — Assets, Categories, Types, Buildings, Floors, Rooms, Assignments, Upload, Reports, barcode utils; apps/frontend/app/dashboard/assets/**, /dashboard/{buildings,floors,rooms}/page.tsx). Use whenever the user asks to add, fix, or explain anything about assets/inventory, asset barcodes or QR codes, asset assignment/checkout/return, asset images, asset costs or maintenance history, or the building/floor/room location hierarchy — even if they just say "دارایی", "بارکد", "انبار" or "تجهیزات" without more detail.
---

# Arzesh ERP — Assets Module

Backend: `apps/backend/src/modules/assets/` — `assets.service.ts`/`assets.controller.ts` (CRUD + barcode/QR image endpoints), `categories.service.ts`/`categories.controller.ts`, `types.controller.ts` (asset types, no separate service), `assignments.controller.ts` (logic lives directly in the controller, no service file), `buildings.controller.ts`, `floors.controller.ts`, `rooms.controller.ts` (all three talk to Prisma directly, no service files), `upload.controller.ts`, `reports.controller.ts`, `barcode.util.ts`. Registered in `assets.module.ts`.

Frontend: `apps/frontend/app/dashboard/assets/{page.tsx, [id]/page.tsx, types/page.tsx, categories/page.tsx, assignments/page.tsx}` plus the location pages, which live **outside** the `assets/` folder: `apps/frontend/app/dashboard/{buildings,floors,rooms}/page.tsx`.

Schema: `apps/backend/prisma/schema.prisma` lines ~112–285 (`AssetType`, `AssetCategory`, `Asset`, `AssetImage`, `AssetAssignment`, `AssetMaintenance`, `AssetCost`, `Building`, `Floor`, `Room`).

## 1. Barcode generation (`assets.service.ts` `create()`, lines 38–98)

Format is exactly `PREFIX-jYYYYjMM-SEQ`, e.g. `COMP-140305-0001`:

1. `purchaseDate` is parsed (Jalali `jYYYY/jMM/jDD` or `jYYYY-jMM-jDD` first, then ISO, then native `Date` as last resort) into `d`. If no `purchaseDate` is given, `d = new Date()` (today) — **the barcode's month segment is the purchase date's month, not necessarily "now"**.
2. `yyyymm = moment(d).format('jYYYYjMM')` — six digits, year+month concatenated with no separator (e.g. `140305`).
3. `prefix = cat.codePrefix || 'AST'` — pulled from the chosen `AssetCategory.codePrefix`. Categories without a prefix fall back to `AST` for every asset in them, so barcodes across different uncategorized-prefix categories can collide on prefix.
4. Sequence: `findFirst({ where: { barcode: { startsWith: 'PREFIX-yyyymm-' } }, orderBy: { barcode: 'desc' } })`, then `parseInt(lastSegment) + 1`, padded to 4 digits (`padStart(4,'0')`).
   - **This is a lexicographic string sort, not numeric.** It only stays correct because of the 4-digit zero-padding; once a prefix+month passes 9999 assets, the 5-digit sequence (`10000`, unpadded since `padStart` only pads *shorter* strings) sorts *before* `9999` alphabetically, and the next `create()` will recompute a colliding/duplicate sequence. Extremely unlikely in practice but worth knowing if bulk-importing.
   - **No row lock / transaction around the read-then-write.** Two concurrent `POST /assets` calls for the same category+month can both read the same `last` row and compute the same `nextSeq`. The subsequent `findUnique` uniqueness check (line 71) will only catch this after the fact — one of the two requests will get a 400 `Duplicate asset barcode`, it won't silently create a collision, but it's a real race under concurrent bulk-entry.
5. If the caller supplies an explicit `barcode` in the payload, all of the above is skipped and that value is used verbatim (still checked for uniqueness).
6. `typeId` can be omitted if `typeName` is given instead — the service `upsert`s an `AssetType` by name on the fly (`where: { name: typeName }`). This means asset creation can silently create new asset types; there's no "type must pre-exist" enforcement at the API level even though the UI (`assets/page.tsx`) always uses a `<select>` populated from `/asset-types`.

**Rendering the barcode as an image** is separate from the barcode *string* stored on the asset:
- `barcode.util.ts` — `generateCode128Png()` uses `bwip-js` (`bcid: 'code128'`, `includetext: true`) to render the stored `barcode` string as a scannable Code128 image. `generateQrPng()` uses the `qrcode` package to encode a **URL** (`${APP_URL}/dashboard/assets/{id}`), not the barcode string.
- `AssetsController` exposes `GET /assets/:id/qr.png` and `GET /assets/:id/barcode.png` (`assets.controller.ts:35-55`). **Neither endpoint consults `Asset.barcodeType`** — both image types are always generatable regardless of what's stored in `barcodeType`. The `barcodeType` enum field (`QR | CODE128`) appears to be intended to record which physical label was printed for the asset, but nothing in the backend currently branches on it; it's editable in the UI form (`assets/page.tsx:292-297`) but otherwise inert.
- `reports.controller.ts` (`GET /assets/report/pdf?type=QR|CODE128`) is the one place `type` actually picks which generator runs, and it's a query param on the report request, not the asset's own `barcodeType`.

## 2. Asset assignment workflow (`assignments.controller.ts` `create()`, lines 22–55)

`POST /asset-assignments` runs a single `$transaction` (15s timeout, `assignments.controller.ts:51-53`) with three steps:

1. **Close the previous assignment**: `findFirst({ where: { assetId, returnedAt: null }, orderBy: { assignedAt: 'desc' } })` — the currently-active assignment (if any) — then `update({ data: { returnedAt: now } })`. "Closing" means setting **only** `returnedAt`; no other field on the old row changes.
2. **Update asset availability**: `maintenance = /تعمیر/.test(purpose)` (the regex is `تعمیر`, literally the Persian substring "تعمیر" — matches `'تعمیر'`, `'تعمیرات'`, `'امانت تعمیرات'`, any string containing it). If matched → `availability = 'MAINTENANCE'`, else → `'IN_USE'`. This write happens **unconditionally** — even if there was no previous assignment to close (first-ever assignment of a brand-new `AVAILABLE` asset still flips it to `IN_USE`/`MAINTENANCE`).
3. **Create the new assignment row** with `assignedById` (from JWT) and `assignedAt: now`.

`PATCH /asset-assignments/:id/return` (lines 57-65) is a **separate, non-transactional** two-step operation: set `returnedAt: now` on the assignment, then unconditionally set the asset's `availability = 'AVAILABLE'`. Note this is the *only* path that ever sets `AVAILABLE` again after an assignment — creating a brand-new assignment on top of an existing one (step 1 above) closes the old row via `returnedAt` but does **not** call the return endpoint's availability logic, it goes straight to `IN_USE`/`MAINTENANCE` per step 2.

Gotchas:
- **`DELETE /asset-assignments/:id` (ADMIN only) does not touch `Asset.availability`.** Deleting the active assignment row leaves the asset stuck at whatever availability the deleted assignment had set — there's no reconciliation.
- The location fields (`buildingId`/`floorId`/`roomId`) are only offered on the **asset-detail page**'s assignment form (`assets/[id]/page.tsx`). The standalone `assets/assignments/page.tsx` "new assignment" modal only collects `assetId` + `userId`/`departmentId` — no location, and no `purpose` field either (so `purpose` is omitted from the payload and falls back to the Prisma column default `"استفاده"`, which is never treated as "maintenance" by the regex above).
- `condition` (`AssetCondition`) is never touched by the assignment flow — only `availability` changes automatically; the physical condition is edit-only (see §3).

## 3. Lifecycle fields: `AssetCondition` / `AssetAvailability`

```prisma
enum AssetCondition { NEW  USED_GOOD  DEFECTIVE }
enum AssetAvailability { AVAILABLE  IN_USE  CONSUMED  MAINTENANCE  RETIRED  LOST }
```

- `condition` is a **required** field with no schema default — every `create()` payload must supply one (the UI form defaults the select to `NEW`, `assets/page.tsx:79`). It is purely manual: nothing in the backend ever changes it automatically.
- `availability` defaults to `AVAILABLE` and is auto-managed only by the assignment create/return flow above (→ `IN_USE`/`MAINTENANCE` on assign, → `AVAILABLE` on explicit return). The other three states — `CONSUMED`, `RETIRED`, `LOST` — are **never set by any backend code path**; they only exist as options in the asset edit `<select>` (`assets/page.tsx:282-289`) for manual admin/manager use. `Asset.consumedAt` (a `DateTime?` column) is likewise never written anywhere in the current codebase — it's schema-only, presumably intended to pair with manually setting `CONSUMED`.

## 4. Costs & maintenance — schema exists, **no implementation**

```prisma
model AssetMaintenance { id assetId asset startDate endDate? cost? description createdAt updatedAt }
model AssetCost         { id assetId asset type(AssetCostType) amount date note createdById createdBy createdAt updatedAt }
enum AssetCostType { PURCHASE  REPAIR  MAINTENANCE  OTHER }
```

Both models are declared and related from `Asset` (`asset.maintenances`, `asset.costs`), but there is **no controller, no service, and no frontend page anywhere in the repo that reads or writes either table** (confirmed by grepping the whole `apps/` tree for `AssetMaintenance`/`AssetCost` — zero hits outside `schema.prisma`). Root `CLAUDE.md` documents these as part of "What's Complete", which is **not accurate for this specific pair of models** — treat cost/maintenance tracking as a TODO, not a working feature. If asked to build it: `AssetCost` already has an `@@index([assetId, date])` for time-ranged queries and a `createdById` audit trail; `AssetMaintenance` has no such index and no audit trail (`createdById`), unlike `AssetCost` — worth adding for consistency if implementing both together.

## 5. Images (`upload.controller.ts`, `AssetImage`)

`POST /uploads/asset-image` (ADMIN/MANAGER, `upload.controller.ts:18-38`):
- `multer` `diskStorage` writes the raw upload to `uploads/assets/{timestamp}-{random}.{ext}`.
- Sharp then resizes it to fit inside **1200×1200** (`fit: 'inside'`, so aspect ratio is preserved and it only shrinks, never upscales/crops) and re-encodes as **JPEG quality 80** regardless of the original format (PNG/WebP/etc. all become `.jpg` content under a filename that keeps the *original* extension via the `c-{filename}` prefix — e.g. a `.png` upload produces a file literally named `c-...-random.png` whose bytes are JPEG. This mismatch between filename extension and actual encoded format is harmless for `<img>` tags (browsers sniff content) but would matter for anything extension-sensitive).
- The original pre-resize file is deleted (`fs.unlinkSync`). Response is just `{ url: "/uploads/assets/c-....ext" }` — **the endpoint does not create an `AssetImage` row, does not accept/use `assetId` from the request body, and returns no DB entity.** Linking an uploaded URL to an asset is entirely the caller's responsibility via a follow-up `PATCH /assets/:id` with `images: [...]`.

`AssetsService.update()` (`assets.service.ts:100-125`) is where `AssetImage` rows actually get created: if `images` (array of URL strings) is present in the patch body, it **deletes all existing `AssetImage` rows for that asset and recreates them from the array** (`deleteMany` then `createMany`) — full replace, not a diff/merge. `AssetsService.create()` does the equivalent inline via nested `createMany` (line 94).

**Known dead-code path**: `assets/page.tsx`'s create/edit modal has an `uploadImages()` helper (lines 93-102) that `POST`s each selected file to `/uploads/asset-image` but **never reads the response body or does anything with the returned `url`** — it just fires the requests and discards the result. So creating a new asset with images attached via the main list page's modal uploads orphaned files to disk (never attached to any `AssetImage` row) and the asset ends up with **no images**, silently. Compare with the asset-detail page's edit modal (`assets/[id]/page.tsx` `onFiles()`, lines 78-85), which correctly captures each returned `url` and appends it to `editData.images`, then sends it in the `PATCH` body — that path works. If asked to fix image upload on the list page, wire `uploadImages()` up the same way `onFiles()` does, or better, save the asset first, then `PATCH` it again with the collected URLs.

## 6. Location hierarchy: Building → Floor → Room

```prisma
model Building { id name(unique) floors[] rooms[] assetAssignments[] }
model Floor    { id name buildingId building(Cascade) rooms[] assetAssignments[]  @@unique([buildingId, name]) }
model Room     { id name buildingId building(Cascade) floorId? floor?(default) assetAssignments[]  @@unique([buildingId, floorId, name]) }
```

- `Floor.building` and `Room.building` both declare `onDelete: Cascade` — **deleting a `Building` deletes every `Floor` and `Room` in it.** `Room.floor` has no explicit `onDelete`, so it uses Prisma's default for an optional relation (`SetNull`): **deleting a `Floor` does not delete its `Room`s, it just nulls out `Room.floorId`** (the room keeps its building).
- `AssetAssignment.building/floor/room` are all optional with no explicit `onDelete`, so they also default to `SetNull`: deleting a `Building`/`Floor`/`Room` does **not** delete assignment history, it just blanks the location fields on any past assignment that referenced it. The user/department/asset/dates on that assignment row survive.
- **Frontend/schema field mismatch — the location edit forms collect data the backend silently drops.** `Building`, `Floor`, and `Room` in `schema.prisma` have **no `address`, `description`, or `capacity` columns at all** — yet:
  - `buildings/page.tsx` has form fields for `address` and `description` (lines 94-95) and even renders them in the table.
  - `floors/page.tsx` has a `description` field (line 103).
  - `rooms/page.tsx` has `description` and `capacity` fields (lines 115-116).
  - The backend controllers make this doubly moot: `BuildingsController.create/update`, `FloorsController.create/update`, and `RoomsController.create/update` (`buildings.controller.ts:27-39`, `floors.controller.ts:24-36`, `rooms.controller.ts:24-36`) explicitly whitelist only `{ name }` / `{ name, buildingId }` / `{ name, buildingId, floorId }` when building the Prisma `data` object — any other body fields, even if the schema had columns for them, are ignored. So these three inputs are pure UI dead-weight today; whatever a user types into address/description/capacity is discarded on save and never round-trips. If asked to make these fields actually work, you need **both** a `schema.prisma` migration (`db push`) **and** updating the three controllers' `data:` objects — neither alone is sufficient.
- `Room.floorId` is optional (a room can belong to a building directly with no floor) — the room-creation form and `RoomsController` both treat `floorId` as nullable/omittable correctly.

## 7. Reports (`reports.controller.ts`)

`GET /assets/report/pdf?type=QR|CODE128` (ADMIN/MANAGER) is the **only** report endpoint in this module. It is not an analytics/aggregation report — it's a printable label sheet:
- Pulls up to 1000 assets (`take: 1000`, no pagination beyond that — a fleet larger than 1000 assets silently gets truncated), ordered by `createdAt desc`.
- Streams an A4 `pdfkit` document, 10 rows per page, each row showing name + barcode text, description (ellipsized), and a generated QR or Code128 image (per the `type` query param, not per-asset `barcodeType`) rendered via the same `barcode.util.ts` functions used by the single-asset endpoints.
- No filtering by category/availability/date — it always dumps the whole (first-1000) asset table. If asked for a "real" report (cost totals, assignment history, availability breakdown, etc.), that doesn't exist yet and would need to be built from scratch — there's no precedent to extend here beyond the PDF label sheet.

## Other things worth knowing before touching this module

- **Deleting an asset can fail silently in the UI.** `Asset.typeId`/`categoryId` are required relations with no explicit `onDelete` → default `Restrict`; same for `AssetAssignment.asset`, `AssetMaintenance.asset`, `AssetCost.asset` (all required, no `onDelete` declared → `Restrict`). So `DELETE /assets/:id` (`AssetsService.remove()`, `assets.service.ts:127-129`) throws an unhandled Prisma FK-constraint error for any asset that has ever had an assignment (or, once implemented, a maintenance/cost row) — there's no try/catch or friendly error mapping. **`assets/page.tsx`'s `onDelete()` (lines 85-91) doesn't check `fetch()`'s response status at all** — it calls `toast.success("دارایی با موفقیت حذف شد")` unconditionally and reloads, so a failed delete (which is the common case for any asset with assignment history) reports success to the user while the asset silently remains in the list.
- Same `Restrict`-by-default logic applies to `AssetCategory` and `AssetType`: you can't delete a category/type that still has assets assigned to it (`categories.service.ts`/`types.controller.ts` `remove()` will throw, again unhandled).
- `AssetCategory` is self-referential (`parentId`/`children`) for a category tree, but neither `categories.service.ts` nor `assets/categories/page.tsx` exposes `parentId` anywhere — the hierarchy field exists in schema and Prisma client but is entirely unused by the current UI/API.
- Role gating differs per action, not just per controller: on `AssetsController`, `list` is `ADMIN|MANAGER|EXPERT` but `get` (single asset) additionally allows `USER`; `update` allows `EXPERT` but `create`/`delete` do not (`create` is `ADMIN|MANAGER`, `delete` is `ADMIN` only). Don't assume one role set applies to the whole controller — check the specific `@Roles()` decorator on the method you're changing.
