'use strict'

const debug = require('debug')('bildit:npm-binary-runner')
const {initializer} = require('@bildit/agent-commons')

module.exports = initializer(async ({ensureAgentInstanceInitialized}, {pimport}) => {
  return {
    async run({agentInstance, binary: pkg, commandArgs, executeCommandOptions = {}}) {
      const agent = await ensureAgentInstanceInitialized({agentInstance}, pkg)

      debug('executing command %s %o in agent instance %s', pkg, commandArgs, agentInstance.id)
      return await agent.executeCommand(agentInstance, commandArgs, executeCommandOptions)
    },
    async [initializer.initializationFunction]({agentInstance}, pkg) {
      const agent = await pimport(agentInstance.kind)

      debug('installing package %s in agent instance %s', pkg, agentInstance.id)
      await agent.executeCommand(agentInstance, ['npm', 'install', '--production', '--global', pkg])
      debug('installed package %s in agent instance %s', pkg, agentInstance.id)

      return agent
    },
  }
})
