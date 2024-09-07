# Proof-Of-Membership on-chain verification test

This sample project is based on this [article](https://soliditydeveloper.com/merkle-tree). We use this to test our own Merkle Tree implementation.

```BASH
reth node --dev  --datadir "~/reth_data/dev"  \
      --log.file.directory "~/reth_data/logs" \
      --dev.block-time 5s

npx hardhat ignition deploy ./ignition/modules/deploy.ts  --network reth

npx hardhat console --network reth
```

```JS
const network = await ethers.provider.getNetwork()
const chain_type = "chain-" + network.chainId.toString()

fs = require("fs")
util = require('util')
readFile = util.promisify(fs.readFile)
contract_data = await readFile(`./ignition/deployments/${chain_type}/deployed_addresses.json`, 'utf8')
contract_addrs = JSON.parse(contract_data.split('#').join('_'))

let usdFactory = await ethers.getContractFactory("USDToken")
let usd = await usdFactory.attach(contract_addrs.USDTokenModule_USDToken)
await usd.balanceOf(contract_addrs.TokenDropModule_TokenDrop)
```