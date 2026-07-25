# Figent --- System Architecture & Engineering Decisions

------------------------------------------------------------------------

# System Architecture --- Big Picture Flow

``` text
User submits repo URL
        ↓
Orchestrator Node
- Clones repo via RepoHandler
- Extracts all code files (.py, .js, .ts, .java, .go)
- Runs static analysis tools on each file (Bandit + Radon)
- Attaches tool_results to each file
- Writes everything into state["files"]

        ↓

Quality Agent
- Reads state["files"]
- Sends file content + Radon findings to the LLM
- Writes → state["quality_findings"]

        ↓

Security Agent
- Reads state["files"]
- Sends file content + Bandit findings to the LLM
- Works for all supported languages
- Writes → state["security_findings"]

        ↓

Performance Agent
- Reads state["files"]
- Sends file content + Radon findings to the LLM
- Writes → state["performance_findings"]

        ↓

Synthesizer Agent
- Reads findings from all three agents
- Deduplicates overlapping issues
- Ranks findings by severity
- Scores confidence
- Decides PR eligibility (confidence ≥ 85%)
- Writes:
    state["all_findings"]
    state["final_report"]

        ↓

GitHub PR Node
- Reads PR-eligible findings
- Applies fixes
- Opens pull requests
- Writes → state["pr_urls"]

        ↓

Chat Agent
- Loads review history from PostgreSQL
- Answers user questions about:
    • findings
    • fixes
    • pull requests

        ↓

Final Output
- Complete review report
- Severity summary
- PR links
- Stored in PostgreSQL
```

------------------------------------------------------------------------

# Day 1 --- LangGraph Fundamentals

## Concept Locked In

LangGraph consists of:

-   Nodes that process state
-   Edges that define execution flow
-   Shared state accessible by every node

Each node follows the pattern:

1.  Read state
2.  Perform work
3.  Update state
4.  Return state

No production code was written.

The focus was understanding LangGraph through documentation and a small
four-node demo graph:

    fetch_repo
        ↓
    quality_agent
        ↓
    security_agent
        ↓
    synthesizer

------------------------------------------------------------------------

# Day 2 --- Project Setup + RepoHandler

## Decision

State is defined using a strict `TypedDict (ReviewState)`.

Reason:

-   Every agent follows the same contract.
-   Prevents accidental writes to unexpected keys.

------------------------------------------------------------------------

## Decision

Skip files larger than **100 KB**.

Reason:

-   LLM context windows are limited.
-   Large files consume excessive tokens.
-   Better overall repository coverage.

------------------------------------------------------------------------

## Decision

Delete cloned repositories after analysis.

Reason:

Keeping repositories permanently wastes storage.

------------------------------------------------------------------------

## Problem

Windows marks `.git` files as read-only.

`shutil.rmtree()` failed with:

    PermissionError

### Fix

Added `_force_remove()` via `onexc=`.

The handler:

-   Changes file permissions
-   Retries deletion

No impact on Linux or macOS.

------------------------------------------------------------------------

## Decision

Expanded supported languages.

Originally:

    .py

Now:

    .py
    .js
    .ts
    .java
    .go

Reason:

LLMs analyze code as plain text.

Only Bandit and Radon remain Python-specific.

------------------------------------------------------------------------

# Day 3 --- Static Analysis Tools

## Decision

Use CLI tools through `subprocess`.

Instead of:

``` python
import bandit
import radon
```

Use:

    bandit -f json
    radon cc -j

Reason:

CLI JSON output is more stable than internal Python APIs.

------------------------------------------------------------------------

## Decision

Radon complexity threshold:

  Complexity   Severity
  ------------ ----------
  0--8         Ignore
  9--15        Medium
  \>15         High

This avoids unnecessary noise.

------------------------------------------------------------------------

## Decision

Static analysis only runs on Python files.

Other languages return:

``` python
tool_results = {
    "bandit_findings": [],
    "radon_findings": []
}
```

The LLM performs reasoning without tool support.

------------------------------------------------------------------------

## Concept Locked In

