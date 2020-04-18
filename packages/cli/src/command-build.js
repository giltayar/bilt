//@ts-check
'use strict'
const path = require('path')
const debug = require('debug')('bilt:cli:build')
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

/**@param {{
 * jobId: string,
 * rootDirectory: import('@bilt/types').Directory
 * packagesToBuild: string[]
 * packages: string[]
 * upto: string[]
 * force: boolean
 * dryRun: boolean
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
  jobConfiguration,
  ...userBuildOptions
}) {
  debug(`starting build of ${rootDirectory}`)
  /**@type {typeof userBuildOptions} */
  const buildOptions = {
    ...userBuildOptions,
    message: userBuildOptions.message + '\n\n\n[bilt-artifacts]',
  }

  const {
    initialSetOfPackagesToBuild,
    uptoPackages,
    packageInfos,
  } = await findInitialSetOfPackagesToBuild(rootDirectory, packages, packagesToBuild, upto)
  const {basePackagesToBuild} = await determineBuildInformation(
    rootDirectory,
    initialSetOfPackagesToBuild,
    packageInfos,
    force,
  )
  debug(
    `determined packages to build`,
    basePackagesToBuild.map((pkg) => pkg.directory),
  )

  const finalPackagesToBuild = calculatePackagesToBuild({
    packageInfos,
    basePackagesToBuild,
    buildUpTo: uptoPackages,
  })

  if (Object.keys(finalPackagesToBuild).length === 0) {
    o.globalFooter('nothing to build')
    return
  }

  if (!dryRun) {
    o.globalHeader(`building ${Object.keys(finalPackagesToBuild).join(', ')}`)
    for await (const stepInfo of executeJob(
      jobConfiguration,
      'before',
      rootDirectory,
      buildOptions,
      {directory: rootDirectory, biltin: {...npmBiltin}},
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
      : makePackageBuild(jobConfiguration, rootDirectory, buildOptions),
    dryRun,
  )

  if (dryRun) {
    console.log(packagesBuildOrder.join(', '))
    return
  }

  try {
    if (succesful.length > 0) {
      for await (const stepInfo of executeJob(
        jobConfiguration,
        'after',
        rootDirectory,
        buildOptions,
        {directory: rootDirectory, biltin: {...npmBiltin}},
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

/**@returns {Promise<{
 * packageInfos: import('@bilt/types').PackageInfos,
 * basePackagesToBuild: import('@bilt/types').Package[],
 * }>} */
async function determineBuildInformation(
  /**@type {import('@bilt/types').Directory} */ rootDirectory,
  /**@type {import('@bilt/types').Package[]} */ initialSetOfPackagesToBuild,
  /**@type {import('@bilt/types').PackageInfos} */ packageInfos,
  /**@type {boolean} */ force,
) {
  if (force) {
    return {packageInfos, basePackagesToBuild: initialSetOfPackagesToBuild}
  }

  const changedFilesInGit = await findChangedFiles({rootDirectory})
  const tentativeChangedPackages = findLatestPackageChanges({
    changedFilesInGit,
    packages: initialSetOfPackagesToBuild,
  })
  const changedPackages = force
    ? tentativeChangedPackages
    : await filterOutPackagesThatWereAlreadyBuilt(tentativeChangedPackages, rootDirectory)

  return {
    packageInfos,
    basePackagesToBuild: changedPackages.map(({package: pkg}) => pkg),
  }
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
 * @param {import('@bilt/git-packages').PackageChange[]} changedPackages
 * @param {import('@bilt/types').Directory} rootDirectory
 * @returns {Promise<import('@bilt/git-packages').PackageChange[]>}
 */
async function filterOutPackagesThatWereAlreadyBuilt(changedPackages, rootDirectory) {
  return (
    await Promise.all(
      changedPackages.map(async ({package: pkg, commit}) => {
        if (commit === FAKE_COMMITISH_FOR_UNCOMMITED_FILES) {
          return {package: pkg, commit, isBuild: false}
        }
        const stdout = await shWithOutput(`git show --format=%B -s ${commit}`, {cwd: rootDirectory})

        if (stdout.includes('[bilt-artifacts]')) {
          return {package: pkg, commit, isBuild: true}
        } else {
          return {package: pkg, commit, isBuild: false}
        }
      }),
    )
  ).filter((x) => !x.isBuild)
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

  return {initialSetOfPackagesToBuild, uptoPackages, packageInfos}
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
      {directory: packageDirectory, biltin: {...npmBiltin}},
    )) {
      o.packageOperation(stepInfo.name, packageInfo)
    }

    return 'success'
  }
}

module.exports = buildCommand
