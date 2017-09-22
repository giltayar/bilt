'use strict'

const debug = require('debug')('bildit:npm-binary-runner')
const {initializer} = require('@bildit/agent-commons')

module.exports = initializer(async ensureAgentInstanceInitialized => {
  return {
    async run({agent, agentInstance, binary: pkg, commandArgs, executeCommandOptions = {}}) {
      await ensureAgentInstanceInitialized({agent, agentInstance}, pkg)

      debug('executing command %s %o in agent instance %s', pkg, commandArgs, agentInstance.id)
      return await agent.executeCommand(agentInstance, commandArgs, executeCommandOptions)
    },
    async [initializer.initializationFunction]({agent, agentInstance}, pkg) {
      debug('installing package %s in agent instance %s', pkg, agentInstance.id)
      await agent.executeCommand(agentInstance, ['npm', 'install', '--production', '--global', pkg])
      debug('installed package %s in agent instance %s', pkg, agentInstance.id)
    },
  }
})
