const fs = require('fs')
const path = require('path')

const remoteDockerAgent = "@bildit/remote-docker-agent": {
  image: "giltayar/node-alpine-git",
  user: "node",
  workdir: "/home/node/builddir"
}

module.exports = {
  plugins: {
    "agent:npm": remoteDockerAgent,
    "agent:repository": remoteDockerAgent,
    "publisher:npm": {"@bildit/npm-publisher-with-git": {
      access: 'public',
      npmAuthenticationLine: '//localhost:4873/:_authToken="NPM_TOKEN"',
      usedLocally: true
    }},
    "vcs": {"@bildit/git-vcs": {
      gitAuthenticationKey: fs.readFileSync(path.resolve(process.env.KEYS_DIR, 'id_rsa')),
      gitUserEmail: 'gil@tayar.org',
      gitUserName: 'Gil Tayar',
      usedLocally: true
    }}
  },
  publish: true
}
