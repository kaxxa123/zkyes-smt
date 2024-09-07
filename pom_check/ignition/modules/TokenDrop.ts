import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import USDToken from "./USDToken";

const TokenDropModule = buildModule("TokenDropModule", (m) => {
    const { usd } = m.useModule(USDToken);

    const drop = m.contract(
        "TokenDrop",
        // Root for level=3, leafs set: 0,1,2
        [usd, "0xe02f8dfe3fa6762ef3f9b218d9f58b651e7f2eb12ff564d7da9d658f8f02f849"],
        { after: [usd] });

    m.call(usd, "mint", [drop, 100n * 10n ** 18n], { after: [drop] })

    return { usd, drop };
});

export default TokenDropModule;
