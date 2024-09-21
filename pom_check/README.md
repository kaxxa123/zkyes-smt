# Proof-Of-Membership on-chain verification test

This sample project is based on this [article](https://soliditydeveloper.com/merkle-tree). We use this to test our own Merkle Tree implementation.

## Proof-of-membership test

This test was excuted against a Reth node. Some harcoded address values may change if ran against any other node.

1. Test is assuming this data:

      ```
      5 ETH = 0x4563918244f40000

      Allocating 5 tokens to address:
      0. 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
      1. 0x70997970C51812dc3A010C7d01b50e0d17dc79C8
      2. 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC
      3. 0x90F79bf6EB2c4f870365E785982E1f101E93b906
      ```

      `tree_config.json` configuration:

      ```JSON
      {
      "level": 3,
      "sort_hash": true,
      "leaves": [
            {
                  "index": 0,
                  "value": "000000000000000000000000f39Fd6e51aad88F6F4ce6aB8827279cffFb922660000000000000000000000000000000000000000000000004563918244f40000"
            },
            {
                  "index": 1,
                  "value": "00000000000000000000000070997970C51812dc3A010C7d01b50e0d17dc79C80000000000000000000000000000000000000000000000004563918244f40000"
            },
            {
                  "index": 2,
                  "value": "0000000000000000000000003C44CdDdB6a900fa2b585dd299e03d12FA4293BC0000000000000000000000000000000000000000000000004563918244f40000"
            },
            {
                  "index": 3,
                  "value": "00000000000000000000000090F79bf6EB2c4f870365E785982E1f101E93b9060000000000000000000000000000000000000000000000004563918244f40000"
            }
      ]
      }
      ```


1. Start clean Reth node

      ```BASH
      rm ~/reth_data/dev -rfv
      rm ~/reth_data/logs -rfv
      reth node --dev  --datadir "~/reth_data/dev"  \
            --log.file.directory "~/reth_data/logs" \
            --dev.block-time 5s
      ```

1. Cleanup earlier deployment, deploy and open console...

      ```BASH
      cd pom_check
      rm ./ignition/deployments -rfv

      npx hardhat ignition deploy ./ignition/modules/deploy.ts  --network reth
      npx hardhat console --network reth
      ```

1. Run test

      ```JS
      // Load contract addresses
      const network = await ethers.provider.getNetwork()
      const chain_type = "chain-" + network.chainId.toString()

      fs = require("fs")
      util = require('util')
      readFile = util.promisify(fs.readFile)
      contract_data = await readFile(`./ignition/deployments/${chain_type}/deployed_addresses.json`, 'utf8')
      contract_addrs = JSON.parse(contract_data.split('#').join('_'))

      // Initialize contract instances
      let usdFactory = await ethers.getContractFactory("USDToken")
      let usd = await usdFactory.attach(contract_addrs.USDTokenModule_USDToken)
      await usd.balanceOf(contract_addrs.TokenDropModule_TokenDrop)

      let dropFactory = await ethers.getContractFactory("TokenDrop")
      let drop = await dropFactory.attach(contract_addrs.TokenDropModule_TokenDrop)
      await drop.token()
      await drop.merkleRoot()

      // Claim tokens
      let accounts = await ethers.getSigners()
      await usd.balanceOf(accounts[2])
      await drop.claim(accounts[2],5n*10n**18n,
            [
            '0x56a3d4f13c5776b804ce10e7c57755567889b426b176e8996525baf4d281cdb2',
            '0x7aea2f12ad1549bf6bee243fb5b39a46440da5788402120a2db5e0fd329985fd',
            '0x664b8cf4c77fb0bed0e08997b1d87065b402113612dc6dabf8945b947106f7cc'
            ])
      await usd.balanceOf(accounts[2])

      await usd.balanceOf(accounts[3])
      await drop.claim(accounts[3],5n*10n**18n,
            [
            '0xce2425dea4427a5b5aa0b2a665016ab1b3ac7fe93fd1145bb12eb4cd0751a016',
            '0x7aea2f12ad1549bf6bee243fb5b39a46440da5788402120a2db5e0fd329985fd',
            '0x664b8cf4c77fb0bed0e08997b1d87065b402113612dc6dabf8945b947106f7cc'
            ])
      await usd.balanceOf(accounts[3])

      //Claiming tokens twice. This should FAIL!
      await drop.claim(accounts[3],5n*10n**18n,
            [
            '0xce2425dea4427a5b5aa0b2a665016ab1b3ac7fe93fd1145bb12eb4cd0751a016',
            '0x7aea2f12ad1549bf6bee243fb5b39a46440da5788402120a2db5e0fd329985fd',
            '0x664b8cf4c77fb0bed0e08997b1d87065b402113612dc6dabf8945b947106f7cc'
            ])

      // Add extra leaf for 0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65
      // Leaf index: 4
      // Leaf value:
      //     00000000000000000000000015d34AAf54267DB7D7c367839AAf71A00a2C6A650000000000000000000000000000000000000000000000004563918244f40000
      //
      // Claiming tokens from account not in the tree. This should FAIL!
      await drop.claim(accounts[4],5n*10n**18n,
            [
            '0x022204976274548b6ad38a3c4b6e25097e64a0fc5119be0dd23fd6c646d55161',
            '0x7be8befe93527c9aa0e48c855958feba1ff38abbc7476cf4de5dbeb14294b093',
            '0xa1e69775e90aaf881ecd49c32ffaf9dbf00a9947e9b292c97a5e2d6b070e54ec'
            ])
      ```
