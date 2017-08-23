'use strict'

const path = require('path')
const debug = require('debug')('bildit:npm-build-job')
const symlinkDependencies = require('./symlink-dependencies')

module.exports = async ({pluginInfo: {job: {kind}}}) => {
  if (kind !== 'npm') return false

  return {
    async runJob(job, {agent}) {
      const {dependencies, artifacts, artifactPath, filesChangedSinceLastBuild} = job
      const packageJsonChanged =
        !filesChangedSinceLastBuild || filesChangedSinceLastBuild.includes('package.json')

      if (packageJsonChanged) {
        if (dependencies) {
          debug('linking to dependent packages %o', dependencies)
          await symlinkDependencies(dependencies, artifactPath, artifacts, agent)
        }

        debug('running npm install in job %o', job)
        await agent.executeCommand(['npm', 'install'], {cwd: artifactPath})
      }

      const packageJson = JSON.parse(
        await agent.readFileAsBuffer(path.join(artifactPath, 'package.json')),
      )

      if ((packageJson.scripts || {}).build) {
        debug('running npm run build in job %o', job)

        await agent.executeCommand(['npm', 'run', 'build'], {cwd: artifactPath})
      }

      if ((packageJson.scripts || {}).test) {
        debug('running npm test in job %o', job)

        await agent.executeCommand(['npm', 'test'], {cwd: artifactPath})
      }
    },
  }
}
