# Place Detail Tavily Enrichment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the place detail page and enrich each opened place once with evidence-backed Tavily data persisted permanently in PostgreSQL.

**Architecture:** Keep the existing place-detail GET fast and add an idempotent POST enrichment endpoint. PostgreSQL atomically claims first-time work, a focused Tavily client performs one search, a deterministic normalizer accepts only fields backed by matching result snippets, and React loads this data independently of the base place response.

**Tech Stack:** FastAPI, psycopg/PostgreSQL JSONB, requests, unittest/pytest, React 19, Vite 8, Tailwind CSS 3 and plain CSS.

**Spec:** `docs/superpowers/specs/2026-09-04-place-detail-tavily-enrichment-design.md`

## Global Constraints

- Persist `success` and `not_found` forever; retry only transient DNS, timeout, HTTP 429 and HTTP 5xx failures.
- Make at most one Tavily Search for a first-time place and prevent duplicate calls across backend workers through PostgreSQL.
- Read `TAVILY_API_KEY` first and accept legacy `TAVILI_API_KEY`; never expose either value to frontend, logs, API responses or the database.
- Do not send `country=vietnam`; use `search_depth=basic`, `max_results=8`, answer and images in one request, with a 20-second timeout and 1 MiB response limit.
- Never use Tavily's free-form `answer` as proof for rating or hours; every structured field must point to a matching `results[].content` and URL.
- Never infer a review-star histogram or mix a rating from one source with a review count from another.
- Do not write Tavily images into `place_photos.url`; retain their source host and use the existing image/category fallbacks.
- Do not fetch arbitrary URLs returned by Tavily and do not render result content as HTML.
- Keep base Overture data visible while enrichment is loading or unavailable.
- Use the approved palette, Be Vietnam Pro, asymmetric gallery, continuous fact strip and responsive field-guide layout from the spec.

---

## File map

- Create `backend/app/repositories/enrichment_repo.py`: schema-independent SQL operations for cache lookup, atomic job claim and final persistence.
- Create `backend/app/services/tavily_service.py`: query construction, Tavily HTTP client, identity filtering and evidence-backed normalization.
- Create `backend/app/services/enrichment_service.py`: cache/provider orchestration and public response shaping.
- Create `backend/tests/test_tavily_enrichment.py`: repository-independent parser/service tests with a fake provider and mocked repository functions.
- Modify `backend/app/core/config.py`: Tavily configuration and legacy environment alias.
- Modify `backend/app/core/bootstrap.py`: idempotent table creation at startup.
- Modify `db/init.sql`: canonical schema for fresh databases.
- Modify `backend/app/api/routes/destinations.py`: POST enrichment endpoint and 202 response.
- Modify `backend/tests/test_api_surface.py`: lock the new route into the API contract.
- Create `web/src/pages/PlaceDetail/PlaceGallery.jsx`: resilient primary/secondary image gallery with source hosts.
- Create `web/src/pages/PlaceDetail/EnrichmentContent.jsx`: fact strip, hours, review highlights and source list.
- Modify `web/src/pages/PlaceDetail/index.jsx`: independent base/enrichment loading and redesigned page structure.
- Replace `web/src/pages/PlaceDetail/PlaceDetail.css`: approved visual system and responsive behavior.
- Modify `web/src/api/client.js`: enrichment POST method.
- Modify `.env.example`: document both the canonical key and legacy compatibility.

---

### Task 1: Persistent enrichment cache and atomic claim

**Files:**
- Create: `backend/app/repositories/enrichment_repo.py`
- Modify: `backend/app/core/bootstrap.py`
- Modify: `db/init.sql`
- Test: `backend/tests/test_tavily_enrichment.py`

**Interfaces:**
- Produces: `get(place_type: str, place_id: int) -> dict | None`
- Produces: `claim(place_type: str, place_id: int, stale_seconds: int = 90) -> bool`
- Produces: `save_success(place_type: str, place_id: int, data: dict, raw_response: dict) -> None`
- Produces: `save_not_found(place_type: str, place_id: int, raw_response: dict) -> None`
- Produces: `release_transient(place_type: str, place_id: int) -> None`
- Produces: `ensure_schema() -> None`

