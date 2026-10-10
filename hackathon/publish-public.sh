#!/usr/bin/env bash
# Publish a filtered copy of this repo to the public submission repo.
# Drops internal notes (plan/context) and another project's film code (plan/reference/film)
# from the WHOLE history, scans for secrets, then force-pushes main.
#   bash hackathon/publish-public.sh
set -euo pipefail
REPO="$(cd "$(dirname "$0")/.." && pwd)"
DEST="${PUBLIC_REMOTE:-ssh://git@altssh.gitlab.com:443/avinmaster/bilimind-workbuddy.git}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

git clone -q --no-local "$REPO" "$TMP/pub"
cd "$TMP/pub"
FILTER_BRANCH_SQUELCH_WARNING=1 git filter-branch -f --index-filter \
  'git rm -r -q --cached --ignore-unmatch plan/context plan/reference/film plan/opensource.md' -- main >/dev/null

# Secret scan over every blob in the rewritten history.
git log -p main > "$TMP/history.txt"
if grep -nE '(sk-or-v1-[A-Za-z0-9]{20,}|sk-[A-Za-z0-9]{32,}|AIza[0-9A-Za-z_-]{30,}|AQ\.[A-Za-z0-9_-]{30,}|glpat-[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9]{30,}|(OPENROUTER|DEEPSEEK|YOUTUBE|GEMINI)_API_KEY="?[A-Za-z0-9_-]{20,})' "$TMP/history.txt" | cut -c1-80 | head -5 | grep .; then
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
for p in plan/context plan/reference/film .env.local; do
  if git log main --oneline -- "$p" | grep -q .; then echo "still present in history: $p" >&2; exit 1; fi
done

git push -q --force "$DEST" main
echo "pushed $(git rev-parse --short main) to $DEST"
