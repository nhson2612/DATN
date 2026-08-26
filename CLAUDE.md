# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this project is

Undergraduate thesis (DATN) on **Text-to-SpatialSQL** for Da Nang tourism. Vietnamese
natural-language question → spatial SQL → PostGIS, plus pgRouting shortest-path.

The repo's real purpose is a **controlled comparison of two agent architectures**. Almost
every file exists to serve that comparison, not to ship a product. Understand this before
changing anything:

- **Baseline** (`app/agent_legacy.py`) — LLM emits raw SQL, then regex post-processing
  (`crs_guard`) patches CRS bugs, then a 3-attempt `self_correct_loop` retries on DB errors.
- **Contribution** (`app/ir_agent.py` + `app/ir.py`) — LLM emits only a closed-vocabulary
  JSON IR; `ir.py` compiles IR → parameterized SQL. The LLM never writes SQL.
- `app/run_benchmark.py` runs **both** agents on every test case in one pass and writes a
  side-by-side report. Do not "improve" one agent without knowing you have moved a
  benchmark number that the thesis text cites.
- **The numbers in `docs/benchmark_results.md` predate the grounding gate and the
  abstention-reason fix.** Re-run `run_benchmark` before quoting them anywhere.

## Commands

```bash
# Database (PostGIS + pgRouting)
docker compose up -d                       # container name: gis_db, db: gis_tourism

# Python env (no requirements pinning beyond >=; venv is gitignored)
cd backend && python3 -m venv venv && ./venv/bin/pip install -r requirements.txt

# API server — MUST run from backend/, module path is app.main
cd backend && ./venv/bin/uvicorn app.main:app --reload --port 8000

# Frontend — single static file, no build step. Open directly or:
cd frontend && python3 -m http.server 5500     # expects API at http://localhost:8000/api

# Data import, in this order (all hit the live Overpass API, slow, mirror-rotating)
cd backend
./venv/bin/python importer.py                     # boundaries, accommodation, poi, roads + pgr_createTopology
./venv/bin/python import_primary.py               # adds highway=primary (idempotent: skips if any exist)
./venv/bin/python node_and_rebuild_topology.py    # REQUIRED: pgr_nodeNetwork — importer alone leaves a broken graph
./venv/bin/python refresh_road_components.py      # REQUIRED after any change to `roads`
./venv/bin/python populate_tourism_attributes.py  # SYNTHETIC attrs — see "Data provenance"

# Benchmark
cd backend
./venv/bin/python -m app.generate_benchmark       # regenerates benchmark_gsqa_auto.json (150 cases)
./venv/bin/python -m app.run_benchmark            # evaluates test split, writes docs/benchmark_results.md
```

There is **no test suite, linter, or formatter** configured. `run_benchmark.py` is the de
facto regression check — it is slow (100 cases × 2 agents × LLM calls, ~11–14s per agent call).

Requires **Ollama** on `localhost:11434`. Both agents now default to **`qwen2.5:7b`**;
override via `OLLAMA_URL` / `OLLAMA_MODEL`. `qwen2.5:1.5b` is also pulled locally, and every
figure in `docs/benchmark_results.md` predating this switch was measured on **1.5b** — numbers
from the two models are not comparable, so state the model next to any figure you quote.
Several design notes below cite 1.5b failure modes as the *reason* a guard exists; those
rationales still hold historically even though the default has moved. `app/db.py` reads `DATABASE_URL`; the standalone `backend/*.py` importer
scripts hardcode the connection string instead.

## Architecture

### The IR layer is the thesis contribution

`app/ir.py` is the file to read first. It is a compiler, and its design choices are
deliberate — each one is a load-bearing argument in the thesis:

- **`TABLES` is a whitelist and the security boundary.** Any column not listed is rejected
  even if the LLM invents it. Adding a DB column means editing `TABLES`, the
  `IR_SYSTEM_PROMPT` in `ir_agent.py`, and `agent_legacy.py`'s schema prompt — three places.
