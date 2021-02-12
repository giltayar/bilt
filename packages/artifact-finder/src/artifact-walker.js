'use strict'
import flatten from 'lodash.flatten'
import find from 'lodash.find'
import {join} from 'path'

/**
 * @param {{ (dir: string, ignoreStack?: string[] | undefined): Promise<{ entries: { name: string; type: string; }[]; ignoreStack: string[]; }>; (arg0: any, arg1: any[]): PromiseLike<{ entries: any; ignoreStack: any; }> | { entries: any; ignoreStack: any; }; }} fetchEntriesOfDir
 * @param {string} dir
 * @param {{ (filename: string, basedir: string): Promise<any[] | undefined>; (arg0: any, arg1: any): any; }} extractArtifacts
 * @param {{ (artifacts: any): any; (arg0: any[]): any; }} extractorMerger
 * @param {string[]} [ignoreStack]
 * @returns {Promise<any>}
 */
export default async function artifactWalker(
  fetchEntriesOfDir,
  dir,
  extractArtifacts,
  extractorMerger,
  baseDir = dir,
  ignoreStack = [],
) {
  const {entries, ignoreStack: newIgnoreStack} = await fetchEntriesOfDir(dir, ignoreStack)
  const filenames = entries
    .filter((entry) => entry.type === 'file')
    .map((entry) => join(dir, entry.name))

  const artifactsOfFiles = await Promise.all(
    filenames.map((filename) => extractArtifacts(filename, baseDir)),
  )

  const aFileIsAnArtifactLeaf =
    /**
     * @param {any} d
     */
    (d) => !!d

  if (find(artifactsOfFiles, aFileIsAnArtifactLeaf)) {
    return extractorMerger(flatten(artifactsOfFiles).filter((a) => !!a))
  }

  const artifacts = await Promise.all(
    entries
      .filter((entry) => entry.type === 'dir')
      .map((entry) =>
        artifactWalker(
          fetchEntriesOfDir,
          join(dir, entry.name),
          extractArtifacts,
          extractorMerger,
          baseDir,
          newIgnoreStack,
        ),
      ),
  )

  return flatten(artifacts).filter((a) => !!a)
}
