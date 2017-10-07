const fs = require('fs')
const path = require('path')

const remoteDockerAgent = {
  '@bildit/remote-docker-agent': {
    image: 'giltayar/node-alpine-git',
    workdir: '/home/node/builddir',
    network: process.env.TEST_NETWORK,
  },
}

const gitConfig = {
  gitAuthenticationKey: fs.readFileSync(path.resolve(process.env.KEYS_DIR, 'id_rsa')),
  gitUserEmail: 'gil@tayar.org',
  gitUserName: 'Gil Tayar',
}

module.exports = {
  plugins: {
    'agent:npm': remoteDockerAgent,
    'agent:repository': remoteDockerAgent,
    'agentCommander:npm': {
      '@bildit/npm-agent-commander': {
        access: 'public',
        npmAuthenticationLine: '//localhost:4873/:_authToken="NPM_TOKEN"',
      },
    },
    vcs: {
      '@bildit/git-vcs': gitConfig,
    },
    repositoryFetcher: {
      '@bildit/git-repository-fetcher': gitConfig,
    },
  },
  publish: true,
}
