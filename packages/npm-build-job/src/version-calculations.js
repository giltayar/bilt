'use strict'

function calculateCurrentPublished(version, publishedVersions) {
  const publishedVersionsOfMinorBranch = findPublishedVersionsOfMinorBranch(
    publishedVersions,
    majorMinorVersionOf(version),
  )

  const currentPatchVersion =
    publishedVersionsOfMinorBranch.length > 0
      ? patchVersionOf(publishedVersionsOfMinorBranch[publishedVersionsOfMinorBranch.length - 1]) ||
        0
      : patchVersionOf(version) || 0

  const versionFields = version.split(/[\.\-]/)

  versionFields[1] = versionFields[1] || 0
  versionFields[2] = Math.max(patchVersionOf(version), currentPatchVersion)

  const currentVersion = fieldsToVersion(versionFields)
  return publishedVersions.indexOf(currentVersion) > -1 && currentVersion
}

function calculateNextVersionPackage(version, publishedVersions) {
  const publishedVersionsOfMinorBranch = findPublishedVersionsOfMinorBranch(
    publishedVersions,
    majorMinorVersionOf(version),
  )

  const nextPatchVersion =
    publishedVersionsOfMinorBranch.length > 0
      ? (patchVersionOf(
          publishedVersionsOfMinorBranch[publishedVersionsOfMinorBranch.length - 1],
        ) || 0) + 1
      : patchVersionOf(version) || 0

  const versionFields = version.split(/[\.\-]/)

  versionFields[1] = versionFields[1] || 0
  versionFields[2] = Math.max(patchVersionOf(version), nextPatchVersion)

  return fieldsToVersion(versionFields)
}

function fieldsToVersion(versionFields) {
  return (
    versionFields[0] +
    '.' +
    versionFields[1] +
    '.' +
    versionFields[2] +
    (versionFields[3] ? '-' + versionFields[3] : '')
  )
}

function findPublishedVersionsOfMinorBranch(publishedVersions, minorVersion) {
  return publishedVersions.filter(
    publishedVersion => majorMinorVersionOf(publishedVersion) === minorVersion,
  )
}

function majorMinorVersionOf(version) {
  const versionFields = version.split(/[\.\-]/)

  if (versionFields.length >= 1)
    return take(versionFields, Math.min(versionFields.length, 2)).join('.')
  else return undefined
}

function patchVersionOf(version) {
  const versionFields = version.split(/[\.\-]/)

  if (versionFields.length >= 2) return parseInt(versionFields[2])
  else return undefined
}

function take(array, lengthToTake) {
  const ret = []

  for (let i = 0; i < Math.min(array.length, lengthToTake); ++i) {
    ret.push(array[i])
  }

  return ret
}

module.exports = {
  calculateCurrentPublished,
  calculateNextVersionPackage,
}
