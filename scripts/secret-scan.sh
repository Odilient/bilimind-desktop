#!/usr/bin/env bash
# Fails when a file holds a secret-like string or one of the real keys on this computer (values never printed).
#   bash scripts/secret-scan.sh TEXT_FILE [ENV_FILE]
set -euo pipefail
if grep -nE '(sk-or-v1-[A-Za-z0-9]{20,}|sk-[A-Za-z0-9]{32,}|AIza[0-9A-Za-z_-]{30,}|AQ\.[A-Za-z0-9_-]{30,}|glpat-[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|(OPENROUTER|DEEPSEEK|YOUTUBE|GEMINI)_API_KEY="?[A-Za-z0-9_-]{20,})' "$1" | cut -c1-80 | head -5 | grep .; then
  echo "SECRET-LIKE STRING FOUND: stopping" >&2
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
if(hit){console.error("REAL KEY FOUND IN THE TEXT ("+hit+"): stopping");process.exit(1);}
console.log("real-key check: clean ("+keys.size+" keys checked)");
' "$1" "${2:-}"
