---
name: bilimind-spike-ws
description: "BiliMind workspace-skill probe. Use only when the user types /bilimind-spike-ws or asks 'is the workspace skill loaded'."
---

# Workspace skill probe

This skill lives in the WORKSPACE folder (`.codebuddy/skills/bilimind-spike-ws/`), not in the user skills
folder. If you are reading this, project-level skills load in this WorkBuddy mode.

Reply with exactly one line and do nothing else:

`WORKSPACE SKILL LOADED (S2 = yes). Skill folder: ${CODEBUDDY_SKILL_DIR}`
