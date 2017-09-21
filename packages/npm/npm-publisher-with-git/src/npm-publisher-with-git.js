'use strict'
const {promisify: p} = require('util')
const fs = require('fs')
const os = require('os')
const path = require('path')
const debug = require('debug')('bildit:npm-publisher-with-git')

module.exports = async ({
  config: {
    npmAuthenticationLine,
    access: access = 'restricted',
    usedLocally = !npmAuthenticationLine,
  },
  pimport,
}) => {
  const vcs = await pimport('vcs')
  const initializedAgentInstances = new Map()

  return {
    async publishPackage(job, {agent, agentInstance}) {
      debug(`publishing for job ${job}`)
      const homeDir = await initializeAgentInstanceIfNeeded({agent, agentInstance})

      const {artifactPath} = job

      await ensureNoDirtyGitFiles(vcs, agent, agentInstance, artifactPath)

      debug('patching package.json version')
      const versionOutput = await agent.executeCommand(
        agentInstance,
        ['npm', 'version', 'patch', '--force', '--no-git-tag-version'],
        {
          cwd: artifactPath,
          returnOutput: true,
          env: {HOME: homeDir},
        },
      )
      debug('npm version output is %s', versionOutput)

      const newVersion = versionOutput.match(/^(v.*)$/m)[0]

      debug('committing patch changes %s', newVersion)

      await vcs.commitAndPush({agent, agentInstance, message: newVersion})

      debug('npm publishing')
      await agent.executeCommand(agentInstance, ['npm', 'publish', '--access', access], {
        cwd: artifactPath,
        env: {HOME: homeDir},
      })
    },
  }

  async function initializeAgentInstanceIfNeeded({agent, agentInstance}) {
    if (initializedAgentInstances.has(agentInstance.id))
      return initializedAgentInstances.get(agentInstance.id).homeDir

    const homeDir =
      usedLocally && npmAuthenticationLine
        ? await p(fs.mkdtemp)(os.tmpdir())
        : await agent.homeDir(agentInstance)

    if (npmAuthenticationLine) {
      debug('creating npmrc with authentication line')

      await createAuthenticationNpmRc(agent, agentInstance, npmAuthenticationLine, homeDir)
    }

    initializedAgentInstances.set(agentInstance.id, {homeDir})

    return homeDir
  }
}

async function createAuthenticationNpmRc(agent, agentInstance, npmAuthenticationLine, homeDir) {
  await agent.writeBufferToFile(
    agentInstance,
    path.join(homeDir, '.npmrc'),
    Buffer.from(npmAuthenticationLine),
  )
}

async function ensureNoDirtyGitFiles(vcs, agent, agentInstance, artifactPath) {
  const dirtyFiles = vcs.listDirtyFiles({agent, agentInstance})

  if (dirtyFiles.length > 0) {
    throw new Error(
      `Cannot publish artifact in ${artifactPath} because it has dirty files:\n${dirtyFiles}`,
    )
  }
}
