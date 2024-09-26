# Iden3 Sparse Merkle Tree

In this project we review the Iden3 Sparse Merkle Tree implementation.

Here we isolate the SMT implementation, which was copied from [iden3/contracts](https://github.com/iden3/contracts/blob/master/contracts/lib/SmtLib.sol) on 17th Sep 2024.

The Solarity SMT, was developed starting from the iden3 SMT. Hence some [conclusions](../solarity_tree/README.md#conclusions) from the Solarity SMT review are also true for the iden3 SMT.

Conclusions in the Solarity discusion that DO NOT apply to iden3:

1. Solarity: "The library supports distinct `add`, `update`, `remove` functions...". 

    The iden3 library `addLeaf` supports both adding a new leaf and updating an existing leaf. However there is no support for leaf removal.


1. Solarity: "The hash of parent nodes is completely non-standard and hard to reproduce off-chain."

    The iden3 library does not employ the unique id system used in Solarity. It rather works directly with `parent_hash -> (left_hash, right_hash)`. This makes reproducing the same tree off-chain easier. 


## Testing

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
    cd iden3_tree
    rm ./ignition/deployments -rfv

    npx hardhat ignition deploy ./ignition/modules/deploy.ts  --network reth
    npx hardhat console --network reth
    ```

1. Run test and demonstrated "reversed" address traversal in iden3 SMT:

    Setting leaves for addresses: <BR />
    `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' -> h0` <BR />
    `0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC' -> h1`

    ...normally result in a root:  <BR />
    `Hash(h1 || h0)`

    Instead, becasuse of how `_pushLeaf` processes the address, the root is actually: <BR />
    `Hash(Hash(h1 | h0) | 0)`

    `_pushLeaf` reads the leaf index (address) in reverse order (from LSB to MSB) when traversing from root-to-leaf. 
    It thus adds both leaves to the 1st half of the tree.

    ```JS
    // Load contract addresses
    const network = await ethers.provider.getNetwork()
    const chain_type = "chain-" + network.chainId.toString()

    fs = require("fs")
    util = require('util')
    readFile = util.promisify(fs.readFile)
    contract_data = await readFile(`./ignition/deployments/${chain_type}/deployed_addresses.json`, 'utf8')
    contract_addrs = JSON.parse(contract_data.split('#').join('_'))

    // Initialize contract instance
    const TreeFactory = await ethers.getContractFactory(
                "TokenSnapshot", 
                { libraries: { SmtLib: contract_addrs.TreeModule_SmtLib }})
    const tree = await TreeFactory.attach(contract_addrs.TreeModule_TokenSnapshot)

    await tree.getMaxDepth()
    await tree.getRoot()

    // Add 1st leaf to the tree. Normally this would go to
    // the right branch of the root. But not in this case.
    // Note the MSBs/LSBs of the address 1111...0110
    await tree.recordBalance('0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', 5n*10n**18n)
    root = "0x" + (await tree.getRoot()).toString(16)

    // Compute leaf hash
    h0 = await tree.hash3(
    "0x000000000000000000000000f39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    "0x0000000000000000000000000000000000000000000000004563918244f40000", 
    "0x0000000000000000000000000000000000000000000000000000000000000001")

    // Confirm root match
    (h0 === root)

    // Add 2nd leaf to the tree. Normally this would go to
    // the left branch of the root. But not in this case.
    // Note the MSBs/LSBs of the address 0011...1100
    await tree.recordBalance('0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC', 5n*10n**18n)
    root = "0x" + (await tree.getRoot()).toString(16)

    // Compute leaf hash
    h1 = await tree.hash3(
    "0x0000000000000000000000003C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
    "0x0000000000000000000000000000000000000000000000004563918244f40000", 
    "0x0000000000000000000000000000000000000000000000000000000000000001")

    // Compute the expected new root
    // Hash(h1 | h0)
    newRoot = await tree.hash2(h1,h0)

    // Confirm that the two roots don't match
    (root !== newRoot)

    // Compute the root based on "reversed address" traversal
    //  Current: 1111...0 1 1 0
    //  New:     0011...1 1 0 0
    //                      | |-- Traverse left, Right = Current_Sibling (Zero)
    //                      |---- Traverse left, Right = Current_Sibling (h0)
    // Hash(Hash(h1 | h0) | 0)
    zero = "0x0000000000000000000000000000000000000000000000000000000000000000"
    actualRoot = await tree.hash2(newRoot,zero)

    // Confirm root match
    (actualRoot === root)
    ```