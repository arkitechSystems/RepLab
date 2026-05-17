# Exercise Library Cleanup Report — 2026-05-17T05:31:41.537Z

- Mode: **COMMIT**
- Source spreadsheet: `_marketing/replab-exercise-library-2026-05-17 (Conversion).xlsx`
- Duplicates rows: 166
- Muscle group rows: 56

## Pre-state

- Master exercises in DB: 479

## Validation — Duplicates
- Planned conversions: 153
- Planned outright deletes: 8
- Errors: 0
- Warnings: 5

### Warnings
- Duplicates row 151 (id=184): source == target (no-op, skipping)
- Duplicates row 99 (id=117): source name "Dumbbell Shoulder Press" collides with another DB row not in the duplicates sheet (ids in DB: 117, 252); skipping to avoid orphaning the non-source row
- Duplicates row 105 (id=290): source name "Banded DB Shoulder Press" collides with another DB row not in the duplicates sheet (ids in DB: 269, 290); skipping to avoid orphaning the non-source row
- Duplicates row 153 (id=321): source name "Single Leg Hack Squat" collides with another DB row not in the duplicates sheet (ids in DB: 280, 321); skipping to avoid orphaning the non-source row
- Duplicates row 161 (id=283): source name "Cable Flyes (Middle Chest)" collides with another DB row not in the duplicates sheet (ids in DB: 283, 312); skipping to avoid orphaning the non-source row

## Validation — New Muscle Group
- Planned updates: 56
- Errors: 0
- Warnings: 7

### Warnings
- Muscle Group row 13 (id=503): new_group "Cardio" not in known set (will apply anyway)
- Muscle Group row 14 (id=546): new_group "Cardio" not in known set (will apply anyway)
- Muscle Group row 15 (id=544): new_group "Cardio" not in known set (will apply anyway)
- Muscle Group row 34 (id=540): new_group "Cardio" not in known set (will apply anyway)
- Muscle Group row 50 (id=537): new_group "Cardio" not in known set (will apply anyway)
- Muscle Group row 52 (id=518): new_group "Cardio" not in known set (will apply anyway)
- Muscle Group row 56 (id=293): new_group "Hips" not in known set (will apply anyway)

## Duplicates Conversion