- [ ] **Step 1: Write failing repository contract tests**

Add test doubles around `execute_query` so SQL behavior is asserted without a live DB:

```python
class EnrichmentRepositoryTests(unittest.TestCase):
    def test_claim_returns_true_only_when_insert_or_stale_takeover_returns_row(self):
        with patch("app.repositories.enrichment_repo.execute_query", return_value=[{"id": 1}]):
            self.assertTrue(enrichment_repo.claim("poi", 265670))
        with patch("app.repositories.enrichment_repo.execute_query", return_value=[]):
            self.assertFalse(enrichment_repo.claim("poi", 265670))

    def test_release_only_deletes_fetching_row(self):
        with patch("app.repositories.enrichment_repo.execute_query") as query:
            enrichment_repo.release_transient("poi", 265670)
        self.assertIn("status = 'fetching'", query.call_args.args[0])
```

- [ ] **Step 2: Run tests and confirm the repository module is missing**

Run:

```bash
cd backend && python -m unittest tests.test_tavily_enrichment.EnrichmentRepositoryTests -v
```

Expected: FAIL because `app.repositories.enrichment_repo` does not exist.

- [ ] **Step 3: Implement the repository and atomic claim**

Create `enrichment_repo.py` with table/type validation and this claim shape:

```python
def claim(place_type: str, place_id: int, stale_seconds: int = 90) -> bool:
    _check_type(place_type)
    rows = execute_query(
        """
        INSERT INTO place_enrichments (place_type, place_id, status)
        VALUES (%s, %s, 'fetching')
        ON CONFLICT (place_type, place_id) DO UPDATE
        SET status = 'fetching', started_at = CURRENT_TIMESTAMP,
            summary = NULL, opening_hours = NULL, rating = NULL,
            review_highlights = '[]'::jsonb, images = '[]'::jsonb,
            sources = '[]'::jsonb, raw_response = NULL
        WHERE place_enrichments.status = 'fetching'
          AND place_enrichments.started_at
              < CURRENT_TIMESTAMP - (%s * INTERVAL '1 second')
        RETURNING id
        """,
        (place_type, place_id, stale_seconds),
    )
    return bool(rows)
```

Serialize JSON with `ensure_ascii=False`. `get()` must return every public
column plus `raw_response` for the service; `save_success()` sets status and all
normalized fields; `save_not_found()` clears normalized fields but retains raw
response; `release_transient()` deletes only a row whose status remains
`fetching`.

- [ ] **Step 4: Add idempotent schema creation**

Put the complete approved `CREATE TABLE IF NOT EXISTS place_enrichments` SQL in
`db/init.sql`. Add `enrichment_repo.ensure_schema()` using the same columns and
checks, then call it inside `bootstrap.ensure_db_schema()` after the existing
`place_photos` alteration:

```python
from app.repositories import enrichment_repo

def ensure_db_schema():
    execute_query("ALTER TABLE place_photos ADD COLUMN IF NOT EXISTS details JSONB;")
    enrichment_repo.ensure_schema()
```

Keep the existing warning behavior so startup reports migration failure without
printing secrets.

- [ ] **Step 5: Run repository tests**

Run:

```bash
cd backend && python -m unittest tests.test_tavily_enrichment.EnrichmentRepositoryTests -v
```

Expected: PASS.

- [ ] **Step 6: Commit the cache layer**

```bash
git add db/init.sql backend/app/core/bootstrap.py backend/app/repositories/enrichment_repo.py backend/tests/test_tavily_enrichment.py
git commit -m "feat: add persistent place enrichment cache"
```

---

### Task 2: Tavily client and evidence-backed normalizer

**Files:**
- Create: `backend/app/services/tavily_service.py`
- Modify: `backend/app/core/config.py`
- Modify: `.env.example`
- Test: `backend/tests/test_tavily_enrichment.py`

