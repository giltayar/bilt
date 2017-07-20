'use strict'
const debug = require('debug')('bildit:job-dispatcher')

module.exports = ({pluginRepository, events}) => {
  return {
    async dispatchJob(job, agentFunctions) {
      debug('dispatching job %o', job)
      const plugin = await pluginRepository.findPlugin({kind: 'JobRunner', job})

      await events.publish('START_JOB', {job})

      debug('running job %o', job)
      const jobResult = await plugin.runJob(job, agentFunctions)
      debug('ran job %o', job)

      await events.publish('END_JOB', {job, jobResult})

      debug('dispatched job %o', job)

      return jobResult
    },
  }
}
