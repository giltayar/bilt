'use strict'

const path = require('path')
const debug = require('debug')('bildit:npm-publisher-with-git')

module.exports = async ({
  pluginConfig: {npmAuthenticationLine, access: access = 'restricted'},
  pluginRepository,
}) => {
  const vcs = await pluginRepository.findPlugin('vcs')

  return {
    async publishPackage(job, {agent, agentInstance}) {
      debug(`publishing for job ${job}`)
      const {artifactPath} = job

      if (npmAuthenticationLine) {
        debug('creating npmrc with authentication line')

        await createAuthenticationNpmRc(agent, agentInstance, npmAuthenticationLine)
      }

      await ensureNoDirtyGitFiles(vcs, agent, agentInstance, artifactPath)

      debug('patching package.json version')
      const versionOutput = await agent.executeCommand(
        agentInstance,
        ['npm', 'version', 'patch', '--force', '--no-git-tag-version'],
        {
          cwd: artifactPath,
          returnOutput: true,
        },
      )
      debug('npm version output is %s', versionOutput, versionOutput.match(/^(v.*)$/m))

      const newVersion = versionOutput.match(/^(v.*)$/m)[0]

      debug('committing patch changes %s', newVersion)

      await vcs.commitAndPush({agent, agentInstance, message: newVersion})

      debug('npm publishing')
      await agent.executeCommand(agentInstance, ['npm', 'publish', '--access', access], {
        cwd: artifactPath,
      })
    },
  }
}

async function createAuthenticationNpmRc(agent, agentInstance, npmAuthenticationLine) {
  const homeDir = await agent.homeDir(agentInstance)

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
