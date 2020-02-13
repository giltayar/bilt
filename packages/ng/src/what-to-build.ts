import {promisify} from 'util'
import {execFile} from 'child_process'
import {Package, Commitish, PackageInfos, RelativeFilePath, Directory} from './package-types'
import {BuildPackageResult} from './build-types'

export async function findChangedFiles({
  rootDir,
  fromCommit,
  toCommit,
}: {
  rootDir: Directory
  fromCommit: Commitish
  toCommit: Commitish
}): Promise<RelativeFilePath[]> {
  const diffTreeResult = await promisify(execFile)(
    'git',
    ['diff-tree', '--no-commit-id', '--name-only', '-r', fromCommit as string, toCommit as string],
    {
      cwd: rootDir as string,
    },
  )

  const changedFiles = diffTreeResult.stdout.split('\n').filter(l => !!l)

  return [...new Set(changedFiles)]
}

export function findChangedPackages({
  changedFiles,
  packages,
}: {
  changedFiles: RelativeFilePath[]
  packages: Package[]
}): Package[] {
  return packages.filter(pkg => changedFiles.some(changedFile => changedFile.startsWith(pkg + '/')))
}

export function calculatePackagesToBuild({
  packages,
  changedPackages,
  buildResults,
  buildUpTo,
  shouldForceBuildAll,
}: {
  packages: PackageInfos
  changedPackages: Package[]
  buildResults: BuildPackageResult[]
  buildUpTo: Package[]
  shouldForceBuildAll: boolean
}): Package[] {
  ;[packages, changedPackages, buildResults, buildUpTo, shouldForceBuildAll]

  throw new Error('Unimplemented')
}
