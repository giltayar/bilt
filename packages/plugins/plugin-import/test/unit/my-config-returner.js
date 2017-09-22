'use strict'

module.exports = async ({config, kind}) => {
  return {
    returnConfig() {
      return config
    },
    returnKind() {
      return kind
    }
  }
}
