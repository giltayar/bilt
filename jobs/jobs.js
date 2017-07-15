"use strict"

module.exports = ({ pluginRepository }) => {
  return {
    async runJob(job) {
      const plugin = pluginRepository.findPlugin({ kind: "Job", jobKind: job.xxx })

      return plugin.runJob(job)
    }
  }
}
