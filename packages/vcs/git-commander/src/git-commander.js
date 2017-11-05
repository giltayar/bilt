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
    {config: {gitAuthenticationKey, gitUserEmail, gitUserName}, pimport},
  ) => {
    return {
      async setup({agentInstance}) {
        debug(`setting up npm on agent instance %s`, agentInstance.id)

        return await ensureAgentInstanceInitialized({agentInstance})
      },

      transformAgentCommand(commandArgs, {setup: {homeDir}}) {
        return {
          ...commandArgs,
          env: gitOverrideLocalConfigEnvVariables(homeDir),
        }
      },

      async [initializer.initializationFunction]({agentInstance}) {
        const agent = await pimport(agentInstance.kind)
        const homeDir = gitAuthenticationKey
          ? await p(fs.mkdtemp)(os.tmpdir())
          : await agent.homeDir(agentInstance)

        if (gitAuthenticationKey) {
          await agent.writeBufferToFile(
            agentInstance,
            path.join(homeDir, '.ssh/config'),
            Buffer.from(''),
          )
        }

        if (gitAuthenticationKey) {
          const idRsaPath = path.join(homeDir, '.ssh/id_rsa')
          await agent.writeBufferToFile(agentInstance, idRsaPath, Buffer.from(gitAuthenticationKey))

          await agent.executeCommand({agentInstance, command: ['chmod', '600', idRsaPath]})
        }

        if (gitUserEmail)
          await agent.executeCommand({
            agentInstance,
            command: ['git', 'config', '--global', 'user.email', gitUserEmail],
            env: gitOverrideLocalConfigEnvVariables(homeDir),
          })

        if (gitUserName)
          await agent.executeCommand({
            agentInstance,
            command: ['git', 'config', '--global', 'user.name', gitUserName],
            env: gitOverrideLocalConfigEnvVariables(homeDir),
          })

        return {homeDir, agent}
      },
    }
  },
)

function gitOverrideLocalConfigEnvVariables(homeDir) {
  return {
    HOME: homeDir,
    GIT_SSH_COMMAND: `ssh -o 'StrictHostKeyChecking no' -F '${homeDir}/.ssh/config' -i '${homeDir}/.ssh/id_rsa'`,
  }
}
