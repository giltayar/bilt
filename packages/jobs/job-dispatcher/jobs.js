'use strict'

module.exports = ({pluginRepository, events}) => {
  return {
    async runJob(job) {
      const plugin = await pluginRepository.findPlugin({kind: 'Job', jobKind: job.xxx})

      await events.publishEvent('START_JOB', {job})

      const jobResult = await plugin.runJob(job)

      await events.publishEvent('END_JOB', {job, jobResult})

      return jobResult
    },
  }
}
