import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, extname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderMarkdownReport } from './lib/report.js';

const repositoryRoot = fileURLToPath(new URL('../', import.meta.url));
const resultsRoot = resolve(repositoryRoot, 'load-tests/results');

function usage() {
  return 'Usage: node load-tests/report.js --input load-tests/results/<summary>.json --output load-tests/results/<report>.md';
}

function parseArguments(argumentsList) {
  const values = {};
  for (let index = 0; index < argumentsList.length; index += 2) {
    const name = argumentsList[index];
    const value = argumentsList[index + 1];
    if (!['--input', '--output'].includes(name) || !value) {
      throw new Error(usage());
    }
    values[name.slice(2)] = value;
  }
  if (!values.input || !values.output) {
    throw new Error(usage());
  }
  return values;
}

function resolveResultPath(value, expectedExtension) {
  const absolutePath = isAbsolute(value) ? resolve(value) : resolve(repositoryRoot, value);
  const relativePath = relative(resultsRoot, absolutePath);
  if (relativePath === '' || relativePath === '..' || relativePath.startsWith(`..${sep}`) || isAbsolute(relativePath)) {
    throw new Error('Input and output files must be below load-tests/results');
  }
  if (extname(absolutePath).toLowerCase() !== expectedExtension) {
    throw new Error(`Expected a ${expectedExtension} file below load-tests/results`);
  }
  return absolutePath;
}

async function main() {
  const argumentsMap = parseArguments(process.argv.slice(2));
  const inputPath = resolveResultPath(argumentsMap.input, '.json');
  const outputPath = resolveResultPath(argumentsMap.output, '.md');
  const summary = JSON.parse(await readFile(inputPath, 'utf8'));
  const report = renderMarkdownReport(summary);

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, report, 'utf8');
  process.stdout.write(`Created ${relative(repositoryRoot, outputPath)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
