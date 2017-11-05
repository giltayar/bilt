'use strict'
const path = require('path')
const debug = require('debug')('bildit:git-repository-fetcher')
const computeDirectoryNameFromRepository = require('./compute-directory-name')

module.exports = async ({appConfig: {repository}, pimport, plugins: [gitCommander]}) => {
  return {
    async fetchRepository({agentInstance, subdirectory}) {
      const agent = await pimport(agentInstance.kind)
      const buildDir = agent.buildDir()

      const directory = path.join(buildDir, computeDirectoryNameFromRepository(repository))

      const gitCommanderSetup = await gitCommander.setup({agentInstance})
      const transform = command =>
        gitCommander.transformAgentCommand(command, {setup: gitCommanderSetup})

      try {
        debug('Checking if repository %s was fetched', repository)
        const status = await agent.executeCommand(
          transform({
            agentInstance,
            command: ['git', 'status', '--porcelain'],
            cwd: directory,
            returnOutput: true,
          }),
        )
        debug('Repository %s was fetched')
        if (status.length > 0) {
          debug('Resetting repository %s', repository)
          await agent.executeCommand(
            transform({
              agentInstance,
              command: ['git', 'reset', '--hard'],
              cwd: directory,
            }),
          )
        }
      } catch (_) {
        debug('cloning repository %s', repository)
        await agent.executeCommand(
          transform({
            agentInstance,
            command: ['git', 'clone', repository, directory],
          }),
        )
      }

      return {directory: subdirectory ? path.join(directory, subdirectory) : directory}
    },
  }
}
module.exports.plugins = ['commander:git']
