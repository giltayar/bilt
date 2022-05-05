import {relative} from 'path'
import {findNpmPackageInfos} from '@bilt/npm-packages'
import {calculatePackagesToBuild} from '@bilt/packages-to-build'
import {shWithOutput} from '@bilt/scripting-commons'
import throat from 'throat'
import {
  findChangedFiles,
  findLatestPackageChanges,
  FAKE_COMMITISH_FOR_UNCOMMITED_FILES,
} from '@bilt/git-packages'
import debugMaker from 'debug'
const debug = debugMaker('bilt:cli:determine-packages-to-build')

/**
 * @typedef {import('@bilt/types').Package} Package
 * @typedef {import('@bilt/types').PackageInfo} PackageInfo
 * @typedef {import('@bilt/types').PackageInfos} PackageInfos
 */

/**
 * @param {{
 * rootDirectory: import('@bilt/types').Directory
 * packagesToBuild: string[]
 * packages: string[]
 * upto: string[]
 * force: boolean
 * }} options
 */
export async function determinePackagesToBuild({
  packagesToBuild,
  packages,
  upto,
  rootDirectory,
  force,
}) {
  const {initialSetOfPackagesToBuild, uptoPackages, packageInfos} = await extractPackageInfos(
    rootDirectory,
    packages,
    packagesToBuild,
    upto,
  )
  debug(
    `determined packages to build`,
    initialSetOfPackagesToBuild.map((pkg) => pkg.directory),
  )
  const changedPackageInfos = await determineChangedPackagesBuildInformation(
    rootDirectory,
    packageInfos,
    undefined,
    force,
  )

  const {packageInfosWithBuildTime: finalPackagesToBuild, warnings} = calculatePackagesToBuild({
    packageInfos: changedPackageInfos,
    basePackagesToBuild: initialSetOfPackagesToBuild,
    buildUpTo: uptoPackages || [],
  })

  return {packagesToBuild: finalPackagesToBuild, warnings}
}

/**@returns {Promise<import('@bilt/packages-to-build').PackageInfosWithBuildTime>} */
async function determineChangedPackagesBuildInformation(
  /**@type {import('@bilt/types').Directory} */ rootDirectory,
  /**@type {PackageInfos} */ packageInfos,
  /**@type {Package[] | undefined} */ checkOnlyThesePackages,
  /**@type {boolean} */ force,
) {
  const changedFilesInGit = await findChangedFiles({rootDirectory})
  const packageChanges = findLatestPackageChanges({
    changedFilesInGit,
    packages: checkOnlyThesePackages ? checkOnlyThesePackages : Object.values(packageInfos),
  })
  const changedPackageInfos = force
    ? makeAllPackagesDirty(packageInfos)
    : await addLastBuildTimeToPackageInfos(packageInfos, packageChanges, rootDirectory)

  return changedPackageInfos
}

/**
 *
 * @param {PackageInfos} packageInfos
 * @returns {import('@bilt/packages-to-build').PackageInfosWithBuildTime}
 */
function makeAllPackagesDirty(packageInfos) {
  // @ts-ignore
  return Object.fromEntries(
    Object.entries(packageInfos).map(([directory, pkgInfo]) => [
      directory,
      {...pkgInfo, lastBuildTime: undefined},
    ]),
  )
}

/**
 * @param {import('@bilt/types').Directory} rootDirectory
 * @param {string[]} packagesDirectories
 * @param {string[]} packagesToBuildDirectories
 * @param {string[]} uptoDirectoriesOrPackageNames
 * @returns {Promise<{
 * initialSetOfPackagesToBuild: Package[]
 * uptoPackages: Package[] | undefined
 * packageInfos: PackageInfos
 * }>}
 */
async function extractPackageInfos(
  rootDirectory,
  packagesDirectories,
  packagesToBuildDirectories,
  uptoDirectoriesOrPackageNames,
) {
  const packages = await convertDirectoriesToPackages(
    rootDirectory,
    packagesDirectories,
    packagesToBuildDirectories,
    uptoDirectoriesOrPackageNames,
  )

  if (packages.length === 0) {
    throw new Error('no packages to build')
  }

  const packageInfos = await findNpmPackageInfos({
    rootDirectory,
    packages,
  })

  const initialSetOfPackagesToBuild =
    !packagesToBuildDirectories || packagesToBuildDirectories.length === 0
      ? Object.values(packageInfos).map((p) => ({
          directory: p.directory,
        }))
      : convertUserPackagesToPackages(packagesToBuildDirectories, packageInfos, rootDirectory) || []
  const uptoPackages = convertUserPackagesToPackages(
    uptoDirectoriesOrPackageNames,
    packageInfos,
    rootDirectory,
  )

  return {
    initialSetOfPackagesToBuild,
    uptoPackages: uptoPackages === undefined ? initialSetOfPackagesToBuild : uptoPackages,
    packageInfos,
  }
}

