'use strict'
const debug = require('debug')('bildit:leveldb-job-dispatcher')
const path = require('path')
const makeDir = require('make-dir')
const uuid = require('uuid/v4')
const levelQueue = require('level-q')
const level = require('level')
const bytewise = require('bytewise')

module.exports = async ({pluginRepository, events, directory}) => {
  const jobState = await pluginRepository.findPlugin({kind: 'jobState'})
  const queue = await initializeDb()
  await listenAndExecuteJobs()

  const awakenFor = new Map()

  return {
    dispatchJob,
  }

  async function dispatchJob(job, {awakenedFrom} = {}) {
    queue.push({job, awakenedFrom})
  }

  async function initializeDb() {
    await makeDir(path.join(directory, '.bildit'))

    const {queue} = levelQueue(
      level(path.join(directory, '.bildit', 'job-queue'), {
        keyEncoding: bytewise,
        valueEncoding: 'json',
      }),
    )

    return queue
  }

  async function runJob(job, awakenedFrom) {
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

    debug('running job %o awakened from job %s', jobWithId, awakenedFrom && awakenedFrom.job.id)
    const jobResult = await jobRunner.runJob(jobWithId, {agent, state, awakenedFrom})
    debug('ran job %o', jobWithId.id)

    await events.publish('END_JOB', {jobWithId, jobResult})

    debug('dispatched job %o', jobWithId)

    return {jobResult, jobWithId}
  }

  async function listenAndExecuteJobs() {
    queue.listen(async (err, value, key, next) => {
      const {job, awakenedFrom} = value

      runJob(job, awakenedFrom).then(dealWithJobResult)

      next()
    })
  }

  async function dealWithJobResult({jobWithId, jobResult}) {
    const {state, jobs: subJobs} = jobResult || {}

    await jobState.setState(jobWithId, state)

    await awakenParentJobIfNeeded(jobWithId, {result: 'success'})

    if (subJobs && subJobs.length > 0) {
      const subJobsWithId = subJobs.map(({job, awaken}) => ({
        job: Object.assign({}, job, {id: uuid()}),
        awaken,
      }))
      const subJobsThatAwakenJob = subJobsWithId.filter(({awaken}) => awaken)
      subJobsThatAwakenJob.forEach(({job: subJob}) => {
        debug('remembering to awaken %s when job %s finishes', jobWithId.id, subJob.id)
        awakenFor.set(subJob.id, jobWithId)
      })

      debug('dispatching subjobs of parent job %s', jobWithId.id)
      await Promise.all(subJobsWithId.map(async ({job}) => await dispatchJob(job)))
    }
  }

  async function awakenParentJobIfNeeded(jobWithId, subJobResult) {
    const parentJob = awakenFor.get(jobWithId.id)
    if (!parentJob) {
      debug('no parent job to awaken for job %s', jobWithId.id)
      return
    }

    debug('dispatching parent job %o because %o awakened', parentJob, jobWithId)
    await dispatchJob(parentJob, {awakenedFrom: {job: jobWithId, result: subJobResult}})
  }
}
