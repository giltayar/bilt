'use strict'
const debug = require('debug')('bildit:plugin-repository')
const path = require('path')
const util = require('util')
const bluebird = require('bluebird')
const cosmiconfig = require('cosmiconfig')

const pretty = x => util.format('%o', x)

module.exports = async (directory, context) => {
  const configLoader = cosmiconfig('bildit', {sync: true, rcExtensions: true})
  const configResult = await configLoader.load(directory)
  if (!configResult) throw new Error(`Could not find configuration path from ${directory}`)

  const {config: {plugins: {registry}}, filepath: configFilePath} = configResult
  const configFileDir = path.dirname(configFilePath)
  const pluginsFound = new Map()

  const pluginRepositoryCreator = context => ({
    async findPlugin(pluginInfo) {
      const possiblePlugin = pluginsFound.get(JSON.stringify(pluginInfo))
      if (possiblePlugin) return possiblePlugin

      const contextWithAdditions = Object.assign({}, context, {
        pluginRepository: this,
        pluginInfo,
      })
      // once we have sync loading in cosmiconfig, we can move it back to 'ctor
      const {kind} = pluginInfo

      debug('looking for plugin of kind %s using context %o', kind, contextWithAdditions)

      if (!registry[kind]) throw new Error(`No plugins support plugin ${kind}`)

      const pluginModulePathsForKind = [].concat(registry[kind])

      const pluginModulesForKind = pluginModulePathsForKind.map(pluginModulePath =>
        require(path.resolve(configFileDir, pluginModulePath)),
      )

      const pluginsForKind = await Promise.all(
        pluginModulesForKind.map(plugin => plugin(contextWithAdditions)),
      )
      const supportedPlugins = pluginsForKind.filter(plugin => !!plugin)
      if (supportedPlugins.length === 0)
        throw new Error(
          `No plugins support the plugin info ${pluginInfo}. Available plugins for ${kind} were ${pretty(
            pluginModulePathsForKind,
          )}`,
        )

      if (supportedPlugins.length > 1)
        throw new Error(`Too many plugins support ${pluginInfo}: ${pretty(supportedPlugins)}`)

      debug('found plugin for kind %s', kind)
      pluginsFound.set(JSON.stringify(pluginInfo), supportedPlugins[0])
      return supportedPlugins[0]
    },
  })
  const temporaryPluginRepositoryForBasePlugins = pluginRepositoryCreator(context)

  const events = await temporaryPluginRepositoryForBasePlugins.findPlugin({kind: 'events'})

  return pluginRepositoryCreator(Object.assign({}, context, {events}))
}
