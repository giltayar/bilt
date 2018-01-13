'use strict'
const {runJob, prepareJobForRunning} = require('@bilt/jobs')

module.exports = async ({pimport}) => {
  const events = await pimport('events')
  const kvStore = new Map()

  const jobQueue = []

  async function dispatchJob(job, {awakenedFrom} = {}) {
    const preparedJob = prepareJobForRunning(job)

    jobQueue.push(preparedJob)

    if (jobQueue.length > 1) return preparedJob

    function nextJob() {
      if (jobQueue.length === 0) return
      const job = jobQueue.shift()

      runJob(job, {awakenedFrom, pimport, events, kvStore, dispatchJob}).then(nextJob, nextJob)
    }

    nextJob()

    return preparedJob
  }

  return {
    dispatchJob,
    async hasAbortedJobs() {
      return false
    },
  }
}
