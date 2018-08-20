'use strict'
const {promisify: p} = require('util')
const fs = require('fs')
const os = require('os')
const path = require('path')
const {initializer} = require('@bilt/agent-commons')
const debug = require('debug')('bilt:npm-commander')

module.exports = initializer(
  async (
    {ensureAgentInstanceInitialized},
    {config: {npmAuthenticationLine, npmRegistry = undefined}, pimport},
  ) => {
    return {
      async setup({agentInstance}) {
        debug(`setting up npm on agent instance %s`, agentInstance.id)
        return await ensureAgentInstanceInitialized({agentInstance})
      },

      transformAgentCommand(
        commandArgs,
        {
          setup: {homeDir},
        },
      ) {
        const registry = npmRegistry || process.env.npm_config_registry
        return {
          ...commandArgs,
          env: {
            npm_config_userconfig: path.join(homeDir, '.npmrc'),
            ...(registry ? {npm_config_registry: registry} : undefined),
          },
        }
      },

      async [initializer.initializationFunction]({agentInstance}) {
        debug('initializing agent instance with npm', agentInstance.id)
        const agent = await pimport(agentInstance.kind)
        const homeDir = npmAuthenticationLine
          ? await p(fs.mkdtemp)(os.tmpdir() + '/')
          : await agent.homeDir(agentInstance)

        if (npmAuthenticationLine) {
          debug(
            'creating npmrc with authentication line in homedir %s',
            npmAuthenticationLine,
            homeDir,
          )

          await agent.writeBufferToFile(
            agentInstance,
            path.join(homeDir, '.npmrc'),
            Buffer.from(npmAuthenticationLine),
          )
        }

        return {homeDir}
      },
    }
  },
)
