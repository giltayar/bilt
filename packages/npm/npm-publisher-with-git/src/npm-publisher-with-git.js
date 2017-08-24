'use strict'

const path = require('path')
const debug = require('debug')('bildit:npm-publisher-with-git')

module.exports = async ({pluginConfig: {npmAuthenticationLine, gitAuthenticationKey}}) => {
  return {
    async publishPackage(job, {agent}) {
      const {artifactPath} = job

      if (npmAuthenticationLine) {
        debug('creating npmrc with authentication line')
        await createAuthenticationNpmRc(agent, npmAuthenticationLine)
      }

      if (gitAuthenticationKey) {
        debug('creating SSH keys')
        await copyGitSshKeys(agent, gitAuthenticationKey)
      }

      await agent.executeCommand(['npm', 'version', 'patch', '--force'], {cwd: artifactPath})

      await agent.executeCommand(['git', 'push'], {cwd: artifactPath})
      await agent.executeCommand(['npm', 'publish'], {cwd: artifactPath})
    },
  }
}

async function createAuthenticationNpmRc(agent, npmAuthenticationLine) {
  const homeDir = await agent.homeDir()

  await agent.writeStringToFile(path.join(homeDir, '.npmrc'), npmAuthenticationLine)
}

async function copyGitSshKeys(agent, gitAuthenticationKey) {
  const homeDir = await agent.homeDir()

  await agent.writeStringToFile(path.join(homeDir, '.ssh', 'id_rsa'), gitAuthenticationKey)
}
