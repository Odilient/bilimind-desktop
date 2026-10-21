abi <abi/4.0>,
include <tunables/global>

# Installed by the .deb so Chromium may use user namespaces on Ubuntu 24.04+. It attaches to the launcher and to
# the Electron binary behind it (scripts/after-pack.cjs renames the binary to <name>.bin).
profile "${executable}" "/opt/${sanitizedProductName}/${executable}{,.bin}" flags=(unconfined) {
  userns,

  # Site-specific additions and overrides. See local/README for details.
  include if exists <local/${executable}>
}
