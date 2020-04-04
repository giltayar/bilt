//@ts-check
'use strict'
const path = require('path')
const {findNpmPackageInfos, findNpmPackages} = require('@bilt/npm-packages')
const {calculateBuildOrder, build} = require('@bilt/build')
const {calculatePackagesToBuild} = require('@bilt/packages-to-build')
const {findChangedFiles, findLatestPackageChanges} = require('@bilt/git-packages')
const applitoolsBuild = require('./applitools-build')
const {sh, shWithOutput} = require('./sh')

/**@param {{
 * rootDirectory: import('@bilt/types').Directory
 * packageDirectories: string[]
 * upto: []
 * force: boolean
 * dryRun: boolean
 * message: string
 * }} param*/
async function buildCommand({rootDirectory, packageDirectories, upto, force, dryRun, message}) {
  const initialSetOfPackagesToBuild = packageDirectories.map((pd) => ({
    directory: /**@type {import('@bilt/types').RelativeDirectoryPath}*/ (pd),
  }))
  const {packagesToBuild, packageInfos} = await determineBuildInformation(
    rootDirectory,
    initialSetOfPackagesToBuild,
    force,
  )

  const finalPackagesToBuild = force
    ? filterPackageInfos(packageInfos, initialSetOfPackagesToBuild)
    : calculatePackagesToBuild({
        packageInfos,
        basePackagesToBuild: packagesToBuild,
        buildUpTo: force ? undefined : upto,
      })

  const packagesBuildOrder = []
  await buildPackages(
    finalPackagesToBuild,
    packageInfos,
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

  await sh(`git commit -m '${message}\n\n\n[bilt-artifacts]\n'`, {cwd: rootDirectory})
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

async function buildPackages(
  /**@type {import('@bilt/types').PackageInfos} */ packagesToBuild,
  /**@type {import('@bilt/types').PackageInfos} */ packageInfos,
  /**@type {import('@bilt/build').BuildPackageFunction} */ buildPackageFunc,
  /**@type {import('@bilt/types').Directory} */ rootDirectory,
  /**@type {boolean}*/ dryRun,
) {
  const buildOrder = calculateBuildOrder({packageInfos: packagesToBuild})

  for await (const buildPackageResult of build({packageInfos, buildOrder, buildPackageFunc})) {
    const packageDirectory = path.join(rootDirectory, buildPackageResult.package.directory)
    if (buildPackageResult.buildResult === 'failure') {
      const error = buildPackageResult.error

      console.error(
        `************** Building package ${buildPackageResult.package.directory} failed: `,
        error.stack || error.toString(),
      )
    }
    if (!dryRun) {
      await sh(`git add .`, {cwd: packageDirectory})
    }
  }
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
  return Object.fromEntries(
    Object.entries(packageInfos).filter(([directory]) =>
      initialSetOfPackagesToBuild.some(({directory: d2}) => d2 === directory),
    ),
  )
}

module.exports = buildCommand
