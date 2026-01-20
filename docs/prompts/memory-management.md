---
name: Memory Management
description: Antigravity memory optimization, cleanup of browser artifacts, and session management
---

# Memory Management Skill

This skill provides procedures for managing Antigravity memory usage, cleaning up browser artifacts, and optimizing performance during long sessions.

---

## Quick Memory Reset

When memory usage gets high (>2GB), run these commands:

```powershell
# Kill Antigravity language server (will auto-restart fresh)
Get-Process | Where-Object { $_.ProcessName -like "*language_server*" } | Stop-Process -Force -ErrorAction SilentlyContinue

# Kill any orphaned node processes
Get-Process | Where-Object { $_.ProcessName -eq "node" -and $_.WorkingSet64 -gt 500MB } | Stop-Process -Force -ErrorAction SilentlyContinue
```

---

## Clean Browser Artifacts

Remove browser recordings, screenshots, and cache. **Run periodically to free disk space.**

```powershell
# Remove browser profile cache (can be GBs)
Remove-Item -Recurse -Force "$env:USERPROFILE\.gemini\antigravity-browser-profile\Default\Cache" -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force "$env:USERPROFILE\.gemini\antigravity-browser-profile\Default\Code Cache" -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force "$env:USERPROFILE\.gemini\antigravity-browser-profile\Default\GPUCache" -ErrorAction SilentlyContinue

# Remove browser video recordings from all conversations
Get-ChildItem -Path "$env:USERPROFILE\.gemini\antigravity\brain" -Recurse -Include "*.webp", "*.webm", "*.mp4", "*.png" | 
    Where-Object { $_.Name -like "*recording*" -or $_.Name -like "*screenshot*" } | 
    Remove-Item -Force -ErrorAction SilentlyContinue

# Remove temp files
Remove-Item -Recurse -Force "$env:USERPROFILE\.gemini\tmp" -ErrorAction SilentlyContinue
```

---

## Clean Old Conversation Artifacts

Remove artifacts from old conversations (keeps last 5):

```powershell
$brainPath = "$env:USERPROFILE\.gemini\antigravity\brain"
$conversations = Get-ChildItem -Path $brainPath -Directory | Sort-Object LastWriteTime -Descending

# Keep only the 5 most recent conversations
$toDelete = $conversations | Select-Object -Skip 5
foreach ($folder in $toDelete) {
    Write-Host "Removing old conversation: $($folder.Name)"
    Remove-Item -Recurse -Force $folder.FullName -ErrorAction SilentlyContinue
}
```

---

## Clean Antigravity History (⚠️ HIGH IMPACT)

This is where Antigravity stores file edit history. **Can grow to 100+ MB with thousands of folders.** This is the main source of "old context loading" on startup.

**Location**: `C:\Users\<user>\AppData\Roaming\Antigravity\User\History`

```powershell
# Check size first
$historyPath = "$env:USERPROFILE\AppData\Roaming\Antigravity\User\History"
$size = (Get-ChildItem $historyPath -Recurse -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum / 1MB
$folders = (Get-ChildItem $historyPath -Directory -ErrorAction SilentlyContinue).Count
Write-Host "History: $folders folders, $([math]::Round($size, 2)) MB"

# Delete all history (safe - doesn't affect git or actual code)
Remove-Item -Recurse -Force "$env:USERPROFILE\AppData\Roaming\Antigravity\User\History" -ErrorAction SilentlyContinue
```

**Note**: This is Antigravity's internal undo history, NOT git history. Deleting this is safe and recommended for fresh starts.

---

## VS Code Memory Optimization

Apply these settings to limit language server memory:

```json
// Add to .vscode/settings.json
{
  "typescript.tsserver.maxTsServerMemory": 2048,
  "files.watcherExclude": {
    "**/node_modules/**": true,
    "**/.next/**": true,
    "**/dist/**": true,
    "**/__pycache__/**": true
  }
}
```

---

## Memory Monitoring

Check current memory usage:

```powershell
# Show Antigravity-related processes and memory
Get-Process | Where-Object { 
    $_.ProcessName -like "*language_server*" -or 
    $_.ProcessName -like "*antigravity*" -or
    $_.ProcessName -eq "node"
} | Select-Object ProcessName, Id, @{N='Memory (MB)';E={[math]::Round($_.WorkingSet64/1MB)}} | 
    Sort-Object 'Memory (MB)' -Descending | Format-Table -AutoSize
```

---

## Preventive Measures

### During Sessions
1. **Close unused tabs** - Each open file adds to memory
2. **Avoid excessive file exploration** - Limit codebase searches
3. **Restart after 2-3 hours** of heavy use

### Agent Instructions
When working in Antigravity, follow these rules:
- **Never use browser_subagent** for simple tasks - prefer direct file operations
- **Avoid taking unnecessary screenshots** - use text snapshots instead
- **Skip video recordings** unless explicitly requested by user
- **Limit grep/find operations** - use targeted paths, not full project scans
- **Close conversations** when switching to unrelated work

---

## Full Cleanup Script

Run for complete memory and disk cleanup:

```powershell
Write-Host "=== Antigravity Full Cleanup ===" -ForegroundColor Cyan

# 1. Kill memory-heavy processes
Write-Host "Stopping language servers..." -ForegroundColor Yellow
Get-Process | Where-Object { $_.ProcessName -like "*language_server*" } | Stop-Process -Force -ErrorAction SilentlyContinue

# 2. Clean browser cache
Write-Host "Cleaning browser cache..." -ForegroundColor Yellow
Remove-Item -Recurse -Force "$env:USERPROFILE\.gemini\antigravity-browser-profile\Default\Cache" -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force "$env:USERPROFILE\.gemini\antigravity-browser-profile\Default\Code Cache" -ErrorAction SilentlyContinue

# 3. Clean recordings and screenshots
Write-Host "Removing browser recordings..." -ForegroundColor Yellow
Get-ChildItem -Path "$env:USERPROFILE\.gemini\antigravity\brain" -Recurse -Include "*.webp", "*.webm", "*.mp4" | 
    Where-Object { $_.Name -like "*recording*" } | Remove-Item -Force -ErrorAction SilentlyContinue

# 4. Clean tmp
Write-Host "Cleaning temp files..." -ForegroundColor Yellow
Remove-Item -Recurse -Force "$env:USERPROFILE\.gemini\tmp" -ErrorAction SilentlyContinue

# 5. Report
Write-Host ""
Write-Host "Cleanup Complete!" -ForegroundColor Green
Write-Host "Restart VS Code/Antigravity for changes to take effect."
```

---

## Token Optimization Tips

To prevent agent loops and reduce token usage:

1. **Be specific in requests** - "Fix line 45 in api.py" vs "fix the bug"
2. **Provide context upfront** - Share relevant file paths
3. **Break large tasks** - One feature at a time
4. **Use checkpoints** - Ask agent to summarize before continuing
5. **Clear conversation** - Start fresh for unrelated tasks