| # | Source ID | Source Name | Target ID | Target Name | TE renamed | SE renamed | PBs deleted | PBs renamed |
|---|---|---|---|---|---|---|---|---|
| 1 | 495 | Barbell Bent Rows | 336 | Barbell Bent Over Row | 16 | 0 | 0 | 0 |
| 2 | 136 | Barbell Row | 336 | Barbell Bent Over Row | 9 | 18 | 0 | 0 |
| 3 | 392 | Barbell Rows | 336 | Barbell Bent Over Row | 33 | 0 | 0 | 0 |
| 4 | 481 | A1: CABLE SEATED ELBOWS OUT ROW | 425 | CABLE SEATED ELBOWS OUT ROW | 24 | 3 | 0 | 0 |
| 5 | 426 | CABLE SEATED ROW | 138 | Seated Cable Row | 0 | 0 | 0 | 0 |
| 6 | 543 | A2: CABLE SEATED ROW | 138 | Seated Cable Row | 24 | 3 | 0 | 0 |
| 7 | 139 | Cable Rows | 138 | Seated Cable Row | 0 | 6 | 0 | 1 |
| 8 | 133 | Pull-Ups | 411 | PULL-UP | 7 | 0 | 2 | 0 |
| 9 | 132 | Pull Ups | 411 | PULL-UP | 3 | 29 | 0 | 0 |
| 10 | 488 | Pull-Ups (warm-up) | 411 | PULL-UP | 7 | 0 | 0 | 0 |
| 11 | 303 | Chin Ups | 135 | Chin-Ups | 3 | 9 | 0 | 0 |
| 12 | 398 | Weighted Chin Ups (Palms Toward Face) | 134 | Supinated Weighted Pull-Ups | 25 | 0 | 6 | 0 |
| 13 | 535 | Weighted Pullups | 134 | Supinated Weighted Pull-Ups | 24 | 0 | 0 | 0 |
| 14 | 391 | Deadlifts | 145 | Deadlift | 44 | 0 | 0 | 0 |
| 15 | 470 | Deadlifts (warm-up 50%) | 145 | Deadlift | 7 | 0 | 0 | 0 |
| 16 | 516 | Deadlifts (warm-up 70%) | 145 | Deadlift | 7 | 0 | 0 | 0 |
| 17 | 337 | Dumbbell Bent-Over Row | 443 | DUMBBELL ONE-ARM ROW | 9 | 0 | 0 | 0 |
| 18 | 137 | Dumbbell Row | 443 | DUMBBELL ONE-ARM ROW | 0 | 10 | 0 | 1 |
| 19 | 143 | Straight-Arm Pulldowns | 354 | Straight-Arm Pulldown | 0 | 6 | 0 | 1 |
| 20 | 302 | Straight Arm Pulldowns | 354 | Straight-Arm Pulldown | 3 | 9 | 0 | 0 |
| 21 | 151 | Barbell Curls | 150 | Barbell Curl | 35 | 0 | 0 | 0 |
| 22 | 526 | Barbell Curl (warm-up) | 150 | Barbell Curl | 7 | 0 | 0 | 0 |
| 23 | 298 | EZ Bar Curls | 152 | EZ Bar Curl | 57 | 28 | 10 | 1 |
| 24 | 297 | EZ Bar Curls | 152 | EZ Bar Curl | 0 | 0 | 0 | 0 |
| 25 | 272 | EZ bar curls | 152 | EZ Bar Curl | 0 | 0 | 0 | 0 |
| 26 | 325 | Dumbbell curls | 153 | Dumbbell Curl | 51 | 4 | 0 | 1 |
| 27 | 316 | DB Curls | 153 | Dumbbell Curl | 3 | 3 | 0 | 0 |
| 28 | 154 | Hammer Curl (DB) | 380 | Dumbbell Hammer Curl | 0 | 24 | 0 | 0 |
| 29 | 431 | HAMMER CURL | 380 | Dumbbell Hammer Curl | 24 | 3 | 0 | 0 |
| 30 | 155 | Hammer Curls | 380 | Dumbbell Hammer Curl | 49 | 64 | 1 | 3 |
| 31 | 156 | Hammer Curls (warm-up) | 380 | Dumbbell Hammer Curl | 0 | 6 | 0 | 0 |
| 32 | 461 | A2: DUMBBELL HAMMER CURL | 380 | Dumbbell Hammer Curl | 31 | 0 | 0 | 0 |
| 33 | 288 | DB Hammer Curls | 380 | Dumbbell Hammer Curl | 3 | 21 | 0 | 0 |
| 34 | 473 | A1: REVERSE GRIP EZ BAR CURL | 414 | REVERSE GRIP EZ BAR CURL | 24 | 6 | 0 | 0 |
| 35 | 464 | A2: SUPINATED EZ BAR CURL | 415 | SUPINATED EZ BAR CURL | 24 | 6 | 0 | 0 |
| 36 | 477 | A3: DUMBBELL SUPINATED CURL | 447 | DUMBBELL SUPINATED CURL | 31 | 0 | 0 | 0 |
| 37 | 486 | A1: DUMBBELL PRONATED CURL | 457 | DUMBBELL PRONATED CURL | 31 | 0 | 0 | 0 |
| 38 | 366 | Reverse-Grip Barbell or EZ-Bar Curl | 340 | Reverse-Grip Barbell Curl | 9 | 0 | 0 | 0 |
| 39 | 384 | Rope Cable Curls | 357 | Rope Cable Curl | 25 | 0 | 0 | 0 |
| 40 | 161 | Single-Arm Cable Curls | 430 | SINGLE-ARM CABLE CURL | 8 | 29 | 5 | 3 |
| 41 | 273 | Single arm cable curl | 430 | SINGLE-ARM CABLE CURL | 0 | 1 | 0 | 0 |
| 42 | 226 | Standing Calf Raises | 225 | Standing Calf Raise | 16 | 4 | 0 | 0 |
| 43 | 482 | Standing Calf Raises (warm-up) | 225 | Standing Calf Raise | 7 | 0 | 0 | 0 |
| 44 | 438 | TEMPO STANDING CALF RAISE | 225 | Standing Calf Raise | 23 | 0 | 0 | 0 |
| 45 | 387 | Seated Calf Raises | 228 | Seated Calf Raise | 10 | 0 | 0 | 0 |
| 46 | 352 | Donkey or Leg Press Calf Raise | 229 | Donkey Calf Raise | 18 | 0 | 0 | 0 |
| 47 | 250 | Bench Press | 101 | Barbell Bench Press | 159 | 16 | 0 | 0 |
| 48 | 285 | BB Bench Press | 101 | Barbell Bench Press | 3 | 59 | 0 | 1 |
| 49 | 309 | BB Bench Press | 101 | Barbell Bench Press | 0 | 0 | 0 | 0 |
| 50 | 284 | BB Bench Press (Warm Up) | 101 | Barbell Bench Press | 4 | 60 | 0 | 0 |
| 51 | 313 | BB Bench Press (Warm Up) | 101 | Barbell Bench Press | 0 | 0 | 0 | 0 |
| 52 | 251 | Incline Bench Press | 322 | Incline barbell bench | 9 | 0 | 1 | 0 |
| 53 | 102 | Incline Bench Press | 322 | Incline barbell bench | 0 | 0 | 0 | 0 |
| 54 | 401 | Incline Press | 322 | Incline barbell bench | 12 | 0 | 0 | 0 |
| 55 | 275 | Incline barbell press | 322 | Incline barbell bench | 7 | 4 | 0 | 1 |
| 56 | 476 | Incline Barbell Press (warm-up 50%) | 322 | Incline barbell bench | 7 | 0 | 0 | 0 |
| 57 | 500 | Incline Barbell Press (warm-up 70%) | 322 | Incline barbell bench | 7 | 0 | 0 | 0 |
| 58 | 256 | Incline DB Press | 103 | Incline Dumbbell Press | 24 | 33 | 4 | 2 |
| 59 | 296 | DB Incline Bench Press | 103 | Incline Dumbbell Press | 3 | 9 | 0 | 0 |
| 60 | 287 | DB Incline Press | 103 | Incline Dumbbell Press | 10 | 180 | 0 | 0 |
| 61 | 311 | DB Incline Press | 103 | Incline Dumbbell Press | 0 | 0 | 0 | 0 |
| 62 | 421 | DUMBBELL INCLINE PRESS | 103 | Incline Dumbbell Press | 24 | 15 | 0 | 0 |
| 63 | 105 | Decline Bench Press | 259 | Decline Barbell Bench Press | 0 | 0 | 0 | 0 |
| 64 | 381 | Pec Dec | 111 | Pec Deck | 25 | 0 | 0 | 0 |
| 65 | 106 | Chest Fly | 343 | Dumbbell Fly | 0 | 6 | 0 | 0 |
| 66 | 263 | Chest Dips (Lean Forward) | 109 | Chest Dips | 0 | 3 | 0 | 0 |
| 67 | 468 | Weighted Dips | 406 | WEIGHTED DIP | 34 | 0 | 0 | 0 |
| 68 | 514 | Weighted Dips (warm-up) | 406 | WEIGHTED DIP | 7 | 0 | 0 | 0 |
| 69 | 257 | Weighted Dips (Drop Set) | 406 | WEIGHTED DIP | 24 | 34 | 0 | 1 |
| 70 | 258 | Max Push-Ups | 112 | Push-Ups | 16 | 26 | 0 | 0 |
| 71 | 261 | Push-ups to Failure (Finisher) | 112 | Push-Ups | 0 | 2 | 0 | 0 |
| 72 | 310 | Max Pushups | 112 | Push-Ups | 1 | 18 | 0 | 0 |
| 73 | 286 | Max Pushups | 112 | Push-Ups | 0 | 0 | 0 | 0 |
| 74 | 385 | Close Grip Push Ups | 113 | Close-Grip Push-Ups | 25 | 0 | 0 | 0 |
| 75 | 542 | Close Grip Pushups | 113 | Close-Grip Push-Ups | 1 | 3 | 0 | 0 |
| 76 | 383 | Close Grip Bench Press | 114 | Close-Grip Bench Press | 50 | 0 | 0 | 0 |
| 77 | 474 | Close-Grip Bench Press (warm-up 50%) | 114 | Close-Grip Bench Press | 7 | 0 | 0 | 0 |
| 78 | 239 | Ab Rollout | 409 | AB WHEEL ROLLOUT | 0 | 0 | 0 | 0 |
| 79 | 242 | Bicycle Crunches | 423 | BICYCLE CRUNCH | 0 | 0 | 0 | 0 |
| 80 | 237 | Hanging Leg Raises | 361 | Hanging Leg Raise | 0 | 0 | 0 | 0 |
| 81 | 241 | Leg Raises | 361 | Hanging Leg Raise | 0 | 0 | 0 | 0 |
| 82 | 235 | Planks | 236 | Plank | 0 | 0 | 0 | 0 |
| 83 | 204 | Hip Thrust | 205 | Barbell Hip Thrust | 0 | 0 | 0 | 0 |
| 84 | 207 | Sumo Deadlift | 557 | Barbell Sumo Deadlift | 0 | 0 | 0 | 0 |
| 85 | 214 | Bodyweight Frog Pumps | 215 | Frog Pumps | 0 | 0 | 0 | 0 |
| 86 | 193 | Romanian Deadlift | 551 | Barbell Romanian Deadlift | 27 | 0 | 0 | 0 |
| 87 | 400 | Barbell RDL | 551 | Barbell Romanian Deadlift | 12 | 0 | 0 | 0 |
| 88 | 326 | Romanian dead Lift | 551 | Barbell Romanian Deadlift | 0 | 2 | 0 | 0 |
| 89 | 281 | DB RDL | 195 | Dumbbell RDL | 3 | 12 | 0 | 1 |
| 90 | 306 | DB RDL's | 195 | Dumbbell RDL | 0 | 3 | 0 | 0 |
| 91 | 199 | Leg Curls | 198 | Leg Curl | 63 | 70 | 3 | 2 |
| 92 | 200 | Hamstring Curl | 198 | Leg Curl | 0 | 0 | 0 | 0 |
| 93 | 201 | Nordic Hamstring Curl | 307 | Nordic Curls | 3 | 12 | 2 | 1 |
| 94 | 324 | Nordic Hamstring Curls | 307 | Nordic Curls | 6 | 15 | 1 | 1 |
| 95 | 417 | CABLE PULL THROUGH | 203 | Cable Pull-Through | 24 | 3 | 0 | 0 |
| 96 | 450 | CABLE ROPE PULLTHROUGH | 203 | Cable Pull-Through | 16 | 0 | 0 | 0 |
| 97 | 213 | Band Walks | 437 | LATERAL BAND WALK | 0 | 0 | 0 | 0 |
| 98 | 561 | Banded Lateral Step | 437 | LATERAL BAND WALK | 18 | 0 | 0 | 0 |
| 99 | 541 | DB Shoulder Press | 252 | Dumbbell Shoulder Press | 4 | 17 | 1 | 1 |
| 100 | 116 | Seated Shoulder Press (DB) | 252 | Dumbbell Shoulder Press | 0 | 15 | 0 | 0 |
| 101 | 362 | Dumbbell Shoulder Press (Seated) | 252 | Dumbbell Shoulder Press | 9 | 0 | 0 | 0 |
| 102 | 405 | DUMBBELL SEATED SHOULDER PRESS | 252 | Dumbbell Shoulder Press | 24 | 6 | 0 | 0 |
| 103 | 314 | Seated DB Shoulder Press | 252 | Dumbbell Shoulder Press | 7 | 7 | 4 | 0 |
| 104 | 119 | Military Press | 331 | Barbell Shoulder Press | 54 | 15 | 0 | 0 |
| 105 | 115 | Overhead Press | 331 | Barbell Shoulder Press | 0 | 6 | 0 | 0 |
| 106 | 548 | Shoulder Press | 331 | Barbell Shoulder Press | 7 | 0 | 0 | 0 |
| 107 | 502 | Shoulder Press (warm-up 50%) | 331 | Barbell Shoulder Press | 7 | 0 | 0 | 0 |
| 108 | 471 | Shoulder Press (warm-up 70%) | 331 | Barbell Shoulder Press | 7 | 0 | 0 | 0 |
| 109 | 402 | DB Lateral Raise | 121 | Dumbbell Lateral Raise | 12 | 0 | 0 | 0 |
| 110 | 120 | Lateral Raises | 121 | Dumbbell Lateral Raise | 7 | 15 | 0 | 0 |
| 111 | 499 | Lateral Raises (warm-up) | 121 | Dumbbell Lateral Raise | 7 | 0 | 0 | 0 |
| 112 | 382 | Side Lateral Raise | 121 | Dumbbell Lateral Raise | 25 | 0 | 0 | 0 |
| 113 | 146 | Barbell Shrugs | 338 | Barbell Shrug | 34 | 59 | 0 | 3 |
| 114 | 318 | BB Shrugs | 338 | Barbell Shrug | 3 | 3 | 0 | 0 |
| 115 | 147 | Dumbbell Shrugs | 378 | Dumbbell Shrug | 0 | 0 | 0 | 0 |
| 116 | 529 | Cable Tricep Pushdowns | 167 | Cable Tricep Pushdown | 3 | 19 | 5 | 1 |
| 117 | 289 | Cable Tri Pushdown | 167 | Cable Tricep Pushdown | 3 | 21 | 0 | 0 |
| 118 | 168 | Tricep Pushdowns | 167 | Cable Tricep Pushdown | 0 | 1 | 1 | 0 |
| 119 | 345 | Triceps Pressdown | 167 | Cable Tricep Pushdown | 9 | 0 | 0 | 0 |
| 120 | 547 | Triceps Pushdown | 167 | Cable Tricep Pushdown | 7 | 0 | 0 | 0 |
| 121 | 505 | Triceps Pushdowns | 167 | Cable Tricep Pushdown | 3 | 0 | 0 | 0 |
| 122 | 479 | Triceps Pushdown (warm-up) | 167 | Cable Tricep Pushdown | 7 | 0 | 0 | 0 |
| 123 | 323 | Skullcrushers | 172 | Skull Crushers | 0 | 3 | 1 | 0 |
| 124 | 399 | Lying Tricep Extensions | 370 | Lying Triceps Extension | 25 | 0 | 0 | 0 |
| 125 | 169 | Overhead Tricep Extension (rope) | 170 | Overhead Triceps Extension | 0 | 15 | 0 | 0 |
| 126 | 442 | ROPE OVERHEAD TRICEPS EXTENSION | 170 | Overhead Triceps Extension | 16 | 2 | 0 | 0 |
| 127 | 174 | Tricep Kickback | 390 | Dumbbell Kickbacks | 0 | 0 | 0 | 0 |
| 128 | 171 | Tricep Extensions | 397 | Dumbbell Tricep Extensions | 0 | 6 | 0 | 1 |
| 129 | 530 | DB Triceps Extensions | 397 | Dumbbell Tricep Extensions | 4 | 0 | 0 | 0 |
| 130 | 179 | BB Squats | 178 | Back Squat | 24 | 9 | 0 | 1 |
| 131 | 334 | Squat | 178 | Back Squat | 24 | 0 | 0 | 0 |
| 132 | 386 | Squats | 178 | Back Squat | 37 | 0 | 0 | 0 |
| 133 | 475 | Squats (warm-up 50%) | 178 | Back Squat | 7 | 0 | 0 | 0 |
| 134 | 538 | Squats (warm-up 70%) | 178 | Back Squat | 7 | 0 | 0 | 0 |
| 135 | 489 | Front Squats | 180 | Front Squat | 3 | 0 | 0 | 0 |
| 136 | 187 | Bulgarian Split Squats | 188 | Bulgarian Split Squat | 2 | 4 | 0 | 1 |
| 137 | 553 | Dumbbell Bulgarian Split Squat | 188 | Bulgarian Split Squat | 18 | 0 | 0 | 0 |
| 138 | 478 | DB Bulgarian Split Squats | 188 | Bulgarian Split Squat | 12 | 0 | 0 | 0 |
| 139 | 221 | DB Walking Lunges | 404 | DUMBBELL WALKING LUNGE | 8 | 4 | 0 | 2 |
| 140 | 294 | Dumbbell Walking Lunges | 404 | DUMBBELL WALKING LUNGE | 1 | 5 | 0 | 0 |
| 141 | 308 | Single DB Walking Lunges | 295 | Single Dumbbell Walking Lunges | 2 | 10 | 1 | 1 |
| 142 | 220 | Walking Lunges | 335 | Walking Lunge | 2 | 0 | 0 | 0 |
| 143 | 186 | Leg Extensions | 185 | Leg Extension | 50 | 69 | 3 | 3 |
| 144 | 492 | Leg Extensions (warm-up) | 185 | Leg Extension | 7 | 0 | 0 | 0 |
| 145 | 575 | Leg ext | 185 | Leg Extension | 1 | 0 | 0 | 0 |
| 146 | 459 | A1: LEG EXTENSION | 185 | Leg Extension | 24 | 9 | 0 | 0 |
| 147 | 532 | Leg Press (warm-up 50%) | 183 | Leg Press | 7 | 0 | 12 | 0 |
| 148 | 515 | Leg Press (warm-up 70%) | 183 | Leg Press | 7 | 0 | 0 | 0 |
| 149 | 418 | SINGLE-LEG LEG PRESS | 184 | Single Leg Leg Press | 24 | 3 | 4 | 0 |
| 150 | 458 | A2: SEATED LEG CURL | 202 | Seated Leg Curl | 24 | 9 | 0 | 0 |
| 151 | 496 | Kettlebell Swings | 559 | Kettlebell Swing | 3 | 0 | 0 | 0 |
| 152 | 533 | Good Mornings | 197 | Good Morning | 3 | 0 | 0 | 0 |
| 153 | 527 | Cable Front Raises | 374 | Cable Front Raise | 3 | 9 | 0 | 0 |

