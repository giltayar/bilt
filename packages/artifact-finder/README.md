# artifactsrc-yml-generator

Given a repo in the current repository, finds all the artifacts and their dependencies, and outputs
an `artifactsrc.yml`

## Purpose

To rebuild the `artifactsrc.yml`

## Installation

 ```sh
 npm install --save artifactsrc-yml-generator
```

## Usage

Run the package itself, giving it an input and output file as parameters.
Currently, it does not use the input file, except to use its dirname to search there.

## Algorithm

* Walks the directories of the input dir, recursively, using `artifact-walker`.
* The walker will recurse the directories, and for each directory call the "artifact extractors". If they
  return an artifact, then it will be concat to the result.
  * Each extractor receives a filename and dir that file is in. If that file "hints" at an artifact
    (e.g. `package.json` for `npm` artifacts), then it will return an "artifact" entry, which is an object with:
    * `artifact`: name of artifact
    * `type`: the type of the artifact.
    * `path`: the relative path within the repository
    * `owners`: list of emails that are the owners of this package
    * `dependencies`: list of all packages that are dependent. This list will be later filtered to include
      only dependencies that are in this repo.
* Once the walker finishes, it contains a list of all artifacts, which it returns
* The script will filter the dependencies inside all those artifacts to include only dependencies to artifacts
  already in the repo.
* The script will write the resultant object as yaml to the output file.
