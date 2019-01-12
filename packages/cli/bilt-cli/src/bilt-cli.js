'use strict'
const {promisify: p} = require('util')
const fs = require('fs')
const path = require('path')
const debug = require('debug')('bilt:bilt-cli')
const chalk = require('chalk')
const pluginImport = require('plugin-import')
const cosmiConfig = require('cosmiconfig')
const flatten = require('lodash.flatten')
const artifactFinder = require('@bilt/artifact-finder')
const defaultbiltConfig = require('./default-biltrc')

async function buildHere(
  directoryToBuild,
  {
    upto,
    from,
    justBuild,
    force,
    repository,
    disabledSteps,
    enabledSteps,
    rebuild,
    dryRun,
    allOutput,
  } = {},
) {
  const buildsSucceeded = []
  const buildsFailed = []
  const isRemoteRepo = !!repository

  debug('Loading configuration from', directoryToBuild)
  const {config: buildConfig, filepath} = await cosmiConfig('bilt', {
    rcExtensions: true,
  }).search(directoryToBuild)

  const finalDirectoryToBuild = path.dirname(filepath)
  debug('building directory', finalDirectoryToBuild)

  const pimport = await createPimport(
    buildConfig,
    isRemoteRepo,
    finalDirectoryToBuild,
    repository,
    disabledSteps,
    enabledSteps,
  )
  try {
    await configureEventsToOutputEventToStdout(pimport)

    const jobDispatcher = await pimport('jobDispatcher')

    const jobsToWaitFor = await runRepoBuildJob({
      directoryToBuild: finalDirectoryToBuild,
      repository,
      jobDispatcher,
      upto,
      from,
      justBuild,
      force,
      isRebuild: rebuild,
      isDryRun: dryRun,
    })

    await waitForJobs(pimport, jobsToWaitFor)
  } finally {
    debug('finalizing plugins')
    await pimport.finalize()
  }

  if (buildsSucceeded.length > 0) {
    console.log(chalk.green.bold('### Built artifacts: %s'), buildsSucceeded.join(','))
  }
  if (buildsFailed.length > 0) {
    console.log(
      chalk.red.bold.underline('### Builds failed for artifacts: %s'),
      buildsFailed.join(','),
    )
  }

  return buildsFailed.length > 0 ? 1 : 0

  async function configureEventsToOutputEventToStdout(pimport) {
    const events = await pimport('events')

    await events.subscribe('STARTING_REPO_JOB', ({artifactsToBeBuilt}) => {
      if (artifactsToBeBuilt.length === 0) {
        console.log('### Nothing to build')
      } else {
        console.log(chalk.green.bold('### Building artifacts: %s'), artifactsToBeBuilt.join(','))
      }
    })

    const outputStreams = new Map()

    await events.subscribe('START_JOB', async ({job}) => {
      if (job.kind === 'repository') return

      const artifactBiltDir = path.resolve(finalDirectoryToBuild, job.artifact.path, '.bilt')
      await p(fs.mkdir)(artifactBiltDir, {recursive: true}).catch(
        err => (err.code === 'EEXIST' ? undefined : Promise.reject(err)),
      )

      const outputStream = fs.createWriteStream(path.resolve(artifactBiltDir, 'build.log'))
      outputStreams.set(job.artifact.path, outputStream)

      console.log(
        chalk.greenBright.underline.bold('###### Building %s'),
        job.artifact.path || job.directory,
      )
    })

    await events.subscribe('START_STEP', ({job, step: {name}}) => {
      const line = `######### Step ${name}`
      console.log(chalk.green.dim(line))
      const outputStream = outputStreams.get(job.artifact.path)
      outputStream.write(line)
      outputStream.write('\n')
    })

    await events.subscribe('STEP_LINE_OUT', ({job, outTo, line}) => {
      const outputStream = outputStreams.get(job.artifact.path)
      outputStream.write(line)
      outputStream.write('\n')

      if (allOutput) {
        process[outTo].write(line)
        process[outTo].write('\n')
      }
    })

    await events.subscribe('END_JOB', async ({job, success}) => {
      if (job.kind === 'repository') return
      ;(success ? buildsSucceeded : buildsFailed).push(job.artifact.name)

      outputStreams.get(job.artifact.path).end()

      if (!success) {
        console.log(chalk.red.dim('###### Build %s failed with error. Output:'), job.artifact.path)

        const artifactBiltDir = path.resolve(directoryToBuild, job.artifact.path, '.bilt')
        const inputStream = fs.createReadStream(path.resolve(artifactBiltDir, 'build.log'))

        await new Promise((resolve, reject) =>
          inputStream
            .pipe(process.stderr)
            .on('error', reject)
            .on('close', resolve),
        )
      }
    })
  }
}

