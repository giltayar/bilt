const fs = require('fs')
const path = require('path')

const localDockerAgent = {
  '@bildit/local-docker-agent': {
    image: 'giltayar/node-alpine-git',
    workdir: '/home/node/builddir',
    network: process.env.TEST_NETWORK,
  },
}

module.exports = {
  plugins: {
    'agent:npm': localDockerAgent,
    'agent:repository': localDockerAgent,
    'publisher:npm': {
      '@bildit/npm-publisher-with-git': {
        access: 'public',
        npmAuthenticationLine: '//localhost:4873/:_authToken="NPM_TOKEN"',
      },
    },
    vcs: {
      '@bildit/git-vcs': {
        gitAuthenticationKey: fs.readFileSync(path.resolve(process.env.KEYS_DIR, 'id_rsa')),
        gitUserEmail: 'gil@tayar.org',
        gitUserName: 'Gil Tayar',
      },
    },
  },
  publish: true,
}
