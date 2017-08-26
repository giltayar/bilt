'use strict'
const debug = require('debug')('bildit:plugin-repository')
const path = require('path')
const util = require('util')
const cosmiconfig = require('cosmiconfig')
const merge = require('lodash.merge')
const flattenDeep = require('lodash.flattendeep')

const pretty = x => util.format('%o', x)

module.exports = async context => {
  const {defaultConfig = {}, directory} = context
  const configLoader = cosmiconfig('bildit', {rcExtensions: true})
  const configFromDirectory = await configLoader.load(directory)
  const config = merge(
    {},
    {
      config: defaultConfig,
      filepath: directory,
    },
    configFromDirectory || {},
  )
  debug('config: %o', config)

  const {config: {plugins}, filepath: configFilePath} = config
  const configFileDir = path.dirname(configFilePath)
  const pluginsFound = new Map()
  debug('registry: %o', plugins)

  const pluginRepositoryCreator = context => ({
    async findPlugin(pluginInfo) {
      const possiblePlugin = pluginsFound.get(JSON.stringify(pluginInfo))
      if (possiblePlugin) return possiblePlugin

      // once we have sync loading in cosmiconfig, we can move it back to 'ctor
      const {kind} = pluginInfo

      debug('looking for plugin of kind %s using context %o', kind, context)

      if (!plugins[kind]) throw new Error(`No plugins support plugin ${kind}`)

      const pluginModulePathsForKind = normalizePluginModules(plugins[kind])
      const pluginModulesForKind = loadModules(configFileDir, pluginModulePathsForKind)
      const pluginsForKind = await createPlugins(
        context,
        config,
        this,
        pluginInfo,
        pluginModulesForKind,
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

  return pluginRepositoryCreator({...context, ...{events}})
}

function normalizePluginModules(modulesEntry) {
  if (typeof modulesEntry === 'string') {
    return [{pluginModulePath: modulesEntry, pluginConfig: {}}]
  } else if (Array.isArray(modulesEntry)) {
    return flattenDeep(modulesEntry.map(module => normalizePluginModules(module)))
  } else {
    return Object.entries(modulesEntry).reduce(
      (arr, [pluginModulePath, pluginConfig]) => arr.concat({pluginModulePath, pluginConfig}),
      [],
    )
  }
}

function loadModules(configFileDir, modules) {
  return modules.map(({pluginModulePath, pluginConfig}) => ({
    module: require(pluginModulePath.startsWith('.')
      ? path.resolve(configFileDir, pluginModulePath)
      : pluginModulePath),
    pluginConfig,
  }))
}

async function createPlugins(context, config, pluginRepository, pluginInfo, pluginModules) {
  return await Promise.all(
    pluginModules.map(({module, pluginConfig}) =>
      module({
        ...context,
        ...{
          pluginRepository,
          pluginInfo,
          config,
          pluginConfig,
        },
      }),
    ),
  )
}