- **`where` is one flat array** holding attribute *and* spatial predicates together.
  Parallel arrays were tried and small models kept putting spatial ops in the attribute
  array; the flat shape deletes that error class. `filters`/`spatial` keys are still
  accepted for backward compatibility.
- **`::geography` is emitted only by the compiler**, never by the LLM — this is what
  eliminates the degrees-vs-meters bug that `crs_guard` has to patch by regex in the baseline.
- **All values are parameterized**; `LIMIT` is always present and capped at `MAX_LIMIT=100`.
- **`IRError` messages are fed back to the LLM** for self-repair. The retry loop in
  `question_to_sql` only fires on malformed IR — valid IR always compiles to runnable SQL,
  so there is no syntax-retry path at all.
- **`prune_ungrounded()` in `ir_agent.py` is a grounding gate run before `compile_ir`.**
  Every proper name in the IR (`in_admin.name`, `within_distance.ref.name`) must have at
  least half its tokens present in the question, or the condition is dropped and the drop is
  recorded under `debug[-1]["pruned"]`. This exists because qwen2.5:1.5b copies literals out
  of the few-shot examples verbatim (it emitted `ref.name = "Non Nuoc Beach"` — straight from
  the prompt — for a question naming no place). It **prunes rather than raising**: the 1.5B
  model repeats the same bad IR on all 3 retries, so raising turned a merely-empty result
  into a hard failure. Verified to prune 0 of the 150 benchmark gold cases.
- **`eq`/`neq` on a string value compile to `unaccent(lower(...)) = unaccent(lower(%s))`,
  not `=`.** `price_level` holds `'Rẻ'` / `'Trung bình'` / `'Sang trọng'` while users (and
  therefore the LLM) type `'rẻ'`, so exact comparison returned 0 rows for a perfectly correct
  IR. Trade-off: the expression cannot use a plain btree index on that column — neither table
  has one today, but add an expression index if you ever need one.
- **Name resolution prefers an exact match before falling back to `LIKE`.** `in_admin` used
  to be `WHERE name LIKE '%X%' ORDER BY ST_Area(geom) DESC LIMIT 1`, i.e. "take the biggest
  thing whose name contains X". Asking for `Phường Hội An` returned `Phường Hội An Tây` and
  therefore **40 cafés instead of 13** — silently. A ward with a suffix ("Tây", "Đông") is
  usually a newer split and *larger* than the original, so the old heuristic was inverted.
  Three clusters are affected in the current data: `Phường Hội An`, `Phường Điện Bàn`,
  `Xã Quế Sơn`.
- **`check_admin_ambiguity()` in `ir_agent.py` raises rather than guessing.** Exact-match-first
  fixes the common case, but if the question says only "Hội An" no candidate matches exactly
  and the compiler would still have to pick one. This gate queries `boundaries`, and when
  there is no unique exact match but several `LIKE` matches it raises `IRError` listing the
  candidates so the self-repair loop can ask again. It lives in `ir_agent.py`, not `ir.py`,
  because it needs a DB connection and the compiler is kept pure. Verified to raise on 0 of
  the 150 gold cases.
- **`within_distance` unions every matching reference point via `ST_Collect`.** It used to be
  `ORDER BY length(name) LIMIT 1`, which for the 24 POIs named exactly `Highlands Coffee` is a
  complete tie — Postgres returned whichever row it scanned first, i.e. non-deterministic.
  "Near Highlands Coffee" almost certainly means "near *any* branch", so the union is the
  correct semantics. A `rank()` keeps only the exact-name rows when any exist, so a unique
  name still resolves to exactly one point and the benchmark is unaffected.
- **`accommodation` deliberately omits `amenity` from the whitelist** even though the column
  exists — only 2 of 1040 rows have a value, so allowing it let the LLM build
  `accommodation WHERE amenity='restaurant'`, which compiles and silently returns nothing.
- **`aggregate` supports only `count`.** `max`/`avg` raise loudly rather than being silently
  dropped — silent wrong answers are the failure mode being guarded against.

### Benchmark independence (recently rebuilt — do not regress this)

