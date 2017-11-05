'use strict'
const {promisify: p} = require('util')
const fs = require('fs')
const os = require('os')
const path = require('path')
const {initializer} = require('@bildit/agent-commons')
const debug = require('debug')('bildit:npm-commander')

module.exports = initializer(
  async (
    {ensureAgentInstanceInitialized},
    {config: {npmAuthenticationLine, access = 'restricted'}, pimport},
  ) => {
    return {
      async setup({agentInstance}) {
        debug(`setting up npm on agent instance %s`, agentInstance.id)
        return await ensureAgentInstanceInitialized({agentInstance})
      },

      transformAgentCommand(commandArgs, {setup: {homeDir}}) {
        return {
          ...commandArgs,
          env: {
            npm_config_userconfig: path.join(homeDir, '.npmrc'),
            npm_config_registry: process.env.npm_config_registry,
          },
          ...(commandArgs.command[1] === 'publish' ? {access} : {}),
        }
      },

      async [initializer.initializationFunction]({agentInstance}) {
        debug('initializing agent instance with npm', agentInstance.id)
        const agent = await pimport(agentInstance.kind)
        const homeDir = npmAuthenticationLine
          ? await p(fs.mkdtemp)(os.tmpdir())
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
