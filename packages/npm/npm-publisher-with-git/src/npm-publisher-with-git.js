'use strict'
const path = require('path')
const semver = require('semver')
const debug = require('debug')('bildit:npm-publisher-with-git')

module.exports = async ({pimport, plugins: [npmAgentCommander, gitAgentCommander]}) => {
  return {
    async setupBuildSteps({job, agentInstance, directory, packageJson}) {
      debug(`publishing for job %o`, job)
      const agent = await pimport(agentInstance.kind)

      const {artifactPath} = job

      const {version} = packageJson
      const newVersion = semver.inc(version, 'patch', true)
      debug('npm version is %s, new version will be %s', version, newVersion)

      const npmAgentCommanderSetup = await npmAgentCommander.setup({agentInstance})
      const gitAgentCommanderSetup = await gitAgentCommander.setup({agentInstance})

      await ensureNoDirtyGitFiles(
        agent,
        agentInstance,
        directory,
        artifactPath,
        gitAgentCommanderSetup,
      )

      return {
        howToBuild: {
          directory,
          agentInstance,
          npmAgentCommanderSetup,
          gitAgentCommanderSetup,
          message: newVersion,
        },
      }
    },
    getBuildSteps({
      howToBuild: {
        directory,
        agentInstance,
        npmAgentCommanderSetup,
        gitAgentCommanderSetup,
        message,
      },
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
        ...getCommitAndPushBuildSteps(agentInstance, directory, message, gitAgentCommanderSetup),
      )

      return {buildSteps}
    },
  }

  function getCommitAndPushBuildSteps(agentInstance, directory, message, gitAgentCommanderSetup) {
    debug('committing patch changes %s', message)
    const transform = command =>
      gitAgentCommander.transformAgentCommand(command, {setup: gitAgentCommanderSetup})
    const buildSteps = []

    buildSteps.push(
      transform({
        agentInstance,
        command: ['git', 'add', '.'],
        cwd: directory,
      }),
    )
    buildSteps.push(
      transform({
        agentInstance,
        command: ['git', 'commit', '-am', message],
        cwd: directory,
      }),
    )

    debug('pushing to remote repo')

    buildSteps.push(
      transform({
        agentInstance,
        command: ['git', 'push', '--set-upstream', 'origin', 'master'],
        cwd: directory,
      }),
    )

    return buildSteps
  }

  async function ensureNoDirtyGitFiles(
    agent,
    agentInstance,
    directory,
    artifactPath,
    gitAgentCommanderSetup,
  ) {
    debug('listing diry files of repo in agent %s', agentInstance.id)
    const transform = command =>
      gitAgentCommander.transformAgentCommand(command, {setup: gitAgentCommanderSetup})

    const status = await agent.executeCommand(
      transform({
        agentInstance,
        command: ['git', 'status', '--porcelain'],
        cwd: directory,
        returnOutput: true,
      }),
    )

    if (status.split('\n').filter(l => !!l).length > 0) {
      throw new Error(
        `Cannot publish artifact in ${directory} because it has dirty files:\n${status}`,
      )
    }
  }
}

module.exports.plugins = ['agentCommander:npm', 'agentCommander:git']
