'use strict'
const debug = require('debug')('bildit:job-dispatcher')

module.exports = ({pluginRepository, events}) => {
  return {
    async dispatchJob(job) {
      debug('dispatching job %o', job)
      const plugin = await pluginRepository.findPlugin({kind: 'Job', jobKind: job.xxx})

      await events.publish('START_JOB', {job})

      const jobResult = await plugin.runJob(job)

      await events.publish('END_JOB', {job, jobResult})

      debug('dispatched job %o', job)

      return jobResult
    },
  }
}
