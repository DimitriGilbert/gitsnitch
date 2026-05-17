# Agent Testing Rules

Use TDD for behavior changes and bug fixes in git-snitch.

## TDD Loop

- Red: write one failing behavior test for the next observable requirement.
- Green: implement the smallest production-quality change that passes.
- Refactor: clean names, boundaries, duplication, and error handling while keeping tests green.
- Repeat one behavior at a time. Do not write broad speculative test suites for imagined future behavior.

## Test Through Public Interfaces

- Prefer CLI tests for CLI behavior, core API tests for report generation, exported contract tests for packages, and rendered UI tests for user-visible behavior.
- Avoid tests coupled to private helper names, implementation order, incidental formatting, or internal data structures unless that structure is the public contract.
- Do not weaken or delete existing tests to pass a change unless the test is wrong and the replacement preserves the behavior contract.

## Git And Report Fixtures

- Tests for git/report behavior must create temporary git repositories during the test.
- Fixtures must be deterministic: fixed authors, emails, dates, branches, remotes, commit messages, and file contents.
- Do not depend on the git-snitch repository history, global git config, network calls, wall-clock time, locale-specific output, or the developer machine's current branch.
- Include sparse cases: empty repos, tiny repos, one contributor, missing remotes, malformed git output, no file stats, nested repos, excluded directories, and explicit branch selection.
- Include safety cases for commit messages or data containing `</script>`, `<`, `>`, `&`, U+2028, and U+2029 when testing HTML injection.

## Test Quality

- Every test should fail for a real regression.
- Cover important failure paths for config validation, CLI argument conflicts, git command failures, template build failures, overwrite protection, and empty report data.
- Fake tests are not acceptable: do not add tests that only assert a mocked function was called unless the call itself is the behavior contract.
- Avoid live dev servers in tests unless the test owns the process and reliably tears it down.
