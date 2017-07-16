'use strict'
const debug = require('debug')('bildit:job-dispatcher')

module.exports = ({pluginRepository, events}) => {
  return {
    async dispatchJob(job, commandExecutor) {
      debug('dispatching job %o', job)
      const plugin = await pluginRepository.findPlugin({kind: 'JobRunner', jobKind: job.xxx})

      await events.publish('START_JOB', {job})

      debug('running job %o', job)
      const jobResult = await plugin.runJob(job, commandExecutor)
      debug('ran job %o', job)

      await events.publish('END_JOB', {job, jobResult})

      debug('dispatched job %o', job)

      return jobResult
    },
  }
}
