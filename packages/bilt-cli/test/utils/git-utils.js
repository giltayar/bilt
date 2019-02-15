'use strict'
const {promisify: p} = require('util')
const fs = require('fs')
const os = require('os')
const path = require('path')
const {executeCommand} = require('@bilt/host-agent')

async function setupGit(keysDir, gitUserEmail, gitUserName) {
  const gitAuthenticationKey = keysDir
    ? await p(fs.readFile)(path.resolve(keysDir, 'id_rsa'))
    : undefined
  const homeDir = gitAuthenticationKey ? await p(fs.mkdtemp)(os.tmpdir() + '/') : undefined
  const gitEnvOverrides = gitAuthenticationKey
    ? {
        HOME: homeDir,
        GIT_SSH_COMMAND: `ssh -o 'StrictHostKeyChecking no' -F '${homeDir}/.ssh/config' -i '${homeDir}/.ssh/id_rsa'`,
      }
    : {}

  if (gitAuthenticationKey) {
    await p(fs.mkdir)(path.join(homeDir, '.ssh'))
    await p(fs.writeFile)(path.join(homeDir, '.ssh/config'), Buffer.from(''))

    const idRsaPath = path.join(homeDir, '.ssh/id_rsa')
    await p(fs.writeFile)(idRsaPath, Buffer.from(gitAuthenticationKey))
    await p(fs.chmod)(idRsaPath, 0o600)
  }

  if (gitUserEmail) {
    await executeCommand({
      command: ['git', 'config', '--global', 'user.email', gitUserEmail],
      env: {...process.env, ...gitEnvOverrides},
    })
  }

  if (gitUserName) {
    await executeCommand({
      command: ['git', 'config', '--global', 'user.name', gitUserName],
      env: {...process.env, ...gitEnvOverrides},
    })
  }

  return gitEnvOverrides
}

module.exports = {setupGit}
