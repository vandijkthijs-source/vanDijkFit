# RepDB content in vDstrong

Exercise data by [RepDB](https://repdb.co). Imported from the
[free catalog](https://exercise-dataset.com/exercises.json). See
[LICENSE-DATA.md](LICENSE-DATA.md) for the in-app use and attribution terms.
This is application content, not a standalone dataset or API.

`source.json` records the source hash, schema version, and counts.
`catalog.json` contains only the fields used by the app. `images.ts` uses static
Metro asset references to the bundled free WebP illustrations. Both start and
finish positions are included where available; no paid preview animations are used.

Regenerate from the repository root with Python 3 (standard library only):

```sh
python3 scripts/import-repdb.py
```

Validate catalog coverage, local assets, muscle mapping and saved-data behavior:

```sh
node --test scripts/check-repdb.cjs
```

Review upstream changes and `matches.ts` when updating. Existing app exercise IDs
are preserved, including their muscle percentages, names, equipment, notes, rest
preferences and history. `matches.ts` explicitly matches equivalent source
exercises and identifies two redundant source aliases. New source entries have
stable `repdb-` prefixed IDs. The existing store merge adds them on rehydration.
Source equipment variants remain distinct (e.g. barbell vs bodyweight glute bridge).

## Muscle defaults

RepDB supplies primary/secondary muscle roles, **not numeric contributions**.
Unreviewed new exercises use the following app defaults: 70% divided equally across
distinct mapped primary groups and 30% across distinct mapped secondary groups;
without secondary groups, primary groups share 100%. These are estimates, not
measured activation percentages. Users can edit them as with other exercises.

Anatomical aliases map into the app's muscle groups: brachialis to biceps,
brachioradialis to forearms, gluteus medius to abductors, rhomboids to upper back,
soleus/gastrocnemius to calves, and transverse abdominis to abs. Hip flexors,
tibialis, serratus and rotator cuff have separate groups to avoid assigning their
work to unrelated muscles. They are searchable/editable and included in muscle
scores; the existing body illustration has no dedicated regions for these groups.

Kettlebells and bands have their own equipment filters. Specialized machines map
to Machine; EZ/trap bars to Barbell; pull-up bars/dip stations/benches to Bodyweight;
other accessories (e.g. rings, TRX, balls and plates) to Other.

## Images and saved data

Bundled illustrations are resolved by exercise ID, separately from `imageUri`.
User photos take precedence. Backups only embed user photos, not all catalog
assets. Saved workout snapshots and custom/modified exercises remain intact.

The source has no exact illustration for these existing variants, so they retain
their initial placeholder (or their user photo):

- Cable Fly (Low to High)
- Cable Fly (High to Low)
- Front Raise (Plate)
- Rope Pushdown
- Walking Lunges (dumbbell; the source only has bodyweight walking lunges)
- Cable Pullover
- Step Ups (dumbbell; the source only has bodyweight step ups)
- Sissy Squat

## Exercise categories

The library and workout picker use Strength, Cardio and Mobility controls, with
Strength selected initially. The 175 selected defaults remain: 67 original
entries and 108 RepDB additions from `../exercises.curated.json`. They are split
into 148 Strength, 17 Cardio (including seven power-conditioning movements) and
10 Mobility exercises. Classification uses supplied modality metadata, then
RepDB categories, defaulting unknown/custom exercises to Strength.

Search covers the complete selected category, including uncurated entries.
All 657 catalog entries remain searchable across the three categories (482
beyond the selected defaults). Custom exercises remain visible under Strength.
The workout picker's muscle/equipment filters still apply. Browsing sorts by
latest workout date, then name; search ranks relevance first, then recency.
Both screens share `features/exercises/exercise-library.ts` and retain virtualized
lists. Category is local screen state. Seeds, images, saved exercises, templates,
workout snapshots, history, storage schema, backups and muscle-map scoring
eligibility are unchanged by these display filters.

## Muscle scoring rules

Upper Back is a separate muscle group from Traps. Existing `upper_back` values
round-trip through display, editing and scoring without being reassigned to
`traps`. Combined Back charts include both. The existing upper-back illustration
is shared by these groups; numerical scores and percentages remain separate.

Muscle scores, muscle volumes, strength indexes and muscle-volume comparisons
exclude source activities categorized as `cardio` or `stretching`, across the
entire catalog. Classification uses the stable exercise ID and existing RepDB
metadata, so old snapshots and exercises removed from the saved library are
handled without a migration. The supplied estimate file additionally excludes seven power-conditioning
exercises. Other strength, plyometrics, Olympic lifts and custom exercises retain
their existing scoring. Recorded sets, generic workout totals,
history, templates, snapshots and saved contributions are unchanged.


## Reviewed estimates (2026-10-19)

`../exercises.muscle-estimates.json` is the user-supplied
`vdstrong-175-muscle-estimates.json`, preserved with its provenance, confidence,
notes, modality and eligibility fields. Its SHA-256 is
`41d018e1adecc84f0b78c42737da7b04865935b1ea37744a2eaa8dde88f18298`.
These are subjective relative training-focus estimates, not measured activation
or hypertrophy percentages. `features/exercises/muscle-estimates.ts` applies its
fractional contributions to the 175 matching seed IDs, using the largest share
as the primary muscle and retaining the other positive shares as secondary
muscles. The other 482 library entries and existing images are unchanged.

The existing store merge updates unmodified defaults on rehydration while
preserving custom/modified exercises, notes, rest preferences, templates and
historical/active workout snapshots. New workouts use the new defaults; saved
snapshot percentages are not rewritten. Scoring eligibility is resolved by
stable ID even for older snapshots: 10 cardio, 10 mobility and 7 power-conditioning
entries keep their reference percentages but give no strength/muscle-map credit.
The existing catalog-category exclusion still covers uncurated cardio/stretching.

Validation: TypeScript and all 16 catalog/scoring/persistence checks pass.
Lint has zero errors and five pre-existing warnings. This data/scoring change
was checked without rebuilding the Android APK.

Category change validation: TypeScript and 17 catalog/scoring/persistence checks
pass. Lint retains five existing warnings and zero errors.
Mobile Chrome verification: both screens switch/filter all three categories,
search uncurated entries within the active category, retain the search on category
changes, and support keyboard activation. Controls fit at phone width without
horizontal overflow; no browser runtime errors. Physical Android testing remains
separate.
