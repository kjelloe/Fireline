#!/bin/bash
# debugging/test_worker_autostash.sh — prove the batch_worker `update`
# autostash path (prompt 66) against real git, in a throwaway clone.
# The PC has been blocked twice by this exact code path, and it only
# ever runs there — so it gets tested here instead.
#
#   bash debugging/test_worker_autostash.sh
set -u
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
pass=0; fail=0
check() { # $1 = label, $2 = expected, $3 = actual
  if [ "$2" = "$3" ]; then echo "  ok   $1"; pass=$((pass+1));
  else echo "  FAIL $1: expected '$2', got '$3'"; fail=$((fail+1)); fi
}

# An upstream with one commit, and a clone that will act as the worker.
git init -q --bare --initial-branch=main "$TMP/origin.git"
git clone -q "$TMP/origin.git" "$TMP/seed" 2>/dev/null
cd "$TMP/seed"
git config user.email t@t; git config user.name t
git checkout -q -b main 2>/dev/null || true
echo v1 > file.txt; printf 'reports/sweeps/\n' > .gitignore; mkdir -p reports/sweeps
git add -A; git commit -qm first; git push -q -u origin main 2>/dev/null
cd "$TMP"; git clone -q "$TMP/origin.git" worker
cd "$TMP/worker"; git config user.email w@w; git config user.name w

# Upstream moves on.
cd "$TMP/seed"; echo v2 > file.txt; git commit -qam second; git push -q 2>/dev/null
cd "$TMP/worker"
mkdir -p reports/sweeps

echo "case 1: DIRTY worktree (the situation that blocked the PC)"
echo "local debug print" >> file.txt
echo "a result nobody wants stashed" > reports/sweeps/run.csv
dirty=$(git status --porcelain --untracked-files=no)
check "dirty is detected" "true" "$([ -n "$dirty" ] && echo true || echo false)"
git stash push -m "batch_worker autostash" >/dev/null 2>&1
check "stash succeeded" "0" "$?"
pullout=$(git pull --ff-only 2>&1)
check "pull now fast-forwards" "0" "$?"
check "upstream change arrived" "true" \
  "$(grep -q 'v2' file.txt && echo true || echo false)"
# The stashed edit and the pull touched the SAME file, so the pop must
# conflict — the case that would have re-exec'd the worker into a tree
# full of conflict markers. The recovery is a hard reset onto the clean
# pulled tree, with the work preserved in the stash.
if git stash pop >/dev/null 2>&1; then
  check "pop conflicted as expected" "conflict" "clean-pop"
else
  git reset --hard HEAD >/dev/null 2>&1
  check "worktree has NO conflict markers after recovery" "true" \
    "$(grep -q '<<<<<<<' file.txt && echo false || echo true)"
  check "the stash entry is preserved for the human" "true" \
    "$([ -n "$(git stash list)" ] && echo true || echo false)"
  check "tree is clean enough to run jobs" "true" \
    "$([ -z "$(git status --porcelain --untracked-files=no)" ] && echo true || echo false)"
fi
check "gitignored RESULT untouched by stash" "true" \
  "$([ -f reports/sweeps/run.csv ] && echo true || echo false)"

echo "case 2: DIVERGED worktree (no stash can fix this)"
cd "$TMP/worker"; git checkout -q -- . 2>/dev/null; git stash clear
echo "a commit made on the worker itself" > worker_only.txt
git add worker_only.txt; git commit -qm "worker-local commit"
cd "$TMP/seed"; echo v3 > file.txt; git commit -qam third; git push -q 2>/dev/null
cd "$TMP/worker"
clean=$(git status --porcelain --untracked-files=no)
check "tree reads CLEAN (so autostash is skipped)" "true" \
  "$([ -z "$clean" ] && echo true || echo false)"
git pull --ff-only >/dev/null 2>&1
check "pull correctly REFUSES a diverged tree" "1" "$([ $? -ne 0 ] && echo 1 || echo 0)"
ahead=$(git log --oneline @{u}..HEAD 2>/dev/null | head -3 | tr '\n' ' ')
check "the local commit is nameable for the mail" "true" \
  "$([ -n "$ahead" ] && echo true || echo false)"

echo
echo "passed $pass, failed $fail"
[ "$fail" -eq 0 ]
