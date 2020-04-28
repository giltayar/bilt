'use strict'
const path = require('path')
const debug = require('debug')('bilt:cli:build')
const throat = require('throat')
const {findNpmPackages, findNpmPackageInfos} = require('@bilt/npm-packages')
const {calculateBuildOrder, build} = require('@bilt/build')
const {calculatePackagesToBuild} = require('@bilt/packages-to-build')
const {executeJob} = require('@bilt/build-with-configuration')
const {
  findChangedFiles,
  findLatestPackageChanges,
  FAKE_COMMITISH_FOR_UNCOMMITED_FILES,
} = require('@bilt/git-packages')
const {shWithOutput} = require('@bilt/scripting-commons')
const o = require('./outputting')
const npmBiltin = require('./npm-biltin')
const makeOptionsBiltin = require('./options-biltin')

/**@param {{
 * jobId: string,
 * rootDirectory: import('@bilt/types').Directory
 * packagesToBuild: string[]
 * packages: string[]
 * upto: string[]
 * force: boolean
 * dryRun: boolean
 * before: boolean|undefined
 * after: boolean|undefined
 * envelop: boolean|undefined
 * jobConfiguration: import('@bilt/build-with-configuration/src/types').Job
 * } & {[x: string]: string|boolean}} options
 */
async function buildCommand({
  rootDirectory,
  packagesToBuild,
  packages,
  upto,
  force,
  dryRun,
  before,
  after,
  jobConfiguration,
  ...userBuildOptions
}) {
  debug(`starting build of ${rootDirectory}`)
  /**@type {typeof userBuildOptions} */
  const buildOptions = {
    ...userBuildOptions,
    message: userBuildOptions.message + '\n\n\n[bilt-with-bilt]',
    force,
  }
  const biltin = {...npmBiltin, ...makeOptionsBiltin(buildOptions)}

  const {
    initialSetOfPackagesToBuild,
    uptoPackages,
    packageInfos,
  } = await findInitialSetOfPackagesToBuild(rootDirectory, packages, packagesToBuild, upto)
  debug(
    `determined packages to build`,
    initialSetOfPackagesToBuild.map((pkg) => pkg.directory),
  )
  const changedPackageInfos = await determineChangedPackagesBuildInformation(
    rootDirectory,
    packageInfos,
    samePackages(uptoPackages, initialSetOfPackagesToBuild)
      ? initialSetOfPackagesToBuild
      : undefined,
    force,
  )

  const finalPackagesToBuild = calculatePackagesToBuild({
    packageInfos: changedPackageInfos,
    basePackagesToBuild: initialSetOfPackagesToBuild,
    buildUpTo: uptoPackages,
  })

  if (Object.keys(finalPackagesToBuild).length === 0) {
    o.globalFooter('nothing to build')
    return
  }

  if (!dryRun) {
    o.globalHeader(`building ${Object.keys(finalPackagesToBuild).join(', ')}`)
    if (before)
      for await (const stepInfo of executeJob(
        jobConfiguration,
        'before',
        rootDirectory,
        buildOptions,
        {directory: rootDirectory, biltin},
      )) {
        o.globalOperation(stepInfo.name)
      }
  }

  const packagesBuildOrder = []
  const {succesful, failed} = await buildPackages(
    finalPackagesToBuild,
    dryRun
      ? async ({packageInfo}) => {
          packagesBuildOrder.push(packageInfo.directory)
          return 'success'
        }
      : makePackageBuild(jobConfiguration, rootDirectory, buildOptions, biltin),
    dryRun,
  )

  if (dryRun) {
    console.log(packagesBuildOrder.join(', '))
    return
  }

  try {
    if (succesful.length > 0 && after) {
      for await (const stepInfo of executeJob(
        jobConfiguration,
        'after',
        rootDirectory,
        buildOptions,
        {directory: rootDirectory, biltin},
      )) {
        o.globalOperation(stepInfo.name)
      }
    }
  } finally {
    if (failed.length > 0) {
      o.globalFailureFooter(
        `Some packages have failed to build`,
        failed.map((p) => packageInfos[p.directory]),
      )
    }
  }
}

function samePackages(packages1, packages2) {
  if (packages1.length !== packages2.length) {
    return false
  }

  const packages1Set = new Set(packages1.map((p) => p.directory))
  const packages2Set = new Set(packages2.map((p) => p.directory))

  return [...packages1Set.values()].every((p) => packages2Set.has(p))
}

