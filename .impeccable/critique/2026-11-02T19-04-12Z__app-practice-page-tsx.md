---
target: student practice screens and Content Studio
total_score: 24
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 4
target_identity: "file:F:\\Recalls Tutor\\app\\practice\\page.tsx"
target_fingerprint: "sha256:c08064f64d7611d25e986f7089e200b55b6239945db8cbb2f5c784979f0d528a"
target_path: "F:\\Recalls Tutor\\app\\practice\\page.tsx"
timestamp: 2026-11-02T19-04-12Z
slug: app-practice-page-tsx
---
Method: dual-agent (A: design review sub-agent · B: detector sub-agent)

Design health (before refinement): 24/40, Acceptable.
| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of system status | 3 | Exam timer scrolled away on phones |
| 2 | Match system / real world | 3 | "Reviewed questions" tile ambiguous |
| 3 | User control and freedom | 2 | Session history only an anchor; review undo unclear |
| 4 | Consistency and standards | 2 | App rounded SaaS vs square editorial public site; stacked CSS layers |
| 5 | Error prevention | 3 | Publish had no confirm |
| 6 | Recognition rather than recall | 2 | Review actions hidden in a select |
| 7 | Flexibility and efficiency | 2 | No key for Check answer; no queue filter |
| 8 | Aesthetic and minimalist design | 2 | Equal-weight rounded panels, no hierarchy |
| 9 | Error recovery | 2 | AI job error told staff to run a CLI command |
| 10 | Help and documentation | 3 | Good inline help, repeated boilerplate |

Specificity verdict: category-interchangeable SaaS dashboard recoloured green; the brand's editorial vocabulary survived only in dead CSS.
Detector: student source clean; studio source 4 findings, all dead or overridden rules plus the deliberate Arial search preview.

Priority issues: [P1] card soup instead of the brand's ruled notebook vocabulary; [P1] practice home had about 7 competing start paths; [P1] mobile exam timer and actions out of view, no Enter to check; [P1] Studio publish hidden in a dropdown, source evidence not sticky; [P2] native confirm() at exam start and submit.
