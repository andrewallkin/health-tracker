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
