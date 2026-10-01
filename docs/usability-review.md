# Heuristic usability review – inspection UI

Method: developer walkthrough of the main tasks for each role (inspector, engineer, manager),
scored against six of Nielsen's usability heuristics (1 = poor, 5 = excellent).

| Heuristic | Before | After | Evidence |
|---|---|---|---|
| Visibility of system status | 4 | 4 | Saved message shows the calculated priority; colored priority badges and status text |
| Match between system and the real world | 2 | 4 | Errors used code names (`projectId`, `findings[0].element`); now plain language with examples |
| Error prevention | 3 | 4 | Empty default finding row caused an error; blank rows are now ignored. Rating is a dropdown |
| Help users recognize, diagnose, recover from errors | 2 | 4 | Errors were a list not tied to fields; invalid fields are now outlined in red |
| Recognition rather than recall | 4 | 4 | Placeholders, labeled ratings ("3 – Fair"), only allowed actions shown per role |
| Aesthetic and minimalist design | 4 | 4 | One-screen layout: form on the left, prioritized list on the right |

Open issues: no edit/delete for drafts, date picker still allows future dates until submit,
no mobile layout yet, needs testing with real field inspectors.
