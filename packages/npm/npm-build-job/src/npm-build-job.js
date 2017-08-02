'use strict'

const debug = require('debug')('bildit:npm-build-job')
const symlinkDependencies = require('./symlink-dependencies')

module.exports = async ({pluginInfo: {job: {kind}}}) => {
  if (kind !== 'npm') return false

  return {
    async runJob(job, {agent}) {
      const {
        dependencies,
        artifacts,
        artifactsDirectory,
        directory,
        filesChangedSinceLastBuild,
      } = job
      const packageJsonChanged =
        !filesChangedSinceLastBuild || filesChangedSinceLastBuild.includes('package.json')

      if (packageJsonChanged) {
        if (dependencies) {
          debug('linking to dependent packages %o', dependencies)
          await symlinkDependencies(dependencies, directory, artifacts, artifactsDirectory)
        }

        debug('running npm install in job %o', job)
        await agent.executeCommand(['npm', 'install'])
      }

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