The earlier benchmark generated gold SQL with `compile_ir()` itself, making the comparison
circular: the new agent matched gold by construction. See `docs/ke-hoach-sua-benchmark.md`
for the critique. The fix, now in place:

- `app/gold_templates.py` holds **hand-written** gold SQL, deliberately sharing no code with
  `ir.py`. Never generate gold via `compile_ir`.
- Cases carry a `split` field (`pool` / `dev` / `test`). `run_benchmark.py` evaluates the
  **`test` split only**. Prompt tuning must use `dev`.
- `generate_benchmark.py` uses `random.seed(42)` and only picks DB entities with unique
  names and non-placeholder names, so cases are reproducible and non-degenerate.
- 8 spatial templates × ~17 cases + 14 unanswerable **L0** cases (weather, ticket prices,
  real-time state) that a correct agent must *abstain* on — scored as Abstention F1.

Metrics: VA (SQL runs), EX (exact result match vs gold), Semantic Accuracy (Jaccard,
partial credit), CRS Violation rate, LLM calls, latency, Abstention F1.

Three of these were measuring the wrong thing and have been corrected — do not reintroduce
the old versions, they all flattered the IR agent:

- **Abstention is an explicit signal, not "returned zero rows".** `is_abstention()` requires
  `success` *and* either `ir["target"] is None` or the `SELECT NULL WHERE FALSE` sentinel.
  Previously any empty result counted as abstention, so an agent that crashed on every
  question scored 100% on the L0 template, and the `except` branch literally credited a crash
  as a true positive. EX on `answerable == False` cases now uses this signal too.
- **LLM calls come from an explicit `llm_calls` counter** returned by both agents, not
  `len(debug)`. `self_correct_loop` logs one entry for the initial generation *plus* one per
  execution attempt, so `len(debug)` was always `llm_calls + 1` for the baseline only.
- **`compute_semantic_accuracy` uses `norm()`**, the same NFC-normalising helper as
  `execution_match`. It previously used `str().lower()`, so an NFD name from the DB versus an
  NFC name in the gold JSON could score `ex_match=True` with 0% Jaccard.

**Every number in `docs/benchmark_results.md` is stale** — it predates these metric fixes,
the grounding gate, the case-insensitive text `eq`, and the generator wording fixes. Re-run
`run_benchmark` before quoting anything. The pre-existing figures (baseline VA 39.0% / EX
6.0%; IR agent VA 87.0% / EX 30.0%) are also *lower* than the pre-rebuild numbers in older
commit messages, because the rebuild removed the circular gold.

Generator fixes that raise scores for **both** agents by removing noise, not by favouring
either: `knn+name` questions no longer read "Quán chợ" / "Quán bến tàu" (the hardcoded
"Quán " prefix is gone); `range:non_spat_filter+name` now says "nhà khách hoặc nhà trọ" to
match its gold `tourism IN ('guest_house','hostel')` filter instead of the unmappable
"homestay"; `range+name` uses the neutral label "nơi lưu trú" because its gold applies no
`tourism` filter at all. The "unique name" filters now normalise with `unaccent(lower(...))` and require
`length(name) >= 6`. Comparing with plain `name = p.name` is both accent- and
Unicode-form-sensitive, so degenerate cases slipped through: `T021` picked the ref name
`'Bánh mì'` (a food noun, and equal to three `'Banh Mi'` rows once normalised) and `T078`
picked `'Phú Hồng'` (two rows differing only in NFD vs NFC). Those two are the only cases
whose gold no longer reproduces — **regenerate the benchmark to clear them**.
Splits are now pool 11 / dev 40 / test 100 (all 15 L0 questions are
used — the 15th was silently dropped by `L0_QUESTIONS[:14]`; the extra one went to pool so
the test split stays at 100).

### Spatial data quirks encoded in the code

- **84 of 94 OSM boundary polygons self-intersect.** Every `ST_Contains` against
  `boundaries` must go through `VALID_BOUNDARY` (`ST_CollectionExtract(ST_MakeValid(geom), 3)`)
  or results are undefined. Both `ir.py` and `gold_templates.py` do this.
