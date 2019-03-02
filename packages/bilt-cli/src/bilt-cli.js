'use strict'
const {promisify: p} = require('util')
const fs = require('fs')
const path = require('path')
const debug = require('debug')('bilt:bilt-cli')
const chalk = require('chalk')
const cosmiConfig = require('cosmiconfig')
const flatten = require('lodash.flatten')
const artifactFinder = require('@bilt/artifact-finder')
const {makeJobDispatcher, dispatchJob} = require('@bilt/in-memory-job-dispatcher')
const {makeEvents, subscribe} = require('@bilt/in-memory-events')
const npmBuilder = require('@bilt/npm-build-job')
const repositoryBuilder = require('@bilt/repo-build-job')
const {makeJobRunner} = require('@bilt/jobs')

async function buildHere(
  repositoryDirectory,
  {
    upto,
    from,
    justBuild,
    force,
    disableSteps,
    enableSteps,
    rebuild,
    dryRun,
    allOutput,
    isFormalBuild,
  } = {},
) {
  const buildsSucceeded = []
  const buildsFailed = []

  const defaultConfig = {isFormalBuild}

  debug('Loading configuration from', repositoryDirectory)
  const {fileConfig, filepath} = await cosmiConfig('bilt', {
    rcExtensions: true,
  }).search(repositoryDirectory)

  const buildConfig = distributeGlobalConfigToBuilderConfig({...defaultConfig, ...fileConfig})

  const finalRepositoryDirectory = path.dirname(filepath)
  debug('building directory', finalRepositoryDirectory)

  const events = await makeEvents()
  await configureEventsToOutputEventToStdout(events)

  const jobRunner = await makeJobRunner({
    buildConfig,
    disableSteps,
    enableSteps,
    events,
    builders: {
      npm: npmBuilder,
      repository: repositoryBuilder,
    },
    repositoryDirectory: finalRepositoryDirectory,
  })
  const jobDispatcher = await makeJobDispatcher({jobRunner})

  const jobsToWaitFor = await runRepoBuildJob({
    repositoryDirectory: finalRepositoryDirectory,
    jobDispatcher,
    upto,
    from,
    justBuild,
    force,
    isRebuild: rebuild,
    isDryRun: dryRun,
    events,
  })

  await waitForJobs(events, jobsToWaitFor)

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

  async function configureEventsToOutputEventToStdout(events) {
    await subscribe(events, 'STARTING_REPO_JOB', ({artifactsToBeBuilt}) => {
      if (artifactsToBeBuilt.length === 0) {
        console.log('### Nothing to build')
      } else {
        console.log(chalk.green.bold('### Building artifacts: %s'), artifactsToBeBuilt.join(','))
      }
    })

    const outputStreams = new Map()

    await subscribe(events, 'START_JOB', async ({job}) => {
      if (job.kind === 'repository') return

      const artifactBiltDir = path.resolve(finalRepositoryDirectory, job.artifact.path, '.bilt')
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

    await subscribe(events, 'START_STEP', ({job, step: {name}}) => {
      const line = `######### Step ${name}`
      console.log(chalk.green.dim(line))
      const outputStream = outputStreams.get(job.artifact.path)
      outputStream.write(line)
      outputStream.write('\n')
    })

    await subscribe(events, 'STEP_LINE_OUT', ({job, outTo, line}) => {
      const outputStream = outputStreams.get(job.artifact.path)
      outputStream.write(line)
      outputStream.write('\n')

      if (allOutput) {
        process[outTo].write(line)
        process[outTo].write('\n')
      }
    })

    await subscribe(events, 'END_JOB', async ({job, success}) => {
      if (job.kind === 'repository') return
      ;(success ? buildsSucceeded : buildsFailed).push(job.artifact.name)

      await closeStream(outputStreams.get(job.artifact.path))

      if (!success) {
        console.log(chalk.red.dim('###### Build %s failed with error. Output:'), job.artifact.path)

        const artifactBiltDir = path.resolve(finalRepositoryDirectory, job.artifact.path, '.bilt')
        await writeToStream(
          fs.createReadStream(path.resolve(artifactBiltDir, 'build.log')),
          process.stderr,
        )
      }
    })
  }
}

async function writeToStream(inputStream, outputStream) {
  await new Promise((resolve, reject) =>
    inputStream
      .pipe(outputStream)
      .on('error', reject)
      .on('unpipe', resolve),
  )
}

function closeStream(stream) {
  return new Promise((resolve, reject) => {
    stream
      .on('error', reject)
      .on('close', resolve)
      .end()
  })
}

async function runRepoBuildJob({
  repositoryDirectory,
  jobDispatcher,
  upto,
  from,
  justBuild,
  force,
  isRebuild,
  isDryRun,
  events,
}) {
  debug('fetching artifacts')
  const artifacts = await (await artifactFinder()).findArtifacts(repositoryDirectory)

  if (!upto && !from && !justBuild) {
    justBuild = artifacts.map(a => a.name)
  }

  return [
    await dispatchJob(
      jobDispatcher,
      {
        kind: 'repository',
        repositoryDirectory,
        artifacts,
        uptoArtifacts: normalizeArtifacts(upto, artifacts, repositoryDirectory),
        fromArtifacts: normalizeArtifacts(from, artifacts, repositoryDirectory),
        justBuildArtifacts: normalizeArtifacts(justBuild, artifacts, repositoryDirectory),
        linkDependencies: true,
        force,
        isRebuild,
        isDryRun,
      },
      {events},
    ),
  ]
}

function normalizeArtifacts(artifactsOrDirsToBuild, artifacts, repositoryDirectory) {
  if (!artifactsOrDirsToBuild) return artifactsOrDirsToBuild

  return flatten(
    [].concat(artifactsOrDirsToBuild).map(artifactNameOrDirToBuild => {
      if (artifactNameOrDirToBuild.startsWith('.') || artifactNameOrDirToBuild.startsWith('/')) {
        const pathOfArtifact = path.resolve(process.cwd(), artifactNameOrDirToBuild)
        debug('looking for artifacts under %s', pathOfArtifact)
        const foundArtifacts = artifacts.filter(artifact =>
          path.resolve(repositoryDirectory, artifact.path).startsWith(pathOfArtifact),
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

async function waitForJobs(events, jobs) {
  debug('waiting for jobs %o', (jobs || []).map(job => job.id))
  const jobsThatAreStillWorking = new Set((jobs || []).map(job => job.id))

  await new Promise(async resolve => {
    await subscribe(events, 'END_JOB', ({job}) => {
      debug('job %s ended', job.id)
      jobsThatAreStillWorking.delete(job.id)

      if (jobsThatAreStillWorking.size === 0) {
        resolve()
      }
    })
  })
}

function distributeGlobalConfigToBuilderConfig(config) {
  const builderConfigKeys = ['npm']

  for (const builderConfigKey of builderConfigKeys) {
    const globalKeys = Object.keys(config).filter(key => !builderConfigKeys.includes(key))

    config[builderConfigKey] = {}

    for (const globalKey of globalKeys) {
      config[builderConfigKey][globalKey] = config[globalKey]
    }
  }

  return config
}

module.exports = buildHere
