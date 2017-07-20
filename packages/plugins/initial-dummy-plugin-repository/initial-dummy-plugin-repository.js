'use strict'
const debug = require('debug')('bildit:initial-dummy-plugin-repository')
const util = require('util')
const bluebird = require('bluebird')

const pretty = x => util.format('%o', x)

module.exports = context => {
  const plugins = {
    JobRunner: [require('../../npm/npm-job-runner')(context)],
  }

  return {
    async findPlugin(pluginInfo) {
      const {kind} = pluginInfo

      debug('looking for plugin of kind %s', kind)

      const pluginsForKind = plugins[kind]

      if (!pluginsForKind) throw new Error(`No plugins support plugin ${kind}`)

      const supportedPlugins = await bluebird.filter(pluginsForKind, async plugin =>
        plugin.supports(pluginInfo),
      )

      if (supportedPlugins.length === 0)
        throw new Error(
          `No plugins support the plugin info ${pluginInfo}. Available plugins for ${kind} were ${pretty(
            pluginsForKind,
          )}`,
        )

      if (supportedPlugins.length > 1)
        throw new Error(`Too many plugins support ${pluginInfo}: ${pretty(supportedPlugins)}`)

      debug('found plugin for kind %s', kind)
      return supportedPlugins[0]
    },
  }
}