Bandit and Radon require actual file paths.

Therefore:

-   Clone repository
-   Run tools
-   Delete repository only after analysis completes

------------------------------------------------------------------------

# Day 4 --- Quality Agent

## Decision

LLM temperature:

    0.1

Reason:

Code reviews should be deterministic.

------------------------------------------------------------------------

## Decision

Prompt includes only the first **3000 characters**.

Reason:

Reduces token usage.

Full-file chunking is planned for v2.

------------------------------------------------------------------------

## Decision

Quality Agent combines:

-   Radon findings
-   Independent LLM reasoning

This allows detection of:

-   Naming issues
-   Structural problems
-   Logic smells

which Radon cannot identify.

------------------------------------------------------------------------

## Problem

LLM wrapped JSON inside markdown fences.

Example:

```` text
```json
[
 ...
]
```
````

### Fix

Strip markdown fences before parsing.

------------------------------------------------------------------------

## Problem

Nested quotes inside JSON broke parsing.

### Fix

Prompt now requires fixes in plain English instead of embedded code.

------------------------------------------------------------------------

## Problem

`content` could be undefined if `llm.invoke()` failed.

### Fix

Initialize:

``` python
content = ""
```

before entering the `try` block.

------------------------------------------------------------------------

## Concept Locked In

Agents are tested independently using manually constructed state.

Full LangGraph integration comes later.

------------------------------------------------------------------------

# Architecture Pattern

Every agent follows the same lifecycle:

1.  Read state
2.  Build grounded prompt
3.  Call the LLM
4.  Parse defensively
5.  Enrich with metadata
6.  Write back to state

Adding a new agent only requires:

-   A new prompt
-   Appropriate tool context

No new infrastructure.

------------------------------------------------------------------------

# Day 5 --- Security Agent + Performance Agent

## Decision

Security Agent analyzes **all languages**.

Python files receive Bandit findings.

Other languages rely on LLM reasoning.

------------------------------------------------------------------------

## Decision

Performance Agent uses Radon as a signal, not as the final authority.

The LLM also detects:

-   Blocking I/O
-   N+1 queries
-   Inefficient algorithms

------------------------------------------------------------------------

## Decision

Shared utilities extracted into:

    backend/utils.py

### Utilities

#### `clean_llm_response()`

Extracts JSON using:

``` python
find("[")
rfind("]")
```

instead of relying solely on markdown fence removal.

------------------------------------------------------------------------

#### `safe_llm_call()`

Adds exponential backoff:

-   10 seconds
-   20 seconds
-   30 seconds

for handling rate limits.

------------------------------------------------------------------------

## Decision

Skip test files permanently.

Ignored:

-   `test_*.py`
-   `conftest.py`
-   `tests/`

Reason:

Only production code is reviewed.

------------------------------------------------------------------------

## Temporary Testing Limits

-   2000 characters per file
-   Maximum 5 findings
-   150-character issue/fix fields

Scheduled for removal before the final demo.

------------------------------------------------------------------------

## Problem

Large JSON responses exceeded model limits.

### Fix

Reduce:

-   input size
-   maximum findings

Future solution:

Chunked file analysis.

------------------------------------------------------------------------

## Problem

HTTP 429 rate limits.

### Fix

Automatic retries using exponential backoff.

------------------------------------------------------------------------

## Concept Locked In

Orchestrator enriches each file with tool results before any agent
executes.

Each file becomes self-contained.

------------------------------------------------------------------------

# Day 6 --- LangGraph Orchestration

## Decision

Wrap the Orchestrator in `try/except`.

Failure scenarios:

-   Invalid repository
-   Private repository
-   Network errors

Errors are stored in:

``` python
state["error"]
```

instead of crashing the graph.

------------------------------------------------------------------------

## Decision

Agents execute sequentially.

    Orchestrator
          ↓
    Quality
          ↓
    Security
          ↓
    Performance

Parallel execution is reserved for v2.

------------------------------------------------------------------------

## Testing Constraint

Analyze only the first **10 files**.

Purpose:

