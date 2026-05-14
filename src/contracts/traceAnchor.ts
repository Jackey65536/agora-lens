export const traceAnchorAbi = [
  {
    "inputs": [],
    "name": "EmptyUri",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "traceHash",
        "type": "bytes32"
      }
    ],
    "name": "TraceAlreadyAnchored",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "length",
        "type": "uint256"
      }
    ],
    "name": "UriTooLong",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "ZeroSignalId",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "ZeroTraceHash",
    "type": "error"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "traceHash",
        "type": "bytes32"
      },
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "signalId",
        "type": "bytes32"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "publisher",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "string",
        "name": "uri",
        "type": "string"
      },
      {
        "indexed": false,
        "internalType": "uint64",
        "name": "anchoredAt",
        "type": "uint64"
      }
    ],
    "name": "TraceAnchored",
    "type": "event"
  },
  {
    "inputs": [],
    "name": "MAX_URI_LENGTH",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "traceHash",
        "type": "bytes32"
      },
      {
        "internalType": "bytes32",
        "name": "signalId",
        "type": "bytes32"
      },
      {
        "internalType": "string",
        "name": "uri",
        "type": "string"
      }
    ],
    "name": "anchorTrace",
    "outputs": [
      {
        "internalType": "uint64",
        "name": "anchoredAt",
        "type": "uint64"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "traceHash",
        "type": "bytes32"
      }
    ],
    "name": "getAnchor",
    "outputs": [
      {
        "internalType": "address",
        "name": "publisher",
        "type": "address"
      },
      {
        "internalType": "bytes32",
        "name": "signalId",
        "type": "bytes32"
      },
      {
        "internalType": "string",
        "name": "uri",
        "type": "string"
      },
      {
        "internalType": "uint64",
        "name": "anchoredAt",
        "type": "uint64"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "traceHash",
        "type": "bytes32"
      }
    ],
    "name": "isAnchored",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
] as const

export const traceAnchorBytecode = '0x6080604052348015600e575f5ffd5b5061067e8061001c5f395ff3fe608060405234801561000f575f5ffd5b506004361061004a575f3560e01c80634f0b58011461004e5780637feb51d91461008d578063aab5a877146100b0578063b2bad5bb146100c7575b5f5ffd5b61007861005c3660046103b6565b5f908152602081905260409020546001600160a01b0316151590565b60405190151581526020015b60405180910390f35b6100a061009b3660046103b6565b6100f3565b60405161008494939291906103cd565b6100b961080081565b604051908152602001610084565b6100da6100d5366004610429565b6101cf565b60405167ffffffffffffffff9091168152602001610084565b5f8181526020819052604081208054600182015460038301546002840180548695606095879591946001600160a01b0390911693919267ffffffffffffffff909116908290610141906104a5565b80601f016020809104026020016040519081016040528092919081815260200182805461016d906104a5565b80156101b85780601f1061018f576101008083540402835291602001916101b8565b820191905f5260205f20905b81548152906001019060200180831161019b57829003601f168201915b505050505091509450945094509450509193509193565b5f846101ee57604051635781cedf60e01b815260040160405180910390fd5b8361020c57604051630c2fb13b60e31b815260040160405180910390fd5b815f81900361022e5760405163d64becfd60e01b815260040160405180910390fd5b6108008111156102595760405163462dac9f60e01b8152600481018290526024015b60405180910390fd5b5f868152602081905260409020546001600160a01b031615610291576040516318d053e360e21b815260048101879052602401610250565b4291506040518060800160405280336001600160a01b0316815260200186815260200185858080601f0160208091040260200160405190810160405280939291908181526020018383808284375f92018290525093855250505067ffffffffffffffff8516602092830152888152808252604090819020835181546001600160a01b0319166001600160a01b03909116178155918301516001830155820151600282019061033f9082610548565b50606091909101516003909101805467ffffffffffffffff191667ffffffffffffffff9092169190911790556040513390869088907f796d9e25db7242d55a0e1fbe85b9d87e051a80086380f1434ceae4431a779beb906103a590899089908990610607565b60405180910390a450949350505050565b5f602082840312156103c6575f5ffd5b5035919050565b60018060a01b0385168152836020820152608060408201525f8351806080840152806020860160a085015e5f60a0828501015260a0601f19601f83011684010191505067ffffffffffffffff8316606083015295945050505050565b5f5f5f5f6060858703121561043c575f5ffd5b8435935060208501359250604085013567ffffffffffffffff811115610460575f5ffd5b8501601f81018713610470575f5ffd5b803567ffffffffffffffff811115610486575f5ffd5b876020828401011115610497575f5ffd5b949793965060200194505050565b600181811c908216806104b957607f821691505b6020821081036104d757634e487b7160e01b5f52602260045260245ffd5b50919050565b634e487b7160e01b5f52604160045260245ffd5b601f821115610543578282111561054357805f5260205f20601f840160051c602085101561051c57505f5b90810190601f840160051c035f5b8181101561053f575f8382015560010161052a565b5050505b505050565b815167ffffffffffffffff811115610562576105626104dd565b6105768161057084546104a5565b846104f1565b6020601f8211600181146105a8575f83156105915750848201515b5f19600385901b1c1916600184901b178455610600565b5f84815260208120601f198516915b828110156105d757878501518255602094850194600190920191016105b7565b50848210156105f457868401515f19600387901b60f8161c191681555b505060018360011b0184555b5050505050565b60408152826040820152828460608301375f606084830101525f6060601f19601f860116830101905067ffffffffffffffff8316602083015294935050505056fea26469706673582212205acfcd8c443feee3dd8b0e4c9fcd6c042b75f694275bedd143b67703a098659664736f6c63430008230033' as const