**Interfaces:**
- Consumes: a place dict containing `name`, `dia_chi`, `thanh_pho`, `dien_thoai`, `website` and `social`.
- Produces: `build_query(place: dict) -> str`
- Produces: `search(place: dict, post=requests.post) -> dict`
- Produces: `normalize(place: dict, payload: dict) -> dict`
- Produces: `TavilyTransientError` and `TavilyConfigurationError`.

- [ ] **Step 1: Add failing configuration, request and parser tests**

Cover the legacy key, exact request payload and the actual Bà Nà Hills response
shape observed during the spike:

```python
class TavilyServiceTests(unittest.TestCase):
    def test_build_query_includes_identity_signals(self):
        q = tavily_service.build_query({
            "name": "Sun World Bà Nà Hills", "dia_chi": "Hòa Vang",
            "thanh_pho": "Đà Nẵng", "dien_thoai": "+842363749888",
            "website": "https://sunworld.vn/en/banahills",
            "social": "https://facebook.com/SunWorldBaNaHills",
        })
        for value in ("Sun World", "Hòa Vang", "Đà Nẵng", "+842363749888", "sunworld.vn"):
            self.assertIn(value, q)

    def test_rating_and_count_come_from_same_result(self):
        data = tavily_service.normalize(PLACE, {
            "answer": "It has 4.7 from 7,813 reviews.",
            "results": [
                {"title": "Ba Na Hills", "url": "https://a.example/place",
                 "content": "4.7 (7,813 reviews) Ba Na, Da Nang", "score": .8},
                {"title": "Wrong branch", "url": "https://b.example/place",
                 "content": "4.9 (66K reviews) Hanoi", "score": .9},
            ], "images": []})
        self.assertEqual(data["rating"]["value"], 4.7)
        self.assertEqual(data["rating"]["review_count"], 7813)

    def test_close_only_does_not_invent_opening_time(self):
        data = tavily_service.normalize(PLACE, {
            "answer": "Open now.",
            "results": [{"title": "Official", "url": PLACE["website"],
                         "content": "Open. Closes at 22:00", "score": .9}],
            "images": []})
        self.assertEqual(data["opening_hours"]["display"], "Đóng cửa lúc 22:00")
        self.assertNotIn("08:00", json.dumps(data))
```

Also test: wrong locality rejection, `javascript:` URL rejection, image title
identity matching, K/`66K+` count parsing, no rating distribution, response over
1 MiB, HTTP 429/5xx/timeout mapped to transient errors, and API key absence
mapped to configuration error.

- [ ] **Step 2: Run tests and confirm Tavily module/config failures**

Run:

```bash
cd backend && python -m unittest tests.test_tavily_enrichment.TavilyServiceTests -v
```

Expected: FAIL because the service and settings fields do not exist.

- [ ] **Step 3: Add Tavily settings with legacy alias**

Modify `config.py`:

```python
from pydantic import AliasChoices, Field, field_validator

tavily_api_key: str | None = Field(
    default=None,
    validation_alias=AliasChoices("TAVILY_API_KEY", "TAVILI_API_KEY"),
)
tavily_url: str = "https://api.tavily.com/search"
tavily_timeout: int = Field(default=20, ge=1, le=60)
```

Document `TAVILY_API_KEY` in `.env.example` and state that the misspelled legacy
name is accepted temporarily. Do not copy the real key.

- [ ] **Step 4: Implement request construction and bounded HTTP handling**

`search()` must use:

```python
payload = {
    "query": build_query(place),
    "topic": "general",
    "search_depth": "basic",
    "max_results": 8,
    "include_answer": True,
    "include_images": True,
    "include_image_descriptions": True,
    "include_raw_content": False,
}
response = post(
    settings.tavily_url,
    headers={"Authorization": f"Bearer {settings.tavily_api_key}"},
    json=payload,
    timeout=settings.tavily_timeout,
)
```

Treat 429 and 5xx as `TavilyTransientError`; call `raise_for_status()` for other
HTTP failures; reject `len(response.content) > 1_048_576`; parse JSON and require
`results` and `images` to be lists. Never log headers or raw response.

- [ ] **Step 5: Implement deterministic identity and field extraction**

