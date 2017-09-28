'use strict'
const {promisify: p} = require('util')
const fs = require('fs')
const os = require('os')
const path = require('path')
const semver = require('semver')
const debug = require('debug')('bildit:npm-publisher-with-git')
const {initializer} = require('@bildit/agent-commons')

module.exports = initializer(
  async (
    {ensureAgentInstanceInitialized},
    {
      config: {
        npmAuthenticationLine,
        access: access = 'restricted',
        usedLocally = !npmAuthenticationLine,
      },
      pimport,
    },
  ) => {
    const vcs = await pimport('vcs')
    return {
      async setupBuildSteps({job, agentInstance, directory}) {
        debug(`publishing for job %o`, job)
        const {homeDir, agent} = await ensureAgentInstanceInitialized({agentInstance})

        const {artifactPath} = job

        await ensureNoDirtyGitFiles(vcs, agent, agentInstance, directory, artifactPath)

        debug('patching package.json version')
        const {version} = JSON.parse(
          await agent.readFileAsBuffer(agentInstance, path.join(directory, 'package.json')),
        )
        debug('npm version is %s', version)

        const newVersion = semver.inc(version, 'patch', true)

        debug('committing patch changes %s', newVersion)

        const {howToBuild: commitAndPushHowToBuild} = await vcs.setupBuildSteps({
          agentInstance,
          directory,
          message: newVersion,
        })

        return {howToBuild: {homeDir, directory, agentInstance, commitAndPushHowToBuild}}
      },
      getBuildSteps({howToBuild: {homeDir, directory, agentInstance, commitAndPushHowToBuild}}) {
        debug('npm publishing')

        const buildSteps = []

        buildSteps.push({
          agentInstance,
          command: ['npm', 'version', 'patch', '--force', '--no-git-tag-version'],
          cwd: directory,
          returnOutput: true,
          env: {HOME: homeDir},
        })

        buildSteps.push({
          agentInstance,
          command: ['npm', 'publish', '--access', access],
          cwd: directory,
          env: {HOME: homeDir},
        })

        buildSteps.push(...vcs.getCommitAndPushBuildSteps({howToBuild: commitAndPushHowToBuild}))

        return {buildSteps}
      },
      async [initializer.initializationFunction]({agentInstance}) {
        const agent = await pimport(agentInstance.kind)
        const homeDir =
          usedLocally && npmAuthenticationLine
            ? await p(fs.mkdtemp)(os.tmpdir())
            : await agent.homeDir(agentInstance)

        if (npmAuthenticationLine) {
          debug('creating npmrc with authentication line')

          await createAuthenticationNpmRc(agent, agentInstance, npmAuthenticationLine, homeDir)
        }

        return {homeDir, agent}
      },
    }
  },
)

async function createAuthenticationNpmRc(agent, agentInstance, npmAuthenticationLine, homeDir) {
  await agent.writeBufferToFile(
    agentInstance,
    path.join(homeDir, '.npmrc'),
    Buffer.from(npmAuthenticationLine),
  )
}

async function ensureNoDirtyGitFiles(vcs, agent, agentInstance, directory, artifactPath) {
  const dirtyFiles = vcs.listDirtyFiles({
    agentInstance,
    directory: path.join(directory, artifactPath),
  })

  if (dirtyFiles.length > 0) {
    throw new Error(
      `Cannot publish artifact in ${artifactPath} because it has dirty files:\n${dirtyFiles}`,
    )
  }
}
