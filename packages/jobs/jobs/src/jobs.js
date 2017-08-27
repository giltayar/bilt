const uuid = require('uuid/v4')
const debug = require('debug')('bildit:jobs')

async function runJob(job, {awakenedFrom, pluginRepository, events, kvStore, dispatchJob}) {
  const result = await executeJob(job, {awakenedFrom, pluginRepository, events, kvStore})

  return await dealWithJobResult(result, {kvStore, dispatchJob})
}

async function executeJob(job, {awakenedFrom, pluginRepository, events, kvStore}) {
  const builder = await pluginRepository.findPlugin(`builder:${job.kind}`)
  const agent = await pluginRepository.findPlugin(`agent:${job.kind}`)

  const jobWithId = prepareJobForRunning(job)

  debug('running job %o awakened from job %s', jobWithId, awakenedFrom && awakenedFrom.job.id)

  await events.publish(!awakenedFrom ? 'START_JOB' : 'AWAKEN_JOB', {job: jobWithId})

  const state = await kvStore.get(`jobstate:${job.id}`)
  debug('state for job %s found: %o', jobWithId.id, state)

  const jobResult = await builder.build(jobWithId, {agent, state, awakenedFrom})
  debug('ran job %s', jobWithId.id)

  const {jobs: subJobs = []} = jobResult || {}

  await events.publish(subJobs.length === 0 ? 'END_JOB' : 'HIBERNATE_JOB', {
    job: jobWithId,
    jobResult,
  })

  debug('dispatched job %o', jobWithId)

  return {jobResult, job: jobWithId}
}

async function dealWithJobResult({job, jobResult}, {kvStore, dispatchJob}) {
  const {state, jobs: subJobs} = jobResult || {}

  debug('saving job %s state %o', job.id, state)
  await kvStore.set(`jobstate:${job.id}`, state)

  await awakenParentJobIfNeeded(job, {result: 'success'}, {kvStore, dispatchJob})

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
    await Promise.all(subJobsWithId.map(async ({job}) => await dispatchJob(job)))

    return job
  } else {
    debug('deleting job state for job %s', job.id)
    await deleteJobState(job, {kvStore})

    return undefined
  }
}

async function awakenParentJobIfNeeded(job, subJobResult, {kvStore, dispatchJob}) {
  const parentJob = await kvStore.get(`awaken:${job.id}`)

  if (!parentJob) {
    debug('no parent job to awaken for job %s', job.id)
    return
  }

  debug('dispatching parent job %o because %s awakened', parentJob, job.id)
  await dispatchJob(parentJob, {awakenedFrom: {job, result: subJobResult}})
}

async function waitForJob(jobToWaitFor, {events}) {
  await new Promise((resolve, reject) => {
    events
      .subscribe('END_JOB', ({job}) => {
        console.log('found end of', job)
        if (job.id === jobToWaitFor.id) resolve()
      })
      .catch(reject)
  })
}

function prepareJobForRunning(job) {
  const jobId = job.id || uuid()

  return job.id ? job : Object.assign({}, {id: jobId}, job)
}

async function deleteJobState(job, {kvStore}) {
  await kvStore.delete(`jobstate:${job.id}`)
  await kvStore.delete(`awaken:${job.id}`)
}

async function isSubJob(job, {kvStore}) {
  return !!await kvStore.get(`awaken:${job.id}`)
}

module.exports = {
  runJob,
  waitForJob,
  prepareJobForRunning,
  deleteJobState,
  isSubJob,
}
