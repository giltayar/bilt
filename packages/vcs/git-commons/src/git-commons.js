'use strict'
const path = require('path')
const fs = require('fs')
const os = require('os')
const {promisify: p} = require('util')
const {initializer} = require('@bildit/agent-commons')

const gitInitializer = module =>
  initializer(async (...moduleArgs) => {
    const [
      ,
      {
        config: {
          gitAuthenticationKey,
          gitUserEmail,
          gitUserName,
          usedLocally = !gitAuthenticationKey,
        },
        pimport,
      },
    ] = moduleArgs

    const plugin = await module(...moduleArgs)

    return {...plugin, [initializer.initializationFunction]: initializeGit}

    async function initializeGit({agentInstance}) {
      const agent = await pimport(agentInstance.kind)
      const homeDir =
        usedLocally && gitAuthenticationKey
          ? await p(fs.mkdtemp)(os.tmpdir())
          : await agent.homeDir(agentInstance)

      await agent.writeBufferToFile(
        agentInstance,
        path.join(homeDir, '.ssh/config'),
        Buffer.from(''),
      )

      if (gitAuthenticationKey) {
        const idRsaPath = path.join(homeDir, '.ssh/id_rsa')
        await agent.writeBufferToFile(agentInstance, idRsaPath, Buffer.from(gitAuthenticationKey))

        await agent.executeCommand(agentInstance, ['chmod', '600', idRsaPath])
      }

      if (gitUserEmail)
        await agent.executeCommand(
          agentInstance,
          ['git', 'config', '--global', 'user.email', gitUserEmail],
          {env: gitOverrideLocalConfigEnvVariables(homeDir)},
        )

      if (gitUserName)
        await agent.executeCommand(
          agentInstance,
          ['git', 'config', '--global', 'user.name', gitUserName],
          {env: gitOverrideLocalConfigEnvVariables(homeDir)},
        )

      return {homeDir, agent}
    }
  })

function gitOverrideLocalConfigEnvVariables(homeDir) {
  return {
    HOME: homeDir,
    GIT_SSH_COMMAND: `ssh -o 'StrictHostKeyChecking no' -F '${homeDir}/.ssh/config' -i '${homeDir}/.ssh/id_rsa'`,
  }
}

module.exports = {
  initializer: gitInitializer,
  gitOverrideLocalConfigEnvVariables,
}
