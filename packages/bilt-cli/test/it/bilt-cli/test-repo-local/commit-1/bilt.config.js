const fs = require('fs')
const path = require('path')

module.exports = {
  plugins: {
    'builder:npm': {
    },
    'commander:git': {
      package: '@bilt/git-commander',
      gitAuthenticationKey:
        process.env.KEYS_DIR && fs.readFileSync(path.resolve(process.env.KEYS_DIR, 'id_rsa')),
      gitUserEmail: 'gil@tayar.org',
      gitUserName: 'Gil Tayar',
    },
  },
  publish: true,
}
