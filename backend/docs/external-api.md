# External API

API-key access for a Grok bot. Your data only.

## Authentication

Create a key in Settings → External API key. It is shown once.

```http
Authorization: Bearer ht_YOUR_KEY_HERE
```

JWT login tokens are rejected. Calendar day and clock time use `Africa/Johannesburg`. Dates are `YYYY-MM-DD`.

Public routes: `GET /api/external/info` (short bot instructions) and `GET /api/external/docs` (this page).

## Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/external/foods?q=` | Saved foods. `q` matches the name. |
| GET | `/api/external/meals?q=` | Saved meals. `q` matches the name. Includes description and foods. |
| POST | `/api/external/foods` | Create a saved food. No photo. Does not log it. |
| PATCH | `/api/external/foods/{foodId}` | Update a saved food. Meals that use it are recalculated. |
| DELETE | `/api/external/foods/{foodId}` | Delete a saved food. |
| POST | `/api/external/meals` | Create a saved meal. No photo. Does not log it. |
| PATCH | `/api/external/meals/{mealId}` | Update a saved meal. |
| DELETE | `/api/external/meals/{mealId}` | Delete a saved meal. |
| POST | `/api/external/quick-log` | Log an estimated food. Macros are the totals eaten. |
| POST | `/api/external/log-food` | Log a saved food id with a servings multiplier. |
| POST | `/api/external/log-meal` | Log a saved meal id with a servings multiplier. |
| DELETE | `/api/external/entries/{entryId}` | Remove one log entry. |
| GET | `/api/external/today?date=` | Goal, eaten, remaining, log lines, weight, Garmin. |
| GET | `/api/external/week?date=` | Week averages for eaten and burned. |
| GET | `/api/external/month?year=&month=` | Month averages for eaten and burned. |
| GET | `/api/external/health?from=&to=` | Garmin health, one row per date. Max 90 days per request. |
| GET | `/api/external/health-snapshots?limit=` | Weekly Garmin snapshots: race predictions and lactate threshold. Read-only. |
| GET | `/api/external/weight?date=` | Weigh-in, 7-day average, 7- and 30-day series, deltas. |
| PUT | `/api/external/weight` | Set the weigh-in for a day. |
| GET | `/api/external/day-status?date=` | Whether a day is marked not tracked. |
| PUT | `/api/external/day-status` | Mark or unmark a day as not tracked. |

Food and meal responses include `description`. It is `null` when none was saved. Meal responses also include `kind`: `manual` or `composed`. A meal's foods list each food's id, name, and portion. They do not repeat that food's description.

Food-update body: any of `name`, `description`, `calories`, `protein`, `carbs`, `fat`. Omitted fields stay as they are. Send `description` as `null` to clear it. Macros stay one serving. Meals that include this food are recalculated. Logged entries stay as they were.

Food delete returns 204. If the food is used in meals, the response is 409 and lists `affectedMealIds` and `affectedMealNames`. Call the same path with `?confirm=true` to remove it from those meals, recalculate them, and delete a meal that has no foods left. Logged entries stay. Unknown ids are 404.

Meal-update body depends on `kind`. `name` and `description` work on both. Send `description` as `null` to clear it. A manual meal can also send `calories`, `protein`, `carbs`, and `fat`. Do not send `items` for a manual meal. A composed meal sends `items` to replace its food list. Each item is `foodId` plus `quantity`. The server recalculates the meal macros. Do not send macros for a composed meal. Each food can appear once. Unknown food ids are rejected.

Meal delete returns 204. Logged entries stay, and they no longer point at the meal. Unknown ids are 404.

Quick-log body: `name`, `slot` (`breakfast`, `lunch`, `dinner`, `snack`), `calories`, `protein`, `carbs`, `fat`, optional `date`.

Log-food body: `foodId`, `servings` (for example `0.5` or `1.5`), `slot`, optional `date`. The food must come from the foods list. The server multiplies that food's one-serving macros.

Meal-create body is one of two shapes. A manual meal sends `name`, optional `description`, `calories`, `protein`, `carbs`, and `fat`. A combo sends `name`, optional `description`, and `items`. Each item is `foodId` plus `quantity`, the portion of that saved food (`0.5`, `1`, `1.5`). The server adds those portions and stores the totals. Each food can appear once. Unknown food ids are rejected. Do not send a photo.

