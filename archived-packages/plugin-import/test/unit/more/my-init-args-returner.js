'use strict'

module.exports = async initArgs => {
  return {
    returnInitArgs() {
      return initArgs
    },
  }
}
