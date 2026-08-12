---
schema_version: "1.0"
document_id: "OM-HANDOFFS-INDEX-001"
kind: "handoff_directory_index"
status: "active"
---

# Handoffs

This directory contains append-only agent reports. Create one file per task run
using `../HANDOFF_TEMPLATE.md` and the naming convention:

`YYYY-MM-DD--TASK-ID--agent-id.md`

Do not overwrite, delete, or silently correct an earlier report. Add a new
handoff with `supersedes: <filename>` in its front matter when a correction is
required.
