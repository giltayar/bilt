'use strict'
const {runJob} = require('@bildit/jobs')

module.exports = async ({pluginRepository, events}) => {
  const kvStore = new Map()

  async function dispatchJob(job, {awakenedFrom} = {}) {
    await runJob(job, {awakenedFrom, pluginRepository, events, kvStore, dispatchJob})
  }

  return {
    dispatchJob,
  }
}
