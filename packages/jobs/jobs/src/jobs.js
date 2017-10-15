const uuid = require('uuid/v4')
const debug = require('debug')('bildit:jobs')

async function runJob(job, {awakenedFrom, pimport, events, kvStore, dispatchJob}) {
  const result = await executeJob(job, {awakenedFrom, pimport, events, kvStore})

  return await dealWithJobResult(result, {kvStore, dispatchJob})
}

async function executeJob(job, {awakenedFrom, pimport, events, kvStore}) {
  const builder = await pimport(`builder:${job.kind}`)
  const agent = await pimport(`agent:${job.kind}`)

  const jobWithId = prepareJobForRunning(job)

  debug('running job %o awakened from job %s', jobWithId, awakenedFrom && awakenedFrom.job.id)

  await events.publish(!awakenedFrom ? 'START_JOB' : 'AWAKEN_JOB', {job: jobWithId})

  const state = await kvStore.get(`jobstate:${job.id}`)
  debug('state for job %s found: %o', jobWithId.id, state)

  const {state: newState, jobs = [], success, err} = await runTheBuild(
    builder,
    agent,
    jobWithId,
    state,
    awakenedFrom,
  )
  debug('ran job %s', jobWithId.id)

  await events.publish(jobs.length === 0 ? 'END_JOB' : 'HIBERNATE_JOB', {
    job: jobWithId,
    state: newState,
    jobs,
    success,
    err,
  })

  debug('dispatched job %o', jobWithId)

  return {state: newState, jobs, job: jobWithId, success, err}
}

async function build(buildSteps, agent) {
  for (const executeCommandArg of buildSteps) {
    await agent.executeCommand(executeCommandArg)
  }
}

async function runTheBuild(builder, agent, job, state, awakenedFrom) {
  const agentInstance = await agent.acquireInstanceForJob()
  try {
    const {howToBuild} = await builder.setupBuildSteps({
      job,
      agentInstance,
      state,
      awakenedFrom,
    })
    try {
      const {buildSteps = [], state, jobs} = builder.getBuildSteps({howToBuild, job})
      await build(buildSteps, agent, job)

      return {state, jobs, success: true}
    } catch (err) {
      return {state, success: false, err}
    } finally {
      if (builder.cleanupBuild) {
        await builder.cleanupBuild({howToBuild})
      }
    }
  } finally {
    agent.releaseInstanceForJob(agentInstance)
  }
}

async function dealWithJobResult(
  {job, state, jobs: subJobs, success, err},
  {kvStore, dispatchJob},
) {
  if (success) {
    debug('saving job %s state %o', job.id, state)
    await kvStore.set(`jobstate:${job.id}`, state)
  }

  await awakenParentJobIfNeeded(job, {success, err}, {kvStore, dispatchJob})

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
