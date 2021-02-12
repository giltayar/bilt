/**
 * @param {string} version
 * @param {string[]} publishedVersions
 */
export function calculateNextVersion(version, publishedVersions) {
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

  versionFields[1] = versionFields[1] || '0'
  versionFields[2] = String(Math.max(patchVersionOf(version) || 0, nextPatchVersion))

  return fieldsToVersion(versionFields)
}

/**
 * @param {string[]} versionFields
 */
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

/**
 * @param {string[]} publishedVersions
 * @param {string | undefined} minorVersion
 */
function findPublishedVersionsOfMinorBranch(publishedVersions, minorVersion) {
  return publishedVersions.filter(
    (publishedVersion) => majorMinorVersionOf(publishedVersion) === minorVersion,
  )
}

/**
 * @param {string} version
 */
function majorMinorVersionOf(version) {
  const versionFields = version.split(/[\.\-]/)

  if (versionFields.length >= 1)
    return take(versionFields, Math.min(versionFields.length, 2)).join('.')
  else return undefined
}

/**
 * @param {string} version
 */
function patchVersionOf(version) {
  const versionFields = version.split(/[\.\-]/)

  if (versionFields.length >= 2) {
    return parseInt(versionFields[2])
  } else {
    return undefined
  }
}

/**
 * @template T
 * @param {T[]} array
 * @param {number} lengthToTake
 */
function take(array, lengthToTake) {
  const ret = []

  for (let i = 0; i < Math.min(array.length, lengthToTake); ++i) {
    ret.push(array[i])
  }

  return ret
}
