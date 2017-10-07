'use strict'
const path = require('path')
const semver = require('semver')
const debug = require('debug')('bildit:npm-publisher-with-git')

module.exports = async ({pimport, plugins: [npmAgentCommander, vcs]}) => {
  return {
    async setupBuildSteps({job, agentInstance, directory, packageJson}) {
      debug(`publishing for job %o`, job)
      const agent = await pimport(agentInstance.kind)

      const {artifactPath} = job

      await ensureNoDirtyGitFiles(vcs, agent, agentInstance, directory, artifactPath)

      const {version} = packageJson
      const newVersion = semver.inc(version, 'patch', true)
      debug('npm version is %s, new version will be %s', version, newVersion)

      const {howToBuild: commitAndPushHowToBuild} = await vcs.setupBuildSteps({
        agentInstance,
        directory,
        message: newVersion,
      })

      const npmAgentCommanderSetup = await npmAgentCommander.setup({agentInstance})

      return {
        howToBuild: {directory, agentInstance, commitAndPushHowToBuild, npmAgentCommanderSetup},
      }
    },
    getBuildSteps({
      howToBuild: {directory, agentInstance, commitAndPushHowToBuild, npmAgentCommanderSetup},
    }) {
      debug('npm publishing')

      const transform = command =>
        npmAgentCommander.transformAgentCommand(command, {setup: npmAgentCommanderSetup})

      const buildSteps = []

      buildSteps.push(
        transform({
          agentInstance,
          command: ['npm', 'version', 'patch', '--force', '--no-git-tag-version'],
          cwd: directory,
          returnOutput: true,
        }),
      )

      buildSteps.push(
        transform({
          agentInstance,
          command: ['npm', 'publish', '--access'],
          cwd: directory,
        }),
      )

      buildSteps.push(
        ...vcs.getCommitAndPushBuildSteps({howToBuild: commitAndPushHowToBuild}).buildSteps,
      )

      return {buildSteps}
    },
  }
}

module.exports.plugins = ['agentCommander:npm', 'vcs']

async function ensureNoDirtyGitFiles(vcs, agent, agentInstance, directory, artifactPath) {
  const dirtyFiles = await vcs.listDirtyFiles({
    agentInstance,
    directory,
  })

  if (dirtyFiles.filter(l => !!l).length > 0) {
    throw new Error(
      `Cannot publish artifact in ${artifactPath} because it has dirty files:\n${dirtyFiles}`,
    )
  }
}
