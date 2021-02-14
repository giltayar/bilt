/**
 * @param {Record<string, any>} args
 */
export function makeOptionsBiltin(args) {
  return {
    options: {
      /**
       * @param {string} name
       */
      getOption(name) {
        return args[name]
      },
    },
  }
}
