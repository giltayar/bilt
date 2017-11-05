const fs = require('fs')
const path = require('path')

const remoteDockerAgent = {
  package: '@bildit/remote-docker-agent',
  image: 'giltayar/node-alpine-git',
  workdir: '/home/node/builddir',
  network: process.env.TEST_NETWORK,
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
    'commander:npm': {
      package: '@bildit/npm-commander',
      access: 'public',
      npmAuthenticationLine: '//localhost:4873/:_authToken="NPM_TOKEN"',
    },
    'commander:git': {
      package: '@bildit/git-commander',
      ...gitConfig,
    },
    repositoryFetcher: '@bildit/git-repository-fetcher',
  },
  publish: true,
}