Log-meal body: `mealId`, `servings` (for example `0.5` or `1.5`), `slot`, optional `date`. The meal must come from the meals list. The server multiplies that meal's macros by servings. Do not send macros.

Weight body: `weightKg` from 30 to 300, optional `date`. A second write on the same day replaces the weight and leaves notes and photos in place.

Day-status body: `notTracked` (bool), optional `date` — omitting the date uses today in SAST. Both endpoints return `{date, notTracked}`. `notTracked: true` marks the day as skipped; `notTracked: false` removes the mark and is safe when there is none. Future dates are rejected with 400.

Burned calories are Garmin `totalCalories`. If Garmin is disconnected, nutrition data is still returned and health status is `unavailable`.

AI estimate is not part of this API.

## Dashboard responses

Macro objects are `{calories, protein, carbs, fat}`: calories in kcal, the rest in grams. Entry objects are log lines: `id`, `logDate`, `time`, `name`, `slot`, `servings`, and macros.

`/today` returns `date`, `goal`, `eaten`, `remaining` (macro objects), `entries`, `notTracked`, `weightKg` (kg), and `health`. `/week` returns `startDate`, `endDate`, `throughDate`, `nutrition` (`daysLogged`, `daysOnTarget`, `averages` macro object), and `energy`. `/month` returns `year`, `month`, and the same `nutrition` and `energy`. `energy` is `{status, reason}` when `unavailable`, and `{status, daysUsed, averageEaten, averageBurned, averageNet}` in kcal when `ready`.

## Garmin health

Garmin connects in Settings. Health data is per calendar day in `Africa/Johannesburg`.

The `health` block appears under `health` in `/today` and as each day row in `/health`. Shape:

- `status` is `ready`, or `unavailable` with a `reason` (`missing`, `disconnected`, `future`, or `error`). Unavailable `/health` day rows carry `date`, `status`, and `reason`, plus a `strength` block when Hevy logged workouts that day; under `/today` the unavailable block is `{status, reason}` with no `date` (same optional `strength`).
- `totalCalories`, `activeCalories`, `bmrCalories` in kcal.
- `steps`, `stepGoal` in steps.
- `restingHr`, `minHr`, `maxHr`, `restingHr7dAvg` in bpm.
- `hrv`: `value` and `weeklyAvg` in ms; `status` is `balanced`, `unbalanced`, `low`, `poor`, or `unavailable`.
- `sleep`: `totalHours`, `deepHours`, `remHours`, `lightHours` (hours, one decimal), `avgHr` (bpm), `score` (0-100).
- `activities`: `id`, `name`, `type`, `startTime` (`HH:MM`), `durationMin` (minutes), `calories`, `avgHr` (bpm), `distanceKm` (km).
- `trainingReadiness`: `score`, `level`, `sleepScore`, `sleepFactorPercent`, `recoveryTime` (Garmin raw value, minutes), `recoveryTimeHours` (hours, one decimal, minutes divided by 60), `recoveryFactorPercent`, `acwrFactorPercent`, `acuteLoad` (training-load units, float).
- `trainingStatus`: `vo2Max` and `vo2MaxPrecise` (ml/kg/min), `vo2MaxDate`, `statusCode`, `statusPhrase`, `statusDate`, `acuteLoad` and `chronicLoad` (training-load units, float), `acwr` (ratio), `acwrPercent`, `acwrStatus`, and `loadBalance` (`aerobicLow`, `aerobicHigh`, `anaerobic` in training-load units (float); `aerobicLowTarget`, `aerobicHighTarget`, `anaerobicTarget` as `[min, max]` targets; `feedbackPhrase`).
- `bodyBattery`: `charged`, `drained`, `highest`, `lowest` (0-100 index).
- `stress`: `avg`, `max` (0-100 index).
- `enduranceScore`: `overall`, `classification`.
- `intensityMinutes`: `moderate`, `vigorous`, `weeklyModerate`, `weeklyVigorous`, `weeklyTotal`, `weekGoal` (minutes).
- `hillScore`: `strength`, `endurance`, `overall`.
- `fitnessAge`: `fitnessAge`, `chronologicalAge` (years).
- `respiration`: `avgSleep` (breaths/min).
- `spo2`: `avgSleep`, `avg7d` (percent).

