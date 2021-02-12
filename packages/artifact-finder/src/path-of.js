import {relative, dirname} from 'path'

export default /**
 * @param {string} filename
 * @param {string} basedir
 */
(filename, basedir) => relative(basedir, dirname(filename))
