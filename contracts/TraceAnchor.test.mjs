import { readFile } from 'node:fs/promises'
import path from 'node:path'
import solc from 'solc'
import { describe, expect, it } from 'vitest'

const contractPath = path.resolve('contracts/TraceAnchor.sol')

describe('TraceAnchor contract', () => {
  it('compiles with the expected public ABI', async () => {
    const compiled = await compileTraceAnchor()
    const names = compiled.abi.map((entry) => entry.name).filter(Boolean)

    expect(names).toContain('TraceAnchored')
    expect(names).toContain('anchorTrace')
    expect(names).toContain('getAnchor')
    expect(names).toContain('isAnchored')
    expect(names).toContain('TraceAlreadyAnchored')
    expect(compiled.bytecode).toMatch(/^0x[0-9a-f]+$/)
  })

  it('keeps trace anchoring append-only and input-validated at source level', async () => {
    const source = await readFile(contractPath, 'utf8')

    expect(source).toContain('if (traceHash == bytes32(0)) revert ZeroTraceHash();')
    expect(source).toContain('if (signalId == bytes32(0)) revert ZeroSignalId();')
    expect(source).toContain('if (uriLength == 0) revert EmptyUri();')
    expect(source).toContain('if (uriLength > MAX_URI_LENGTH) revert UriTooLong(uriLength);')
    expect(source).toContain('if (anchors[traceHash].publisher != address(0)) revert TraceAlreadyAnchored(traceHash);')
  })
})

async function compileTraceAnchor() {
  const source = await readFile(contractPath, 'utf8')
  const input = {
    language: 'Solidity',
    sources: {
      'TraceAnchor.sol': {
        content: source,
      },
    },
    settings: {
      outputSelection: {
        '*': {
          '*': ['abi', 'evm.bytecode.object'],
        },
      },
    },
  }
  const output = JSON.parse(solc.compile(JSON.stringify(input)))
  const errors = output.errors?.filter((entry) => entry.severity === 'error') ?? []
  expect(errors).toEqual([])

  const contract = output.contracts['TraceAnchor.sol'].TraceAnchor
  return {
    abi: contract.abi,
    bytecode: `0x${contract.evm.bytecode.object}`,
  }
}
