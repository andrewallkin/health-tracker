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

Burned calories are Garmin `totalCalories`. If Garmin is disconnected, nutrition data is still returned and health status is `unavailable`.

AI estimate is not part of this API.

## Dashboard responses

Macro objects are `{calories, protein, carbs, fat}`: calories in kcal, the rest in grams. Entry objects are log lines: `id`, `logDate`, `time`, `name`, `slot`, `servings`, and macros.

`/today` returns `date`, `goal`, `eaten`, `remaining` (macro objects), `entries`, `notTracked`, `weightKg` (kg), and `health`. `/week` returns `startDate`, `endDate`, `throughDate`, `nutrition` (`daysLogged`, `daysOnTarget`, `averages` macro object), and `energy`. `/month` returns `year`, `month`, and the same `nutrition` and `energy`. `energy` is `{status, reason}` when `unavailable`, and `{status, daysUsed, averageEaten, averageBurned, averageNet}` in kcal when `ready`.

## Garmin health

Garmin connects in Settings. Health data is per calendar day in `Africa/Johannesburg`.

The `health` block appears under `health` in `/today` and as each day row in `/health`. Shape:

- `status` is `ready`, or `unavailable` with a `reason` (`missing`, `disconnected`, `future`, or `error`); those rows carry only `date`, `status`, and `reason`.
- `totalCalories`, `activeCalories`, `bmrCalories` in kcal.
- `steps`, `stepGoal` in steps.
- `restingHr`, `minHr`, `maxHr`, `restingHr7dAvg` in bpm.
- `hrv`: `value` and `weeklyAvg` in ms; `status` is `balanced`, `unbalanced`, `low`, `poor`, or `unavailable`.
- `sleep`: `totalHours`, `deepHours`, `remHours`, `lightHours` (hours, one decimal), `avgHr` (bpm), `score` (0-100).
- `activities`: `id`, `name`, `type`, `startTime` (`HH:MM`), `durationMin` (minutes), `calories`, `avgHr` (bpm), `distanceKm` (km).
- `trainingReadiness`: `score`, `level`, `sleepScore`, `sleepFactorPercent`, `recoveryTime` (Garmin raw value, minutes), `recoveryTimeHours` (hours, one decimal, minutes divided by 60), `recoveryFactorPercent`, `acwrFactorPercent`, `acuteLoad` (training-load units).
- `trainingStatus`: `vo2Max` and `vo2MaxPrecise` (ml/kg/min), `vo2MaxDate`, `statusCode`, `statusPhrase`, `statusDate`, `acuteLoad` and `chronicLoad` (training-load units), `acwr` (ratio), `acwrPercent`, `acwrStatus`, and `loadBalance` (`aerobicLow`, `aerobicHigh`, `anaerobic` in training-load units; `aerobicLowTarget`, `aerobicHighTarget`, `anaerobicTarget` as `[min, max]` targets; `feedbackPhrase`).
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

Two required dates, `YYYY-MM-DD`. Returns `from`, `to`, `status`, and `days`, one row per date oldest first. A future date is `{date, status: "unavailable", reason: "future"}`; a day with no data is `reason: "missing"`. The range is capped at 90 days inclusive: reversed ranges, non-dates, calendar-impossible dates, and longer spans are 400. When Garmin is disconnected the response is `status: "unavailable"`, `reason: "disconnected"`, and empty `days`.

### GET /api/external/health-snapshots

Read-only. Snapshots are captured server-side every Monday around 07:00 SAST, with a catch-up at startup when no snapshot exists since that anchor. Optional `?limit=` from 1 to 52, default 52, newest first. Each item is `id`, `snapshotDate` (`YYYY-MM-DD`), `fetchedAt` (ISO timestamp), `racePredictions`, and `lactateThreshold`. `racePredictions` is `time5K`, `time10K`, `timeHalfMarathon`, `timeMarathon` — race times in seconds. `lactateThreshold` is `speedMps` in m/s (Garmin's raw value x 10, cross-checked against race predictions), `paceSecPerKm` in seconds derived from the speed, `heartRate` in bpm, and `asOf`, Garmin's version timestamp string. Either half is `null` when Garmin did not report it.

### Backfill script

`uv run python scripts/backfill_garmin_health.py` refetches past days with the widened metrics. `--days N` sets how many days back (default 84). `--from YYYY-MM-DD --to YYYY-MM-DD` sets an explicit range, capped at 90 days. `--throttle SECONDS` paces day fetches (default 1.5). The script is resumable: days that already carry the new blocks are skipped, and one failed day does not stop the run. It authenticates with `GARMIN_EMAIL` and `GARMIN_PASSWORD`, falling back to `~/.garminconnect/garmin_tokens.json`, and re-encrypts rotated tokens into the database.
