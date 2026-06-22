# Kickoff prompt for Claude Code

*Copy everything in the box below and paste it as your first message to Claude Code, in the
repo where you've placed the scaffold files. It tells Claude Code to adopt the structure and
confirm the continuity system works.*

---

```
You are taking over the Reflex project. The repo already contains a scaffold I set up:
a CLAUDE.md, a docs/ tree, and subagents in .claude/agents/. Before doing anything else:

1. Read CLAUDE.md fully — it is the project's standing memory and is loaded every session.
2. Read docs/ARCHITECTURE.md, docs/SCHEMA.md, docs/DECISIONS.md, and docs/PROGRESS.md.
3. Confirm back to me, in a short summary:
   - what Reflex is and its two surfaces,
   - the layer boundaries (what lives in Postgres vs the Cloudflare Worker vs the API vs the
     extension),
   - the locked decisions you must not relitigate,
   - and what the next step is according to docs/PROGRESS.md.

Then verify the working setup:
4. Run /agents and confirm the five project subagents are registered (explorer, schema-guard,
   implementer, reviewer, doc-keeper). If any are missing, tell me.
5. Confirm you understand the continuity rule: if our conversation is ever cleared, you rebuild
   context from CLAUDE.md and the docs/ tree, not from chat history, and the files are the
   source of truth if anything conflicts.

Do NOT write any code, apply any migration, or change any environment yet. The schema in
migrations/0000_baseline.sql is written but not applied — I apply migrations myself with
database credentials, which never go into any tool. After you've confirmed the above, wait for
me to tell you the first task.
```

---

## How to use the continuity system day to day

- **Starting fresh / after clearing context:** just say *"Read CLAUDE.md and docs/PROGRESS.md
  and tell me where we left off."* Claude Code rebuilds from the files — you never re-explain
  the project.

- **Finishing a session:** say *"Use the doc-keeper subagent to update docs/PROGRESS.md with
  what we did,"* and make sure that update is in the same commit as the work. This is what keeps
  the next session accurate.

- **Before a big change:** *"Use the explorer subagent to map how X works first."* It reads in
  its own context window so the main session stays clean.

- **Anything touching the database:** *"Use schema-guard to check this against the schema."*
  Then implement. Then *"Use reviewer to check the diff before I commit."*

- **The loop that keeps quality high:** explorer (understand) → implementer (build) →
  schema-guard / reviewer (check) → doc-keeper (record). The main session stays a thin
  orchestrator; the heavy reading and checking happen in subagents.

## A note on what makes this work

The whole continuity guarantee rests on one discipline: **PROGRESS.md is updated in the same
commit as the work it describes.** If that slips, the docs drift from reality and a cleared
session rebuilds a stale picture. Keep that one habit and Claude Code can resume this project
indefinitely, no matter how many times the conversation is wiped.
