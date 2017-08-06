const uuid = require('uuid/v4')
const debug = require('debug')('bildit:jobs')

async function runJob(job, {awakenedFrom, pluginRepository, events, kvStore, dispatchJob}) {
  const result = await executeJob(job, {awakenedFrom, pluginRepository, events, kvStore})

  await dealWithJobResult(result, {kvStore, dispatchJob})
}

async function executeJob(job, {awakenedFrom, pluginRepository, events, kvStore}) {
  const jobRunner = await pluginRepository.findPlugin({
    kind: 'jobRunner',
    job,
  })
  const agent = await pluginRepository.findPlugin({kind: 'agent', job})

  const jobId = job.id || uuid()
  const jobWithId = Object.assign({}, {id: jobId}, job)

  debug('running job %o awakened from job %s', jobWithId, awakenedFrom && awakenedFrom.job.id)

  await events.publish('START_JOB', {job})

  const state = job.id ? await kvStore.get(`jobstate:${job.id}`) : undefined
  debug('state for job %s found: %o', jobWithId.id, state)

  const jobResult = await jobRunner.runJob(jobWithId, {agent, state, awakenedFrom})
  debug('ran job %s', jobWithId.id)

  await events.publish('END_JOB', {jobWithId, jobResult})

  debug('dispatched job %o', jobWithId)

  return {jobResult, job: jobWithId}
}

async function dealWithJobResult({job, jobResult}, {kvStore, dispatchJob}) {
  const {state, jobs: subJobs} = jobResult || {}

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
  }
}

async function awakenParentJobIfNeeded(job, subJobResult, {kvStore, dispatchJob}) {
  const parentJob = await kvStore.get(`awaken:${job.id}`)

  if (!parentJob) {
    debug('no parent job to awaken for job %s', job.id)
    return
  }

  debug('dispatching parent job %o because %o awakened', parentJob, job)
  await dispatchJob(parentJob, {awakenedFrom: {job, result: subJobResult}})
}

module.exports = {
  runJob,
}
