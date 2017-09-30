'use strict'
const path = require('path')
const debug = require('debug')('plugin-import')
const merge = require('lodash.merge')

module.exports = (pluginLists, {baseDirectory = '', appConfigs = []} = {}) => {
  const plugins = pluginLists.reduce((acc, curr) => merge({}, acc, curr), {})
  const appConfig = appConfigs.reduce((acc, curr) => merge({}, acc, curr), {})
  debug('plugins: %o\nappConfig: %o', plugins, appConfig)

  const pluginsFound = new Map()

  const pimport = async kind => {
    debug('looking for plugin of kind', kind)

    const pluginInfo = plugins[kind]

    debug('found plugin for %s, info: %o', kind, pluginInfo)

    if (!pluginInfo) throw new Error(`No plugins support plugin ${kind}`)

    const normalizedPluginModuleInfo = normalizePluginModule(pluginInfo)

    const alreadyFoundPlugin = pluginsFound.get(JSON.stringify(normalizedPluginModuleInfo))
    if (alreadyFoundPlugin) {
      debug('already created plugin kind %s for %o, returning it', kind, normalizedPluginModuleInfo)
      return alreadyFoundPlugin
    }

    const pluginModuleWithConfig = loadPluginModule(baseDirectory, normalizedPluginModuleInfo)
    debug('creating plugin for kind %s, info %o', kind, pluginInfo)
    const plugin = await createPlugin(pimport, pluginInfo, kind, pluginModuleWithConfig)

    debug('found plugin for kind %s', kind)
    pluginsFound.set(JSON.stringify(normalizedPluginModuleInfo), plugin)

    return plugin
  }
  pimport.finalize = async () =>
    await Promise.all(
      [...pluginsFound].map(
        async ([, plugin]) => (plugin.finalize ? await plugin.finalize() : undefined),
      ),
    )

  return pimport

  async function createPlugin(pimport, pluginInfo, kind, {pluginModule, pluginConfig}) {
    const dependentPlugins = pluginModule.plugins || []
    const plugins = []

    for (const plugin of dependentPlugins) {
      plugins.push(await pimport(plugin))
    }

    return await pluginModule({
      pimport,
      config: pluginConfig,
      appConfig,
      kind,
      directory: baseDirectory,
      plugins,
    })
  }
}

function normalizePluginModule(modulesEntry) {
  if (typeof modulesEntry === 'string') {
    return {pluginModulePath: modulesEntry, pluginConfig: {}}
  } else if (typeof modulesEntry === 'function') {
    return {
      pluginModulePath: modulesEntry,
      pluginConfig: {},
      somethingToMakeItUnique: modulesEntry.name || Math.randomO(),
    }
  } else {
    const plugin = Object.entries(modulesEntry)[0]

    return {pluginModulePath: plugin[0], pluginConfig: plugin[1]}
  }
}

function loadPluginModule(baseDirectory, {pluginModulePath, pluginConfig}) {
  if (typeof pluginModulePath === 'function') {
    return {pluginModule: pluginModulePath, pluginConfig}
  }
  return {
    pluginModule: require(pluginModulePath.startsWith('.')
      ? path.resolve(baseDirectory, pluginModulePath)
      : pluginModulePath),
    pluginConfig,
  }
}
