'use strict'

const initializationFunction = Symbol('initializionFunction')

module.exports = module => {
  return async (...args) => {
    const initializedAgentInstances = new Map()

    const plugin = await module({ensureAgentInstanceInitialized}, ...args)
    const initialization = plugin[initializationFunction]

    return plugin

    async function ensureAgentInstanceInitialized({agentInstance}, ...args) {
      const key = `${agentInstance.id}:${JSON.stringify(args)}`
      if (initializedAgentInstances.has(key)) {
        return initializedAgentInstances.get(key)
      }

      const ret = await initialization({agentInstance}, ...args)

      initializedAgentInstances.set(key, ret)

      return ret
    }
  }
}

module.exports.initializationFunction = initializationFunction
