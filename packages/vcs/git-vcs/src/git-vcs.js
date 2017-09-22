'use strict'
const fs = require('fs')
const os = require('os')
const path = require('path')
const {promisify: p} = require('util')
const debug = require('debug')('bildit:git-vcs')
const {initializer} = require('@bildit/agent-commons')

module.exports = initializer(
  (
    {ensureAgentInstanceInitialized},
    {
      config: {
        gitAuthenticationKey,
        gitUserEmail,
        gitUserName,
        usedLocally = !gitAuthenticationKey,
      },
      pimport,
    },
  ) => {
    return {
      async fetchRepository({agentInstance, repository}) {
        const {homeDir, agent} = await ensureAgentInstanceInitialized({agentInstance})

        try {
          debug('Checking if repository %s was fetched', repository)
          const status = await agent.executeCommand(
            agentInstance,
            ['git', 'status', '--porcelain'],
            {
              cwd: agent.buildDir(),
              returnOutput: true,
              env: gitOverrideLocalConfigEnvVariables(homeDir),
            },
          )
          debug('Repository %s was fetched')
          if (status.length > 0) {
            debug('Resetting repository %s', repository)
            await agent.executeCommand(agentInstance, ['git', 'reset', '--hard'], {
              cwd: agent.buildDir(),
              env: gitOverrideLocalConfigEnvVariables(homeDir),
            })
          }
        } catch (_) {
          debug('cloning repository %s', repository)
          await agent.executeCommand(
            agentInstance,
            ['git', 'clone', repository, agent.buildDir()],
            {
              env: gitOverrideLocalConfigEnvVariables(homeDir),
            },
          )
        }
      },
      async commitAndPush({agentInstance, message}) {
        debug('committing patch changes %s', message)
        const {homeDir, agent} = await ensureAgentInstanceInitialized({agentInstance})

        await agent.executeCommand(agentInstance, ['git', 'commit', '-am', message], {
          cwd: agent.buildDir(),
          env: gitOverrideLocalConfigEnvVariables(homeDir),
        })

        debug('pushing to remote repo')
        await agent.executeCommand(
          agentInstance,
          ['git', 'push', '--set-upstream', 'origin', 'master'],
          {
            cwd: agent.buildDir(),
            env: gitOverrideLocalConfigEnvVariables(homeDir),
          },
        )
      },
      async push({agentInstance}) {
        debug('pushing to remote repo')
        const {homeDir, agent} = await ensureAgentInstanceInitialized({agentInstance})
        await agent.executeCommand(
          agentInstance,
          ['git', 'push', '--set-upstream', 'origin', 'master'],
          {
            cwd: agent.buildDir(),
            env: gitOverrideLocalConfigEnvVariables(homeDir),
          },
        )
      },
      async listDirtyFiles({agentInstance}) {
        debug('listing diry files of repo in agent %s', agentInstance.id)
        const {homeDir, agent} = await ensureAgentInstanceInitialized({agentInstance})

        const status = await agent.executeCommand(agentInstance, ['git', 'status', '--porcelain'], {
          cwd: agent.buildDir(),
          returnOutput: true,
          env: gitOverrideLocalConfigEnvVariables(homeDir),
        })

        return status.split('\n').map(line => line.slice(3))
      },

      async [initializer.initializationFunction]({agentInstance}) {
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
