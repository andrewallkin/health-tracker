Data model (three entities)

Saved meal
- reusable template: name, description, default calories + macros, optional picture
- create manually or save from an AI estimate (after review/edit)

Log entry
- something eaten on a specific day: date/time, meal slot (breakfast / lunch / dinner / snack)
- calories + macros (may differ from the saved meal if edited)
- servings multiplier (e.g. 0.5, 1.0, 2.0) — scale saved meal defaults or one-off estimates
- optional link to a saved meal
- edit and delete

Daily goal
- fixed daily targets: calories + protein / carbs / fat (grams)
- v1: same goal every day; varying goals or Garmin-derived targets can come later


Meal/Food Upload
- one of the following
    - description only
    - description plus picture
    - picture only
- return calories, macros, assumptions, confidence, source, summary (MacrosEstimator class)
- review step: user confirms or edits the estimate before logging or saving
- after review: add to today's log and/or save as a reusable meal


Meal creation (manual)
- provide name, description, macros, calories
- optional picture upload
- save to library and use again when logging


Daily macros and calorie tracking
- set calorie and macro goals (Daily goal)
- track what you have had in a day (Log entries)
- primary metrics: consumed vs goal, remaining budget (kcal + each macro)
- add food via Meal/Food Upload, manual log, or select from saved meals
- edit and delete today's entries

Dashboard visuals (MVP — pick these first)
- progress bars or rings: calories + protein / carbs / fat vs goal
- remaining budget callout ("420 kcal, 35g protein left")
- today's meal list grouped by slot, with edit/delete
- weekly trends and charts can wait


Photo storage
- decide early: local paths, object storage, or URL on the meal record
- affects whether saved meals work across devices


Build order
1. Daily goals + log entry CRUD + today dashboard (no AI)
2. Manual saved meal library + select when logging
3. AI upload wired to MacrosEstimator, review/edit, then log or save
4. Chat UI (later — don't implement)
5. Garmin active-calorie integration (later — optional)


Chat UI (later — don't implement)
- conversation memory buffer
- can ask for recipe ideas based on ingredients at home
- returns markdown or HTML that is rendered nicely