**Totals:** template_exercises renamed=1946, session_entries renamed=1218, personal_bests deleted=67, personal_bests renamed=35, exercises deleted=153

## Outright Deletes (convert_to = "DELETE")

| # | Source ID | Source Name | TE deleted | SE deleted | PB deleted | Ex deleted |
|---|---|---|---|---|---|---|
| 1 | 265 | Hack Squat  (Sandwich w/ HE Goblet) | 3 | 44 | 1 | 1 |
| 2 | 278 | Hack Squat  (Sandwich w/ HE Goblet) | 0 | 0 | 0 | 1 |
| 3 | 279 | Hip flexor Raises (SS w Leg Ext) | 0 | 33 | 0 | 1 |
| 4 | 266 | Hip flexor Raises (SS w Leg Ext) | 0 | 0 | 0 | 1 |
| 5 | 264 | Cable Warm Up with Rope Attachment | 24 | 50 | 3 | 1 |
| 6 | 327 | Cable Warm Up with Rope Attachment | 0 | 0 | 0 | 1 |
| 7 | 507 | B | 1 | 8 | 0 | 1 |
| 8 | 578 | Chest f | 1 | 1 | 0 | 1 |

**Totals:** template_exercises deleted=29, session_entries deleted=136, personal_bests deleted=4, exercises deleted=8