/**
 * @param {string[]} directoriesOrPackageNames
 * @param {PackageInfos} packageInfos
 * @param {string} rootDirectory
 * @returns {Package[] | undefined}
 */
function convertUserPackagesToPackages(directoriesOrPackageNames, packageInfos, rootDirectory) {
  return directoriesOrPackageNames == null
    ? undefined
    : directoriesOrPackageNames.map((d) => {
        if (directoryIsActuallyPackageName(d)) {
          let packagesInfoEntry = Object.entries(packageInfos).filter(([, packageInfo]) =>
            packageInfo.name.includes(d),
          )
          if (packagesInfoEntry.length === 0) {
            throw new Error(
              `cannot find a package with the name "${d}" in any packages in ${rootDirectory}`,
            )
          } else if (packagesInfoEntry.length > 1) {
            const exactPackageInfoEntry = packagesInfoEntry.find(
              ([, packageInfo]) => packageInfo.name === d,
            )
            if (exactPackageInfoEntry === undefined) {
              throw new Error(
                `there are ${packagesInfoEntry.length} packages with the name "${d}" in any packages in ${rootDirectory}`,
              )
            } else {
              packagesInfoEntry = [exactPackageInfoEntry]
            }
          }
          return {
            directory: /**@type{import('@bilt/types').RelativeDirectoryPath}*/ (
              packagesInfoEntry[0][0]
            ),
          }
        } else {
          return {
            directory: /**@type{import('@bilt/types').RelativeDirectoryPath}*/ (
              relative(rootDirectory, d)
            ),
          }
        }
      })
}

/**
 * @param {string} directory
 */
function directoryIsActuallyPackageName(directory) {
  return !directory.startsWith('.') && !directory.startsWith('/')
}

/**
 * @param {string} rootDirectory
 * @param {string[][]} directoryPackages
 *
 * @returns {Promise<Package[]>}
 */
async function convertDirectoriesToPackages(rootDirectory, ...directoryPackages) {
  return [...new Set(directoryPackages.flat())]
    .filter((d) => !!d)
    .filter((d) => !directoryIsActuallyPackageName(d))
    .map((d) => ({
      directory: /**@type{import('@bilt/types').RelativeDirectoryPath}*/ (
        relative(rootDirectory, d)
      ),
    }))
}

/**
 *
 * @param {PackageInfos} packageInfos,
 * @param {import('@bilt/git-packages').PackageChange[]} packageChanges
 * @param {import('@bilt/types').Directory} rootDirectory
 * @returns {Promise<import('@bilt/packages-to-build').PackageInfosWithBuildTime>}
 */
async function addLastBuildTimeToPackageInfos(packageInfos, packageChanges, rootDirectory) {
  const dirtyInfo = new Map(
    //@ts-ignore
    await Promise.all(
      packageChanges.map(
        //@ts-ignore
        throat(20, async (packageChange) => {
          if (packageChange.commit === FAKE_COMMITISH_FOR_UNCOMMITED_FILES) {
            return [packageChange.package.directory, {...packageChange, isDirty: true}]
          }
          const stdout = await shWithOutput(`git show --format=%B -s ${packageChange.commit}`, {
            cwd: rootDirectory,
          })

          if (stdout.includes('[bilt-with-bilt]')) {
            return [packageChange.package.directory, {...packageChange, isDirty: false}]
          } else {
            return [packageChange.package.directory, {...packageChange, isDirty: true}]
          }
        }),
      ),
    ),
  )

  //@ts-ignore
  return Object.fromEntries(
    Object.entries(packageInfos).map(([directory, packageInfo]) => {
      const packageDirtyInfo = dirtyInfo.get(directory)

      if (packageDirtyInfo) {
        return [
          directory,
          {
            ...packageInfo,
            lastBuildTime: packageDirtyInfo.isDirty ? undefined : packageDirtyInfo.commitTime,
          },
        ]
      } else {
        return [directory, {...packageInfo, lastBuildTime: new Date()}]
      }
    }),
  )
}
