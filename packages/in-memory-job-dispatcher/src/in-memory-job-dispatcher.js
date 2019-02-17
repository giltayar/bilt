'use strict'
const {runJob, prepareJobForRunning} = require('@bilt/jobs')

/**
 * @type JobDispatcher
 */
class JobDispatcher {} // eslint-disable-line

/**
 *
 * @param {{jobRunner: import('@bilt/jobs').JobRunner}} options
 * @returns {Promise<JobDispatcher>}
 */
async function makeJobDispatcher({jobRunner}) {
  return {jobRunner, jobQueue: []}
}

/**
 * @typedef {{job: object, result: {success: boolean}}}  AwakenedFrom
 * @param {JobDispatcher} jobDispatcher
 * @param {object} job
 * @param {{awakenedFrom: AwakenedFrom}}
 * @returns {Promise<void>}
 */
async function dispatchJob(jobDispatcher, job, {awakenedFrom} = {}) {
  const {jobQueue, jobRunner} = jobDispatcher
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

    runJob(jobRunner, job, {
      awakenedFrom,
      dispatchJob: (...args) => dispatchJob(jobDispatcher, ...args),
    }).then(nextJob, err => nextJob(null, err))
  }

  nextJob()

  return preparedJob
}

module.exports = {makeJobDispatcher, dispatchJob}
