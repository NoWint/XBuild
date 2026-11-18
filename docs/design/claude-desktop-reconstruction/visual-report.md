# Visual validation report

Date: 2026-11-16. Reference: installed Claude Desktop 5.11492.5.

## Result and limits

No Claude-versus-XBuild pixel score is available. The official application
rejects debugging flags; the current macOS screen capture permission check
returned false. Authenticated reference pages have not been observed. Static
client measurements and public documentation remain design references, not
proof of the active runtime style branch or pixel equality.

The XBuild shared-component browser suite passed 23 assertions under Node
24.14.0. It mounts the real shared components, but its local fixture handlers
do not exercise Agent execution. The full Desktop bundle compiled; the
following Agent build hit `ENOSPC` before native CDR execution. These outcomes
must not be combined into a claim that the full application passed.

## Available evidence

| Evidence                      | Location                                                                                 | What it establishes                                              |
| ----------------------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Static reference measurements | `reference-measurements.json`                                                            | Traceable dimensions, layers, typography and motion references   |
| Shared-component screenshots  | `packages/desktop/.e2e-artifacts/claude-desktop-design-system/`                          | XBuild components at 390/768/1200 widths and both themes         |
| Browser run                   | `packages/desktop/.e2e-artifacts/claude-reconstruction-20261116/shared-browser.log`      | 23 assertions passed; no full-app runtime coverage               |
| Comparator engineering run    | `packages/desktop/.e2e-artifacts/claude-reconstruction-20261116/visual-engineering.log`  | 101 assertions passed, including Chromium overlay alpha behavior |
| Native build attempt          | `packages/desktop/.e2e-artifacts/claude-reconstruction-20261116/cdr-native-baseline.log` | Desktop compiled; Agent compilation blocked by disk capacity     |
| Independent review            | `packages/desktop/.e2e-artifacts/claude-reconstruction-20261116/ui-review.md`            | Composer alignment, pane motion and divider gaps identified      |

## Reproducible comparison

Use `node scripts/compare-desktop-ui.mjs --help` for the current CLI. The
comparison contract is in `visual-validation-spec.md`. It requires equal
dimensions and matching theme, viewport, DPR and state metadata for a valid
comparison. Supply legally captured, privacy-safe reference and candidate
images; do not substitute an OSS screenshot, synthetic mock or unrelated
window state. The tool writes the overlay, pixel difference, JSON result and
interactive local HTML report using asynchronous IO.

Pending checks include the full-app 1440/1200/768/390 layouts, the repaired
composer center and width, real Side Pane/terminal reduced motion, actual
menus/settings/search and runtime message/tool/file states. Official
same-state captures, scroll behavior and animation timing remain a separate
reference gate after XBuild execution succeeds.
