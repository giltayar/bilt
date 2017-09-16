'use strict'
const fs = require('fs')
const os = require('os')
const path = require('path')
const {promisify: p} = require('util')
const debug = require('debug')('bildit:git-vcs')

module.exports = ({
  pluginConfig: {
    gitAuthenticationKey,
    gitUserEmail,
    gitUserName,
    usedLocally = !gitAuthenticationKey,
  },
}) => {
  const initializedAgentInstances = new Map()

  return {
    async fetchRepository({agent, agentInstance, repository}) {
      const homeDir = await initializeAgentInstanceIfNeeded({agent, agentInstance})

      try {
        debug('Checking if repository %s was fetched', repository)
        const status = await agent.executeCommand(agentInstance, ['git', 'status', '--porcelain'], {
          cwd: agent.buildDir(),
          returnOutput: true,
          env: gitOverrideLocalConfigEnvVariables(homeDir),
        })
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
        await agent.executeCommand(agentInstance, ['git', 'clone', repository, agent.buildDir()], {
          env: gitOverrideLocalConfigEnvVariables(homeDir),
        })
      }
    },
    async commitAndPush({agent, agentInstance, message}) {
      debug('committing patch changes %s', message)
      const homeDir = await initializeAgentInstanceIfNeeded({agent, agentInstance})

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
    async push({agent, agentInstance}) {
      const homeDir = await initializeAgentInstanceIfNeeded({agent, agentInstance})
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
    async listDirtyFiles({agent, agentInstance}) {
      debug('listing diry files of repo in agent %s', agentInstance.id)
      const homeDir = await initializeAgentInstanceIfNeeded({agent, agentInstance})

      const status = await agent.executeCommand(agentInstance, ['git', 'status', '--porcelain'], {
        cwd: agent.buildDir(),
        returnOutput: true,
        env: gitOverrideLocalConfigEnvVariables(homeDir),
      })

      return status.split('\n').map(line => line.slice(3))
    },
  }

  async function initializeAgentInstanceIfNeeded({agent, agentInstance}) {
    if (initializedAgentInstances.has(agentInstance.id))
      return initializedAgentInstances.get(agentInstance.id).homeDir

    const homeDir =
      usedLocally && gitAuthenticationKey
        ? await p(fs.mkdtemp)(os.tmpdir())
        : await agent.homeDir(agentInstance)

    await agent.writeBufferToFile(agentInstance, path.join(homeDir, '.ssh/config'), Buffer.from(''))

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
    initializedAgentInstances.set(agentInstance.id, {homeDir})

    return homeDir
  }
}

function gitOverrideLocalConfigEnvVariables(homeDir) {
  return {
    HOME: homeDir,
    GIT_SSH_COMMAND: `ssh -o 'StrictHostKeyChecking no' -F '${homeDir}/.ssh/config' -i '${homeDir}/.ssh/id_rsa'`,
  }
}
