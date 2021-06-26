import {join} from 'path'
import debugMaker from 'debug'
const debug = debugMaker('bilt:cli:build')
import {Listr} from 'listr2'
import splitLines from 'split-lines'
import {calculateBuildOrder, build} from '@bilt/build'
import {getPhaseExecution} from '@bilt/build-with-configuration'
import inquirer from 'inquirer'
import {childProcessWait} from '@bilt/scripting-commons'
import {determinePackagesToBuild} from '@bilt/bilt-cli-commons'
import {globalFooter, globalHeader, globalFailureFooter, packageErrorFooter} from './outputting.js'
import npmBiltin from './npm-biltin.js'
import {makeOptionsBiltin} from './options-biltin.js'

/**
 * @typedef {import('@bilt/types').Package} Package
 * @typedef {import('@bilt/types').PackageInfo} PackageInfo
 * @typedef {import('@bilt/types').PackageInfos} PackageInfos
 */

/**
 * @param {{
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
  debug(`starting build of ${rootDirectory}`)

  const {packagesToBuild: finalPackagesToBuild, warnings} = await determinePackagesToBuild({
    packagesToBuild,
    packages,
    upto,
    rootDirectory,
    force,
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

  const packagesInBuildOrder = await getPackagesInBuildOrder(finalPackagesToBuild)

  if (dryRun) {
    console.log(packagesInBuildOrder.join(', '))
    return true
  }

  const message =
    userBuildOptions.message === 'marker-for-no-message'
      ? await getMessageFromUser()
      : userBuildOptions.message

  const buildOptions = {
    ...userBuildOptions,
    message: message + '\n\n\n[bilt-with-bilt]',
    force,
  }

  const biltin = {...npmBiltin, ...makeOptionsBiltin(buildOptions)}

  globalHeader(`building ${packagesInBuildOrder.join(', ')}`)

  if (before) {
    await executeBeforePhase(jobConfiguration, rootDirectory, buildOptions, biltin)
  }

  const {successful, failed} = await executeDuringPhase(
    finalPackagesToBuild,
    jobConfiguration,
    rootDirectory,
    buildOptions,
    biltin,
  )

  try {
    if (successful.length > 0 && after) {
      await executeAfterPhase(jobConfiguration, rootDirectory, buildOptions, biltin)
    }
  } finally {
    if (failed.length > 0) {
      globalFailureFooter(
        `Some packages have failed to build`,
        failed.map((p) => finalPackagesToBuild[p.directory]),
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
  await executePhase(jobConfiguration, 'after', rootDirectory, buildOptions, biltin)
}

/**
 * @param {import("@bilt/types").PackageInfos} finalPackagesToBuild
 * @param {import('@bilt/build-with-configuration').Job} jobConfiguration
 * @param {import("@bilt/types").Nominal<string, "Directory">} rootDirectory
 * @param {{ [x: string]: string | boolean | undefined; message?: string; force?: boolean; jobId?: string; envelope?: boolean | undefined; }} buildOptions
 * @param {object} biltin
 */
async function executeDuringPhase(
  finalPackagesToBuild,
  jobConfiguration,
  rootDirectory,
  buildOptions,
  biltin,
) {
  return await buildPackages(
    finalPackagesToBuild,
    makePackageBuild(jobConfiguration, rootDirectory, buildOptions, biltin),
  )
}

/** @param {import("@bilt/types").PackageInfos} finalPackagesToBuild */
async function getPackagesInBuildOrder(finalPackagesToBuild) {
  /** @type {import("@bilt/types").RelativeDirectoryPath[]} */
  const packagesBuildOrder = []

  await buildPackages(finalPackagesToBuild, async ({packageInfo}) => {
    packagesBuildOrder.push(packageInfo.directory)
    return 'success'
  })

  return packagesBuildOrder
}

/**
 * @param {import('@bilt/build-with-configuration').Job} jobConfiguration
 * @param {import("@bilt/types").Nominal<string, "Directory">} rootDirectory
 * @param {Record<string, string | boolean | undefined>} buildOptions
 * @param {object} biltin
 */
