'use strict'
const path = require('path')
const {initializer, gitOverrideLocalConfigEnvVariables} = require('@bildit/git-commons')
const debug = require('debug')('bildit:git-repository-fetcher')
const computeDirectoryNameFromRepository = require('./compute-directory-name')

module.exports = initializer(
  async ({ensureAgentInstanceInitialized}, {appConfig: {repository}}) => {
    return {
      async fetchRepository({agentInstance, subdirectory}) {
        const {agent, homeDir} = await ensureAgentInstanceInitialized({agentInstance})

        const buildDir = agent.buildDir()

        const directory = path.join(buildDir, computeDirectoryNameFromRepository(repository))

        try {
          debug('Checking if repository %s was fetched', repository)
          const status = await agent.executeCommand(
            agentInstance,
            ['git', 'status', '--porcelain'],
            {
              cwd: directory,
              returnOutput: true,
              env: gitOverrideLocalConfigEnvVariables(homeDir),
            },
          )
          debug('Repository %s was fetched')
          if (status.length > 0) {
            debug('Resetting repository %s', repository)
            await agent.executeCommand(agentInstance, ['git', 'reset', '--hard'], {
              cwd: directory,
              env: gitOverrideLocalConfigEnvVariables(homeDir),
            })
          }
        } catch (_) {
          debug('cloning repository %s', repository)
          await agent.executeCommand(agentInstance, ['git', 'clone', repository, directory], {
            env: gitOverrideLocalConfigEnvVariables(homeDir),
          })
        }

        return {directory: path.join(directory, subdirectory)}
      },
    }
  },
)
