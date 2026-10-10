#!/usr/bin/env bash
# Publish a filtered copy of this repo to the public GitHub repo.
# Drops internal notes (plan/context, plan/opensource.md) and another project's film code (plan/reference/film)
# from the WHOLE history, checks that every commit keeps its original author and committer dates, scans for
# secrets, then force-pushes main (and, with --tags, the tags, so a v0.1.0 tag triggers the release workflow).
#   bash hackathon/publish-public.sh            # main only
#   bash hackathon/publish-public.sh --tags     # main + all tags
set -euo pipefail
PUSH_TAGS=0
for a in "$@"; do
  case "$a" in
    --tags) PUSH_TAGS=1 ;;
    *) echo "unknown argument: $a (use --tags)" >&2; exit 2 ;;
  esac
done
REPO="$(cd "$(dirname "$0")/.." && pwd)"
DEST="${PUBLIC_REMOTE:-ssh://git@ssh.github.com:443/Odilient/bilimind-desktop.git}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

git clone -q --no-local "$REPO" "$TMP/pub"
cd "$TMP/pub"
git checkout -q main
REFS=(main)
if [ "$PUSH_TAGS" = 1 ]; then
  # local tags of the source repo (clone already copied them); make sure they are all here
  git fetch -q --tags "$REPO"
  REFS+=(--tags)
fi

# Commit timings before the rewrite: author and committer name, email and date (with zone) for every commit.
stamp() { git log --format='%an|%ae|%ad|%cn|%ce|%cd|%s' --date=raw "$@"; }
stamp main > "$TMP/dates-before.txt"

# --index-filter only touches the tree: filter-branch keeps GIT_AUTHOR_* and GIT_COMMITTER_* (names, emails,
# dates) from each original commit. No --env-filter, no --prune-empty, no rebase, no amend: nothing here
# rewrites a date. --tag-name-filter cat moves the tags onto the rewritten commits.
FILTER_BRANCH_SQUELCH_WARNING=1 git filter-branch -f \
  --index-filter 'git rm -r -q --cached --ignore-unmatch plan/context plan/reference/film plan/opensource.md' \
  --tag-name-filter cat -- "${REFS[@]}" >/dev/null

stamp main > "$TMP/dates-after.txt"
if ! cmp -s "$TMP/dates-before.txt" "$TMP/dates-after.txt"; then
  echo "COMMIT AUTHORS OR DATES CHANGED BY THE FILTER: not pushing" >&2
  diff "$TMP/dates-before.txt" "$TMP/dates-after.txt" | head -10 >&2 || true
  exit 1
fi
echo "commit timings preserved ($(wc -l < "$TMP/dates-after.txt") commits, author and committer dates identical)"

# Secret scan over every blob in the rewritten history (main and, with --tags, every tag).
git log -p "${REFS[@]}" > "$TMP/history.txt"
if grep -nE '(sk-or-v1-[A-Za-z0-9]{20,}|sk-[A-Za-z0-9]{32,}|AIza[0-9A-Za-z_-]{30,}|AQ\.[A-Za-z0-9_-]{30,}|glpat-[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|(OPENROUTER|DEEPSEEK|YOUTUBE|GEMINI)_API_KEY="?[A-Za-z0-9_-]{20,})' "$TMP/history.txt" | cut -c1-80 | head -5 | grep .; then
  echo "SECRET-LIKE STRING FOUND: not pushing" >&2
  exit 1
fi
# Exact real keys from the local config / .env.local (values never printed).
node -e '
const fs=require("fs"),os=require("os"),path=require("path");
const keys=new Set();
try{const c=JSON.parse(fs.readFileSync(path.join(os.homedir(),".bilimind","config.json"),"utf8"));Object.values(c.keys||{}).forEach(k=>k&&keys.add(k));}catch{}
try{fs.readFileSync(process.argv[2],"utf8").split(/\r?\n/).forEach(l=>{const m=l.match(/^[A-Z_]*_KEY=(.{16,})$/);if(m)keys.add(m[1].replace(/^"|"$/g,""));});}catch{}
const h=fs.readFileSync(process.argv[1],"utf8");
let hit=0; for(const k of keys){ if(k.length>=16 && h.includes(k)) hit++; }
if(hit){console.error("REAL KEY FOUND IN HISTORY ("+hit+"): not pushing");process.exit(1);}
console.log("real-key check: clean ("+keys.size+" keys checked)");
' "$TMP/history.txt" "$REPO/.env.local"
for p in plan/context plan/reference/film plan/opensource.md .env.local; do
  if git log "${REFS[@]}" --oneline -- "$p" | grep -q .; then echo "still present in history: $p" >&2; exit 1; fi
done

git push -q --force "$DEST" main
echo "pushed $(git rev-parse --short main) to $DEST (main)"
if [ "$PUSH_TAGS" = 1 ]; then
  if git tag | grep -q .; then
    git push -q --force "$DEST" --tags
    echo "pushed tags: $(git tag | tr '\n' ' ')"
  else
    echo "no tags to push"
  fi
fi
