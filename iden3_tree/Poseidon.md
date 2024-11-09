# iden3 Poseidon

## @iden3/js-crypto Poseidon Hashing
Iden3 has two implementatinos for Poseidon hashes in each of these libraries `@iden3/js-crypto` and `circomlibjs`.

The one in `@iden3/js-crypto` is compatible with the EVM Poseidon hashing functions. The `circomlibjs` Poseidon is not.

<BR />

## circomlibjs Poseidon Hashing
Using the Circomlibjs Poseidon hashing function requires awareness of how this is implemented in iden3.

These can be provided with either an array of numbers or a 32-byte `Uint8Array`. However the conversion between the two is not trivial. Conversion is done using the `Field::e()` function.

Since Poseidon is computed with Eliptic Curve operations, the curve over which the hash is computed is required. In general circom uses the bn128 curve.

The following code shows how a hash is computed using numbers vs `Uint8Array`.

```JS
let { buildPoseidon }  = require("circomlibjs")
let jsposeidon = await buildPoseidon()

// Copmute hash given two numbers
jhash = jsposeidon([1,1])
jhash = Array.from(jhash).map(byte => byte.toString(16).padStart(2, '0')).join('')
// jhash = 3dde09b2c54e4bf93215ce3166932e4182e8b962d771b91b85a3288f124d3923

// Convert number to Uint8Array
one = jsposeidon.F.e(1)
jhashb = jsposeidon([one,one])
jhashb = Array.from(jhashb).map(byte => byte.toString(16).padStart(2, '0')).join('')

// Confirm how hashing numeric values is 
// equivalent to hashing 32-byte arrays
// that are converted with F.e
jhash === jhashb
```

<BR />

## Implementation for F.e()