async function createPimport(
  buildConfig,
  isRemoteRepo,
  directoryToBuild,
  repository,
  disabledSteps,
  enabledSteps,
) {
  return pluginImport(
    [
      defaultbiltConfig.plugins,
      buildConfig.plugins,
      {
        'agent:npm': {
          directory: isRemoteRepo ? undefined : directoryToBuild,
        },
        repositoryFetcher: {
          repository: isRemoteRepo ? repository : undefined,
          directory: isRemoteRepo ? undefined : directoryToBuild,
        },
        jobDispatcher: {disabledSteps, enabledSteps},
      },
    ],
    {
      baseDirectory: directoryToBuild,
      useThisRequire: require,
    },
  )
}

async function runRepoBuildJob({
  directoryToBuild,
  repository,
  jobDispatcher,
  upto,
  from,
  justBuild,
  force,
  isRebuild,
  isDryRun,
}) {
  debug('fetching artifacts')
  const artifacts = await (await artifactFinder()).findArtifacts(directoryToBuild)

  if (!upto && !from && !justBuild) {
    justBuild = artifacts.map(a => a.name)
  }

  return [
    await jobDispatcher.dispatchJob({
      kind: 'repository',
      repository,
      artifacts,
      uptoArtifacts: normalizeArtifacts(upto, artifacts, directoryToBuild),
      fromArtifacts: normalizeArtifacts(from, artifacts, directoryToBuild),
      justBuildArtifacts: normalizeArtifacts(justBuild, artifacts, directoryToBuild),
      linkDependencies: true,
      force,
      isRebuild,
      isDryRun,
    }),
  ]
}

function normalizeArtifacts(artifactsOrDirsToBuild, artifacts, directoryToBuild) {
  if (!artifactsOrDirsToBuild) return artifactsOrDirsToBuild

  return flatten(
    [].concat(artifactsOrDirsToBuild).map(artifactNameOrDirToBuild => {
      if (artifactNameOrDirToBuild.startsWith('.') || artifactNameOrDirToBuild.startsWith('/')) {
        const pathOfArtifact = path.resolve(process.cwd(), artifactNameOrDirToBuild)
        debug('looking for artifacts under %s', pathOfArtifact)
        const foundArtifacts = artifacts.filter(artifact =>
          path.resolve(directoryToBuild, artifact.path).startsWith(pathOfArtifact),
        )
        if (foundArtifacts.length === 0)
          throw new Error(`could not find artifact "${artifactNameOrDirToBuild}"`)

        return foundArtifacts.map(a => a.name)
      } else {
        const foundArtifact = artifacts.find(artifact => artifact.name === artifactNameOrDirToBuild)
        if (!foundArtifact) throw new Error(`could not find artifact "${artifactNameOrDirToBuild}"`)

        return foundArtifact.name
      }
    }),
  )
}

async function waitForJobs(pimport, jobs) {
  debug('waiting for jobs %o', (jobs || []).map(job => job.id))
  const events = await pimport('events')
  const jobsThatAreStillWorking = new Set((jobs || []).map(job => job.id))

  await new Promise(async resolve => {
    await events.subscribe('END_JOB', ({job}) => {
      debug('job %s ended', job.id)
      jobsThatAreStillWorking.delete(job.id)

      if (jobsThatAreStillWorking.size === 0) {
        resolve()
      }
    })
  })
}

module.exports = buildHere
