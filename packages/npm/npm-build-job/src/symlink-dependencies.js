'use strict'
const debug = require('debug')('bilt:npm-build-job:symlink-dependencies')

async function symlinkDependencies({agent, agentInstance}, dependencies, artifactDirectory) {
  debug('linking %s', artifactDirectory)
  await agent.executeCommand({
    agentInstance,
    command: ['npm', 'link'],
    cwd: artifactDirectory,
  })

  for (const dependency of dependencies) {
    debug('linking %s to dependencies in %s', artifactDirectory, dependency)
    await agent.executeCommand({
      agentInstance,
      command: ['npm', 'link', dependency],
      cwd: artifactDirectory,
    })
  }
}

module.exports = symlinkDependencies