Every field above except `status` and `reason` is `null` when Garmin did not report it.

### GET /api/external/health?from=&to=

Two required dates, `YYYY-MM-DD`. Returns `from`, `to`, `status`, and `days`, one row per date oldest first. A future date is `{date, status: "unavailable", reason: "future"}`; a day with no data is `reason: "missing"`. Today is always fetched live. A past day already stored with `is_complete` false (fetched before that calendar day ended) is fetched once more and then marked complete. A past day with no stored row stays `reason: "missing"` until `scripts/backfill_garmin_health.py` populates it — a 90-day range does not live-fetch those. `/today`, `/week`, and `/month` use the same complete-day rule, and they also fetch a past day that has no row yet. The range is capped at 90 days inclusive: reversed ranges, non-dates, calendar-impossible dates, and longer spans are 400. When Garmin is disconnected the response is `status: "unavailable"`, `reason: "disconnected"`, and empty `days`.

### GET /api/external/health-snapshots

Read-only. Snapshots are captured server-side every Monday around 07:00 SAST, with a catch-up at startup when no snapshot exists since that anchor. Optional `?limit=` from 1 to 52, default 52, newest first. Each item is `id`, `date` (`YYYY-MM-DD`), `fetchedAt` (ISO timestamp), `racePredictions`, and `lactateThreshold`. `racePredictions` is `time5K`, `time10K`, `timeHalfMarathon`, `timeMarathon` — race times in seconds. `lactateThreshold` is `speedMps` in m/s (Garmin's raw value x 10, cross-checked against race predictions), `paceSecPerKm` in seconds derived from the speed, `heartRate` in bpm, and `asOf`, a passthrough timestamp string of Garmin's underlying reading (Garmin's raw `calendarDate`; observed `2026-08-24T17:37:34.267`, format not guaranteed) — treat it as an opaque string, not a `YYYY-MM-DD` date. Either half is `null` when Garmin did not report it.

### Backfill script

`uv run python scripts/backfill_garmin_health.py` refetches past days with the widened metrics. `--days N` sets how many days back (default 84). `--from YYYY-MM-DD --to YYYY-MM-DD` sets an explicit range, capped at 90 days. `--throttle SECONDS` paces day fetches (default 1.5). The script is resumable: days that already carry the new blocks are skipped, and one failed day does not stop the run. It authenticates with `GARMIN_EMAIL` and `GARMIN_PASSWORD`, falling back to `~/.garminconnect/garmin_tokens.json`, and re-encrypts rotated tokens into the database.

## Hevy

Hevy strength data lives behind the same API key. Read endpoints are served from a local mirror kept fresh by server-side syncs — they never call Hevy and answer instantly. Write endpoints are proxies that validate your payload and forward it to the Hevy API unchanged.

Hevy request and response keys are `snake_case`. The nutrition and health endpoints above use `camelCase`; the Hevy ones do not.

Id formats: workout and routine ids are 36-character UUID strings; routine-folder ids are plain integers (`4063618`); exercise template ids are 8-character uppercase hex strings (`55E6546F`) for catalogue exercises and UUID strings for custom ones. `GET /api/external/hevy/metadata` returns this note plus every valid filter value.

All date params are `YYYY-MM-DD`. They compare against `local_date`, the SAST calendar day of the workout, not the UTC day.

| Endpoint | Purpose |
|----------|---------|
| `GET /api/external/hevy/workouts?from=&to=&limit=` | Mirror workout summaries, newest first. |
| `GET /api/external/hevy/workouts/{workoutId}` | One workout with full exercises and sets. |
| `GET /api/external/hevy/exercises?muscle_group=&equipment=&type=&search=` | Exercise-template catalogue. |
| `GET /api/external/hevy/metadata` | Filter values and the id-format note. |
| `GET /api/external/hevy/exercises/{templateId}/progression?from=&to=` | Per-session stats for one exercise. |
| `GET /api/external/hevy/prs` | Personal records, one per exercise ever done. |
| `GET /api/external/hevy/habits?from=&to=` | Exercise and equipment frequency. |
| `GET /api/external/hevy/routines` | Live (calls Hevy, not the mirror): the account's routines, paginated — list them before creating or updating one. |
| `POST /api/external/hevy/routines` | Create a routine in Hevy. |
| `PUT /api/external/hevy/routines/{routineId}` | Overwrite a routine in Hevy. |
| `POST /api/external/hevy/routine-folders` | Create a routine folder in Hevy. |
| `GET /api/external/hevy/body-measurements/{date}` | That day's Hevy body measurement, or 404 when Hevy has none. |
| `PUT /api/external/hevy/body-measurements/{date}` | Upsert that day's Hevy body measurements (creates the day's entry on first write). |
| `POST /api/external/hevy/links` | Link a Garmin activity to a Hevy workout. |
| `DELETE /api/external/hevy/links` | Remove that link. |
| `POST /api/external/hevy/load/templates` | Bulk-sync the exercise-template catalogue. |
| `POST /api/external/hevy/load/workouts` | Bulk-backfill every workout. |
| `POST /api/external/hevy/load/events` | Apply workout events since the last sync. |

### Workouts

Each item of `GET /api/external/hevy/workouts` carries `id`, `title`, `start_time`, `end_time` (ISO timestamps), `local_date` (`YYYY-MM-DD`), `routine_id` (`null` when not started from a routine), `garmin_activity_ids` (list), `exercise_count`, and `set_count`. Optional `from` and `to` bound `local_date` inclusively; `limit` is 1 to 200, default 50, anything else 400.

`GET /api/external/hevy/workouts/{workoutId}` adds `description` (`null` when none, including when Hevy sends `""`) and `exercises`. Each exercise carries `index`, `title`, `exercise_template_id`, `superset_id`, `rest_seconds`, `notes`, and `sets`. Each set carries `index`, `type` (`warmup`, `normal`, `failure`, or `dropset`), `weight_kg`, `reps`, `distance_meters`, `duration_seconds`, `rpe`, `custom_metric`, and `rep_range` (`{"start", "end"}` — routine sets only). Fields Hevy did not report are `null`. Unknown ids are 404.

### Exercise catalogue

`GET /api/external/hevy/exercises` returns every catalogue entry, sorted by title, no pagination: `id`, `title`, `type`, `primary_muscle_group`, `secondary_muscle_groups` (list), `equipment`, `is_custom`, `thumbnail_url` (`null` when none). All four filters are optional and combine: `muscle_group`, `equipment`, and `type` match exactly (case-insensitive), `search` is a case-insensitive substring of the title.

`GET /api/external/hevy/metadata` returns `muscle_groups`, `equipment`, `exercise_types`, and `set_types` (lists of strings — use them to fill the filters and set payloads) plus `id_formats` (the id-format note above). The catalogue is empty until `POST /api/external/hevy/load/templates` has run once.

### Progression and PRs

`GET /api/external/hevy/exercises/{templateId}/progression` lists one entry per session containing that exercise, oldest first: `date`, `workout_id`, `n_sets`. Weight exercises add `best_e1rm`, `top_weight`, and `total_volume_kg` (e1RM = weight × (1 + reps / 30)). Duration and distance exercises add `best_duration_seconds` (and `best_distance_meters` for distance types) instead. Absent fields are omitted, not `null`. Unknown template ids are 404.

`GET /api/external/hevy/prs` returns one entry per exercise ever done, sorted by title: `template_id`, `title`, `pr` (`{metric, value, date}` — the first session that reached the maximum), optional `best_e1rm` (`{value, date}`, weight exercises only — its peak can land on a different date than the top weight), and `history_count` (number of sessions). `pr.metric` is `weight_kg`, falling back to `reps` when no weight was ever logged, or `duration_seconds` / `distance_meters` for cardio exercises.

Both include every logged set, warmups included.

`GET /api/external/hevy/habits` returns `exercises` (`[{template_id, title, count}]` — `count` is the number of sessions containing the exercise, sorted by count then title) and `equipment_profile` (`[{equipment, count}]`, sorted the same way).

### Routines and folders

The write bodies mirror Hevy's own request shapes. Unknown fields are rejected with 422 — a typo cannot silently drop data, because Hevy's PUTs overwrite. A server without `HEVY_API_KEY` configured is 503; Hevy errors and network failures surface as 502.

`GET /api/external/hevy/routines` is the one Hevy read that is not mirror-backed: it calls Hevy directly, page by page (10 routines per page, one request per second), and returns Hevy's routine entries as-is. List routines before creating or updating one — Hevy does not enforce title uniqueness, so duplicates are possible: prefer updating an existing routine (PUT below) over creating a near-duplicate. Intentional duplicates are allowed.

Routine create (POST `/api/external/hevy/routines`) and update (PUT `/api/external/hevy/routines/{routineId}`) take the same body:

```json
{
  "routine": {
    "title": "Push Day",
    "folder_id": 4063618,
    "notes": "Focus on form over weight",
    "exercises": [
      {
        "exercise_template_id": "55E6546F",
        "superset_id": 1,
        "rest_seconds": 90,
        "notes": "Stay slow and controlled",
        "sets": [
          {
            "type": "normal",
            "weight_kg": 40.0,
            "reps": 10,
            "distance_meters": null,
            "duration_seconds": null,
            "rep_range": {"start": 8, "end": 12}
          }
        ]
      }
    ]
  }
}
```

Only `title` is required; omit what does not apply. `folder_id` is a numeric folder id, not a UUID — create a folder first (`POST /api/external/hevy/routine-folders`, body `{"routine_folder": {"title": "Coach Programs"}}`, returns 201 with Hevy's response) and use the integer id from it. `type` is one of the `set_types` from metadata. `rep_range` (`{start, end}`) belongs on routine sets. Cardio exercises use `distance_meters` or `duration_seconds` instead of `weight_kg` × `reps`.

`rep_range` is special: Hevy rejects an explicit `"rep_range": null` on routine writes with 400, so the proxy automatically omits (not nulls) any `rep_range` you leave out — omitting it is always safe. Other fields sent as `null` (`notes`, `weight_kg`, `distance_meters`, …) are forwarded as `null` unchanged.

POST returns 201 with Hevy's routine response. PUT is a FULL overwrite: Hevy replaces the whole routine, so every exercise you omit is deleted — send the complete routine every time.

Hevy's routine response has no top-level `notes` field — notes exist on exercises only. A `notes` string on the routine is accepted and forwarded, and Hevy does not return it on create, update, or list. Exercise `notes` do come back.

### Body measurements

PUT `/api/external/hevy/body-measurements/{date}` (`date` is `YYYY-MM-DD`; non-dates are 400) forwards any of `weight_kg`, `lean_mass_kg`, `fat_percent`, `neck_cm`, `shoulder_cm`, `chest_cm`, `left_bicep_cm`, `right_bicep_cm`, `left_forearm_cm`, `right_forearm_cm`, `abdomen`, `waist`, `hips`, `left_thigh`, `right_thigh`, `left_calf`, `right_calf` to Hevy. This proxy does not merge: Hevy overwrites the whole day's measurement with the body you send, so fields you omit are cleared. Send the full field set you want kept.

`GET /api/external/hevy/body-measurements/{date}` returns Hevy's measurement for that date (the same fields as the write body, plus `date`), or 404 when Hevy has none. Non-dates are 400. Use it to confirm a write: Hevy's create and update responses do not echo the saved values.

The proxy upserts by reading first. Hevy's live `PUT /v1/body_measurements/{date}` can answer 200 with `{}` even for a date that did not exist yet, so a successful PUT is not proof of an update. When GET finds no measurement, the proxy creates one with `POST /v1/body_measurements` (Hevy's POST schema carries `date` inside the body) and this endpoint returns 201 with `{}`. When GET finds one, the proxy PUTs and returns 200 with Hevy's response. If another writer creates the day's entry between the GET and the POST (the create answers 409), the proxy re-fetches the measurement, merges your fields on top, and retries the PUT. Other Hevy errors and network failures surface as 502.

The `PUT /api/external/weight` endpoint above also dual-writes `weight_kg` to Hevy automatically when the server has `HEVY_API_KEY` configured, with the same upsert semantics: it creates the day's measurement on first write and updates it after. Unlike this proxy, the dual-write merges: it reads the day's existing Hevy measurement first and updates only `weight_kg`, so fat and circumference measurements for that day survive. A Hevy failure there never fails the local write; it is reported in the response as `hevy_error`.

### Garmin links

`POST /api/external/hevy/links` and `DELETE /api/external/hevy/links` take `{"workout_id": "...", "garmin_activity_id": "..."}` and return `{"workout_id": "...", "garmin_activity_ids": ["..."]}`. Links are 1:1: one workout holds at most one activity, and one activity belongs to at most one workout.

POST is 404 for an unknown workout, 404 when the activity is not in the workout's `local_date` Garmin data (the activity must be on that day's health row), and 409 when either side is already linked to a different partner. DELETE is 404 when the workout is unknown or the link is absent, and returns the remaining links.