Create small helpers with explicit responsibilities. `_norm` strips accents,
case-folds and collapses whitespace; `_host` accepts only HTTP(S) URLs and
removes a leading `www.`; `_result_matches` applies the approved official-host,
exact-phone, or name-plus-locality rules; `_parse_review_count` supports comma,
dot, `K` and `K+` forms; `_extract_rating`, `_extract_hours` and
`_extract_review` return evidence-bearing dictionaries from one result at a
time; `_safe_images` keeps at most eight matching HTTPS images; and
`_safe_summary` removes unsupported numeric claims from the Tavily answer and
returns at most 600 characters.

Use Unicode NFD normalization and lowercase matching. A result passes when its
host matches the Overture website host, its digit-only phone matches, or the
normalized name and locality both occur in title/content. Sort accepted rating
candidates by official-domain first, then review count, then Tavily score. Store
the exact matched substring as `evidence` and cap it at 280 characters.

Opening-hour patterns must separately support full ranges and close-only text:

```python
RANGE_RE = re.compile(
    r"(?:opening hours?|hours?|giờ mở cửa)\s*[:\-]?\s*"
    r"(\d{1,2}(?::\d{2})?\s*(?:am|pm)?\s*[–—-]\s*"
    r"\d{1,2}(?::\d{2})?\s*(?:am|pm)?)", re.I)
CLOSE_RE = re.compile(r"(?:closes?|đóng cửa)(?:\s+at|\s+lúc)?\s+(\d{1,2}:\d{2})", re.I)
```

Return this stable normalized shape:

```python
{
    "summary": str | None,
    "opening_hours": dict | None,
    "rating": dict | None,
    "review_highlights": list,
    "images": list,
    "sources": list,
}
```

- [ ] **Step 6: Run Tavily tests**

Run:

```bash
cd backend && python -m unittest tests.test_tavily_enrichment.TavilyServiceTests -v
```

Expected: PASS without making a network request or consuming credits.

- [ ] **Step 7: Commit provider and parser**

```bash
git add .env.example backend/app/core/config.py backend/app/services/tavily_service.py backend/tests/test_tavily_enrichment.py
git commit -m "feat: add evidence-backed Tavily enrichment"
```

---

### Task 3: Cache-first enrichment orchestration and API

**Files:**
- Create: `backend/app/services/enrichment_service.py`
- Modify: `backend/app/api/routes/destinations.py`
- Modify: `backend/tests/test_tavily_enrichment.py`
- Modify: `backend/tests/test_api_surface.py`

**Interfaces:**
- Consumes: repository functions from Task 1 and `search()`/`normalize()` from Task 2.
- Produces: `enrich(place_type: str, place_id: int) -> tuple[int, dict]`
- Produces: `POST /api/places/{place_type}/{place_id}/enrichment`.

- [ ] **Step 1: Write failing cache orchestration tests**

Use patches, not the real database/provider:

