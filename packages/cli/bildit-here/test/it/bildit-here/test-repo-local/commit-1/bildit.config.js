const fs = require('fs')
const path = require('path')

module.exports = {
  plugins: {
    'agentCommander:npm': {
      package: '@bildit/npm-agent-commander',
      access: 'public',
      npmAuthenticationLine: '//localhost:4873/:_authToken="NPM_TOKEN"',
    },
    'binaryRunner:npm': async ({pimport}) => {
      return {
        async run({executeCommandArg}) {
          const agent = await pimport(executeCommandArg.agentInstance.kind)
          return await agent.executeCommand(executeCommandArg)
        },
      }
    },
    'agentCommander:git': {
      package: '@bildit/git-agent-commander',
      gitAuthenticationKey: fs.readFileSync(path.resolve(process.env.KEYS_DIR, 'id_rsa')),
      gitUserEmail: 'gil@tayar.org',
      gitUserName: 'Gil Tayar',
    },
  },
  publish: true,
}
