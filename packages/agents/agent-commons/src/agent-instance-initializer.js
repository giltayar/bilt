'use strict'

const initializationFunction = Symbol('initializionFunction')

module.exports = module => {
  return async (...args) => {
    const initializedAgentInstances = new Map()

    const plugin = await module(ensureAgentInstanceInitialized, ...args)
    const initialization = plugin[initializationFunction]

    return plugin

    async function ensureAgentInstanceInitialized({agent, agentInstance}, ...args) {
      if (initializedAgentInstances.has(agentInstance.id)) {
        return initializedAgentInstances.get(agentInstance.id)
      }

      const ret = await initialization({agent, agentInstance}, ...args)

      initializedAgentInstances.set(agentInstance.id, ret)

      return ret
    }
  }
}

module.exports.initializationFunction = initializationFunction