```python
class EnrichmentServiceTests(unittest.TestCase):
    @patch("app.services.enrichment_service.enrichment_repo.get")
    @patch("app.services.enrichment_service.tavily_service.search")
    def test_success_cache_never_calls_tavily(self, search, get):
        get.return_value = {
            "status": "success", "summary": "cached",
            "opening_hours": None, "rating": None,
            "images": [], "sources": [], "review_highlights": [],
            "fetched_at": "2026-09-04T00:00:00+00:00",
        }
        code, body = enrichment_service.enrich("poi", 265670)
        self.assertEqual(code, 200)
        self.assertTrue(body["cached"])
        self.assertEqual(body["enrichment"]["summary"], "cached")
        search.assert_not_called()

    def test_transient_failure_releases_claim_for_next_visit(self):
        with patch.multiple(
            "app.services.enrichment_service.enrichment_repo",
            get=DEFAULT, claim=DEFAULT, release_transient=DEFAULT,
        ) as repo, patch(
            "app.services.enrichment_service.destination_repo.get_place_detail",
            return_value=PLACE,
        ), patch(
            "app.services.enrichment_service.tavily_service.search",
            side_effect=tavily_service.TavilyTransientError("timeout"),
        ):
            repo["get"].return_value = None
            repo["claim"].return_value = True
            code, body = enrichment_service.enrich("poi", 265670)
        self.assertEqual(code, 503)
        self.assertIn("thử lại", body["detail"])
        repo["release_transient"].assert_called_once_with("poi", 265670)

    def test_empty_normalized_result_saves_not_found(self):
        with patch.multiple(
            "app.services.enrichment_service.enrichment_repo",
            get=DEFAULT, claim=DEFAULT, save_not_found=DEFAULT,
        ) as repo, patch(
            "app.services.enrichment_service.destination_repo.get_place_detail",
            return_value=PLACE,
        ), patch(
            "app.services.enrichment_service.tavily_service.search",
            return_value={"answer": "", "results": [], "images": []},
        ), patch(
            "app.services.enrichment_service.tavily_service.normalize",
            return_value={"summary": None, "opening_hours": None,
                          "rating": None, "review_highlights": [],
                          "images": [], "sources": []},
        ):
            repo["get"].side_effect = [None, {
                "status": "not_found", "summary": None,
                "opening_hours": None, "rating": None,
                "review_highlights": [], "images": [], "sources": [],
                "fetched_at": "2026-09-04T00:00:00+00:00",
            }]
            repo["claim"].return_value = True
            code, body = enrichment_service.enrich("poi", 265670)
        self.assertEqual((code, body["status"]), (200, "not_found"))
        repo["save_not_found"].assert_called_once()
```

Cover cached `not_found`, fresh `fetching` returning 202, missing place returning
404, first success returning `cached=False`, and configuration failure returning
503 without persisting a terminal cache.

- [ ] **Step 2: Run orchestration tests and confirm failure**

Run:

```bash
cd backend && python -m unittest tests.test_tavily_enrichment.EnrichmentServiceTests -v
```

Expected: FAIL because `enrichment_service` does not exist.

- [ ] **Step 3: Implement cache-first service**

The service order must be exact:

```python
def enrich(place_type: str, place_id: int) -> tuple[int, dict]:
    place = destination_repo.get_place_detail(place_type, place_id)
    if not place:
        return 404, {"detail": "Không tìm thấy địa điểm."}

    cached = enrichment_repo.get(place_type, place_id)
    if cached and cached["status"] in ("success", "not_found"):
        return 200, _public(cached, cached=True)

    if not enrichment_repo.claim(place_type, place_id):
        return 202, {"status": "fetching", "cached": False}

    try:
        raw = tavily_service.search(place)
        normalized = tavily_service.normalize(place, raw)
        if not _has_value(normalized):
            enrichment_repo.save_not_found(place_type, place_id, raw)
        else:
            enrichment_repo.save_success(place_type, place_id, normalized, raw)
        return 200, _public(enrichment_repo.get(place_type, place_id), cached=False)
    except tavily_service.TavilyConfigurationError:
        enrichment_repo.release_transient(place_type, place_id)
        return 503, {"detail": "Tavily chưa được cấu hình."}
    except tavily_service.TavilyTransientError:
        enrichment_repo.release_transient(place_type, place_id)
        return 503, {"detail": "Chưa tải được dữ liệu web; ứng dụng sẽ thử lại ở lần mở sau."}
```

`_public()` must return the exact API shape from the spec: top-level `status`
and `cached`, plus an `enrichment` object containing only `summary`,
`opening_hours`, `rating`, `review_highlights`, `images`, `sources` and
ISO-8601 `fetched_at`. It must omit `raw_response`, `started_at`, `provider` and
database `id`. For `not_found`, return the same shape with empty nullable/list
fields so the frontend has one stable contract.

- [ ] **Step 4: Register the endpoint with correct status propagation**

In `destinations.py`:

```python
@places_router.post("/{place_type}/{place_id}/enrichment")
def enrich_place(place_type: str, place_id: int, response: Response):
    if place_type not in ("poi", "accommodation"):
        raise HTTPException(status_code=400, detail="place_type phải là poi hoặc accommodation.")
    status_code, body = enrichment_service.enrich(place_type, place_id)
    if status_code == 404:
        raise HTTPException(status_code=404, detail=body["detail"])
    if status_code == 503:
        raise HTTPException(status_code=503, detail=body["detail"])
    response.status_code = status_code
    return body
```

