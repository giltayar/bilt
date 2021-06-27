import yaml from 'js-yaml'
import fs from 'fs/promises'
import {readStream} from './read-stream.js'
import {normalizeToGithubActionsId} from './normalize-to-github-actions-id.js'
import path from 'path'

const __dirname = new URL('.', import.meta.url).pathname

/**
 *
 * @param {{'template-workflow-file'?: string, 'bilt-options'?: string}} options
 */
export async function generateCommand({
  'template-workflow-file': templateWorkflowFile = path.resolve(
    __dirname,
    'default-github-workflow.yaml',
  ),
  'bilt-options': biltOptions = '',
}) {
  const biltPackageInfosOutput = JSON.parse((await readStream(process.stdin)).toString('utf-8'))

  const workflowTemplate = await yaml.load(await fs.readFile(templateWorkflowFile, 'utf8'), {
    filename: templateWorkflowFile,
  })

  console.log(
    yaml.dump(
      transformWorkflowTemplate(workflowTemplate, biltPackageInfosOutput.packages, biltOptions),
      {noRefs: true},
    ),
  )
}

/**
 * @param {any} workflowTemplate
 * @param {{
 *    name: string;
 *    directory: import('@bilt/types').RelativeDirectoryPath;
 *    dependencies: string[];
 *  }[]
 * } packages
 * @param {string} biltOptions
 */
function transformWorkflowTemplate(workflowTemplate, packages, biltOptions) {
  return {
    ...workflowTemplate,
    jobs: removeKey(
      {
        ...workflowTemplate.jobs,
        generateBuildInformation: transformGenerateBuildInformationTemplate(
          workflowTemplate.jobs['generateBuildInformation'],
          packages,
          biltOptions,
        ),
        ...generateBuildJobs(workflowTemplate.jobs['build-template'], packages),
      },
      'build-template',
    ),
  }
}

/**
 * @param {{ [x: string]: any; }} obj
 * @param {string} key
 */
function removeKey(obj, key) {
  const {[key]: _, ...restOfObject} = obj

  return restOfObject
}

/**
 * @param {any} template
 * @param {{
 *    name: string;
 *    directory: import('@bilt/types').RelativeDirectoryPath;
 *    dependencies: string[];
 *  }[]
 * } packages
 * @param {string} biltOptions
 */
function transformGenerateBuildInformationTemplate(template, packages, biltOptions) {
  return {
    ...template,
    steps: (template.steps || []).concat({
      name: 'Generate build information',
      id: 'generateBuildInformation',
      run: `bilt ${biltOptions} --dry-run --json | github-actions-workflow echo-build-needs`,
    }),
    outputs: {
      ...template.outputs,
      ...Object.fromEntries(
        packages.map((pkg) => {
          const normalizedPackageName = normalizeToGithubActionsId(pkg.name)
          return [
            `needs-build-${normalizedPackageName}`,
            `\${{steps.generateBuildInformation.outputs.needs-build-${normalizedPackageName}}}`,
          ]
        }),
      ),
    },
  }
}

/**
 * @param {any} template
 * @param {{
 *    name: string;
 *    directory: import('@bilt/types').RelativeDirectoryPath;
 *    dependencies: string[];
 *  }[]
 * } packages
 * @returns {object}
 */
function generateBuildJobs(template, packages) {
  return Object.fromEntries(
    packages.map((pkg) => {
      const normalizedPackageName = normalizeToGithubActionsId(pkg.name)
      return [
        `build-${normalizedPackageName}`,
        {
          ...template,
          name: template.name.replaceAll('$packageNames', pkg.name),
          needs: pkg.dependencies
            .map((d) => `build-${normalizeToGithubActionsId(d)}`)
            .concat(pkg.dependencies.length === 0 ? 'generateBuildInformation' : []),
          if: `\${{needs.generateBuildInformation.outputs.needs-build-${normalizedPackageName} == 'true'}}`,
          steps: template.steps.map((/** @type {any} */ step) =>
            step.name !== 'Build'
              ? step
              : {
                  ...step,
                  run: step.run.replaceAll('$packageNames', pkg.name),
                },
          ),
        },
      ]
    }),
  )
}
