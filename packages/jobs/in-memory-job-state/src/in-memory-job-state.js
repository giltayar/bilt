'use strict'

const debug = require('debug')('bildit:in-memory-job-state')

module.exports = async () => {
  const stateOfJobs = new Map()

  return {
    async getState(job) {
      debug('getting state for job %s', job.id)

      return stateOfJobs.get(job.id)
    },

    async setState(job, state) {
      debug('setting state for job %s to %o', job.id, state)

      stateOfJobs.set(job.id, state)
    },
  }
}