Add `/api/places/{place_type}/{place_id}/enrichment` to `EXPECTED_PATHS`.

- [ ] **Step 5: Run backend feature and API surface tests**

Run:

```bash
cd backend && python -m unittest tests.test_tavily_enrichment tests.test_api_surface -v
```

Expected: PASS.

- [ ] **Step 6: Commit the service/API slice**

```bash
git add backend/app/services/enrichment_service.py backend/app/api/routes/destinations.py backend/tests/test_tavily_enrichment.py backend/tests/test_api_surface.py
git commit -m "feat: expose cache-first place enrichment API"
```

---

### Task 4: Frontend enrichment state and resilient rendering components

**Files:**
- Modify: `web/src/api/client.js`
- Create: `web/src/pages/PlaceDetail/PlaceGallery.jsx`
- Create: `web/src/pages/PlaceDetail/EnrichmentContent.jsx`
- Modify: `web/src/pages/PlaceDetail/index.jsx`

**Interfaces:**
- Consumes: `POST /api/places/{type}/{id}/enrichment` response from Task 3.
- Produces: `api.enrichPlace(type, id) -> Promise<EnrichmentResponse>`.
- Produces: `<PlaceGallery place enrichment />` and `<EnrichmentContent enrichment state />`.

- [ ] **Step 1: Add the API method**

```javascript
enrichPlace: (type, id) =>
  request(`/places/${encodeURIComponent(type)}/${Number(id)}/enrichment`, {
    method: "POST",
  }),
```

- [ ] **Step 2: Implement independent enrichment loading and bounded polling**

In `PlaceDetail`, add state:

```javascript
const [enrichment, setEnrichment] = useState(null);
const [enrichmentState, setEnrichmentState] = useState("loading");
const [enrichmentError, setEnrichmentError] = useState("");
```

Use a cancellable effect separate from the base-place fetch:

```javascript
useEffect(() => {
  let cancelled = false;
  const timers = [];

  async function load(attempt = 0) {
    try {
      const data = await api.enrichPlace(type, id);
      if (cancelled) return;
      if (data.status === "fetching" && attempt < 3) {
        timers.push(setTimeout(() => load(attempt + 1), 2000));
        return;
      }
      setEnrichment(data.enrichment || null);
      setEnrichmentState(data.status === "not_found" ? "not_found" : "success");
    } catch (error) {
      if (!cancelled) {
        setEnrichmentState("error");
        setEnrichmentError(error.message);
      }
    }
  }

  setEnrichment(null);
  setEnrichmentState("loading");
  setEnrichmentError("");
  load();
  return () => {
    cancelled = true;
    timers.forEach(clearTimeout);
  };
}, [type, id]);
```

If the fourth response is still `fetching`, set state to error with the approved
retry-on-next-visit copy instead of treating it as success.

- [ ] **Step 3: Build the image gallery component**

`PlaceGallery` must deduplicate URLs from the existing `place.anh` and Tavily
images, choose the first working URL as hero, show at most two desktop secondary
images, and expose a horizontal mobile rail. On image error, remove that URL
from local component state; if all fail, render the category fallback passed by
the parent. Every Tavily image displays its `host` as a small source caption.

Component signature:

```jsx
export default function PlaceGallery({ name, baseImage, fallbackImage, images = [] })
```

- [ ] **Step 4: Build enrichment facts and evidence rendering**

`EnrichmentContent` receives:

```jsx
export default function EnrichmentContent({ enrichment, state, error, mode = "details" })
```

With `mode="facts"`, render only the loading/result fact strip. With
`mode="details"`, render the summary, hours, highlights, source list and state
messages so the page can place the two presentations in different parts of the
layout without duplicating fetching logic.

Render:

