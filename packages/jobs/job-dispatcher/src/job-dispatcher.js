'use strict'
const debug = require('debug')('bildit:job-dispatcher')
const uuid = require('uuid/v4')

module.exports = async ({pluginRepository, events}) => {
  const jobState = await pluginRepository.findPlugin({kind: 'jobState'})

  async function dispatchJob(job) {
    debug('dispatching job %o', job)

    const {jobResult, jobWithId} = await runJob(job)

    if (jobResult) {
      await dealWithJobResult(jobWithId, jobResult)
    }

    return jobResult
  }

  return {
    dispatchJob,
  }

  async function runJob(job) {
    const jobRunner = await pluginRepository.findPlugin({
      kind: 'jobRunner',
      job,
    })
    const agent = await pluginRepository.findPlugin({kind: 'agent', job})

    const jobId = job.id || uuid()
    const jobWithId = Object.assign({}, {id: jobId}, job)

    await events.publish('START_JOB', {job})

    const state = await jobState.getState(jobWithId)
    debug('state for job %s found: %o', jobWithId.id, state)

    debug('running job %o', jobWithId)
    const jobResult = await jobRunner.runJob(jobWithId, {agent, state})
    debug('ran job %o', jobWithId)

    await events.publish('END_JOB', {jobWithId, jobResult})

    debug('dispatched job %o', jobWithId)

    return {jobResult, jobWithId}
  }

  async function dealWithJobResult(jobWithId, jobResult) {
    const {state, jobs} = jobResult

    await jobs.map(async ({job, awaken}) => await dispatchJob(job))

    await jobState.setState(jobWithId, state)
  }
}
