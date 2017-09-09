'use strict'

const path = require('path')
const debug = require('debug')('bildit:git-vcs')

module.exports = ({
  pluginConfig: {
    gitAuthenticationKey,
    gitUserEmail,
    gitUserName,
    usedLocally = !gitAuthenticationKey,
  },
}) => {
  const initializedAgentInstances = new Set()

  return {
    async fetchRepository({agent, agentInstance, repository}) {
      await initializeAgentInstanceIfNeeded({agent, agentInstance})

      try {
        debug('Checking if repository %s was fetched', repository)
        const status = await agent.executeCommand(agentInstance, ['git', 'status', '--porcelain'], {
          cwd: agent.buildDir(agentInstance),
          returnOutput: true,
        })
        debug('Repository %s was fetched')
        if (status.length > 0) {
          debug('Resetting repository %s', repository)
          await agent.executeCommand(agentInstance, ['git', 'reset', '--hard'], {
            cwd: agent.buildDir(agentInstance),
          })
        }
      } catch (_) {
        debug('cloning repository %s', repository)
        await agent.executeCommand(agentInstance, [
          'git',
          'clone',
          repository,
          agent.buildDir(agentInstance),
        ])
      }
    },
    async commitAndPush({agent, agentInstance, message}) {
      debug('committing patch changes %s', message)
      await agent.executeCommand(agentInstance, ['git', 'commit', '-am', message], {
        cwd: agent.buildDir(agentInstance),
      })

      debug('pushing to remote repo')
      await agent.executeCommand(agentInstance, ['git', 'push'], {
        cwd: agent.buildDir(agentInstance),
      })
    },
    async listDirtyFiles({agent, agentInstance}) {
      debug('listing diry files of repo in agent %s', agentInstance.id)
      const status = await agent.executeCommand(agentInstance, ['git', 'status', '--porcelain'], {
        cwd: agent.buildDir(agentInstance),
        returnOutput: true,
      })

      return status.split('\n').map(line => line.slice(3))
    },
  }

  async function initializeAgentInstanceIfNeeded({agent, agentInstance}) {
    if (usedLocally) return
    if (initializedAgentInstances.has(agentInstance.id)) return

    const homeDir = await agent.homeDir(agentInstance)

    await agent.writeBufferToFile(
      agentInstance,
      path.join(homeDir, '.ssh', 'config'),
      Buffer.from('HOST *\n\tStrictHostKeyChecking no\n'),
    )

    if (gitAuthenticationKey) {
      const idRsaPath = path.join(homeDir, '.ssh', 'id_rsa')
      await agent.writeBufferToFile(agentInstance, idRsaPath, Buffer.from(gitAuthenticationKey))

      await agent.executeCommand(agentInstance, ['chmod', '600', idRsaPath])
    }

    if (gitUserEmail)
      await agent.executeCommand(agentInstance, [
        'git',
        'config',
        '--global',
        'user.email',
        gitUserEmail,
      ])

    if (gitUserName)
      await agent.executeCommand(agentInstance, [
        'git',
        'config',
        '--global',
        'user.name',
        gitUserName,
      ])
    initializedAgentInstances.add(agentInstance.id)
  }
}
