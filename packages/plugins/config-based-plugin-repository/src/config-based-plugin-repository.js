'use strict'
const debug = require('debug')('bildit:config-based-plugin-repository')
const path = require('path')
const cosmiconfig = require('cosmiconfig')
const merge = require('lodash.merge')

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
    async findPlugin(kind) {
      debug('looking for plugin of kind', kind, context)

      const pluginInfo = plugins[kind]

      debug('found plugin for %s, info: %o', kind, pluginInfo)

      if (!pluginInfo) throw new Error(`No plugins support plugin ${kind}`)

      const normalizedPluginModuleInfo = normalizePluginModule(pluginInfo)

      const alreadyFoundPlugin = pluginsFound.get(JSON.stringify(normalizedPluginModuleInfo))
      debug('already created plugin kind %s for %o, returning it', kind, normalizedPluginModuleInfo)
      if (alreadyFoundPlugin) return alreadyFoundPlugin

      const pluginModule = loadPluginModule(configFileDir, normalizedPluginModuleInfo)
      debug('creating plugin for kind %s, info %o, in context %o', kind, pluginInfo, context)
      const plugin = await createPlugin(context, config, this, pluginInfo, pluginModule)

      debug('found plugin for kind %s', kind)
      pluginsFound.set(JSON.stringify(pluginInfo), plugin)

      return plugin
    },
  })
  const temporaryPluginRepositoryForBasePlugins = pluginRepositoryCreator(context)

  const events = await temporaryPluginRepositoryForBasePlugins.findPlugin('events')

  return pluginRepositoryCreator({...context, ...{events}})
}

function normalizePluginModule(modulesEntry) {
  if (typeof modulesEntry === 'string') {
    return {pluginModulePath: modulesEntry, pluginConfig: {}}
  } else {
    const plugin = Object.entries(modulesEntry)[0]

    return {pluginModulePath: plugin[0], pluginConfig: plugin[1]}
  }
}

function loadPluginModule(configFileDir, {pluginModulePath, pluginConfig}) {
  return {
    pluginModule: require(pluginModulePath.startsWith('.')
      ? path.resolve(configFileDir, pluginModulePath)
      : pluginModulePath),
    pluginConfig,
  }
}

async function createPlugin(
  context,
  config,
  pluginRepository,
  pluginInfo,
  {pluginModule, pluginConfig},
) {
  return pluginModule({
    ...context,
    ...{
      pluginRepository,
      pluginInfo,
      config: config.config,
      pluginConfig,
    },
  })
}
