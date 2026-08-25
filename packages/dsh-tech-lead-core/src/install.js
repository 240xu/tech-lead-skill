/**
 * Install drift audit over caller-supplied listings. Pure function.
 * Hash comparison lives in bin/install.js --check; this module does set math.
 *
 * @param {{version: string, files: string[]}} manifest
 * @param {string[]} actualFiles all files present under target (relative, posix)
 * @param {string[]} pkgFiles managed files in the current package
 * @param {string} pkgVersion
 * @returns {{
 *   missingManaged: string[],
 *   unmanaged: string[],
 *   versionMismatch: boolean,
 *   newInPackage: string[],
 * }}
 */
export function installAudit(manifest, actualFiles, pkgFiles, pkgVersion) {
  const managedSet = new Set(manifest?.files ?? []);
  const actualSet = new Set(actualFiles ?? []);
  const isBackup = (rel) => /\.bak-\d+(?:-\d+)?$/.test(rel);

  const missingManaged = (manifest?.files ?? []).filter((f) => !actualSet.has(f));
  const unmanaged = (actualFiles ?? []).filter((f) => !managedSet.has(f) && !isBackup(f)).sort();
  const newInPackage = (pkgFiles ?? []).filter((f) => !managedSet.has(f));

  return {
    missingManaged,
    unmanaged,
    versionMismatch: Boolean(manifest && pkgVersion && manifest.version !== pkgVersion),
    newInPackage,
  };
}
