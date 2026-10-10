# WP16 Expert Team "bilimind-crew": status

Full status (WP7 + WP16): `skills/bilimind/STATUS.md`. This file stays out of the team zip.

- **Works:** WorkBuddy's `validate_expert.py` passes with no warnings. A dry-run `register_expert.py`
  into a scratch config folder also succeeded. Agent IDs are unchanged from the spike:
  `bilimind-crew-team-lead`, `bilimind-writer`, `bilimind-coder`, `bilimind-checker`. Members:
  Dean Bilim (lead), Paige Turner, Ada Passmore, Vera Citewell. The category is `09-OperationsHR`
  (training: exam revision and staff onboarding). Avatars are 512x512 geometric cobalt/lime PNGs.
  The skill is bundled at `skills/bilimind` and declared in plugin.json.
- **Rebuild:** `node skills/bilimind/scripts/zip-skill.mjs --team` syncs the member playbooks from
  `skills/bilimind/references/*.md` and the skill copy, then writes `skills/dist/bilimind-crew.zip`.
  Avatars: `node workbuddy/bilimind-crew/avatars/src/make-avatars.mjs`.
- **Registered (10 October, real config):** copied to `C:/Users/User/.workbuddy-ai/plugins/marketplaces/my-experts/plugins/bilimind-crew`,
  validate_expert.py OK, register_expert.py --session-id dormathon-build OK from our own terminal
  (marketplace.json entry + .created-by-session); WorkBuddy adopted it into experts/custom/<user>/experts.json
  by itself, so it shows in My Experts (the app has since replaced the marker with
  .pending-preview-session). The skill is also installed at `C:/Users/User/.workbuddy-ai/skills/bilimind` (install.ps1).
- **Re-copy after any rebuild:** run `--team`, then copy again and re-run register (it updates in place).
- **Not yet run inside WorkBuddy:** no course has been built with the team inside WorkBuddy, so the parallel
  Agent spawns, TeamCreate + SendMessage to `team-lead` and present_files are untested.