- **`db/init.sql` now creates `unaccent` and two expression indexes**, and is verified to run
  on a clean database. `unaccent` is load-bearing — `ir.py` uses it for every name match and
  every text comparison — and it used to be missing from `init.sql`, so a fresh volume broke
  the whole IR agent. The expression indexes are
  `gist((geom::geography))` on `poi` and `accommodation`: `ir.py` always emits `::geography`
  so distances come out in metres, but the plain `gist(geom)` index is geometry-typed and the
  cast **loses the index**, making every `ST_DWithin` a full table scan. Measured on `poi`:
  Seq Scan 3,001 of 3,274 rows discarded → Bitmap Index Scan 55 of 328. At 3k rows that is
  13ms vs 9.8ms, which is why it went unnoticed for so long.
- **The routing graph must be noded before it is usable.** `importer.py` only runs
  `pgr_createTopology`, which does **not** split road geometries where they cross, leaving a
  badly fragmented graph. `backend/node_and_rebuild_topology.py` fixes this with
  `pgr_nodeNetwork`, and must be run after `importer.py`. Effect measured on the live DB:
  roads 5787 → 7924 segments, vertices 5830 → 6341, and 98.7% of vertices now sit in one
  component (19 components, largest 6260). `main.py` still snaps only to vertices with
  `comp_size > 100`. **`pgr_dijkstra` now runs with `directed := true`** and falls back to
  `directed := false` only when the directed search finds nothing; the fallback route is
  flagged to the caller as `may_violate_oneway` (a `properties` field per leg in
  `/api/itineraries/recommend`). It used to always pass `false`, which threw away every
  one-way constraint — a 135 m one-way segment was driven the wrong way and reported as
  135 m when the legal route is 225 m, i.e. 40% short with no error. One-way share:
  `gis_tourism` 49% (3,878/7,924), `gis_vietnam` 25.7% (224,748/873,873). Measured
  2026-08-25, share of pairs where only the directed search fails: `gis_vietnam` long-haul
  0/20, `gis_vietnam` urban (≤3 km) 1/12, `gis_tourism` 1/20 — hence the fallback rather
  than a hard switch.
- **`pgr_connectedComponents` must never run inside a request.** `/api/route` used to call it
  in the snap query — twice per request, O(V+E) over the whole graph. It is now materialised
  into `roads_components` by `backend/refresh_road_components.py`, which **must be re-run
  after anything changes `roads`** (notably `node_and_rebuild_topology.py`, which recreates
  the table so every vertex id changes). Measured: `Function Scan` over 6,341 rows at 17.7ms
  → `Index Scan` over 1 row at 0.239ms, a 74× drop, and O(log n) instead of O(V+E).
  **Footgun:** the script renames `roads` → `roads_raw`, recreates `roads`, and commits after
  every step with no wrapping transaction. A crash between the rename and the repopulate
  leaves no `roads` table at all, and step 1 (`DROP TABLE IF EXISTS roads_raw CASCADE`) then
  destroys the only surviving copy on the next run — recovery would mean re-importing from
  Overpass. Snapshot `roads` before running it.
- `main.py` rejects endpoints farther than `MAX_SNAP_DISTANCE_METERS = 1500` from the network
  and returns the snap coordinates plus a total distance that includes both snap walks.
- `GET /api/roads` serves the network as GeoJSON **for display only** — never feed it to
  routing, which reads `roads.geom` directly. It accepts an optional bbox
  (`min_lon`/`min_lat`/`max_lon`/`max_lat`), a `tolerance` for
  `ST_SimplifyPreserveTopology` (default `0.00005` ≈ 5 m), and a `LIMIT`. Measured: default
  2.06 MB / 40,576 vertices, `tolerance=0` 3.92 MB / 119,609, a city-centre bbox 264 KB and
  ~10× faster. The frontend still fetches the whole city on `map.on('load')`, so it only gets
  the simplification win; wiring `map.getBounds()` into a `moveend` handler would claim the
  rest but makes off-screen roads disappear.
