'use strict'

const debug = require('debug')('bildit:npm-binary-runner')

module.exports = () => {
  const agentInstanceIdsAlreadyInstalled = new Set()

  return {
    async run({agent, agentInstance, binary: pkg, commandArgs, executeCommandOptions = {}}) {
      await ensureAgentInstanceHasPackageInstalled(agent, agentInstance, pkg)

      debug('executing command %s %o in agent instance %s', pkg, commandArgs, agentInstance.id)
      return await agent.executeCommand(agentInstance, commandArgs, executeCommandOptions)
    },
  }

  async function ensureAgentInstanceHasPackageInstalled(agent, agentInstance, pkg) {
    debug('checking package %s is installed in agent instance %s', pkg, agentInstance.id)
    if (agentInstanceIdsAlreadyInstalled.has(agentInstance.id)) {
      debug('package %s is installed in agent %s', pkg, agentInstance.id)
      return
    }

    debug('installing package %s in agent instance %s', pkg, agentInstance.id)
    await agent.executeCommand(agentInstance, ['npm', 'install', '--global', pkg])
    debug('installed package %s in agent instance %s', pkg, agentInstance.id)

    agentInstanceIdsAlreadyInstalled.add(agentInstance.id)
  }
}
