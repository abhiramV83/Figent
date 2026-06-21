# Figent — Engineering Decisions Log

---

## Day 1 — LangGraph Fundamentals

**Concept locked in:** LangGraph = nodes process state, edges define flow,
state is shared memory across all agents. Every node reads state, does
work, writes back to state, returns it.

No project code written today — pure understanding via LangGraph docs +
a dummy 4-node graph (fetch_repo → quality_agent → security_agent →
synthesizer) to internalize the pattern before touching the real project.

---

## Day 2 — Project Setup + RepoHandler

**Decision:** State defined upfront as a strict `TypedDict` (`ReviewState`)
— forces every agent to follow a fixed contract. Prevents agents from
silently writing unexpected keys into shared state.

**Decision:** Files over 100KB are skipped during repo extraction. LLM
context windows have limits — large files would blow up token usage
for one file at the cost of analyzing the rest of the repo.

**Decision:** Repo is cleaned up (deleted from disk) after analysis
completes. Storing cloned repos permanently wastes storage — at scale,
100 reviews would mean 100 repos sitting on disk unnecessarily.

**Problem hit:** Windows sets `.git` folder files as read-only, so
`shutil.rmtree()` failed with `PermissionError` on cleanup/re-clone.
**Fix:** Added a `_force_remove` handler passed via `onexc=` to
`shutil.rmtree()` — it chmods the file to writable then retries deletion.
Windows-specific fix, has no effect on Linux/Mac deployment.

**Decision:** Extended file support beyond Python — originally scoped to
`.py` only, expanded to `.py, .js, .ts, .java, .go`. Reasoning: LLM-based
agents can analyze any language as raw text since they just read code as
text. Only the static analysis tools (bandit, radon) remain Python-specific
since they're Python tooling. This is a deliberate v1 scope decision, not
an oversight — documented clearly for interviews and README.

---

## Day 3 — Static Analysis Tools (bandit + radon)

**Decision:** Used `subprocess` + JSON output mode (`-f json` for bandit,
`-j` for radon) instead of importing them as Python libraries directly.
Reasoning: CLI JSON output is stable and well-documented across versions;
internal Python APIs for these tools change more often between releases.

**Decision:** radon complexity threshold set at `> 8` to flag a function.
8–15 = medium severity, above 15 = high severity. Based on radon's own
complexity rating scale. Filtering at this threshold avoids noise from
flagging every trivial function with complexity 1–2.

**Decision:** Static analysis tools only run on `.py` files — for any
other language, `analyze_file()` returns empty findings immediately.
These files rely purely on LLM reasoning in the agent layer instead.

**Concept locked in:** Tools require an actual file path on disk to run
(not in-memory content) — this is why RepoHandler keeps the cloned repo
present on disk throughout analysis, with cleanup only happening at the
very end of the full pipeline.

---

## Day 4 — Quality Agent (first real LangGraph-style agent)

**Decision:** `temperature=0.1` for the LLM — code analysis needs
consistent, repeatable output across runs, not creative variation.

**Decision:** Truncating file content to first 3000 characters in the
prompt — controls token usage and cost. Large files get partial analysis
for now; full-file chunking is a planned v2 improvement.

**Decision:** Agent combines static tool findings (radon) WITH the LLM's
own independent reading of the code — not purely tool-driven. The LLM
catches issues radon's complexity score alone can't judge (e.g. unclear
naming, weak structure, logic smells).

**Problem hit:** LLM occasionally wrapped JSON output in markdown code
fences (` ```json ... ``` `), breaking `json.loads()`.
**Fix:** Added explicit strip logic — detect and remove fences before
parsing.

**Problem hit:** LLM sometimes used nested quotes/backticks inside JSON
string values (e.g. embedding `code syntax` inside the "fix" field),
breaking JSON escaping and causing parse failures.
**Fix:** Added an explicit prompt rule instructing the LLM to describe
fixes in plain English instead of embedding code-with-quotes — removed
the entire class of bug at the prompt level instead of patching every
possible escaping edge case in code.

**Problem hit:** `content` variable was referenced in the `except` block
before being guaranteed to exist (if `llm.invoke()` itself threw before
`content` was assigned, the except block would crash with a
`NameError` instead of showing the real error).
**Fix:** Defined `content = ""` upfront before the `try` block so error
logging always works, even on total invoke failure.

**Concept locked in:** Every agent today is tested in isolation with
manually-built state (acting as a stand-in orchestrator). This is
correct component-level testing practice — integration via a real
LangGraph graph happens on Day 6, where an `orchestrator_node` will
automatically populate `state["files"]` with tool results attached,
replacing today's manual wiring.

---

## Architecture Pattern (applies to every agent going forward)

Every agent in this project follows the same contract:
1. Read relevant data from `state`
2. Build a grounded prompt (real tool findings + actual code, not guesses)
3. Call the LLM
4. Parse defensively (strip fences, handle JSON errors gracefully)
5. Enrich output with metadata (file, agent name)
6. Write back to `state`, return `state`

This consistency means adding a new agent type (Security, Performance)
is mostly about writing a new prompt and connecting the right tool
output — not building new infrastructure each time.