//@ts-check
'use strict'
const path = require('path')
const debug = require('debug')('bilt:cli:build')
const {findNpmPackages, findNpmPackageInfos} = require('@bilt/npm-packages')
const {calculateBuildOrder, build} = require('@bilt/build')
const {calculatePackagesToBuild} = require('@bilt/packages-to-build')
const {
  findChangedFiles,
  findLatestPackageChanges,
  FAKE_COMMITISH_FOR_UNCOMMITED_FILES,
} = require('@bilt/git-packages')
const buildPackage = require('./package-build')
const {sh, shWithOutput} = require('@bilt/scripting-commons')
const o = require('./outputting')

/**
 * @typedef {{
 * pull: boolean
 * push: boolean
 * commit: boolean
 * install: boolean
 * update: boolean
 * audit: boolean
 * build: boolean
 * test: boolean
 * publish: boolean
 * }} BuildOptions
 */

/**@param {{
 * rootDirectory: import('@bilt/types').Directory
 * packages: string[]
 * upto: string[]
 * force: boolean
 * dryRun: boolean
 * message: string
 * } & BuildOptions} options
 */
async function buildCommand({
  rootDirectory,
  packages,
  upto,
  force,
  dryRun,
  message,
  pull,
  push,
  commit,
  install,
  update,
  audit,
  build,
  test,
  publish,
}) {
  debug(`starting build of ${rootDirectory}`)
  const buildOptions = {pull, push, commit, install, update, audit, build, test, publish}

  const {
    initialSetOfPackagesToBuild,
    uptoPackages,
    packageInfos,
  } = await findInitialSetOfPackagesToBuild(rootDirectory, packages, upto)
  const {packagesToBuild} = await determineBuildInformation(
    rootDirectory,
    initialSetOfPackagesToBuild,
    packageInfos,
    force,
  )
  debug(
    `determined packages to build`,
    packagesToBuild.map((pkg) => pkg.directory),
  )

  const finalPackagesToBuild = force
    ? filterPackageInfos(packageInfos, initialSetOfPackagesToBuild)
    : calculatePackagesToBuild({
        packageInfos,
        basePackagesToBuild: packagesToBuild,
        buildUpTo: force ? undefined : uptoPackages,
      })

  o.globalHeader(`building ${Object.keys(finalPackagesToBuild).join(', ')}`)

  if (!dryRun && buildOptions.pull) {
    o.globalOperation(`pulling commits from remote`)
    await sh('git pull --rebase --autostash', {cwd: rootDirectory})
  }

  const packagesBuildOrder = []
  const aPackageWasBuilt = await buildPackages(
    finalPackagesToBuild,
    dryRun
      ? async ({packageInfo}) => {
          packagesBuildOrder.push(packageInfo.directory)
          return 'success'
        }
      : buildPackage(rootDirectory, buildOptions),
    rootDirectory,
    dryRun,
    buildOptions,
  )

  if (dryRun) {
    console.log(packagesBuildOrder.join(', '))
    return
  }

  if (aPackageWasBuilt) {
    if (buildOptions.commit) {
      o.globalOperation('commiting packages')
      await sh(`git commit --allow-empty -m '${message}\n\n\n[bilt-artifacts]\n'`, {
        cwd: rootDirectory,
      })
    }

    if (buildOptions.push) {
      o.globalOperation('pulling again to push')
      await sh('git pull --rebase --autostash', {cwd: rootDirectory})
      o.globalOperation('pushing commits to remote')
      await sh('git push', {cwd: rootDirectory})
    }
  } else if (Object.keys(finalPackagesToBuild).length === 0) {
    o.globalFooter('nothing to build')
  }
}

/**@returns {Promise<{
 * packageInfos: import('@bilt/types').PackageInfos,
 * packagesToBuild: import('@bilt/types').Package[],
 * }>} */
async function determineBuildInformation(
  /**@type {import('@bilt/types').Directory} */ rootDirectory,
  /**@type {import('@bilt/types').Package[]} */ initialSetOfPackagesToBuild,
  /**@type {import('@bilt/types').PackageInfos} */ packageInfos,
  /**@type {boolean} */ force,
) {
  if (force) {
    return {packageInfos, packagesToBuild: initialSetOfPackagesToBuild}
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
    packagesToBuild: changedPackages.map(({package: pkg}) => pkg),
  }
}

/**@returns {Promise<boolean>} */
async function buildPackages(
  /**@type {import('@bilt/types').PackageInfos} */ packageInfosToBuild,
  /**@type {import('@bilt/build').BuildPackageFunction} */ buildPackageFunc,
  /**@type {import('@bilt/types').Directory} */ rootDirectory,
  /**@type {boolean}*/ dryRun,
  /**@type {BuildOptions} */ buildOptions,
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
    const packageDirectory = path.join(rootDirectory, buildPackageResult.package.directory)
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
        if (buildOptions.commit) {
          debug('adding', packageDirectory, 'to git')
          await sh(`git add .`, {cwd: packageDirectory})
        }
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
  uptoDirectoriesOrPackageNames,
) {
  const findAllPackages =
    !packagesDirectories ||
    packagesDirectories.length === 0 ||
    packagesDirectories.some((d) => d === '*')
  const hasPackageNames =
    packagesDirectories && packagesDirectories.some(directoryIsActuallyPackageName)

  const allPackagesInRoot =
    findAllPackages || hasPackageNames ? await findNpmPackages({rootDirectory}) : undefined

  if (findAllPackages || hasPackageNames) {
    const packageInfos = await findNpmPackageInfos({
      rootDirectory,
      packages: allPackagesInRoot,
    })

    const packages = findAllPackages
      ? allPackagesInRoot
      : convertUserPackagesToPackages(packagesDirectories, packageInfos, rootDirectory)

    const uptoPackages = convertUserPackagesToPackages(
      uptoDirectoriesOrPackageNames,
      packageInfos,
      rootDirectory,
    )

    return {initialSetOfPackagesToBuild: packages, uptoPackages, packageInfos}
  } else {
    const packages = packagesDirectories.map((
      /**@type{import('@bilt/types').RelativeDirectoryPath}*/ directory,
    ) => ({directory}))

    const packageInfos = await findNpmPackageInfos({
      rootDirectory,
      packages,
    })

    const uptoPackages = convertUserPackagesToPackages(
      packagesDirectories,
      packageInfos,
      rootDirectory,
    )

    return {initialSetOfPackagesToBuild: packages, uptoPackages, packageInfos}
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
    : directoriesOrPackageNames.map((d) => {
        if (directoryIsActuallyPackageName(d)) {
          const packageInfo = packageInfos[d]
          if (!packageInfo)
            throw new Error(
              `cannot find a package with the name ${d} in any packages in ${rootDirectory}`,
            )
          return {directory: packageInfo.directory}
        } else {
          return {directory: /**@type{import('@bilt/types').RelativeDirectoryPath}*/ (d)}
        }
      })
}

/**
 * @param {string} directory
 */
function directoryIsActuallyPackageName(directory) {
  return !directory.startsWith('.') && !directory.startsWith('/')
}

module.exports = buildCommand
