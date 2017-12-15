const fs = require('fs')
const path = require('path')

const remoteDockerAgent = {
  package: '@bilt/remote-docker-agent',
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
      package: '@bilt/npm-commander',
      access: 'public',
      npmAuthenticationLine: '//localhost:4873/:_authToken="NPM_TOKEN"',
    },
    'builder:npm': {
      artifactDefaults: {publish: true},
    },
    'commander:git': {
      package: '@bilt/git-commander',
      ...gitConfig,
    },
    repositoryFetcher: '@bilt/git-repository-fetcher',
  },
  publish: true,
}
