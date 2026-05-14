import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import solc from 'solc'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const contractPath = path.join(rootDir, 'contracts', 'TraceAnchor.sol')
const artifactPath = path.join(rootDir, 'src', 'contracts', 'traceAnchor.ts')

const source = await readFile(contractPath, 'utf8')
const input = {
  language: 'Solidity',
  sources: {
    'TraceAnchor.sol': {
      content: source,
    },
  },
  settings: {
    optimizer: {
      enabled: true,
      runs: 200,
    },
    outputSelection: {
      '*': {
        '*': ['abi', 'evm.bytecode.object'],
      },
    },
  },
}

const output = JSON.parse(solc.compile(JSON.stringify(input)))
const errors = output.errors?.filter((entry) => entry.severity === 'error') ?? []
if (errors.length > 0) {
  throw new Error(errors.map((entry) => entry.formattedMessage).join('\n'))
}

const contract = output.contracts['TraceAnchor.sol'].TraceAnchor
const bytecode = `0x${contract.evm.bytecode.object}`
const abi = contract.abi

await mkdir(path.dirname(artifactPath), { recursive: true })
await writeFile(
  artifactPath,
  `export const traceAnchorAbi = ${JSON.stringify(abi, null, 2)} as const\n\n` +
    `export const traceAnchorBytecode = '${bytecode}' as const\n`,
  'utf8',
)

console.log(`Wrote ${path.relative(rootDir, artifactPath)}`)
