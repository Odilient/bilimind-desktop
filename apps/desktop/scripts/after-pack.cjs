// electron-builder afterPack hook (Linux only): put a small launcher in front of the Electron binary.
// An AppImage cannot carry Chromium's setuid sandbox helper, and Ubuntu 24.04+ blocks the user-namespace sandbox for
// apps without an AppArmor profile, so Chromium aborts before any JavaScript runs. The launcher adds --no-sandbox in
// exactly that case (AppImage + restricted user namespaces). The .deb installs an AppArmor profile and keeps the sandbox.
const { chmodSync, renameSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');

const launcher = name => `#!/bin/sh
# BiliMind Desktop launcher (apps/desktop/scripts/after-pack.cjs)
here="$(dirname "$(readlink -f "$0")")"
if [ -n "$APPIMAGE" ] && [ "$(cat /proc/sys/kernel/apparmor_restrict_unprivileged_userns 2>/dev/null)" = "1" ]; then
  exec "$here/${name}.bin" --no-sandbox "$@"
fi
exec "$here/${name}.bin" "$@"
`;

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'linux') return;
  const name = context.packager.executableName || 'bilimind-desktop';
  const exe = join(context.appOutDir, name);
  renameSync(exe, `${exe}.bin`);
  writeFileSync(exe, launcher(name));
  chmodSync(exe, 0o755);
};
