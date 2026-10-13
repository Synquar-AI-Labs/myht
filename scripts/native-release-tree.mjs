export function isReleaseTreeClean(status) {
  return status.split(/\r?\n/).filter(Boolean).every(line => line === ' M AGENTS.md');
}

export function assertReleaseBuild(receipt, head, status) {
  if (receipt.target !== 'staging' || receipt.head !== head) throw new Error('Build staging native assets from this commit first.');
  if (receipt.clean !== true || !isReleaseTreeClean(status)) throw new Error('Commit the work and rebuild staging assets before a release (AGENTS.md may remain modified).');
}
