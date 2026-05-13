@echo off
REM ─────────────────────────────────────────────────────────────────
REM  push-to-github.bat
REM  Run this AFTER creating the repo at https://github.com/new
REM  (name: workflow-tracker, private/public your choice, NO readme)
REM ─────────────────────────────────────────────────────────────────

cd /d "%~dp0"

echo Removing any stale git state...
if exist ".git" rmdir /s /q ".git"

echo Initialising git repo...
git init -b main
git config user.email "greigfensome@gmail.com"
git config user.name "Greig"

echo Staging all files...
git add -A

echo Committing...
git commit -m "Initial commit — workflow tracker with Notion integration"

echo Adding GitHub remote...
git remote add main https://github.com/greigorius/workflow-tracker.git

echo Pushing to GitHub...
git push -u main main --force

echo.
echo Done! Open https://github.com/greigorius/workflow-tracker to verify.
pause
