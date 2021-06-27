/**
 * @param {string} name
 */
export function normalizeToGithubActionsId(name) {
  return name.replaceAll('/', '__').replaceAll(/[^a-zA-Z\-_]/g, '_')
}
