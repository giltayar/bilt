const fs = require('fs')
const path = require('path')

const localDockerAgent = {
  package: '@bilt/local-docker-agent',
  image: 'giltayar/node-alpine-git',
  workdir: '/home/node/builddir',
  network: process.env.TEST_NETWORK,
}

module.exports = {
  plugins: {
    'agent:npm': localDockerAgent,
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
      gitAuthenticationKey: fs.readFileSync(path.resolve(process.env.KEYS_DIR, 'id_rsa')),
      gitUserEmail: 'gil@tayar.org',
      gitUserName: 'Gil Tayar',
    },
  },
  publish: true,
}