-   Faster iteration
-   Reduced rate limits

Future production strategy:

Analyze only changed files.

------------------------------------------------------------------------

## Milestone

First successful end-to-end pipeline.

Input:

    Repository URL

Output:

    Structured findings from all three agents

without manual state creation.

------------------------------------------------------------------------

# Review State Structure

``` python
result = {
    "repo_url": "...",
    "repo_path": "...",
    "files": [
        {
            "path": "...",
            "content": "...",
            "language": "...",
            "size_kb": 0.1,
            "tool_results": {
                "bandit_findings": [],
                "radon_findings": []
            }
        }
    ],
    "quality_findings": [],
    "security_findings": [],
    "performance_findings": [],
    "all_findings": [],
    "final_report": {},
    "pr_urls": [],
    "error": None
}
```

------------------------------------------------------------------------

# Day 7 --- Synthesizer Agent

## Decision

Deduplicate findings using:

-   File path
-   Line proximity (±5 lines)

instead of exact line matching.

------------------------------------------------------------------------

## Decision

Merged findings use:

-   Highest severity
-   Highest confidence
-   Fix from highest-confidence agent

------------------------------------------------------------------------

## Decision

PR threshold:

    Confidence ≥ 85%

Lower-confidence findings remain report-only.

------------------------------------------------------------------------

## Decision

`final_report` stores:

-   Complete findings
-   Severity summary

to support dashboards.

------------------------------------------------------------------------

# Day 8 --- Fix Generation

## Decision

Generate fixes **only** for PR-eligible findings.

Reason:

Avoid wasting tokens on low-confidence issues.

------------------------------------------------------------------------

## Decision

Provide the LLM with:

-   10 lines before
-   Issue line (marked with `>>>`)
-   10 lines after

This provides enough context without sending the entire file.

------------------------------------------------------------------------

## Decision

Fix format:

``` json
{
  "original_code": "...",
  "fixed_code": "..."
}
```

Chosen over unified diffs because string replacement is simpler and more
reliable.

------------------------------------------------------------------------

# Day 9 --- GitHub PR Opening

## Decision

One pull request per finding.

Reason:

Smaller PRs are easier to review.

------------------------------------------------------------------------

## Decision

Branch naming convention:

``` text
figent/fix-{filename}-L{line}
```

Automated branches remain grouped.

------------------------------------------------------------------------

## Decision

Apply fixes using exact string replacement.

    original_code
          ↓
    fixed_code

instead of replacing by line number.

Reason:

Line numbers change after earlier edits.

------------------------------------------------------------------------

## Decision

If `original_code` is not found:

-   Skip the pull request
-   Continue processing

Never open a broken PR.

------------------------------------------------------------------------

## Safety Decision

Automatic PR creation only occurs on repositories with write access.

Third-party repositories always run in **report-only mode**.

This is the project's primary responsible AI safeguard. Day 9 --- GitHub
PR + Issue Opening

Decision: Three-tier action system based on severity + confidence: -
Critical/High + confidence ≥ 85% → PR with automated fix - Medium/Low OR
confidence \< 85% → GitHub Issue for human review\
- Confidence \< 60% → Report only, no GitHub action This mirrors how
real code review tools operate --- not everything deserves automation.

Decision: LLM generates PR and Issue titles --- conventional commit
format for PRs (fix(scope): description), bracketed severity format for
Issues (\[SEVERITY\] description). More professional than auto-generated
text from finding content.

Decision: If a PR-eligible finding has no valid code_fix, it gets
downgraded to an Issue automatically instead of being skipped. No
finding is silently lost --- it always surfaces somewhere.

Decision: Labels applied to Issues by severity --- critical/high get
"bug" label, medium gets "enhancement", all get "figent" label for easy
filtering. Makes Figent's Issues identifiable at a glance.

# Day 10 --- Chat Agent

Decision: Chat agent is stateless between sessions but stateful within a
session --- conversation history maintained in memory during one chat
session, cleared when session ends. Full history sent with every message
so LLM has conversation context.

