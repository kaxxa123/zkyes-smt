# Local Merkle Tree tests

Project for testing the Merklke Library before releasing a new package.

Whenever testing a new version we need to link the local library and pull the latest version into the test project as follows:

```BASH
# Link the latest library
cd ./merkle
npm run build
npm link

# Update library at the test project
cd ./merkle_test
npm link zkyes-smt
npm run build
```
