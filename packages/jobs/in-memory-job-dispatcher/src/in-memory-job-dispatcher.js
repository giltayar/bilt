'use strict'
const {runJob, prepareJobForRunning} = require('@bildit/jobs')

module.exports = async ({pluginRepository, events}) => {
  const kvStore = new Map()

  async function dispatchJob(job, {awakenedFrom} = {}) {
    const preparedJob = prepareJobForRunning(job)

    await runJob(preparedJob, {awakenedFrom, pluginRepository, events, kvStore, dispatchJob})

    return preparedJob
  }

  return {
    dispatchJob,
    async hasAbortedJobs() {
      return false
    },
  }
}
