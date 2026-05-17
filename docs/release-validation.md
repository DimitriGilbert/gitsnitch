# Release Validation

Phase 12 validates the npm CLI v1 release through generated HTML/content-level and jsdom/component tests. It does not currently run real browser or `file://` end-to-end automation.

The following residual risks are accepted for v1 because real-browser automation may be unavailable in the release environment:

- actual `file://` hash routing in a standalone browser
- theme toggle behavior in a standalone browser
- CSV and JSON downloads in a real browser
- custom-template standalone execution in a real browser

A future real-browser E2E follow-up should cover these paths when browser automation is available.
