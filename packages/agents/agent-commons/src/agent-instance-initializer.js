'use strict'

const initializationFunction = Symbol('initializionFunction')

module.exports = module => {
  return async (...args) => {
    const initializedAgentInstances = new Set()

    const plugin = await module(ensureAgentInstanceInitialized, ...args)
    const initialization = plugin[initializationFunction]

    return plugin

    async function ensureAgentInstanceInitialized({agent, agentInstance}, ...args) {
      if (initializedAgentInstances.has(agentInstance.id)) return

      const ret = await initialization({agent, agentInstance}, ...args)

      initializedAgentInstances.add(agentInstance.id)

      return ret
    }
  }
}

module.exports.initializationFunction = initializationFunction