F.e() is implemented in ffjavascript library [here](https://github.com/iden3/ffjavascript/blob/master/src/wasm_field1.js).
    
```JS
// Function may be provided with a string or Uint8Array.
// If a Uint8Array is provided the value is immidiately returned.
// If a string is provided the function:
//      1. converts this to a BigInt
//      2. converts value to be a positive mod p value
//      3. converts this to a little endian Uint8Array (LSB is first byte)
//      4. converts to Montgomery
//
// Inputs:
//      a - value to be converted
//      b - (optional) numeric base of hex, octal etc.
//
// Returns:
//      Converted value as a Uint8Array
e(a, b) {

    // If input is a byte array do nothing
    if (a instanceof Uint8Array) return a;

    // Convert string "a" to a BigInt value
    let ra = Scalar.e(a, b);

    // If the BigInt is negative
    // get the positive modulo
    if (Scalar.isNegative(ra)) {
        // Invert the sign to get a positive value
        ra = Scalar.neg(ra);

        // Make sure the value is within range [0, prime]
        if (Scalar.gt(ra, this.p)) {
            ra = Scalar.mod(ra, this.p);
        }

        // Compute prime - value
        ra = Scalar.sub(this.p, ra);
    } 
    
    // If the BigInt is positive
    // check its range.
    else {
        // Make sure the value is within range [0, prime]
        if (Scalar.gt(ra, this.p)) {
            ra = Scalar.mod(ra, this.p);
        }
    }

    // Convert Little Endian BigInt to Buffer.
    // The first bytes is the least significant Byte in the Buffer 
    const buff = utils.leInt2Buff(ra, this.n8);

    // An integer Z is represented as Z*R mod M, where M is the modulo 
    // and R = 2r is a radix that is co prime to M. This representation 
    // is called Montgomery residue. Multiplication is performed in this 
    // residue, and division by M is replaced with division by R
    return this.toMontgomery(buff);
}

toMontgomery(a) {
    return this.op1("_toMontgomery", a);
}

op1(opName, a) {
    this.tm.setBuff(this.pOp1, a);
    this.tm.instance.exports[this.prefix + opName](this.pOp1, this.pOp3);
    return this.tm.getBuff(this.pOp3, this.n8);
}

// Scalar.e(a, b) is implemented here:
// https://github.com/iden3/ffjavascript/blob/master/src/scalar.js

export const e = fromString;

// Convert s to a BigInt value
export function fromString(s, radix) {
    if ((!radix)||(radix==10)) {
        return BigInt(s);
    } else if (radix==16) {
        if (s.slice(0,2) == "0x") {
            return BigInt(s);
        } else {
            return BigInt("0x"+s);
        }
    }
}
```

<BR />

## Poseidon On-Chain Libraries

The [iden3 contracts library](https://github.com/iden3/contracts/blob/master/contracts/lib/Poseidon.sol) does not include a solidity implementation of the Poseidon hashing functions. Instead it contains a set of stub libraries.

These are installed on Ethereum mainnet at these addresses.

| Library          | Address                                      |
|------------------|----------------------------------------------|
| `PoseidonUnit1L` | `0xC72D76D7271924a2AD54a19D216640FeA3d138d9` | 
| `PoseidonUnit2L` | `0x72F721D9D5f91353B505207C63B56cF3d9447edB` | 
| `PoseidonUnit3L` | `0x5Bc89782d5eBF62663Df7Ce5fb4bc7408926A240` | 
| `PoseidonUnit4L` | `0x0695cF2c6dfc438a4E40508741888198A6ccacC2` | 


We can also get the code for these libraries using the 'circomlibjs' as follows. 

```JS
let { poseidonContract } = require("circomlibjs")

const accounts = await ethers.getSigners()
const codePoseidon2 = poseidonContract.createCode(2);
const codePoseidon3 = poseidonContract.createCode(3);
const abiPoseidon2 = poseidonContract.generateABI(2);
const abiPoseidon3 = poseidonContract.generateABI(3);

// Deploy libraries
let trn = await accounts[0].sendTransaction({ to: null, data: codePoseidon2 })
let receipt = await trn.provider.getTransactionReceipt(trn.hash)
if (typeof receipt?.contractAddress !== "string")
    throw "Failed on installig Poseidon2 contract";
const addr2 = receipt?.contractAddress;

trn = await accounts[0].sendTransaction({ to: null, data: codePoseidon3 })
receipt = await trn.provider.getTransactionReceipt(trn.hash)
if (typeof receipt?.contractAddress !== "string")
    throw "Failed on installig Poseidon3 contract";
const addr3 = receipt?.contractAddress;

// Attach to library instances
const factoryPoseidon2 = new ethers.ContractFactory(abiPoseidon2, codePoseidon2, accounts[0]);
const factoryPoseidon3 = new ethers.ContractFactory(abiPoseidon3, codePoseidon3, accounts[0]);

const hash2 = factoryPoseidon2.attach(addr2);
const hash3 = factoryPoseidon3.attach(addr3);
```

Unlike the stub libraries, the deployed libraries will have two functions both named `poseidon`. One will take an array of `uint256` and the other an array of `bytes32`, as input. To invoke these from JS we must resolve the naming ambiguity:

```JS
val = await hash2['poseidon(uint256[2])']([1, 1])
val.toString(16)
// 7af346e2d304279e79e0a9f3023f771294a78acb70e73f90afe27cad401e81

await hash2['poseidon(bytes32[2])'](["0x0000000000000000000000000000000000000000000000000000000000000001", "0x0000000000000000000000000000000000000000000000000000000000000001"])
// 0x007af346e2d304279e79e0a9f3023f771294a78acb70e73f90afe27cad401e81
```

Unlike the circomlibjs Poseidon functions, that work differently depending whether these are provided with a `number` or a `Uint8Array`, the solidity functions return the same hash.

Match Smart Contract hash with JS hash
```JS
// Smart Contract hash...
val = await hash2['poseidon(uint256[2])']([1, 1])
val.toString(16) 
// 7af346e2d304279e79e0a9f3023f771294a78acb70e73f90afe27cad401e81
val2 = jsposeidon.F.e(val)
Array.from(val2).map(byte => byte.toString(16).padStart(2, '0')).join('')
// 3dde09b2c54e4bf93215ce3166932e4182e8b962d771b91b85a3288f124d3923

// JS hash
jhash = jsposeidon([1,1])
jhash = Array.from(jhash).map(byte => byte.toString(16).padStart(2, '0')).join('')
// 3dde09b2c54e4bf93215ce3166932e4182e8b962d771b91b85a3288f124d3923
```
<BR />