Decision: System prompt built from review_result dict --- not from
database. For the chat session the review result is already in memory,
no DB query needed. DB persistence happens in Day 13 when FastAPI routes
are built.

Decision: Findings summary truncated to 100 chars per finding in system
prompt --- keeps context window manageable. Full finding details
available if user asks specifically about one.

# Day 11 --- Chat Agent Deep Context

Decision: Intent detection runs before every message --- lightweight LLM
call returning a single word (summary, file_query, severity_query, etc).
Small token cost but significantly improves response quality by pulling
the right context before answering. Better than sending everything every
time.

Decision: Extra context injected into system prompt per message based on
intent --- not stored in conversation history. Keeps history clean (just
user/assistant turns) while still providing full details when needed for
specific queries.

Decision: File and severity queries pull FULL finding details into
context --- not the truncated 100-char summaries from the base system
prompt. User asking about a specific file deserves complete information.

Decision: Lookup helper methods added to ChatAgent class ---
get_findings_by_file(), get_findings_by_severity(),
get_pr_eligible_findings() These keep the chat() method clean and make
individual lookups reusable across different intent handlers.

Decision: Added time.sleep(5) between questions in test file ---
prevents rate limit hits when firing multiple LLM calls back to back
during testing. Not needed in production since users type naturally.

Problem hit: Rate limit (429) when firing all test questions back to
back with no delay. Chat test was hitting 8000 TPM limit from
accumulated conversation history growing with each message. Fix: Added 5
second delay between questions in test file.

------------------------------------------------------------------------

# Day 12 --- PostgreSQL + History Tracking

Decision: Using Neon (cloud PostgreSQL) directly from day 1 instead of
SQLite locally then switching. Neon free tier is enough for development
and production --- removes the need for any migration later. Connection
string stored in .env, never hardcoded anywhere.

Decision: Single connection point --- all database access goes through
backend/db/database.py. engine and SessionLocal defined once, imported
everywhere. Changing the database later = change one line in .env only.

Decision: Findings stored as flat rows in DB (not nested JSON) ---
enables proper SQL queries like "all critical findings across all
reviews" or "findings by file across multiple repos". JSON storage would
make these queries impossible or very slow.

Decision: Four tables --- reviews, findings, chat_sessions,
chat_messages. Reviews → Findings is one-to-many. Reviews → ChatSessions
is one-to-many. ChatSessions → ChatMessages is one-to-many. Clean
relational model, no denormalization needed at this scale.

Decision: Chat agents stored in memory (active_chat_agents dict in
routes.py) not serialized to DB. ChatAgent instances are reconstructed
from DB data when a review is loaded in a new session. No point
serializing Python objects --- DB stores the raw data, Python rebuilds
the agent from it.

Decision: Review status tracks the full lifecycle --- pending → running
→ complete / failed. Frontend can poll GET /review/:id to check status
or use WebSocket for live updates. Both patterns supported.

Decision: complete_review() in crud.py saves all findings and matches
them against pr_urls to determine action_taken per finding. This
denormalizes slightly (action_taken stored on finding) but makes
querying findings with their GitHub URLs much simpler --- no join
needed.

## Day 13 — FastAPI + WebSocket

Decision: WebSocket for review streaming — client gets live updates
as each agent completes instead of waiting for full analysis.
REST for everything else — chat, history, review retrieval.
Right tool for right job.

Decision: Health endpoint added at GET /health — Render uses this
to confirm backend is alive. Without it Render marks service as
failed even when running fine.

Decision: CORS configured for both localhost:3000 (dev) and Vercel
URL (prod). Vercel URL updated after deployment on Day 16.

Decision: Keepalive message sent after synthesizer completes —
PR agent takes a long time (GitHub API calls per finding). Without
keepalive the WebSocket times out waiting. Client handles keepalive
type without breaking the listen loop.

Problem hit: WebSocket closing with code 1011 (internal error) —
keepalive ping timeout during long PR agent execution.
Fix: Increased uvicorn ws-ping-timeout to 300s, added keepalive
event after synthesizer, increased test timeout to 600s.

