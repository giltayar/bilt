'use strict'

module.exports = async ({config}) => {
  return {
    returnConfig() {
      return config
    },
  }
}
