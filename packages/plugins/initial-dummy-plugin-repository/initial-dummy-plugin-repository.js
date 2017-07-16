'use strict'

module.export = context => {
  const plugins = {
    Job: [require('../../jobs/npm-jobs-runner')(context)],
  }

  return {
    async findPlugin(pluginInfo) {
      const {kind} = pluginInfo

      const pluginsForKind = plugins[kind]

      if (!pluginsForKind) throw new Error(`No plugins support plugin ${kind}`)

      const supportedPlugins = pluginsForKind.filter(plugin => plugin.supports(pluginInfo))
      if (supportedPlugins.length === 0)
        throw new Error(
          `No plugins support the plugin info ${pluginInfo}. Available plugins for ${kind} were ${pluginsForKind}`,
        )

      if (supportedPlugins.length > 1)
        throw new Error(`Too many plygins support ${pluginInfo}: ${supportedPlugins}`)

      return supportedPlugins[0]
    },
  }
}
