const fs = require('fs')
const path = require('path')

module.exports = {
  plugins: {
    "publisher:npm": {"@bildit/npm-publisher-with-git": {
      access: 'public',
      npmAuthenticationLine: '//localhost:4873/:_authToken="13Uzzp+0ioIVF+9+dkSdjx1PS2n7QjfoGUi7Dv2GMPk="',
      usedLocally: true
    }},
    "binaryRunner:npm": async () => {
      return {
        async run({agent, agentInstance, binary: pkg, commandArgs, executeCommandOptions = {}}) {
          return await agent.executeCommand(agentInstance, commandArgs, executeCommandOptions)
        },
      }
    },
    "vcs": {"@bildit/git-vcs": {
      gitAuthenticationKey: fs.readFileSync(path.resolve(process.env.KEYS_DIR, 'id_rsa')),
      gitUserEmail: 'gil@tayar.org',
      gitUserName: 'Gil Tayar',
      usedLocally: true
    }}
  },
  publish: true
}