The server also links automatically: a Hevy sync, and a Garmin day save, each link a workout to the closest Garmin activity starting within 20 minutes of it on the same local day. A run, round of golf, or any other activity with no Hevy start in that window stays unmatched. The comparison uses the activity's UTC start (`startTimeUtc`, taken from Garmin's `startTimeGMT`) when the health snapshot has it, so a workout logged outside South Africa still matches. Snapshots that only have a local `startTime` are still read as SAST — that misses a watch set to another zone (Vietnam is five hours from SAST). Refetch those days with `scripts/backfill_garmin_health.py` (it refetches complete days whose activities lack `startTimeUtc`) and then `POST /api/external/hevy/load/workouts` to link them. Manual links are never overwritten by re-syncs.

### Bulk load

`POST /api/external/hevy/load/templates` syncs the full exercise-template catalogue (~454 entries) and `POST /api/external/hevy/load/workouts` backfills every workout from the paginated feed (~145 workouts). Both return `{"count": N}` and are idempotent — re-running is safe. They are bulk operations, not reads: Hevy allows one request per second and 10 items per page, so the workout backfill takes ~15 seconds and the template catalogue ~45. Call them before building anything on top of the mirror.

`POST /api/external/hevy/load/events` applies workout update/delete events since the last processed one and returns `{"count": N}`. Run `/load/workouts` first: the events feed only covers workouts that changed inside its window, so without the bulk backfill the mirror is missing older history. The server's background catch-up applies the entire feed on its first cycle — there is no event cursor yet, so nothing is skipped — and then pins its cursor at the newest event timestamp.

