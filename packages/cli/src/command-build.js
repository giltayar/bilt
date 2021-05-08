import {relative, resolve, join} from 'path'
import debugMaker from 'debug'
const debug = debugMaker('bilt:cli:build')
import throat from 'throat'
import {findNpmPackages, findNpmPackageInfos} from '@bilt/npm-packages'
import {calculateBuildOrder, build} from '@bilt/build'
import {calculatePackagesToBuild} from '@bilt/packages-to-build'
import {getPhaseExecution} from '@bilt/build-with-configuration'
import {
  findChangedFiles,
  findLatestPackageChanges,
  FAKE_COMMITISH_FOR_UNCOMMITED_FILES,
} from '@bilt/git-packages'
import {shWithOutput, childProcessWait} from '@bilt/scripting-commons'
import {
  globalFooter,
  globalHeader,
  globalOperation,
  globalFailureFooter,
  packageErrorFooter,
  packageFooter,
  packageHeader,
  packageOperation,
} from './outputting.js'
import npmBiltin from './npm-biltin.js'
import {makeOptionsBiltin} from './options-biltin.js'

/**
 * @typedef {import('@bilt/types').Package} Package
 * @typedef {import('@bilt/types').PackageInfo} PackageInfo
 * @typedef {import('@bilt/types').PackageInfos} PackageInfos
 */

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
 * envelope: boolean|undefined
 * jobConfiguration: import('@bilt/build-with-configuration').Job
 * } & {[x: string]: string|boolean|undefined}} options
 */
export default async function buildCommand({
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
  const branchName = await getGitBranchName(rootDirectory)
  debug(`starting build of ${rootDirectory} - branch ${branchName}`)
  const buildOptions = {
    ...userBuildOptions,
    message: userBuildOptions.message + '\n\n\n[bilt-with-bilt-' + branchName + ']',
    force,
  }
  const {initialSetOfPackagesToBuild, uptoPackages, packageInfos} = await extractPackageInfos(
    rootDirectory,
    packages,
    packagesToBuild,
    upto,
  )
  debug(
    `determined packages to build`,
    initialSetOfPackagesToBuild.map((pkg) => pkg.directory),
  )
  const changedPackageInfos = await determineChangedPackagesBuildInformation(
    rootDirectory,
    packageInfos,
    samePackages(uptoPackages || [], initialSetOfPackagesToBuild || [])
      ? initialSetOfPackagesToBuild
      : undefined,
    force,
  )

  const {packageInfosWithBuildTime: finalPackagesToBuild, warnings} = calculatePackagesToBuild({
    packageInfos: changedPackageInfos,
    basePackagesToBuild: initialSetOfPackagesToBuild,
    buildUpTo: uptoPackages || [],
  })

  if (warnings && warnings.length > 0) {
    if (warnings.includes('NO_LINKED_UPTO')) {
      globalFooter(
        `mothing to build because the none of the uptos is linked to any of the packages to build.
Maybe you forgot to add an upto package?`,
      )
      return true
    }
  }

  if (Object.keys(finalPackagesToBuild).length === 0) {
    globalFooter('nothing to build')
    return true
  }

  if (dryRun) {
    return await showPackagesForDryRun(finalPackagesToBuild, dryRun)
  }

  const biltin = {...npmBiltin, ...makeOptionsBiltin(buildOptions)}

  globalHeader(`building ${Object.keys(finalPackagesToBuild).join(', ')}`)

  if (before) {
    await executeBeforePhase(jobConfiguration, rootDirectory, buildOptions, biltin)
  }

  const {succesful, failed} = await executeDuringPhase(
    finalPackagesToBuild,
    jobConfiguration,
    rootDirectory,
    buildOptions,
    biltin,
    dryRun,
  )

  try {
    if (succesful.length > 0 && after) {
      await executeAfterPhase(jobConfiguration, rootDirectory, buildOptions, biltin)
    }
  } finally {
    if (failed.length > 0) {
      globalFailureFooter(
        `Some packages have failed to build`,
        failed.map((p) => packageInfos[p.directory]),
      )
    }
  }
  return failed.length === 0
}

/**
 * @param {import('@bilt/build-with-configuration').Job} jobConfiguration
 * @param {import("@bilt/types").Nominal<string, "Directory">} rootDirectory
 * @param {Record<string, string | boolean | undefined>} buildOptions
 * @param {object} biltin
 */
async function executeAfterPhase(jobConfiguration, rootDirectory, buildOptions, biltin) {
  await executePhase(jobConfiguration, 'after', rootDirectory, buildOptions, biltin, (se) =>
    globalOperation(se.info().name),
  )
}

/**
 * @param {import("@bilt/types").PackageInfos} finalPackagesToBuild
 * @param {import('@bilt/build-with-configuration').Job} jobConfiguration
 * @param {import("@bilt/types").Nominal<string, "Directory">} rootDirectory
 * @param {{ [x: string]: string | boolean | undefined; message?: string; force?: boolean; jobId?: string; envelope?: boolean | undefined; }} buildOptions
 * @param {object} biltin
 * @param {boolean} dryRun
 */
async function executeDuringPhase(
  finalPackagesToBuild,
  jobConfiguration,
  rootDirectory,
  buildOptions,
  biltin,
  dryRun,
) {
  return await buildPackages(
    finalPackagesToBuild,
    makePackageBuild(jobConfiguration, rootDirectory, buildOptions, biltin),
    dryRun,
  )
}

/**
 * @param {import("@bilt/types").PackageInfos} finalPackagesToBuild
 * @param {boolean} dryRun
 */
async function showPackagesForDryRun(finalPackagesToBuild, dryRun) {
  /** @type {import("@bilt/types").RelativeDirectoryPath[]} */
  const packagesBuildOrder = []

  await buildPackages(
    finalPackagesToBuild,
    async ({packageInfo}) => {
      packagesBuildOrder.push(packageInfo.directory)
      return 'success'
    },
    dryRun,
  )

  console.log(packagesBuildOrder.join(', '))

  return true
}

/**
 * @param {import('@bilt/build-with-configuration').Job} jobConfiguration
 * @param {import("@bilt/types").Nominal<string, "Directory">} rootDirectory
 * @param {Record<string, string | boolean | undefined>} buildOptions
 * @param {object} biltin
 */
async function executeBeforePhase(jobConfiguration, rootDirectory, buildOptions, biltin) {
  await executePhase(jobConfiguration, 'before', rootDirectory, buildOptions, biltin, (se) =>
    globalOperation(se.info().name),
  )
}

/**
 * @param {Package[]} packages1
 * @param {Package[]} packages2
 */
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
  /**@type {PackageInfos} */ packageInfos,
  /**@type {Package[] | undefined} */ checkOnlyThesePackages,
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
 * @param {PackageInfos} packageInfos
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
 * succesful: Package[],
 * failed: Package[],
 * }>} */
