'use strict'
const {runJob, prepareJobForRunning} = require('@bilt/jobs')

module.exports = async ({pimport}) => {
  const events = await pimport('events')
  const kvStore = new Map()

  async function dispatchJob(job, {awakenedFrom} = {}) {
    const preparedJob = prepareJobForRunning(job)

    await runJob(preparedJob, {awakenedFrom, pimport, events, kvStore, dispatchJob})

    return preparedJob
  }

  return {
    dispatchJob,
    async hasAbortedJobs() {
      return false
    },
  }
}
