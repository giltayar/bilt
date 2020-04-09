//@ts-check
'use strict'
const path = require('path')
const debug = require('debug')('bilt:cli:build')
const {findNpmPackageInfos, findNpmPackages} = require('@bilt/npm-packages')
const {calculateBuildOrder, build} = require('@bilt/build')
const {calculatePackagesToBuild} = require('@bilt/packages-to-build')
const {
  findChangedFiles,
  findLatestPackageChanges,
  FAKE_COMMITISH_FOR_UNCOMMITED_FILES,
} = require('@bilt/git-packages')
const applitoolsBuild = require('./package-build')
const {sh, shWithOutput} = require('@bilt/scripting-commons')

/**@param {{
 * rootDirectory: import('@bilt/types').Directory
 * packages: string[]
 * upto: string[]
 * force: boolean
 * dryRun: boolean
 * message: string
 * }} param*/
async function buildCommand({
  rootDirectory,
  packages: packageDirectories,
  upto,
  force,
  dryRun,
  message,
}) {
  debug(`starting build of ${rootDirectory}`)
  const initialSetOfPackagesToBuild = (packageDirectories || []).map((pd) => ({
    directory: /**@type {import('@bilt/types').RelativeDirectoryPath}*/ (pd),
  }))
  const uptoPackages =
    upto &&
    upto.map((pd) => ({
      directory: /**@type {import('@bilt/types').RelativeDirectoryPath}*/ (pd),
    }))
  const {packagesToBuild, packageInfos} = await determineBuildInformation(
    rootDirectory,
    initialSetOfPackagesToBuild,
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
  debug(`determined final list of packages to build`, Object.keys(finalPackagesToBuild))

  const packagesBuildOrder = []
  const aPackageWasBuilt = await buildPackages(
    finalPackagesToBuild,
    dryRun
      ? async ({packageInfo}) => {
          packagesBuildOrder.push(packageInfo.directory)
          return 'success'
        }
      : applitoolsBuild(rootDirectory),
    rootDirectory,
    dryRun,
  )

  if (dryRun) {
    console.log(packagesBuildOrder.join(', '))
    return
  }

  if (aPackageWasBuilt) {
    debug('commiting packages')
    await sh(`git commit -m '${message}\n\n\n[bilt-artifacts]\n'`, {cwd: rootDirectory})

    debug('pushing')
    await sh('git push', {cwd: rootDirectory})
  }
}

/**@returns {Promise<{
 * packageInfos: import('@bilt/types').PackageInfos,
 * packagesToBuild: import('@bilt/types').Package[],
 * }>} */
async function determineBuildInformation(
  /**@type {import('@bilt/types').Directory} */ rootDirectory,
  /**@type {import('@bilt/types').Package[]} */ initialSetOfPackagesToBuild,
  /**@type {boolean} */ force,
) {
  const packages = await findNpmPackages({rootDirectory})
  const packageInfos = await findNpmPackageInfos({rootDirectory, packages})

  if (force) {
    return {packageInfos, packagesToBuild: initialSetOfPackagesToBuild}
  }

  const changedFilesInGit = await findChangedFiles({rootDirectory})
  const tentativeChangedPackages = findLatestPackageChanges({
    changedFilesInGit,
    packages,
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
      const error = buildPackageResult.error

      console.error(
        `************** Building package ${buildPackageResult.package.directory} failed: `,
        error.stack || error.toString(),
      )
    } else if (buildPackageResult.buildResult === 'success') {
      aPackageWasBuilt = true
      if (!dryRun) {
        debug('adding', packageDirectory, 'to git')
        await sh(`git add .`, {cwd: packageDirectory})
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
 */
function filterPackageInfos(packageInfos, initialSetOfPackagesToBuild) {
  //@ts-ignore
  return Object.fromEntries(
    Object.entries(packageInfos).filter(([directory]) =>
      initialSetOfPackagesToBuild.some(({directory: d2}) => d2 === directory),
    ),
  )
}

module.exports = buildCommand
