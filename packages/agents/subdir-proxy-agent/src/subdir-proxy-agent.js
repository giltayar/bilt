const path = require('path')
module.exports = (agent, subdir) => ({
  async executeCommand(commandArgs, options) {
    return await agent.executeCommand(
      commandArgs,
      Object.assign({}, options, {cwd: path.resolve(agent.cwd, subdir)}),
    )
  },
})
