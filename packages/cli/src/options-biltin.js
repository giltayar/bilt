'use strict'
function makeOptionsBiltIn(args) {
  return {
    options: {
      getOption(name) {
        return args[name]
      },
    },
  }
}

module.exports = makeOptionsBiltIn
