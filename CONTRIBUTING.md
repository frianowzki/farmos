# Commit Convention

farmOS uses [Conventional Commits](https://www.conventionalcommits.org/).
Every commit message is validated by **commitlint** through a husky `commit-msg` hook.

## Format

```
<type>(<scope>): <subject>

[optional body]

[optional footer]
```

- **type** — required, one of the list below
- **scope** — optional, the area touched (`wallets`, `projects`, `login`, `api`, `db`, …)
- **subject** — required, imperative mood, no trailing period, ≤100 chars total header

## Types

| Type | Use for |
| --- | --- |
| `feat` | A new user-visible capability |
| `fix` | A bug fix |
| `docs` | Documentation only (`CHANGELOG.md`, `README.md`, `SETUP.md`, `AGENTS.md`) |
| `style` | Formatting, whitespace, missing semicolons — no behaviour change |
| `refactor` | Code change that is neither a feature nor a fix |
| `perf` | A change that improves performance |
| `test` | Adding or fixing tests |
| `build` | Build system or dependencies (`package.json`, `next.config.ts`) |
| `ci` | CI configuration |
| `chore` | Maintenance that touches nothing above |
| `revert` | Reverts a previous commit |

## Examples

```
feat(wallets): add default wallet hero card with per-chain balances
fix(login): render sprout mark instead of the full wordmark
docs: refresh CHANGELOG for 0.2.0
refactor(api): extract profile scoping helper
build(deps): bump next to 16.4.5
```

## Breaking changes

Add `!` after the type/scope and a `BREAKING CHANGE:` footer:

```
feat(db)!: scope every table by profile_id

BREAKING CHANGE: existing rows without a profile_id are backfilled to p1.
```

This is what makes the changelog generation accurate — `feat!` lands under a
**BREAKING** heading instead of **Added**.

## Setup (once per clone)

```bash
npm install       # runs `prepare` → `husky` → installs the commit-msg hook
```

Verify it works:

```bash
echo "bad message" | npx commitlint      # exits 1 with a rule violation
echo "feat(login): use the sprout mark" | npx commitlint   # exits 0
```

## Generating the changelog

`CHANGELOG.md` is grouped manually today but follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Because every commit now
carries a type, it can be generated automatically:

```bash
# list what would go under "Added"
git log --no-merges --pretty='%s' | grep -E '^feat' 
# "Fixed"
git log --no-merges --pretty='%s' | grep -E '^fix'
```

When a release is cut, move the `Unreleased` section to a dated version heading
and keep the raw `git log` as the source of truth.