## Muscle Group Reassignments

| # | ID | Name | From | To | Updated |
|---|---|---|---|---|---|
| 1 | 322 | Incline barbell bench | Other | Chest | 1 |
| 2 | 307 | Nordic Curls | Other | Hamstrings | 1 |
| 3 | 269 | Banded DB Shoulder Press | Other | Shoulders | 1 |
| 4 | 295 | Single Dumbbell Walking Lunges | Other | Quads | 1 |
| 5 | 280 | Single Leg Hack Squat | Other | Quads | 1 |
| 6 | 312 | Cable Flyes (Middle Chest) | Other | Chest | 1 |
| 7 | 506 | Abs/Core Work | Other | Core | 1 |
| 8 | 463 | Band Curls | Other | Biceps | 1 |
| 9 | 277 | Banded lateral raises | Other | Shoulders | 1 |
| 10 | 487 | Band High Pulls | Other | Back | 1 |
| 11 | 509 | Band Pushups | Other | Chest | 1 |
| 12 | 291 | Bent Over DB Undhd Rows | Other | Back | 1 |
| 13 | 503 | Box Jumps + Pick Up | Other | Cardio | 1 |
| 14 | 546 | Burpee Press | Other | Cardio | 1 |
| 15 | 544 | Burpees | Other | Cardio | 1 |
| 16 | 292 | Cable Flyes | Other | Chest | 1 |
| 17 | 299 | Cable Lateral Raises | Other | Shoulders | 1 |
| 18 | 317 | Cable Rows Wide Grip | Other | Back | 1 |
| 19 | 576 | Cable skullcrushers | Other | Triceps | 1 |
| 20 | 320 | Chest Flyes | Other | Chest | 1 |
| 21 | 271 | Chest supported DB Row | Other | Back | 1 |
| 22 | 467 | Clean and Press | Other | Shoulders | 1 |
| 23 | 521 | Cliffhanger Walkouts | Other | Core | 1 |
| 24 | 519 | DB 21s | Other | Biceps | 1 |
| 25 | 485 | DB Shovel Curls | Other | Biceps | 1 |
| 26 | 282 | DB Split Squat | Other | Quads | 1 |
| 27 | 315 | Dips | Other | Triceps | 1 |
| 28 | 466 | Divebomber Pushups | Other | Chest | 1 |
| 29 | 328 | Dumbbell chest supported rows | Other | Back | 1 |
| 30 | 577 | Dumbbell incline curls | Other | Biceps | 1 |
| 31 | 276 | Dumbbell skull crushers | Other | Triceps | 1 |
| 32 | 579 | Hammer strength incline press | Other | Chest | 1 |
| 33 | 523 | Hanging Corkscrews | Other | Core | 1 |
| 34 | 540 | High Knees | Other | Cardio | 1 |
| 35 | 301 | Incline DB Curls | Other | Biceps | 1 |
| 36 | 490 | Inverted Chin Curls | Other | Biceps | 1 |
| 37 | 525 | Jack Pushups | Other | Chest | 1 |
| 38 | 484 | Knee Up Chinups | Other | Back | 1 |
| 39 | 270 | Max Pull Ups | Other | Back | 1 |
| 40 | 520 | Mule Kicks | Other | Glutes | 1 |
| 41 | 319 | Neutral Grip Pull Ups | Other | Back | 1 |
| 42 | 462 | Over Unders | Other | Core | 1 |
| 43 | 534 | Push Press | Other | Shoulders | 1 |
| 44 | 522 | Rotational Pushdowns | Other | Triceps | 1 |
| 45 | 472 | Run the Rack DB Curls | Other | Biceps | 1 |
| 46 | 580 | Seated hammer curls | Other | Biceps | 1 |
| 47 | 510 | Shuffle Pushups + Pick Up | Other | Chest | 1 |
| 48 | 274 | Single arm cable hammer curl | Other | Biceps | 1 |
| 49 | 581 | Single leg curl | Other | Hamstrings | 1 |
| 50 | 537 | Skiers | Other | Cardio | 1 |
| 51 | 539 | Spiderman Pushups | Other | Chest | 1 |
| 52 | 518 | Sprawling Burpees | Other | Cardio | 1 |
| 53 | 531 | Taps | Other | Core | 1 |
| 54 | 480 | Twisting Pistons | Other | Core | 1 |
| 55 | 300 | Upright Dips | Other | Triceps | 1 |
| 56 | 293 | Weighted Hip Flexor Raises | Other | Hips | 1 |

**Totals:** exercises muscle_group updated=56

## Post-state
- Master exercises after run: 318
- Delta: -161 (negative = removed duplicates)

