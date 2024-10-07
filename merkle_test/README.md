# Local Merkle Tree tests

Project for testing the Merklke Library before releasing a new package.

Project assumes the Merkle Libary was deployed locally using:

```BASH
cd ./merkle
npm run build
npm link
```

To pull the `zkyes-smt` package from the local node modules:

```BASH
cd ./merkle_test
npm link zkyes-smt
npm run build
```
