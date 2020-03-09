import path from 'path'
import {promisify} from 'util'
import {exec} from 'child_process'
import {
  Directory,
  findNpmPackageInfos,
  findNpmPackages,
  RelativeDirectoryPath,
} from '@bilt/ng-packages'
import {
  findChangedFiles,
  findChangedPackages,
  calculatePackagesToBuild,
} from '@bilt/ng-what-to-build'
import {
  loadCommitsOfLastSuccesfulBuilds,
  calculateBuildOrder,
  build,
  BuildPackageFunction,
  saveCommitOfLastSuccesfulBuild,
} from '@bilt/ng-build'

export async function buildJustChangedPackages(
  rootDirectory: Directory,
  buildPackageFunc: BuildPackageFunction,
) {
  const {changedPackages, packageInfos, commit} = await commonBuild(rootDirectory)

  const packagesToBuild = calculatePackagesToBuild({
    packageInfos,
    basePackagesToBuild: changedPackages,
    buildUpTo: [],
  })

  const buildOrder = calculateBuildOrder({packageInfos: packagesToBuild})

  for await (const buildPackageResult of build({packageInfos, buildOrder, buildPackageFunc})) {
    console.log(
      `package ${buildPackageResult.package} built: ${buildPackageResult.buildResult}${
        buildPackageResult.error ? '. Error: ' + buildPackageResult.error : ''
      }`,
    )
    await saveCommitOfLastSuccesfulBuild({rootDirectory, buildPackageResult, commit})
  }
}

export async function buildUpTo(
  rootDirectory: Directory,
  upToPackages: RelativeDirectoryPath[],
  buildPackageFunc: BuildPackageFunction,
) {
  const {changedPackages, packageInfos, commit} = await commonBuild(rootDirectory)

  const packagesToBuild = calculatePackagesToBuild({
    packageInfos,
    basePackagesToBuild: changedPackages,
    buildUpTo: upToPackages.map(upTo => ({directory: upTo})),
  })

  const buildOrder = calculateBuildOrder({packageInfos: packagesToBuild})

  for await (const buildPackageResult of build({packageInfos, buildOrder, buildPackageFunc})) {
    console.log(
      `package ${buildPackageResult.package} built: ${buildPackageResult.buildResult}${
        buildPackageResult.error ? '. Error: ' + buildPackageResult.error : ''
      }`,
    )
    await saveCommitOfLastSuccesfulBuild({rootDirectory, buildPackageResult, commit})
  }
}

async function commonBuild(rootDirectory: Directory) {
  const {stdout} = await promisify(exec)('git rev-parse HEAD')
  const toCommit = stdout.trim()

  const packages = await findNpmPackages({rootDirectory})
  const packageInfos = await findNpmPackageInfos({rootDirectory, packages})
  const packageSuccessfulCommits = await loadCommitsOfLastSuccesfulBuilds({
    rootDirectory: path.join(rootDirectory as string, '.bilt'),
    packages,
  })

  const changedFiles = (
    await Promise.all(
      packageSuccessfulCommits.map(packageSuccessfulCommit =>
        packageSuccessfulCommit?.commit
          ? findChangedFiles({rootDirectory, fromCommit: packageSuccessfulCommit.commit, toCommit})
          : undefined,
      ),
    )
  ).flat()

  const changedPackages = await findChangedPackages({changedFiles, packages})

  return {packageInfos, changedPackages, commit: toCommit}
}