async function buildPackages(
  /**@type {PackageInfos} */ packageInfosToBuild,
  /**@type {import('@bilt/build').BuildPackageFunction} */ buildPackageFunc,
  /**@type {boolean}*/ dryRun,
) {
  const buildOrder = calculateBuildOrder({packageInfos: packageInfosToBuild})

  const ret = {
    succesful: /**@type {Package[]}*/ ([]),
    failed: /**@type {Package[]}*/ ([]),
    built: /**@type {Package[]}*/ ([]),
  }
  debug('starting build')
  for await (const buildPackageResult of build(packageInfosToBuild, buildOrder, buildPackageFunc)) {
    debug(
      `build of ${buildPackageResult.package.directory} ended. result: ${
        buildPackageResult.buildResult
      }.${buildPackageResult.error ? 'Error: ' + buildPackageResult.error : ''}`,
    )
    if (buildPackageResult.buildResult === 'failure') {
      ret.failed.push(buildPackageResult.package)
      packageErrorFooter(
        'build package failed',
        packageInfosToBuild[buildPackageResult.package.directory],
        buildPackageResult.error,
      )
    } else if (buildPackageResult.buildResult === 'success') {
      ret.succesful.push(buildPackageResult.package)
      if (!dryRun) {
        packageFooter(
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
 * @param {PackageInfos} packageInfos,
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

          const branchName = await getGitBranchName(rootDirectory)
          if (stdout.includes(`[bilt-with-bilt-${branchName}]`)) {
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
 * @param {import('@bilt/types').Directory} rootDirectory
 * @param {string[]} packagesDirectories
 * @param {string[]} packagesToBuildDirectories
 * @param {string[]} uptoDirectoriesOrPackageNames
 * @returns {Promise<{
 * initialSetOfPackagesToBuild: Package[]
 * uptoPackages: Package[] | undefined
 * packageInfos: PackageInfos
 * }>}
 */
async function extractPackageInfos(
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
      : convertUserPackagesToPackages(packagesToBuildDirectories, packageInfos, rootDirectory) || []
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
 * @param {PackageInfos} packageInfos
 * @param {string} rootDirectory
 * @returns {Package[] | undefined}
 */
function convertUserPackagesToPackages(directoriesOrPackageNames, packageInfos, rootDirectory) {
  return directoriesOrPackageNames == null
    ? undefined
    : directoriesOrPackageNames
        .filter((d) => d !== '*')
        .map((d) => {
          if (directoryIsActuallyPackageName(d)) {
            const packagesInfoEntry = Object.entries(packageInfos).filter(([, packageInfo]) =>
              packageInfo.name.includes(d),
            )
            if (packagesInfoEntry.length > 1) {
              throw new Error(
                `there are ${packagesInfoEntry.length} packages with the name "${d}" in any packages in ${rootDirectory}`,
              )
            }
            if (packagesInfoEntry.length === 0)
              throw new Error(
                `cannot find a package with the name "${d}" in any packages in ${rootDirectory}`,
              )
            return {
              directory: /**@type{import('@bilt/types').RelativeDirectoryPath}*/ (packagesInfoEntry[0][0]),
            }
          } else {
            return {
              directory: /**@type{import('@bilt/types').RelativeDirectoryPath}*/ (relative(
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
 * @param {string} cwd
 */
async function getGitBranchName(cwd) {
  const branchName = await shWithOutput(`git branch --show-current`, {
    cwd,
  })
  return branchName.trim()
}

/**
 * @param {string} rootDirectory
 * @param {string[][]} directoryPackages
 */
async function convertDirectoriesToPackages(rootDirectory, ...directoryPackages) {
  /** @type {string[]} */
  // @ts-expect-error
  const allDirectoryPackages = [].concat(...directoryPackages.filter((d) => !!d))

  const autoFoundPackages = allDirectoryPackages.some((d) => d === '*')
    ? await findNpmPackages({
        rootDirectory: /**@type{import('@bilt/types').Directory}*/ (rootDirectory),
      })
    : undefined

  const allDirectoryPackagesWithAutoFoundPackages = autoFoundPackages
    ? allDirectoryPackages
        .filter((d) => !directoryIsActuallyPackageName(d))
        .concat(autoFoundPackages.map((p) => resolve(rootDirectory, p.directory)))
    : allDirectoryPackages.filter((d) => !directoryIsActuallyPackageName(d))

  return [...new Set(allDirectoryPackagesWithAutoFoundPackages)].map((d) => ({
    directory: /**@type{import('@bilt/types').RelativeDirectoryPath}*/ (relative(rootDirectory, d)),
  }))
}

/**@return {import('@bilt/build').BuildPackageFunction} */
function makePackageBuild(
  /**@type {import('@bilt/build-with-configuration').Job} */ jobConfiguration,
  /**@type {import('@bilt/types').Directory}*/ rootDirectory,
  /**@type {{[x: string]: string|boolean | undefined}} */ buildOptions,
  /**@type {object} */ biltin,
) {
  /**@type import('@bilt/build').BuildPackageFunction */
  return async function ({packageInfo}) {
    const packageDirectory = /**@type {import('@bilt/types').Directory}*/ (join(
      rootDirectory,
      packageInfo.directory,
    ))

    packageHeader('building', packageInfo)
    await executePhase(jobConfiguration, 'during', packageDirectory, buildOptions, biltin, (se) =>
      packageOperation(se.info().name, packageInfo),
    )

    return 'success'
  }
}

/**
 * @param {import('@bilt/build-with-configuration').Job} jobConfiguration
 * @param {'during' | 'before' | 'after'} phase
 * @param {import('@bilt/types').Directory} packageDirectory
 * @param {Record<string, string | boolean | undefined>} buildOptions
 * @param {object} biltin
 * @param {(se: import('@bilt/build-with-configuration').StepExecution) => void} logExecution
 */
async function executePhase(
  jobConfiguration,
  phase,
  packageDirectory,
  buildOptions,
  biltin,
  logExecution,
) {
  const stepExecutions = getPhaseExecution(
    jobConfiguration.steps[phase],
    packageDirectory,
    buildOptions,
    {directory: packageDirectory, biltin},
  )

  for (const stepExecution of stepExecutions.filter((se) => se.isEnabled())) {
    if (await stepExecution.shouldSkip()) {
      const childProcess = await stepExecution.executeToChildProcess()
      childProcess.stdout.pipe(process.stdout)
      childProcess.stderr.pipe(process.stderr)
      await childProcessWait(childProcess, stepExecution.info().command)
    }
    logExecution(stepExecution)
  }
}
