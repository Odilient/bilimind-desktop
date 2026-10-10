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
- **Not done:** not registered in the real `my-experts` folder (the orchestrator does that), and not
  run inside WorkBuddy yet (open questions T1-T5 in hackathon/EXPERT-TEAM.md section 8).
- **Next:** after WP6's final bundle, run `--team` again. Then copy this folder to
  `%USERPROFILE%\.workbuddy-ai\plugins\marketplaces\my-experts\plugins\bilimind-crew` and register
  it from inside WorkBuddy (EXPERT-TEAM.md steps B-E).
