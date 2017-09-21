'use strict'

const path = require('path')
const debug = require('debug')('bildit:npm-build-job')
const symlinkDependencies = require('./symlink-dependencies')

module.exports = async ({
  pimport,
  config: {publish, linkLocalPackages},
  appConfig: {publish: appPublish},
}) => {
  const npmPublisher = await pimport('publisher:npm')

  return {
    async build(job, {agent}) {
      const agentInstance = await agent.acquireInstanceForJob(job)

      const {dependencies, artifacts, artifactPath, filesChangedSinceLastBuild} = job
      const packageJsonChanged =
        !filesChangedSinceLastBuild || filesChangedSinceLastBuild.includes('package.json')

      if (packageJsonChanged) {
        if (dependencies && linkLocalPackages) {
          debug('linking to dependent packages %o', dependencies)
          await symlinkDependencies({agent, agentInstance}, dependencies, artifactPath, artifacts)
        }

        debug('running npm install in job %o', job)
        await agent.executeCommand(agentInstance, ['npm', 'install'], {cwd: artifactPath})
      }

      const packageJson = JSON.parse(
        await agent.readFileAsBuffer(agentInstance, path.join(artifactPath, 'package.json')),
      )

      if ((packageJson.scripts || {}).build) {
        debug('running npm run build in job %o', job)

        await agent.executeCommand(agentInstance, ['npm', 'run', 'build'], {cwd: artifactPath})
      }

      if ((packageJson.scripts || {}).test) {
        debug('running npm test in job %o', job)

        await agent.executeCommand(agentInstance, ['npm', 'test'], {cwd: artifactPath})
      }

      if ((publish || appPublish) && !packageJson.private) {
        await npmPublisher.publishPackage(job, {agent, agentInstance})
      } else {
        debug(
          `not publishing because config publish is ${publish} or package json is private (${packageJson.private}`,
        )
      }

      agent.releaseInstanceForJob(agentInstance)
    },
  }
}