### Strength in the day views

`/today`'s `health` block and every `/health` day row carry a `strength` block when Hevy logged workouts that day — including unavailable and missing days, since it comes from Hevy, not Garmin. It is absent when the day has no workouts. Exact shape:

```json
{
  "sessions": [
    {
      "workout_id": "8f2c...",
      "title": "Push Day",
      "start_time": "2026-11-10T14:22:32+00:00",
      "end_time": "2026-11-10T15:10:00+00:00",
      "garmin_activity_ids": ["24833957298"],
      "total_volume_kg": 3200.0,
      "hard_sets": 6,
      "n_exercises": 7
    }
  ],
  "total_volume_kg": 3200.0,
  "hard_sets": 6
}
```

Sessions are ordered by start time. `total_volume_kg` sums `weight_kg × reps` over non-warmup sets (cardio sets contribute 0). `hard_sets` counts non-warmup sets with `rpe >= 8`, or `type` `failure`, or a `normal` set without `rpe` at that exercise's top non-warmup weight (ties all count). Warmup sets never count. A straight-set exercise with no RPE therefore counts every work set at that weight, so `hard_sets` can equal the work-set count. Log RPE or mark failure sets when the count should mean effort.

### Webhook

`POST /api/hevy/webhook` is the server-to-server receiver Hevy calls when a workout changes. It does not use the external API key: authorization is `Authorization: Bearer <HEVY_WEBHOOK_TOKEN>` (the raw token without the `Bearer` prefix is also accepted). Body is `{"workoutId": "<hevy workout id>"}`.

The handler validates and answers `200 {"status": "accepted"}` immediately; the sync runs in the background. Wrong or missing token is 401, a body without a non-empty `workoutId` is 400, and a server without `HEVY_WEBHOOK_TOKEN` configured is 503.
