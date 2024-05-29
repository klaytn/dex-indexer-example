import {
  EthereumProject,
  EthereumDatasourceKind,
  EthereumHandlerKind,
} from "@subql/types-ethereum";

// Can expand the Datasource processor types via the generic param
const project: EthereumProject = {
  specVersion: "1.0.0",
  version: "0.0.1",
  name: "uniswap-v3",
  description:
    "This project can be use as a starting point for developing your new Ethereum SubQuery project",
  runner: {
    node: {
      name: "@subql/node-ethereum",
      version: ">=3.0.0",
    },
    query: {
      name: "@subql/query",
      version: "*",
    },
  },
  schema: {
    file: "./schema.graphql",
  },
  network: {
    /**
     * chainId is the EVM Chain ID, for Ethereum this is 1
     * https://chainlist.org/chain/1
     */
    chainId: "8217",
    /**
     * These endpoint(s) should be public non-pruned archive node
     * We recommend providing more than one endpoint for improved reliability, performance, and uptime
     * Public nodes may be rate limited, which can affect indexing speed
     * When developing your project we suggest getting a private API key
     */
    //  endpoint: ["http://15.164.40.103:8551"],
    // endpoint: ["https://archive-en.cypress.klaytn.net", "http://34.64.197.145:8551"],
    endpoint: ["https://archive-en.cypress.klaytn.net", ],
    // dictionary: "https://dict-tyk.subquery.network/query/eth-mainnet",
  },
  dataSources: [
    {
      kind: EthereumDatasourceKind.Runtime,
      startBlock: 144895284,
      options: {
        // Must be a key of assets
        abi: "Factory",
        address: "0xA15Be7e90df29A4aeaD0C7Fc86f7a9fBe6502Ac9",
      },
      assets: new Map([
        ["Factory", { file: "./abis/factory.json" }],
        ["ERC20", { file: "./abis/ERC20.json" }],
        ["ERC20SymbolBytes", { file: "./abis/ERC20SymbolBytes.json" }],
        ["ERC20NameBytes", { file: "./abis/ERC20NameBytes.json" }],
        ["Pool", { file: "./abis/pool.json" }],
      ]),
      mapping: {
        file: "./dist/index.js",
        handlers: [
          {
            kind: EthereumHandlerKind.Event,
            handler: "handlePoolCreated",
            filter: {
              topics: [
                "PoolCreated(address indexed token0, address indexed token1, uint24 indexed fee, int24 tickSpacing, address pool, uint256 exid)",
              ],
            },
          },
        ],
      },
    },
    // ethereum/contract
    {
      kind: EthereumDatasourceKind.Runtime,
      startBlock: 144895284,

      options: {
        // Must be a key of assets
        abi: "NonfungiblePositionManager",
        address: "0x51D233B5aE7820030A29c75d6788403B8B5d317B",
      },
      assets: new Map([
        ["NonfungiblePositionManager", { file: "./abis/NonfungiblePositionManager.json" },],
        ["Pool", { file: "./abis/pool.json" }],
        ["ERC20", { file: "./abis/ERC20.json" }],
        ["Factory", { file: "./abis/factory.json" }],
      ]),
      mapping: {
        file: "./dist/index.js",
        handlers: [
          {
            kind: EthereumHandlerKind.Event,
            handler: "handleIncreaseLiquidity",
            filter: {
              topics: [
                "IncreaseLiquidity (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)",
              ],
            },
          },
          {
            kind: EthereumHandlerKind.Event,
            handler: "handleDecreaseLiquidity",
            filter: {
              topics: [
                "DecreaseLiquidity (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)",
              ],
            },
          },

          {
            kind: EthereumHandlerKind.Event,
            handler: "handleCollect",
            filter: {
              topics: [
                "Collect (uint256 tokenId, address recipient, uint256 amount0, uint256 amount1)",
              ],
            },
          },
          {
            kind: EthereumHandlerKind.Event,
            handler: "handleTransfer",
            filter: {
              topics: ["Transfer (address from, address to, uint256 tokenId)"],
            },
          },
        ],
      },
    },
    {
      kind: EthereumDatasourceKind.Runtime,
      startBlock: 144895284,
      options: {
        // Must be a key of assets
        abi: "V2factory",
        address: "0xc6a2ad8cc6e4a7e08fc37cc5954be07d499e7654",
      },
      assets: new Map([
        ["V2factory", { file: "./abis/v2factory.json" }],
        ["ERC20", { file: "./abis/ERC20.json" }],
        ["ERC20SymbolBytes", { file: "./abis/ERC20SymbolBytes.json" }],
        ["ERC20NameBytes", { file: "./abis/ERC20NameBytes.json" }],
        ["V2pool", { file: "./abis/v2pool.json" }],
      ]),
      mapping: {
        file: "./dist/index.js",
        handlers: [
          {
            kind: EthereumHandlerKind.Event,
            handler: "handleV2PoolCreated",
            filter: {
              topics: [
                "CreatePool (address tokenA, uint amountA, address tokenB, uint amountB, uint fee, address exchange, uint exid)",
              ],
            },
          },
        ],
      },
    },
  ],
  templates: [
    {
      kind: EthereumDatasourceKind.Runtime,
      name: "Pool",
      options: {
        abi: "Pool",
      },
      assets: new Map([
        ["Pool", { file: "./abis/pool.json" }],
        ["ERC20", { file: "./abis/ERC20.json" }],
        ["Factory", { file: "./abis/factory.json" }],
      ]),
      mapping: {
        file: "./dist/index.js",
        handlers: [
          {
            kind: EthereumHandlerKind.Event,
            handler: "handleInitialize",
            filter: {
              topics: ["Initialize (uint160,int24)"],
            },
          },
          {
            kind: EthereumHandlerKind.Event,
            handler: "handleSwap",
            filter: {
              topics: [
                "Swap (address sender, address recipient, int256 amount0, int256 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick)",
              ],
            },
          },
          {
            kind: EthereumHandlerKind.Event,
            handler: "handleMint",
            filter: {
              topics: [
                "Mint(address sender, address owner, int24 tickLower, int24 tickUpper, uint128 amount, uint256 amount0, uint256 amount1)",
              ],
            },
          },
          {
            kind: EthereumHandlerKind.Event,
            handler: "handleBurn",
            filter: {
              topics: [
                "Burn(indexed address,indexed int24,indexed int24,uint128,uint256,uint256)",
              ],
            },
          },
          {
            kind: EthereumHandlerKind.Event,
            handler: "handleFlash",
            filter: {
              topics: [
                "Flash(indexed address,indexed address,uint256,uint256,uint256,uint256)",
              ],
            },
          },
        ],
      },
    },
    {
      kind: EthereumDatasourceKind.Runtime,
      name: "V2pool",
      options: {
        abi: "V2pool",
      },
      assets: new Map([
        ["V2pool", { file: "./abis/v2pool.json" }],
        ["ERC20", { file: "./abis/ERC20.json" }],
      ]),
      mapping: {
        file: "./dist/index.js",
        handlers: [
          {
            kind: EthereumHandlerKind.Event,
            handler: "handleExchangePos",
            filter: {
              topics: [
                "ExchangePos(address tokenA, uint amountA, address tokenB, uint amountB);",
              ],
            },
          },
          {
            kind: EthereumHandlerKind.Event,
            handler: "handleExchangeNeg",
            filter: {
              topics: [
                "ExchangeNeg(address tokenA, uint amountA, address tokenB, uint amountB);",
              ],
            },
          },
          {
            kind: EthereumHandlerKind.Event,
            handler: "handleAddLiquidity",
            filter: {
              topics: [
                "AddLiquidity(address user, address tokenA, uint amountA, address tokenB, uint amountB, uint liquidity);",
              ],
            },
          },
          {
            kind: EthereumHandlerKind.Event,
            handler: "handleRemoveLiquidity",
            filter: {
              topics: [
                "RemoveLiquidity(address user, address tokenA, uint amountA, address tokenB, uint amountB, uint liquidity);",
              ],
            },
          },
        ]
      }
    }
  ],

  repository: "https://github.com/JayChoi1736/klayswap-subql-starter",
};

// Must set default to the project instance
export default project;
