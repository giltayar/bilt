//@ts-check
'use strict'
const path = require('path')
const {promisify} = require('util')
const {exec} = require('child_process')
const {findNpmPackageInfos, findNpmPackages} = require('@bilt/npm-packages')
const {
  loadCommitsOfLastSuccesfulBuilds,
  calculateBuildOrder,
  saveCommitOfLastSuccesfulBuild,
  build,
} = require('@bilt/build')
const {calculatePackagesToBuild} = require('@bilt/packages-to-build')
const {findChangedFiles, findChangedPackages} = require('@bilt/git-packages')
const applitoolsBuild = require('./applitools-build')

async function buildCommand(
  /**@type {{rootDirectory: import('@bilt/types').Directory, packages: string[], upto: [], force: boolean, dryRun: boolean}}*/ {
    rootDirectory,
    packages,
    upto,
    force,
    dryRun,
  },
) {
  const {changedPackages, packageInfos, commit} = await determineBuildInformation(rootDirectory)

  const packagesToBuild = force
    ? await findNpmPackageInfos({
        rootDirectory,
        packages: packages.map((pkg) => ({
          directory: /**@type {import('@bilt/types').RelativeDirectoryPath}*/ (pkg),
        })),
      })
    : calculatePackagesToBuild({
        packageInfos,
        basePackagesToBuild: changedPackages,
        buildUpTo: upto,
      })

  const packagesBuildOrder = []
  await buildPackages(
    packagesToBuild,
    packageInfos,
    dryRun
      ? /**@type {import('@bilt/build').BuildPackageFunction} */ async ({packageInfo}) => {
          packagesBuildOrder.push(packageInfo.directory)
          return /**@type {import('@bilt/build').BuildPackageSuccessResult} */ 'success'
        }
      : applitoolsBuild(rootDirectory),
    rootDirectory,
    commit,
    dryRun,
  )

  if (dryRun) {
    console.log(packagesBuildOrder.join(', '))
  }
}

async function determineBuildInformation(
  /**@type import('@bilt/types').Directory */ rootDirectory,
) {
  const {stdout} = await promisify(exec)('git rev-parse HEAD', {cwd: rootDirectory})
  const toCommit = /**@type {import('@bilt/types').Commitish}*/ (stdout.trim())

  const packages = await findNpmPackages({rootDirectory})
  const packageInfos = await findNpmPackageInfos({rootDirectory, packages})
  const lastSuccesfulBuildOfPackages = await loadCommitsOfLastSuccesfulBuilds({
    rootDirectory: /**@type {import('@bilt/types').Directory}*/ (path.join(rootDirectory, '.bilt')),
    packages,
  })

  const changedFilesInGit = await findChangedFiles({rootDirectory})
  const changedPackages = findChangedPackages({changedFilesInGit, lastSuccesfulBuildOfPackages})

  return {packageInfos, changedPackages, commit: toCommit}
}

async function buildPackages(
  /**@type {import('@bilt/types').PackageInfos} */ packagesToBuild,
  /**@type {import('@bilt/types').PackageInfos} */ packageInfos,
  /**@type {import('@bilt/build').BuildPackageFunction} */ buildPackageFunc,
  /**@type {import('@bilt/types').Directory} */ rootDirectory,
  /**@type {import('@bilt/types').Commitish}*/ commit,
  /**@type {boolean}*/ dryRun,
) {
  const buildOrder = calculateBuildOrder({packageInfos: packagesToBuild})
  for await (const buildPackageResult of build({packageInfos, buildOrder, buildPackageFunc})) {
    if (buildPackageResult.buildResult === 'failure') {
      const error = buildPackageResult.error

      console.error(
        `************** Building package ${buildPackageResult.package.directory} failed: `,
        error.stack || error.toString(),
      )
    }
    if (!dryRun)
      await saveCommitOfLastSuccesfulBuild({
        rootDirectory: /**@type import('@bilt/types').Directory */ (path.join(
          rootDirectory,
          '.bilt',
        )),
        buildPackageResult,
        commit,
      })
  }
}

module.exports = buildCommand