/**@returns {Promise<import('@bilt/packages-to-build').PackageInfosWithBuildTime>} */
async function determineChangedPackagesBuildInformation(
  /**@type {import('@bilt/types').Directory} */ rootDirectory,
  /**@type {import('@bilt/types').PackageInfos} */ packageInfos,
  /**@type {import('@bilt/types').Package[]} */ checkOnlyThesePackages,
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
 * @param {import('@bilt/types').PackageInfos} packageInfos
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

/**@returns {Promise<{
 * succesful: import('@bilt/types').Package[],
 * failed: import('@bilt/types').Package[],
 * }>} */
async function buildPackages(
  /**@type {import('@bilt/types').PackageInfos} */ packageInfosToBuild,
  /**@type {import('@bilt/build').BuildPackageFunction} */ buildPackageFunc,
  /**@type {boolean}*/ dryRun,
) {
  const buildOrder = calculateBuildOrder({packageInfos: packageInfosToBuild})

  const ret = {succesful: [], failed: [], built: []}
  debug('starting build')
  for await (const buildPackageResult of build({
    packageInfos: packageInfosToBuild,
    buildOrder,
    buildPackageFunc,
  })) {
    debug(
      `build of ${buildPackageResult.package.directory} ended. result: ${
        buildPackageResult.buildResult
      }.${buildPackageResult.error ? 'Error: ' + buildPackageResult.error : ''}`,
    )
    if (buildPackageResult.buildResult === 'failure') {
      ret.failed.push(buildPackageResult.package)
      o.packageErrorFooter(
        'build package failed',
        packageInfosToBuild[buildPackageResult.package.directory],
        buildPackageResult.error,
      )
    } else if (buildPackageResult.buildResult === 'success') {
      ret.succesful.push(buildPackageResult.package)
      if (!dryRun) {
        o.packageFooter(
          'build package succeeded',
          packageInfosToBuild[buildPackageResult.package.directory],
        )
      }
    }
  }

  return ret
}

/**
 *
 * @param {import('@bilt/types').PackageInfos} packageInfos,
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

/**
 * @param {string[]} packagesDirectories
 * @param {string[]} packagesToBuildDirectories
 * @param {string[]} uptoDirectoriesOrPackageNames
 * @returns {Promise<{
 * initialSetOfPackagesToBuild: import('@bilt/types').Package[]
 * uptoPackages: import('@bilt/types').Package[] | undefined
 * packageInfos: import('@bilt/types').PackageInfos
 * }>}
 */
async function findInitialSetOfPackagesToBuild(
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
    throw new Error('no packages to build. You can let bilt autofind your packages using "*"')
  }

  const packageInfos = await findNpmPackageInfos({
    rootDirectory,
    packages,
  })

  const initialSetOfPackagesToBuild =
    !packagesToBuildDirectories ||
    packagesToBuildDirectories.length === 0 ||
    packagesToBuildDirectories[0] === '*'
      ? Object.values(packageInfos).map((p) => ({
          directory: p.directory,
        }))
      : convertUserPackagesToPackages(packagesToBuildDirectories, packageInfos, rootDirectory)
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
 * @param {import('@bilt/types').PackageInfos} packageInfos
 * @param {string} rootDirectory
 * @returns {import('@bilt/types').Package[]}
 */
function convertUserPackagesToPackages(directoriesOrPackageNames, packageInfos, rootDirectory) {
  return directoriesOrPackageNames == null
    ? undefined
    : directoriesOrPackageNames
        .filter((d) => d !== '*')
        .map((d) => {
          if (directoryIsActuallyPackageName(d)) {
            const packageInfoEntry = Object.entries(packageInfos).find(
              ([, packageInfo]) => d === packageInfo.name,
            )
            if (!packageInfoEntry)
              throw new Error(
                `cannot find a package with the name ${d} in any packages in ${rootDirectory}`,
              )
            return {
              directory: /**@type{import('@bilt/types').RelativeDirectoryPath}*/ (packageInfoEntry[0]),
            }
          } else {
            return {
              directory: /**@type{import('@bilt/types').RelativeDirectoryPath}*/ (path.relative(
                rootDirectory,
                d,
              )),
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
 */
async function convertDirectoriesToPackages(rootDirectory, ...directoryPackages) {
  const allDirectoryPackages = [].concat(...directoryPackages.filter((d) => !!d))

  const autoFoundPackages = allDirectoryPackages.some((d) => d === '*')
    ? await findNpmPackages({
        rootDirectory: /**@type{import('@bilt/types').Directory}*/ (rootDirectory),
      })
    : undefined

  const allDirectoryPackagesWithAutoFoundPackages = autoFoundPackages
    ? allDirectoryPackages
        .filter((d) => !directoryIsActuallyPackageName(d))
        .concat(autoFoundPackages.map((p) => path.resolve(rootDirectory, p.directory)))
    : allDirectoryPackages.filter((d) => !directoryIsActuallyPackageName(d))

  return [...new Set(allDirectoryPackagesWithAutoFoundPackages)].map((d) => ({
    directory: /**@type{import('@bilt/types').RelativeDirectoryPath}*/ (path.relative(
      rootDirectory,
      d,
    )),
  }))
}

/**@return {import('@bilt/build').BuildPackageFunction} */
function makePackageBuild(
  /**@type {import('@bilt/build-with-configuration/src/types').Job} */ jobConfiguration,
  /**@type {import('@bilt/types').Directory}*/ rootDirectory,
  /**@type {{[x: string]: string|boolean}} */ buildOptions,
  /**@type {object} */ biltin,
) {
  /**@type import('@bilt/build').BuildPackageFunction */
  return async function ({packageInfo}) {
    const packageDirectory = path.join(rootDirectory, packageInfo.directory)

    o.packageHeader('building', packageInfo)

    for await (const stepInfo of executeJob(
      jobConfiguration,
      'during',
      packageDirectory,
      buildOptions,
      {directory: packageDirectory, biltin},
    )) {
      o.packageOperation(stepInfo.name, packageInfo)
    }

    return 'success'
  }
}

module.exports = buildCommand
