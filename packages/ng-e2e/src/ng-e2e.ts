import path from 'path'
import {promisify} from 'util'
import {exec} from 'child_process'
import {
  Directory,
  findNpmPackageInfos,
  findNpmPackages,
  RelativeDirectoryPath,
  PackageInfos,
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

export async function forceBuild(rootDirectory: Directory, buildPackageFunc: BuildPackageFunction) {
  const {packageInfos, commit} = await determineBuildInformation(rootDirectory)

  await buildPackages(packageInfos, packageInfos, buildPackageFunc, rootDirectory, commit)
}

export async function buildJustChangedPackages(
  rootDirectory: Directory,
  buildPackageFunc: BuildPackageFunction,
) {
  const {changedPackages, packageInfos, commit} = await determineBuildInformation(rootDirectory)

  const packagesToBuild = calculatePackagesToBuild({
    packageInfos,
    basePackagesToBuild: changedPackages,
    buildUpTo: undefined,
  })

  await buildPackages(packagesToBuild, packageInfos, buildPackageFunc, rootDirectory, commit)
}

export async function buildUpTo(
  rootDirectory: Directory,
  upToPackages: RelativeDirectoryPath[],
  buildPackageFunc: BuildPackageFunction,
) {
  const {changedPackages, packageInfos, commit} = await determineBuildInformation(rootDirectory)

  const packagesToBuild = calculatePackagesToBuild({
    packageInfos,
    basePackagesToBuild: changedPackages,
    buildUpTo: upToPackages.map((upTo) => ({directory: upTo})),
  })

  await buildPackages(packagesToBuild, packageInfos, buildPackageFunc, rootDirectory, commit)
}

async function determineBuildInformation(rootDirectory: Directory) {
  const {stdout} = await promisify(exec)('git rev-parse HEAD', {cwd: rootDirectory as string})
  const toCommit = stdout.trim()

  const packages = await findNpmPackages({rootDirectory})
  const packageInfos = await findNpmPackageInfos({rootDirectory, packages})
  const lastSuccesfulBuildOfPackages = await loadCommitsOfLastSuccesfulBuilds({
    rootDirectory: path.join(rootDirectory as string, '.bilt'),
    packages,
  })

  const changedFilesInGit = await findChangedFiles({rootDirectory})
  const changedPackages = findChangedPackages({changedFilesInGit, lastSuccesfulBuildOfPackages})

  return {packageInfos, changedPackages, commit: toCommit}
}

async function buildPackages(
  packagesToBuild: PackageInfos,
  packageInfos: PackageInfos,
  buildPackageFunc: BuildPackageFunction,
  rootDirectory: Directory,
  commit: string,
) {
  const buildOrder = calculateBuildOrder({packageInfos: packagesToBuild})
  for await (const buildPackageResult of build({packageInfos, buildOrder, buildPackageFunc})) {
    console.log(
      `package ${buildPackageResult.package.directory} built: ${buildPackageResult.buildResult}${
        buildPackageResult.error ? '. Error: ' + buildPackageResult.error : ''
      }`,
    )
    await saveCommitOfLastSuccesfulBuild({
      rootDirectory: path.join(rootDirectory as string, '.bilt'),
      buildPackageResult,
      commit,
    })
  }
}
