'use strict'

const debug = require('debug')('bildit:npm-build-job')

module.exports = async ({pluginInfo: {job: {kind}}}) => {
  if (kind !== 'npm') return false

  return {
    async runJob(job, {agent}) {
      debug('running npm install in job %o', job)
      await agent.executeCommand(['npm', 'install'])
      const packageJson = JSON.parse(await agent.readFileAsBuffer('package.json'))

      if ((packageJson.scripts || {}).build) {
        debug('running npm run build in job %o', job)

        await agent.executeCommand(['npm', 'run', 'build'])
      }

      if ((packageJson.scripts || {}).test) {
        debug('running npm test in job %o', job)

        await agent.executeCommand(['npm', 'test'])
      }
    },
  }
}
