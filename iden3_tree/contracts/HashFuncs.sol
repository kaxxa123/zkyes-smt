// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.27;

// AlexZ: The use of libraries for hashing functions provides a
// flexible way of setting SmtLib with any hashing functions.
// Unfortunately the naming poseidon() could have been more generic.
// However we keep this (even when swapping poseidon with keccak256)
// to minimize the changes at SmtLib.sol
library MyKeccak2L {
    function poseidon(
        uint256[2] calldata preimage
    ) public pure returns (uint256) {
        return uint256(keccak256(abi.encodePacked(preimage[0], preimage[1])));
    }
}

library MyKeccak3L {
    function poseidon(
        uint256[3] calldata preimage
    ) public pure returns (uint256) {
        return
            uint256(
                keccak256(
                    abi.encodePacked(preimage[0], preimage[1], preimage[2])
                )
            );
    }
}
