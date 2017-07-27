'use strict'
const debug = require('debug')('bildit:job-dispatcher')

module.exports = async ({pluginRepository, events}) => {
  return {
    async dispatchJob(job) {
      debug('dispatching job %o', job)
      const jobRunner = await pluginRepository.findPlugin({kind: 'jobRunner', job})
      const agent = await pluginRepository.findPlugin({kind: 'agent', job})

      await events.publish('START_JOB', {job})

      debug('running job %o', job)
      const jobResult = await jobRunner.runJob(job, {agent})
      debug('ran job %o', job)

      await events.publish('END_JOB', {job, jobResult})

      debug('dispatched job %o', job)

      return jobResult
    },
  }
}