async function executeBeforePhase(jobConfiguration, rootDirectory, buildOptions, biltin) {
  await executePhase(jobConfiguration, 'before', rootDirectory, buildOptions, biltin)
}

/**@returns {Promise<{
 * successful: Package[],
 * failed: Package[],
 * }>} */
async function buildPackages(
  /**@type {PackageInfos} */ packageInfosToBuild,
  /**@type {import('@bilt/build').BuildPackageFunction} */ buildPackageFunc,
) {
  const buildOrder = calculateBuildOrder({packageInfos: packageInfosToBuild})

  const ret = {
    successful: /**@type {Package[]}*/ ([]),
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
      ret.successful.push(buildPackageResult.package)
    }
  }

  return ret
}

/**@return {import('@bilt/build').BuildPackageFunction} */
function makePackageBuild(
  /**@type {import('@bilt/build-with-configuration').Job} */ jobConfiguration,
  /**@type {import('@bilt/types').Directory}*/ rootDirectory,
  /**@type {{[x: string]: string|boolean | undefined}} */ buildOptions,
  /**@type {object} */ biltin,
) {
  /**@type {import('@bilt/build').BuildPackageFunction} */
  return async function ({packageInfo}) {
    const packageDirectory = /**@type {import('@bilt/types').Directory}*/ (
      join(rootDirectory, packageInfo.directory)
    )

    await executePhase(
      jobConfiguration,
      'during',
      packageDirectory,
      buildOptions,
      biltin,
      packageInfo,
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
 * @param {PackageInfo=} packageInfo
 */
async function executePhase(
  jobConfiguration,
  phase,
  packageDirectory,
  buildOptions,
  biltin,
  packageInfo,
) {
  const stepExecutions = getPhaseExecution(
    jobConfiguration.steps[phase],
    packageDirectory,
    buildOptions,
    {directory: packageDirectory, biltin},
  )

  const title = (function formatTitle() {
    if (phase === 'during' && packageInfo) return `building ${packageInfo.directory}`
    return phase
  })()

  return new Listr(
    [
      {
        title,
        task: (_, task) => task.newListr(convertStepExecutionsToTasks(stepExecutions)),
        options: {
          persistentOutput: true,
        },
      },
    ],
    {
      rendererOptions: {
        showTimer: true,
        collapseErrors: false,
        formatOutput: 'wrap',
      },
    },
  ).run()
}

/** @type {( linesToDisplay?: number) => (payload: string, showAll?: boolean) => string} */
function LinesBuffer(linesToDisplay = 10) {
  /** @type {string[]} */
  let buffer = []
  return function handlePayload(payload, showAll = false) {
    const newLines = splitLines(payload.toString())
    buffer = buffer.concat(newLines)
    if (showAll) return buffer.join('\n')
    return buffer.slice(Math.max(0, buffer.length - linesToDisplay), buffer.length).join('\n')
  }
}

/**
 * @param {import('@bilt/build-with-configuration').StepExecution[]} stepExecutions
 * @returns {import('listr2').ListrTask[]}
 */
function convertStepExecutionsToTasks(stepExecutions) {
  return stepExecutions.map(function createTaskFromStep(stepExecution) {
    return {
      title: stepExecution.info().name,
      task: async function (_, task) {
        const childProcess = await stepExecution.executeToChildProcess()
        const buffer = LinesBuffer()
        childProcess.stdout.on('data', (payload) => {
          task.output = buffer(payload)
        })
        childProcess.stderr.on('data', (payload) => {
          task.output = buffer(payload, true)
        })
        await childProcessWait(childProcess, stepExecution.info().command)
      },
      skip: stepExecution.shouldSkip,
      exitOnError: true,
      enabled: stepExecution.isEnabled,
      options: {
        persistentOutput: true,
      },
    }
  })
}

async function getMessageFromUser() {
  return (await inquirer.prompt({name: 'message', validate: (x) => (!x ? 'required' : true)}))
    .message
}
