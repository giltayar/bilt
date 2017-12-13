'use strict'
const path = require('path')

module.exports = ({pimport, config: {directory}}) => {
  return {
    async fetchRepository({agentInstance, subdirectory}) {
      const fullPath = subdirectory ? path.join(directory, subdirectory) : directory

      const agent = await pimport(agentInstance.kind)

      const agentDirectory = agent.translateHostPathToAgentPath(fullPath)

      return {directory: agentDirectory}
    },
  }
}
