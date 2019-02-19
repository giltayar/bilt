const uuid = require('uuid/v4')
const debug = require('debug')('bilt:jobs')
const {publish} = require('@bilt/in-memory-events')
const {executeBuild} = require('./build')

/**
 * @type JobRunner
 */
class JobRunner {} // eslint-disable-line

/**
 *
 * @param {{config: object, disabledSteps: string[], enabledSteps: [], builders: {[name: string]: {setupBuildSteps: function, getBuildSteps: function}}, events: import('@bilt/in-memory-events').InMemoryEvents}} options
 *
 * @returns {Promise<JobRunner>}
 */
async function makeJobRunner({
  config,
  disabledSteps,
  enabledSteps,
  builders,
  events,
  repositoryDirectory,
}) {
  return {
    config,
    disabledSteps,
    enabledSteps,
    builders,
    kvStore: new Map(),
    events,
    repositoryDirectory,
  }
}

async function runJob(jobRunner, job, {awakenedFrom, dispatchJob}) {
  const {
    config,
    builders,
    disabledSteps,
    enabledSteps,
    events,
    kvStore,
    repositoryDirectory,
  } = jobRunner

  const builder = builders[job.kind]
  const buildConfig = config && config[job.kind]

  const result = await executeJob(job, builder, {
    buildConfig,
    awakenedFrom,
    events,
    kvStore,
    disabledSteps,
    enabledSteps,
    repositoryDirectory,
  })

  return await dealWithJobResult(result, {kvStore, dispatchJob, events})
}

async function executeJob(
  job,
  builder,
  {buildConfig, awakenedFrom, events, kvStore, disabledSteps, enabledSteps, repositoryDirectory},
) {
  const jobWithId = prepareJobForRunning(job)

  debug('running job %o awakened from job %s', jobWithId, awakenedFrom && awakenedFrom.job.id)

  await publish(events, !awakenedFrom ? 'START_JOB' : 'AWAKEN_JOB', {job: jobWithId})

  const state = await kvStore.get(`jobstate:${job.id}`)
  debug('state for job %s found: %o', jobWithId.id, state)

  const {state: newState, jobs = [], success, err} = await executeBuild({
    builder,
    job: jobWithId,
    buildConfig,
    state,
    awakenedFrom,
    disabledSteps,
    enabledSteps,
    events,
    repositoryDirectory,
  })
  debug('ran job %s', jobWithId.id)

  await publish(events, jobs.length === 0 ? 'END_JOB' : 'HIBERNATE_JOB', {
    job: jobWithId,
    state: newState,
    jobs,
    success,
    err,
  })

  debug('dispatched job %o', jobWithId)

  return {state: newState, jobs, job: jobWithId, success, err}
}

async function dealWithJobResult(
  {job, state, jobs: subJobs, success, err},
  {kvStore, dispatchJob, events},
) {
  if (success) {
    debug('saving job %s state %o', job.id, state)
    await kvStore.set(`jobstate:${job.id}`, state)
  }

  await awakenParentJobIfNeeded(job, {success, err}, {kvStore, dispatchJob, events})

  if (subJobs && subJobs.length > 0) {
    const subJobsWithId = subJobs.map(({job, awaken}) => ({
      job: Object.assign({}, job, {id: uuid()}),
      awaken,
    }))
    const subJobsThatAwakenJob = subJobsWithId.filter(({awaken}) => awaken)
    await Promise.all(
      subJobsThatAwakenJob.map(async ({job: subJob}) => {
        debug('remembering to awaken %s when job %s finishes', job.id, subJob.id)
        await kvStore.set(`awaken:${subJob.id}`, job)
      }),
    )

    debug('dispatching subjobs of parent job %s', job.id)
    await Promise.all(subJobsWithId.map(async ({job}) => await dispatchJob(job, {events})))

    return job
  } else {
    debug('deleting job state for job %s', job.id)
    await deleteJobState(job, {kvStore})

    return undefined
  }
}

async function awakenParentJobIfNeeded(job, subJobResult, {kvStore, dispatchJob, events}) {
  const parentJob = await kvStore.get(`awaken:${job.id}`)

  if (!parentJob) {
    debug('no parent job to awaken for job %s', job.id)
    return
  }

  debug('dispatching parent job %o because %s awakened', parentJob, job.id)
  await dispatchJob(parentJob, {awakenedFrom: {job, result: subJobResult}, events})
}

function prepareJobForRunning(job) {
  const jobId = job.id || uuid()

  return job.id ? job : {id: jobId, ...job}
}

async function deleteJobState(job, {kvStore}) {
  await kvStore.delete(`jobstate:${job.id}`)
  await kvStore.delete(`awaken:${job.id}`)
}

module.exports = {
  makeJobRunner,
  runJob,
  prepareJobForRunning,
  executeBuild,
}
