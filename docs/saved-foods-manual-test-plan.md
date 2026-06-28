# Saved Foods + Compose-from-Foods — Manual Test Plan

Use this checklist to validate the feature end-to-end in the running app. Check each box when it passes.

## Prerequisites

- [ ] Migration applied: `./backend/run_migrations.sh`
- [ ] Dev stack running: `docker compose -f docker-compose.dev.yml up -d` **or** local backend + frontend
- [ ] Logged in (e.g. `demo@example.com` / `password123` after seed)
- [ ] Optional demo data: `uv run python scripts/seed_db.py --reset`  
  (includes chilli mince, rice, avo, and composed meal **Mince bowl with rice**)

**URLs:** http://localhost:3000 (Docker) or http://localhost:5173 (Vite)

---

## 1. Library — Foods tab

### 1.1 Navigation

- [ ] **Add food** → **Saved meals** opens **Library** with subtitle “Meals and reusable foods”
- [ ] **Meals | Foods** tab switch works; active tab is visually highlighted
- [ ] **+ New** on Foods tab opens **New food**

### 1.2 Create saved food (manual)

- [ ] Create **Chilli mince**: name, description (e.g. “one portion”), calories + macros
- [ ] Add tags: **Protein** (and optionally **Snack**)
- [ ] Save → food appears in Foods list with macro chips and tag badges
- [ ] Create **Rice** with tag **Carb**
- [ ] Create **Avocado** with tag **Topping**

### 1.3 Edit saved food

- [ ] Tap a food → **Edit food** opens with fields pre-filled
- [ ] Change description or macros → **Save changes** → list updates

### 1.4 Search and tag filter (Foods tab)

- [ ] Search by name filters the list
- [ ] Tag chips (All, Protein, Carb, …) filter correctly
- [ ] **All** clears tag filter

---

## 2. Library — Meals tab (regression + composed)

### 2.1 Manual saved meals (unchanged)

- [ ] **+ New** → **Manual** mode → create meal with name + macros (optional photo)
- [ ] Meal appears on Meals tab; tap → **Log meal** → log with servings works
- [ ] Edit meal (pencil) → change macros → save → log again shows updated totals

### 2.2 Composed saved meal

- [ ] **+ New meal** → **From foods**
- [ ] Add chilli mince + rice via composer (quantity steppers, remove line)
- [ ] Running **Total** macros match sum of components
- [ ] Name meal (e.g. “Mince with rice”) → **Save meal**
- [ ] Meals tab shows meal with ingredient subtitle (e.g. “Chilli mince · Rice”)
- [ ] **Manage foods** link → opens Library on **Foods** tab

### 2.3 Edit composed meal

- [ ] Edit composed meal → opens in compose mode with lines pre-filled
- [ ] Change quantity or swap a component → save → subtitle and totals update

---

## 3. Quick log — From foods

- [ ] **Add food** → **Quick log**
- [ ] Toggle **From foods** (subtitle: “Built from saved foods”)
- [ ] Build plate (e.g. mince + rice + avo); verify **Total** preview
- [ ] Enter name (e.g. “Lunch bowl”) and meal slot
- [ ] **Add to today** → **one** entry on day view with that name and correct aggregated macros
- [ ] Entry is **not** linked to saved meal (no saved-meal edit path unless you saved as meal separately)

### 3.1 Quick log — Manual (regression)

- [ ] **Quick log** → **Manual** → enter name + macros → logs as before
- [ ] Subtitle: “One-off item, not saved to library”

### 3.2 Edit quick-log entry

- [ ] Tap edit on a quick-log entry → **Edit entry** (manual fields only)
- [ ] Change macros → save → day totals update

---

## 4. Log composed saved meal

- [ ] Library → Meals → select composed meal → **Log meal**
- [ ] **Ingredients** section lists components with quantities
- [ ] Change **Servings** (e.g. ×1.5) → nutrition preview scales correctly
- [ ] Confirm → one day entry; macros = meal totals × servings
- [ ] Edit logged entry (from day view) → servings/slot update correctly

---

## 5. AI estimate — Save as food

- [ ] Settings: OpenAI API key configured
- [ ] **Add food** → **AI estimate** → describe food (e.g. “grated cheddar, 2 tbsp”)
- [ ] On review: enable **Save as food** only (disable add-to-day if testing library-only)
- [ ] Optionally pick tags (e.g. **Dairy**, **Topping**)
- [ ] Confirm → navigates to Library **Foods** tab; new food listed
- [ ] Combined: **Add to today** + **Save as food** + **Save as meal** (if desired) — each action works

---

## 6. Forward-only updates (food → composed meal, not past logs)

Setup: composed meal logged yesterday or earlier today; note entry calories.

- [ ] Edit **Chilli mince** (or a food in a composed meal) → increase calories → save
- [ ] Library → composed meal shows **updated** total macros
- [ ] **Existing log entry** for that meal (logged before edit) still shows **old** calories
- [ ] Log the same composed meal again → new entry uses **updated** meal totals

---

## 7. Delete saved food (confirm cascade)

Setup: food used in at least one composed meal.

- [ ] Edit food → **Delete saved food** (or delete flow from edit page)
- [ ] Confirm dialog lists affected meal names (e.g. “This food is used in: Mince bowl with rice…”)
- [ ] Confirm delete → food removed from Foods tab
- [ ] Composed meal either **recomputed** without that food or **removed** if it had no items left
- [ ] Past log entries unchanged

### 7.1 Delete unused food

- [ ] Delete a food not used in any meal → deletes without extra warning (or simple confirm only)

---

## 8. Delete saved meal (regression)

- [ ] Delete manual or composed saved meal → confirm
- [ ] Past log entries remain on day view but no longer link to meal (`savedMealId` cleared in UI behavior)

---

## 9. Edge cases

- [ ] **From foods** quick log with empty plate → confirm button disabled
- [ ] **From foods** new meal with no components → save disabled
- [ ] Composer: add same food twice → second add disabled (use quantity instead)
- [ ] Composer empty state when no foods → “Add foods to your library” / **Manage foods** link works
- [ ] Library Foods tab with no matches → “No foods match your search”

---

## 10. Seed data smoke (optional)

After `scripts/seed_db.py --reset`:

- [ ] Foods tab: Chilli mince, Rice, Avocado
- [ ] Meals tab: **Mince bowl with rice** shows composed subtitle
- [ ] Log **Mince bowl with rice** → ingredients + correct totals (500 kcal base)

---

## 11. Regression — unrelated flows

- [ ] Day / week / month dashboards still load
- [ ] Goals settings still save
- [ ] Check-in section unaffected
- [ ] Health section (mock data) unaffected

---

## Sign-off

| Area | Tester | Date | Pass / Fail | Notes |
|------|--------|------|-------------|-------|
| Library & foods CRUD | | | | |
| Compose quick log | | | | |
| Compose saved meal | | | | |
| Log composed meal | | | | |
| AI save as food | | | | |
| Food update / delete cascade | | | | |
| Regression | | | | |

**Known limitations (v1, expected):**

- Log entries store flat macros only — no ingredient breakdown on day view after logging
- Editing a quick-log entry does not reopen the food composer
- Manual and composed meal modes are fixed after creation (no convert manual → composed on edit)
- No structured units (g/cups) — portion notes live in description only
