import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import USDToken from "./USDToken";

const TokenDropModule = buildModule("TokenDropModule", (m) => {
    const { usd } = m.useModule(USDToken);

    const drop = m.contract(
        "TokenDrop",
        // Root for Level=3, Sorted, Leafs Set: 0,1,2,3
        [usd, "0xef0f86bd9a12acd5285d712174c8f8035f503428154c4b4a40c2494f32a77b3b"],
        { after: [usd] });

    m.call(usd, "mint", [drop, 100n * 10n ** 18n], { after: [drop] })

    return { usd, drop };
});

export default TokenDropModule;
