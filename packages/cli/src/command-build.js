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
const makePackageBuild = require('./package-build')
const {shWithOutput} = require('@bilt/scripting-commons')
const o = require('./outputting')

/**@param {{
 * rootDirectory: import('@bilt/types').Directory
 * packagesToBuild: string[]
 * packages: string[]
 * upto: string[]
 * force: boolean
 * dryRun: boolean
 * buildConfiguration: object
 * } & {[x: string]: string|boolean}} options
 */
async function buildCommand({
  rootDirectory,
  packagesToBuild,
  packages,
  upto,
  force,
  dryRun,
  buildConfiguration,
  ...buildOptions
}) {
  debug(`starting build of ${rootDirectory}`)

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

  const finalPackagesToBuild = force
    ? filterPackageInfos(packageInfos, initialSetOfPackagesToBuild)
    : calculatePackagesToBuild({
        packageInfos,
        basePackagesToBuild,
        buildUpTo: force ? undefined : uptoPackages,
      })

  o.globalHeader(`building ${Object.keys(finalPackagesToBuild).join(', ')}`)

  if (!dryRun && buildOptions.pull) {
    for await (const stepInfo of executeJob(
      buildConfiguration['build'],
      'before',
      rootDirectory,
      buildOptions,
    )) {
      o.globalOperation(stepInfo.name)
    }
  }

  const packagesBuildOrder = []
  const aPackageWasBuilt = await buildPackages(
    finalPackagesToBuild,
    dryRun
      ? async ({packageInfo}) => {
          packagesBuildOrder.push(packageInfo.directory)
          return 'success'
        }
      : makePackageBuild(buildConfiguration, rootDirectory, buildOptions),
    dryRun,
  )

  if (dryRun) {
    console.log(packagesBuildOrder.join(', '))
    return
  }

  if (aPackageWasBuilt) {
    for await (const stepInfo of executeJob(
      buildConfiguration['build'],
      'after',
      rootDirectory,
      buildOptions,
    )) {
      o.globalOperation(stepInfo.name)
    }
  } else if (Object.keys(finalPackagesToBuild).length === 0) {
    o.globalFooter('nothing to build')
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
  const changedPackages = await filterOutPackagesThatWereAlreadyBuilt(
    tentativeChangedPackages,
    rootDirectory,
  )

  return {
    packageInfos,
    basePackagesToBuild: changedPackages.map(({package: pkg}) => pkg),
  }
}

/**@returns {Promise<boolean>} */
async function buildPackages(
  /**@type {import('@bilt/types').PackageInfos} */ packageInfosToBuild,
  /**@type {import('@bilt/build').BuildPackageFunction} */ buildPackageFunc,
  /**@type {boolean}*/ dryRun,
) {
  const buildOrder = calculateBuildOrder({packageInfos: packageInfosToBuild})

  debug('starting build')
  let aPackageWasBuilt = false
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
      o.packageErrorFooter(
        'build package failed',
        packageInfosToBuild[buildPackageResult.package.directory],
        buildPackageResult.error,
      )
    } else if (buildPackageResult.buildResult === 'success') {
      aPackageWasBuilt = true
      if (!dryRun) {
        o.packageFooter(
          'build package succeeded',
          packageInfosToBuild[buildPackageResult.package.directory],
        )
      }
    }
  }

  return aPackageWasBuilt
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
 *
 * @param {import('@bilt/types').PackageInfos} packageInfos
 * @param {import('@bilt/types').Package[]} initialSetOfPackagesToBuild
 * @returns {import('@bilt/types').PackageInfos}
 */
function filterPackageInfos(packageInfos, initialSetOfPackagesToBuild) {
  //@ts-ignore
  return Object.fromEntries(
    Object.entries(packageInfos).filter(([directory]) =>
      initialSetOfPackagesToBuild.some(({directory: d2}) => d2 === directory),
    ),
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

module.exports = buildCommand
