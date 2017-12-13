'use strict'
const path = require('path')
const assert = require('assert')
const debug = require('debug')('plugin-import')
const merge = require('lodash.merge')

module.exports = (pluginLists, {baseDirectory = ''} = {}) => {
  const plugins = pluginLists.reduce(
    (acc, curr) => merge({}, acc, normalizePluginModules(curr)),
    {},
  )
  debug('plugins: %o\nbaseDirectory: %s', plugins, baseDirectory)

  const pluginsFound = new Map()

  const pimport = async kind => {
    debug('looking for plugin of kind', kind)

    const pluginInfo = plugins[kind]

    debug('found plugin for %s, info: %o', kind, pluginInfo)

    if (!pluginInfo) throw new Error(`No plugins support plugin ${kind}`)

    const normalizedPluginInfo = normalizePluginModule(pluginInfo)

    const pluginKey = JSON.stringify(normalizedPluginInfo)

    const alreadyFoundPlugin = pluginsFound.get(pluginKey)
    if (alreadyFoundPlugin) {
      debug('already created plugin kind %s for %o, returning it', kind, normalizedPluginInfo)
      return alreadyFoundPlugin
    }

    const pluginModuleWithConfig = loadPluginModule(baseDirectory, normalizedPluginInfo)
    debug('creating plugin for kind %s, info %o', kind, pluginInfo)
    const plugin = await createPlugin(pimport, pluginInfo, kind, pluginModuleWithConfig)

    debug('found plugin for kind %s', kind)
    pluginsFound.set(pluginKey, plugin)

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
      kind,
      directory: baseDirectory,
      plugins,
    })
  }
}

function normalizePluginModules(moduleEntries) {
  if (!moduleEntries) return moduleEntries

  return Object.entries(moduleEntries)
    .map(([name, module]) => [name, normalizePluginModule(module)])
    .reduce((obj, [name, value]) => ({...obj, [name]: value}), {})
}

function normalizePluginModule(modulesEntry) {
  if (typeof modulesEntry === 'string') {
    return {package: modulesEntry}
  } else if (typeof modulesEntry === 'function') {
    return {
      package: modulesEntry,
      somethingToMakeItUnique: modulesEntry.name || Math.random(),
    }
  } else {
    assert(modulesEntry.package, 'plugin configuration must have a "package" field')

    return modulesEntry
  }
}

function loadPluginModule(baseDirectory, pluginConfig) {
  const pluginConfigWithoutPackage = {...pluginConfig}
  delete pluginConfigWithoutPackage.package

  if (typeof pluginConfig.package === 'function') {
    return {pluginModule: pluginConfig.package, pluginConfig: pluginConfigWithoutPackage}
  }
  return {
    pluginModule: require(pluginConfig.package.startsWith('.')
      ? path.resolve(baseDirectory, pluginConfig.package)
      : pluginConfig.package),
    pluginConfig: pluginConfigWithoutPackage,
  }
}
