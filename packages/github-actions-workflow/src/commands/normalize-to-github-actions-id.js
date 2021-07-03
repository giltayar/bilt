/**
 * @param {string} name
 */
export function normalizeToGithubActionsId(name) {
  //@ts-expect-error
  return name.replaceAll('/', '__').replaceAll(/[^a-zA-Z\-_]/g, '_')
}
