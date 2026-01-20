---
name: Project Audit
description: Comprehensive code quality, security, and formatting audit using shared MCP tools
---

# Project Audit Skill

This skill provides comprehensive project auditing capabilities using shared tools from `C:\Projects\mcp-shared`. It covers linting, formatting, security scanning, and custom pattern detection.

## Prerequisites

Ensure the following tools are installed globally or accessible:
- **Node.js** with npm/npx
- **Python** with pip
- **Ruff** (`pip install ruff`)
- **Bandit** (`pip install bandit`)
- **ripgrep** (`rg`) for pattern scanning

---

## Audit Categories

### 1. ESLint - JavaScript/TypeScript Linting

Lint frontend code for common issues and best practices.

```powershell
# Run ESLint with shared config
npx eslint <frontend-path> --config C:\Projects\mcp-shared\linters\eslint.config.js --format=json > eslint-violations.json

# Quick check (console output)
npx eslint <frontend-path> --format=stylish

# Auto-fix issues
npx eslint <frontend-path> --fix
```

**Key Rules Enforced:**
- `no-unused-vars` (warn) - Unused variables
- `no-console` (warn) - Console statements
- `prefer-const` (error) - Const over let when possible
- `no-var` (error) - No var declarations

---

### 2. Ruff - Python Linting

Fast Python linting (10x faster than flake8).

```powershell
# Run Ruff with shared config
ruff check <backend-path> --config C:\Projects\mcp-shared\linters\ruff.toml --output-format=json > ruff-violations.json

# Quick check (console output)
ruff check <backend-path>

# Auto-fix issues
ruff check <backend-path> --fix
```

**Rule Sets Enabled:**
- `E` - pycodestyle errors
- `F` - pyflakes
- `B` - flake8-bugbear
- `I` - isort (imports)
- `N` - pep8-naming
- `UP` - pyupgrade

**Ignored:** `E501` (line too long - handled by formatter)

---

### 3. Prettier - Code Formatting

Check and fix code formatting for consistency.

```powershell
# Check formatting (no changes)
npx prettier --check <path> --config C:\Projects\mcp-shared\formatters\.prettierrc

# Auto-format files
npx prettier --write <path> --config C:\Projects\mcp-shared\formatters\.prettierrc
```

**Format Settings:**
- Semi-colons: enabled
- Single quotes: disabled (double quotes)
- Tab width: 2
- Print width: 100

---

### 4. Bandit - Python Security Scanning

Scan Python code for security vulnerabilities.

```powershell
# Run security scan with shared config
bandit -r <backend-path> -c C:\Projects\mcp-shared\security\bandit.yaml -f json > bandit-violations.json

# Quick scan (console output)
bandit -r <backend-path> --severity-level low --confidence-level low

# High severity only
bandit -r <backend-path> -ll
```

**Security Tests Included:**
- B307 - `eval()` usage
- B310 - `urllib` URL open
- B311 - Random module (for crypto)
- B324 - Weak hash functions
- Pickle/Marshal deserialization
- XML vulnerabilities

---

### 5. Custom Pattern Detection

Use ripgrep for detecting anti-patterns and manual overrides.

```powershell
# Detect manual font size overrides in Tailwind
rg "text-\[|font-\[" <frontend-path> --count-matches

# Detect hardcoded colors (non-semantic)
rg "#[0-9A-Fa-f]{3,6}" <frontend-path> --glob "*.tsx" --glob "*.css"

# Detect console.log statements
rg "console\.(log|debug|info|warn|error)" <frontend-path> --glob "*.ts" --glob "*.tsx"

# Detect TODO/FIXME comments
rg "(TODO|FIXME|HACK|XXX):" <project-path>

# Detect direct atom imports in pages (Atomic Design violation)
rg "from.*atoms" <frontend-path>/app

# Detect inline styles
rg "style=\{" <frontend-path> --glob "*.tsx"

# Detect any usage of 'any' type in TypeScript
rg ": any" <frontend-path> --glob "*.ts" --glob "*.tsx"
```

---

## Full Audit Pipeline

Run a comprehensive audit across all categories:

```powershell
# Set project path
$PROJECT = "<project-root>"

# 1. ESLint Frontend
Write-Host "Running ESLint..." -ForegroundColor Cyan
npx eslint "$PROJECT\frontend" --format=json | Out-File eslint-violations.json -Encoding utf8

# 2. Ruff Backend
Write-Host "Running Ruff..." -ForegroundColor Cyan
ruff check "$PROJECT\backend" --output-format=json | Out-File ruff-violations.json -Encoding utf8

# 3. Prettier Check
Write-Host "Running Prettier..." -ForegroundColor Cyan
npx prettier --check "$PROJECT\frontend" 2>&1 | Out-File prettier-violations.txt -Encoding utf8

# 4. Bandit Security
Write-Host "Running Bandit..." -ForegroundColor Cyan
bandit -r "$PROJECT\backend" -f json | Out-File bandit-violations.json -Encoding utf8

# 5. Pattern Detection
Write-Host "Scanning for anti-patterns..." -ForegroundColor Cyan
rg "text-\[|font-\[" "$PROJECT\frontend" --count-matches | Out-File pattern-violations.txt -Encoding utf8

Write-Host "Audit Complete!" -ForegroundColor Green
```

---

## Audit Report Format

Generate a markdown report summarizing findings:

```markdown
# Project Audit Report
**Date**: YYYY-MM-DD HH:MM:SS
**Project**: <project-name>

## Summary

| Category | Violations | Status |
|----------|------------|--------|
| ESLint | X | 🟢/🟠/🔴 |
| Ruff | X | 🟢/🟠/🔴 |
| Prettier | X files | 🟢/🟠/🔴 |
| Bandit | X | 🟢/🟠/🔴 |
| Patterns | X | 🟢/🟠/🔴 |

## System Grade

**Total Violations**: X
**Rating**: X/10

Grading Scale:
- < 50 violations: 9/10 🟢 GREEN
- 50-200 violations: 7/10 🟠 YELLOW
- > 200 violations: 5/10 🔴 RED

## Detailed Findings

### ESLint Issues
[List top issues by frequency]

### Ruff Issues  
[List top issues by rule code]

### Security Issues
[List any Bandit findings with severity]

### Anti-Patterns
[List pattern violations found]

## Recommended Actions
1. [Priority fix #1]
2. [Priority fix #2]
3. [Priority fix #3]
```

---

## Quick Commands Reference

| Task | Command |
|------|---------|
| Lint frontend | `npx eslint frontend/` |
| Lint backend | `ruff check backend/` |
| Check formatting | `npx prettier --check frontend/` |
| Security scan | `bandit -r backend/ -ll` |
| Find TODOs | `rg "TODO\|FIXME" .` |
| Auto-fix ESLint | `npx eslint frontend/ --fix` |
| Auto-fix Ruff | `ruff check backend/ --fix` |
| Auto-format | `npx prettier --write frontend/` |

---

## Integration Tips

1. **CI/CD Integration**: Add audit commands to your CI pipeline
2. **Pre-commit Hooks**: Run quick checks before commits
3. **Scheduled Audits**: Run full audits weekly for larger projects
4. **IDE Integration**: Configure ESLint/Ruff in VS Code for real-time feedback