---

## Day 14 — React Dashboard (Analysis View)

Decision: Dark theme (gray-950 background) — code review tools
conventionally use dark UI. Matches developer expectations and
makes severity colors (red, orange, yellow, green) pop visually.

Decision: WebSocket connection managed in Home.jsx with useRef —
ws instance stored in ref not state so reconnects don't trigger
re-renders. Prevents duplicate connections on state updates.

Decision: Live agent progress shown as cards appearing one by one
as each WebSocket event fires. User sees system working in real
time instead of a blank loading spinner for 3-5 minutes.

Decision: Auto-redirect to /review/:id after complete event fires —
1.5 second delay so user sees the "complete" confirmation before
navigating. Immediate redirect feels jarring.

Decision: Findings displayed with severity color coding —
critical=red, high=orange, medium=yellow, low=gray. Color alone
communicates urgency before reading the text.

Decision: GitHub URL shown as "View PR" or "View Issue" badge on
each finding — direct link to the GitHub action taken. User can
click straight from the dashboard to the opened PR.

Decision: Two tabs on review page — findings and chat. Keeps
the page clean. User reads findings first, then asks questions
about them in chat. Natural flow.

---

## Day 15 — History View + Polish

Decision: History page shows all reviews ordered by created_at
descending — most recent first. Each review shows repo URL,
timestamp, status, finding count, PR count, issue count.

Decision: Status color coded — complete=green, running=yellow,
failed=red. Running status means the graph crashed before
completing — user knows not to expect results.

Decision: Click anywhere on history row to navigate to review —
full row is clickable, not just a button. Better UX on mobile.

Decision: Empty state message when no reviews exist — "No reviews
yet. Run your first analysis." Avoids blank page confusion on
first use.

---

## Day 16 — Remove Constraints + Deployment

Decision: Removed testing constraints from all 3 agent prompts —
max findings limit, character limits on issue/fix fields.
Replaced with chunked file analysis (6000 char chunks, 500 char
overlap). Chunking solves truncation at the root instead of
limiting output quality.

Decision: chunk_file() added to utils.py — splits large files
into overlapping chunks so no file content is lost. 500 char
overlap preserves context at chunk boundaries. Each chunk carries
start_line so agents report accurate line numbers.

Decision: Render for backend deployment — free tier sufficient
for portfolio demo. Cold start (~30 seconds after inactivity)
is acceptable — warn interviewer before demo.

Decision: Vercel for frontend — zero config React deployment,
automatic HTTPS, instant CDN. Free tier has no limitations for
portfolio use.

Decision: Environment variables set on Render dashboard — never
committed to GitHub. GROQ_API_KEY, GITHUB_TOKEN, DATABASE_URL
all injected at runtime via Render env var config.

Decision: API base URL configured via Vite environment variables
(VITE_API_URL, VITE_WS_URL) — dev points to localhost, prod
points to Render URL. One config change switches environments,
no code changes needed.

Decision: wss:// (secure WebSocket) used in production — required
since Vercel frontend is HTTPS. ws:// only for localhost dev.

---

## Day 17 — README + Eval + Demo Video

Decision: Eval suite built against figent-test-repo which has
4 known intentional vulnerabilities — hardcoded password, SQL
injection, command injection, O(n³) complexity. Precision and
recall measured against these known issues.

Decision: Precision and recall reported in README — shows system
actually works, not just claims to. Real numbers from real test.
This is what separates a serious project from a tutorial.

Decision: README structured as: one-liner → live demo link →
what it does → architecture → tech stack → eval results →
engineering decisions → local setup. Recruiter reads top to
bottom and has everything they need in 2 minutes.

Decision: Demo video is exactly 2 minutes — shows: URL input →
live agent streaming → findings dashboard → GitHub PRs and Issues
opened → chat agent Q&A. Every major feature visible, no
unnecessary narration.

Decision: decisions.md linked from README — shows engineering
maturity. Most students never document why they made choices.
This file alone differentiates the project in interviews.