- A three-part fact strip for rating, review count and opening-hours display.
- A skeleton strip while loading.
- Summary only as text.
- Opening hours with a source link.
- At most three review highlights with their source links.
- A source list using hostname plus title; all links use `target="_blank"` and
  `rel="noopener noreferrer"`.
- Compact `not_found` and transient-error messages using the exact approved copy.
- `fetched_at` formatted with `Intl.DateTimeFormat("vi-VN", {dateStyle: "medium"})`.

Never use `dangerouslySetInnerHTML`.

- [ ] **Step 5: Run frontend lint before visual CSS work**

Run:

```bash
cd web && npm run lint
```

Expected: PASS; fix React hook cleanup or accessibility errors before continuing.

- [ ] **Step 6: Commit the frontend data/rendering slice**

```bash
git add web/src/api/client.js web/src/pages/PlaceDetail/index.jsx web/src/pages/PlaceDetail/PlaceGallery.jsx web/src/pages/PlaceDetail/EnrichmentContent.jsx
git commit -m "feat: load and render persisted place enrichment"
```

---

### Task 5: Field-guide visual redesign and end-to-end verification

**Files:**
- Modify: `web/src/pages/PlaceDetail/index.jsx`
- Replace: `web/src/pages/PlaceDetail/PlaceDetail.css`
- Modify: `backend/tests/test_giao_dien_that.py`

**Interfaces:**
- Consumes: components and state from Task 4.
- Produces: responsive `/dia-diem/:type/:id` UI using the approved design tokens.

- [ ] **Step 1: Restructure the page around the approved hierarchy**

Use semantic landmarks in this order:

```jsx
<main className="place-field-guide">
  <nav className="place-field-guide__nav" aria-label="Điều hướng địa điểm">
    <Link to="/dia-diem">Địa điểm</Link><span aria-hidden="true">/</span><span>{place.ten}</span>
  </nav>
  <header className="place-field-guide__header">
    <p className="place-field-guide__eyebrow">{categoryLabel}</p>
    <h1>{place.ten}</h1>
    <p>{place.dia_chi}</p>
  </header>
  <PlaceGallery name={place.ten} baseImage={place.anh} fallbackImage={fallbackImage} images={enrichment?.images} />
  <EnrichmentContent enrichment={enrichment} state={enrichmentState} error={enrichmentError} mode="facts" />
  <div className="place-field-guide__columns">
    <article><EnrichmentContent enrichment={enrichment} state={enrichmentState} error={enrichmentError} mode="details" /></article>
    <aside><PlaceMap place={place} /><ContactCard place={place} /><PlaceActions place={place} /></aside>
  </div>
  <section aria-labelledby="nearby-title"><h2 id="nearby-title">Gần đây</h2><NearbyPlaces places={nearbyPlaces} /></section>
</main>
```

Use the actual existing component/function names when they differ from the
descriptive names above; do not create wrappers solely to make this sample
compile.

Remove the old hero title overlay and the false statement that provider data is
directly verified. Keep existing favorite and booking behavior unchanged.

- [ ] **Step 2: Implement the visual tokens and asymmetric gallery**

Start `PlaceDetail.css` with scoped custom properties:

```css
.place-field-guide {
  --forest: #0b5d42;
  --deep-forest: #073b2a;
  --field: #f4f6f2;
  --paper: #ffffff;
  --ink: #17211c;
  --star: #e9a928;
  min-height: 100vh;
  background: var(--field);
  color: var(--ink);
}
```

At desktop widths, use a 2:1 gallery with the right third split vertically and
a 2fr/1fr content grid. Use 1px rules for hierarchy, reserve large radii for the
gallery and primary actions, and avoid shadows on ordinary content sections.

- [ ] **Step 3: Add responsive, focus and reduced-motion behavior**

At `max-width: 768px`, make gallery images horizontal `scroll-snap-type: x
mandatory`, collapse facts to two columns, and stack the aside below content.
Add `:focus-visible` outlines in `--forest` and:

```css
@media (prefers-reduced-motion: reduce) {
  .place-field-guide *,
  .place-field-guide *::before,
  .place-field-guide *::after {
    scroll-behavior: auto !important;
    transition-duration: 0.01ms !important;
    animation-duration: 0.01ms !important;
  }
}
```