- `boundaries` covers **post-2025-merger Da Nang** (bbox ≈ 107.37–108.71 lon), so Hoi An and
  former Quang Nam POIs are in the data despite the project being titled "Da Nang".

### Data provenance — critical

Geometry, names, `amenity`, `tourism`, and road network come from **OpenStreetMap** via the
Overpass API. These are real.

`rating`, `review_count`, `price_level`, and `climate_label` are **synthetic**, generated by
`populate_tourism_attributes.py` with `random.uniform` / `random.choice` / keyword rules.
Nothing in the schema or docs marks them as synthetic. Two consequences:

1. Any answer about "highest rated" or "cheapest" is meaningless as tourism information,
   though still valid for measuring SQL generation.
2. `populate_tourism_attributes.py` **does not call `random.seed()`**, so re-running it
   changes every value and silently invalidates the `gold_results` baked into
   `benchmark_gsqa_auto.json`. Regenerate the benchmark after any re-run.

No open dataset supplies real ratings for this region (verified: Overture Places and
Foursquare OS Places both omit rating/review/price fields; the UCSD Google Local dataset is
US-only). Real ratings require a paid API.

### A second database, `gis_vietnam`, holds nationwide data

Built 2026-08-25 from **Overture Maps** (release `2026-08-19.0`) via DuckDB → CSV → PostGIS,
*not* Overpass — Overpass cannot query the whole country without timing out. `gis_tourism` is
untouched; switch with `DATABASE_URL`. Roughly 1.2 GB.

| | `gis_tourism` (Da Nang) | `gis_vietnam` |
| :--- | ---: | ---: |
| `poi` | 3,274 | 306,173 |
| `accommodation` | 1,040 | 39,231 |
| `boundaries` | 94 | 3,454 |
| `roads` | 7,924 | 873,873 |

- **`pgr_nodeNetwork` is unnecessary here.** Overture segments carry a `connectors` array, so
  the graph arrives already noded and `source`/`target` come straight from it. The plan
  document originally budgeted 1–2 weeks for national routing on the assumption that noding
  was required; it took ~25 minutes. See `docs/ke-hoach-full-vietnam.md` §7.
- Only the **main network** is loaded (motorway/trunk/primary/secondary/tertiary). The
  3.64 M `residential` and 1.00 M `service` segments are deliberately excluded: they would
  push the DB past 10 GB and `pgr_dijkstra` already loads the whole edge table per request.
  Consequence: addresses down small lanes snap to the nearest main road and may exceed
  `MAX_SNAP_DISTANCE_METERS`.
- `pgr_dijkstra` takes ~2.2 s here, and the time barely changes between a 102 km and a
  1,470 km route — the cost is loading 874 k edges, not the search. Bounding the edge query
  by the bbox of the two endpoints is the fix.
- **`rating`, `review_count`, `price_level` are DEFAULT values, not data.** Overture has no
  such fields (verified against the parquet schema). `populate_tourism_attributes.py` was
  deliberately *not* run here — it would only manufacture 306 k more fake numbers.
- **Boundary coverage has holes.** `Phường Bến Nghé` (District 1, HCMC) matches nothing, and
  `admin_level=4` holds 55 rows for 34 distinct names when Vietnam has 34 provinces — Overture
  `divisions` appears to mix in superseded boundaries. If boundary quality matters, take
  `boundaries` from OSM instead; this is the one theme where the source is genuinely suspect.
- Name collisions at national scale are what `check_admin_ambiguity` exists for:
  `Xã Tân Thành` matches **14** boundaries, so the old "largest area wins" heuristic would be
  wrong 93% of the time. 12.0% of ward names and 14.8% of POI names are duplicated.

## Repo conventions

- Code comments and LLM prompts are in **Vietnamese**; identifiers in English. Match this.
- `.gitignore` contains `*.md` with `!README.md`, so **this file and everything in `docs/`
  is untracked** except `docs/benchmark_results.md`, which was force-added. `git add -f` is
  needed to commit CLAUDE.md.
- Frontend is one 31KB `index.html` using MapLibre GL 3.6.2 from unpkg — no bundler, no
  package.json.
