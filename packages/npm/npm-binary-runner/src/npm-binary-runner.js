'use strict'

const debug = require('debug')('bildit:npm-binary-runner')
const {initializer} = require('@bildit/agent-commons')

module.exports = initializer(async ({ensureAgentInstanceInitialized}, {pimport}) => {
  return {
    async run({binary: pkg, executeCommandArg}) {
      const {agentInstance, command} = executeCommandArg
      const agent = await ensureAgentInstanceInitialized({agentInstance}, pkg)

      if (executeCommandArg) {
        debug('executing command %s %o in agent instance %s', pkg, command, agentInstance.id)
        return await agent.executeCommand(executeCommandArg)
      }
    },
    async [initializer.initializationFunction]({agentInstance}, pkg) {
      const agent = await pimport(agentInstance.kind)

      debug('installing package %s in agent instance %s', pkg, agentInstance.id)
      await agent.executeCommand({
        agentInstance,
        command: ['npm', 'install', '--production', '--global', pkg],
      })
      debug('installed package %s in agent instance %s', pkg, agentInstance.id)

      return agent
    },
    singleton: false,
  }
})
