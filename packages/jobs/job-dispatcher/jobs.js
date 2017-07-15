'use strict'

module.exports = ({pluginRepository, events}) => {
  return {
    async runJob(job) {
      const plugin = pluginRepository.findPlugin({kind: 'Job', jobKind: job.xxx})

      events.publishEvent('START_JOB', {job})

      const jobResult = plugin.runJob(job)

      events.publishEvent('END_JOB', {job, jobResult})

      return jobResult
    },
  }
}
