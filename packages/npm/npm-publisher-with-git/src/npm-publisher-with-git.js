'use strict'

const path = require('path')
const debug = require('debug')('bildit:npm-publisher-with-git')

module.exports = async ({
  pluginConfig: {
    npmAuthenticationLine,
    gitAuthenticationKey,
    gitUserEmail,
    gitUserName,
    access: access = 'restricted',
  },
}) => {
  return {
    async publishPackage(job, {agent}) {
      debug(`publishing for job ${job}`)
      const {artifactPath} = job

      if (npmAuthenticationLine) {
        debug('creating npmrc with authentication line')
        await createAuthenticationNpmRc(agent, npmAuthenticationLine)
      }

      if (gitAuthenticationKey) {
        debug('creating SSH keys')
        await initializeGit(agent, gitAuthenticationKey, gitUserEmail, gitUserName)
      }

      await ensureNoDirtyGitFiles(agent, {artifactPath})

      debug('patching package.json version')
      const versionOutput = await agent.executeCommand(
        ['npm', 'version', 'patch', '--force', '--no-git-tag-version'],
        {
          cwd: artifactPath,
          returnOutput: true,
        },
      )
      debug('npm version output is %s', versionOutput, versionOutput.match(/^(v.*)$/m))

      const newVersion = versionOutput.match(/^(v.*)$/m)[0]

      debug('committing patch changes %s', newVersion)
      await agent.executeCommand(['git', 'commit', '-am', newVersion], {
        cwd: artifactPath,
      })

      debug('pushing to remote repo')
      await agent.executeCommand(['git', 'push'], {
        cwd: artifactPath,
      })

      debug('npm publishing')
      await agent.executeCommand(['npm', 'publish', '--access', access], {cwd: artifactPath})
    },
  }
}

async function createAuthenticationNpmRc(agent, npmAuthenticationLine) {
  const homeDir = await agent.homeDir()

  await agent.writeBufferToFile(path.join(homeDir, '.npmrc'), Buffer.from(npmAuthenticationLine))
}

async function initializeGit(agent, gitAuthenticationKey, gitUserEmail, gitUserName) {
  const homeDir = await agent.homeDir()

  await agent.writeBufferToFile(
    path.join(homeDir, '.ssh', 'id_rsa'),
    Buffer.from(gitAuthenticationKey),
  )

  await agent.writeBufferToFile(
    path.join(homeDir, '.ssh', 'config'),
    Buffer.from('HOST *\n\tStrictHostKeyChecking no\n'),
  )

  await agent.executeCommand(['git', 'config', '--global', 'user.email', gitUserEmail])
  await agent.executeCommand(['git', 'config', '--global', 'user.name', gitUserName])
}

async function ensureNoDirtyGitFiles(agent, {artifactPath}) {
  const result = await agent.executeCommand(['git', 'status', '--porcelain'], {
    cwd: artifactPath,
    returnOutput: true,
  })

  if (result.length > 0) {
    throw new Error(
      `Cannot publish artifact in ${artifactPath} because it has dirty files:\n${result}`,
    )
  }
}
