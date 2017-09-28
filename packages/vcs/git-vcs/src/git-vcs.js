'use strict'
const {promisify: p} = require('util')
const debug = require('debug')('bildit:git-vcs')
const {initializer, gitOverrideLocalConfigEnvVariables} = require('@bildit/git-commons')

module.exports = initializer(({ensureAgentInstanceInitialized}, {config, pimport}) => {
  return {
    async setupBuildSteps({job, agentInstance, directory, message}) {
      const {homeDir} = await ensureAgentInstanceInitialized({agentInstance}, {config, pimport})

      return {howToBuild: {homeDir, directory, agentInstance, message}}
    },
    getCommitAndPushBuildSteps({howToBuild: {homeDir, directory, agentInstance, message}}) {
      debug('committing patch changes %s', message)
      const buildSteps = []

      buildSteps.push({
        agentInstance,
        command: ['git', 'commit', '-am', message],
        cwd: directory,
        env: gitOverrideLocalConfigEnvVariables(homeDir),
      })

      debug('pushing to remote repo')
      buildSteps.push({
        agentInstance,
        command: ['git', 'push', '--set-upstream', 'origin', 'master'],
        cwd: directory,
        env: gitOverrideLocalConfigEnvVariables(homeDir),
      })

      return {buildSteps}
    },
    async push({agentInstance, directory}) {
      debug('pushing to remote repo')
      const {homeDir, agent} = await ensureAgentInstanceInitialized(
        {agentInstance},
        {config, pimport},
      )
      await agent.executeCommand({
        agentInstance,
        command: ['git', 'push', '--set-upstream', 'origin', 'master'],
        cwd: directory,
        env: gitOverrideLocalConfigEnvVariables(homeDir),
      })
    },
    async listDirtyFiles({agentInstance, directory}) {
      debug('listing diry files of repo in agent %s', agentInstance.id)
      const {homeDir, agent} = await ensureAgentInstanceInitialized(
        {agentInstance},
        {config, pimport},
      )

      const status = await agent.executeCommand({
        agentInstance,
        command: ['git', 'status', '--porcelain'],
        cwd: directory,
        returnOutput: true,
        env: gitOverrideLocalConfigEnvVariables(homeDir),
      })

      return status.split('\n').map(line => line.slice(3))
    },
  }
})