- [ ] **Step 4: Add a browser test for base content surviving enrichment failure**

Extend `test_giao_dien_that.py` with a class guarded by the existing
`@can_browser`. Open `/dia-diem/poi/265670`, wait for the heading, and assert:

```python
self.assertIn("Thông tin", c.js("document.body.innerText"))
self.assertIn("Nguồn", c.js("document.body.innerText"))
self.assertEqual(c.js("window.__loi"), [])
```

Intercepting network is not available in the custom CDP helper, so backend unit
tests remain the authoritative failure-state tests; this browser test verifies
that the real page mounts and enrichment does not erase base content.

- [ ] **Step 5: Run focused and full verification**

Run:

```bash
cd backend && python -m unittest tests.test_tavily_enrichment tests.test_api_surface -v
cd web && npm run lint && npm run build
```

Then run the existing backend suite:

```bash
cd backend && python -m unittest discover -s tests -v
```

Expected: all unit tests pass; browser tests may report SKIP only when Chrome or
the dev servers are unavailable.

- [ ] **Step 6: Perform one real Tavily/DB smoke test for POI 265670**

Start local services using the project's Makefile, then call:

```bash
curl -X POST http://127.0.0.1:8000/api/places/poi/265670/enrichment | jq .
curl -X POST http://127.0.0.1:8000/api/places/poi/265670/enrichment | jq .
```

Expected: first successful response has `cached: false`; second has `cached:
true`. Query PostgreSQL and confirm one row exists for `(poi, 265670)`. This is
the only verification step that consumes a Tavily credit.

- [ ] **Step 7: Review the rendered page when a browser is available**

Inspect desktop and mobile widths for gallery cropping, long Vietnamese place
names, long source URLs, sticky aside behavior, loading skeleton and broken
image fallback. If no browser is connected, report that visual inspection is
unverified rather than claiming completion from build output alone.

- [ ] **Step 8: Commit the visual redesign**

```bash
git add web/src/pages/PlaceDetail/index.jsx web/src/pages/PlaceDetail/PlaceDetail.css backend/tests/test_giao_dien_that.py
git commit -m "feat: redesign place detail as a travel field guide"
```

---

### Task 6: Final security and regression audit

**Files:**
- Verify only; modify the smallest relevant file if a check exposes a defect.

**Interfaces:**
- Consumes: complete implementation from Tasks 1–5.
- Produces: evidence that secrets, raw provider responses and unrelated working-tree changes are not shipped.

- [ ] **Step 1: Scan tracked changes for secrets and unsafe rendering**

Run:

```bash
git diff HEAD~4 -- . ':!docs' | rg -n "tvly-|TAVILI_API_KEY=.+|TAVILY_API_KEY=.+|dangerouslySetInnerHTML|raw_response"
```

Expected: no real key, no `dangerouslySetInnerHTML`; `raw_response` appears only
in repository/service code and never in the public response builder.

- [ ] **Step 2: Verify unrelated user changes remain untouched**

Run:

```bash
git status --short
```

Expected: pre-existing changes in `.env.example`, `Makefile`,
`docker-compose.yml`, `DATN/`, `Makefile.local` and `gis_vietnam.dump` are
preserved unless `.env.example` was intentionally included for Tavily docs.

- [ ] **Step 3: Run final tests and inspect the exact diff**

Run:

```bash
cd backend && python -m unittest discover -s tests -v
cd ../web && npm run lint && npm run build
cd .. && git diff --check
```

Review `git log --oneline -6` and `git status --short`; do not commit unrelated
files.

- [ ] **Step 4: Commit any audit-only correction**

Only if Step 1–3 required a correction:

```bash
git status --short
git add backend/app/services/tavily_service.py backend/app/services/enrichment_service.py web/src/pages/PlaceDetail/index.jsx web/src/pages/PlaceDetail/PlaceDetail.css
git commit -m "fix: harden persisted place enrichment"
```

Stage only the paths actually corrected from the explicit implementation-file
list above. If no correction was needed, do not create an empty commit.
