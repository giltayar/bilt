'use strict'

const path = require('path')
const debug = require('debug')('bildit:git-vcs')

module.exports = ({pluginConfig: {gitAuthenticationKey, gitUserEmail, gitUserName}}) => {
  const initializedAgentInstances = new Set()

  return {
    async fetch({agent, agentInstance, repository}) {
      await initializeAgentInstanceIfNeeded({agent, agentInstance})
      debug('cloning repository %s', repository)

      try {
        const status = await agent.executeCommand(agentInstance, ['git', 'status', '--porcelain'], {
          cwd: agent.buildDir(),
          returnOutput: true,
        })
        if (status.length > 0) {
          await agent.executeCommand(agentInstance, ['git', 'reset', '--hard'], {
            cwd: agent.buildDir(),
          })
        }
      } catch (_) {
        await agent.executeCommand(agentInstance, ['git', 'clone', repository, agent.buildDir()])
      }
    },
    async commitAndPush({agent, agentInstance, message}) {
      debug('committing patch changes %s', message)
      await agent.executeCommand(agentInstance, ['git', 'commit', '-am', message], {
        cwd: agent.buildDir(),
      })

      debug('pushing to remote repo')
      await agent.executeCommand(agentInstance, ['git', 'push'], {
        cwd: agent.buildDir(),
      })
    },
    async listDirtyFiles({agent, agentInstance}) {
      const status = await agent.executeCommand(agentInstance, ['git', 'status', '--porcelain'], {
        cwd: agent.buildDir(),
        returnOutput: true,
      })

      return status.split('\n').map(line => line.slice(3))
    },
  }

  async function initializeAgentInstanceIfNeeded({agent, agentInstance}) {
    if (initializedAgentInstances.has(agentInstance.id)) return

    const homeDir = await agent.homeDir(agentInstance)

    await agent.writeBufferToFile(
      agentInstance,
      path.join(homeDir, '.ssh', 'id_rsa'),
      Buffer.from(gitAuthenticationKey),
    )

    await agent.writeBufferToFile(
      agentInstance,
      path.join(homeDir, '.ssh', 'config'),
      Buffer.from('HOST *\n\tStrictHostKeyChecking no\n'),
    )

    await agent.executeCommand(agentInstance, [
      'git',
      'config',
      '--global',
      'user.email',
      gitUserEmail,
    ])

    await agent.executeCommand(agentInstance, [
      'git',
      'config',
      '--global',
      'user.name',
      gitUserName,
    ])
  }
}
