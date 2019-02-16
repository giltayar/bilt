'use strict'
const {runJob, prepareJobForRunning} = require('@bilt/jobs')

/**
 * @type JobDispatcher
 */
class JobDispatcher {} // eslint-disable-line

/**
 *
 * @param {{pimport: (plugin: string) => Promise<any>, disabledSteps: string[], enabledSteps: string[]}} options
 * @returns {Promise<JobDispatcher>}
 */
async function makeJobDispatcher({pimport, disabledSteps, enabledSteps}) {
  return {pimport, disabledSteps, enabledSteps, kvStore: new Map(), jobQueue: []}
}

/**
 * @typedef {{job: object, result: {success: boolean}}}  AwakenedFrom
 * @param {JobDispatcher} jobDispatcher
 * @param {object} job
 * @param {{awakenedFrom: AwakenedFrom, events: import('@bilt/in-memory-events').InMemoryEvents}}
 * @returns {Promise<void>}
 */
async function dispatchJob(jobDispatcher, job, {awakenedFrom, events} = {}) {
  const {pimport, disabledSteps, enabledSteps, kvStore, jobQueue} = jobDispatcher
  const preparedJob = prepareJobForRunning(job)

  jobQueue.push(preparedJob)

  if (jobQueue.length > 1) return preparedJob

  function nextJob(_, err) {
    if (err) {
      console.error(err)
      return
    }
    if (jobQueue.length === 0) return
    const job = jobQueue.shift()

    runJob(job, {
      awakenedFrom,
      pimport,
      events,
      kvStore,
      dispatchJob: (...args) => dispatchJob(jobDispatcher, ...args),
      disabledSteps,
      enabledSteps,
    }).then(nextJob, err => nextJob(null, err))
  }

  nextJob()

  return preparedJob
}

module.exports = {makeJobDispatcher, dispatchJob}
