const { LCDClient, Wallet, MnemonicKey } = require('@terra-money/terra.js');
const { sendMsg, sleep } = require('../src/utils');
const { Exchange } = require('../src/exchange');
const { Anchor } = require('../src/anchorLiquidation');
const secrets = require('../secrets.json');

const terra = new LCDClient({
	URL: 'https://lcd.terra.dev',
	chainID: 'columbus-5'
 });
const owner = new MnemonicKey({
	mnemonic:
		secrets.mnemonic,
  });
const wallet = new Wallet(terra, owner);
const anchorAddressProvider = new AddressProviderFromJson(columbus5);

const bLunaToLuna = async (exchange) => {
	// TODO: First check if we have bLuna to swap..
	const cw20AmountToSwap = await exchange.getFixedAmountToSwapCw20(anchorAddressProvider.bLunaToken(), 0);
	if(parseFloat(cw20AmountToSwap) < 0.5) {
		return "Less than 0.5 bLUNA, not swapping";
	}
	
	const bLunaBeliefPrice = await exchange.getBeliefPrice(anchorAddressProvider.bLunaToken(), 'uluna');
	const bLunaLunaPair = (await exchange.queryPairAddress(anchorAddressProvider.bLunaToken(), 'uluna')).contract_addr;
		
	const cw20TradeMsg = exchange.cw20ToNativeSwapMsg(owner.accAddress, cw20AmountToSwap, bLunaLunaPair, "0.005", bLunaBeliefPrice, anchorAddressProvider.bLunaToken());
	return await(sendMsg(terra, wallet, cw20TradeMsg));
}

const lunaToUst = async (exchange) => {
	const amountToSwap = await exchange.getFixedAmountToSwap('uluna', 100_000); // We always want at least 0.1 LUNA in our account to cover transaction fees
	if(parseInt(amountToSwap) < 500_000) {
		return "Less than 0.5 LUNA, not swapping";
	}
	const lunaBeliefPrice = await exchange.getNativeBeliefPrice('uluna', 'uusd');
	const lunaUsdPair = (await exchange.queryNativePairAddress('uluna', 'uusd')).contract_addr;
	const swapMsg = exchange.nativeToNativeSwapMsg(owner.accAddress, 'uluna', amountToSwap, "0.005", lunaBeliefPrice, lunaUsdPair)
	return await sendMsg(terra, wallet, swapMsg);
}

const convertLiquidatedBlunaToUst = async () => {
	const astroportFactoryAddress = "terra1fnywlw4edny3vw44x04xd67uzkdqluymgreu7g";
	const astroportRouterAddress = "terra16t7dpwwgx9n3lq6l6te3753lsjqwhxwpday9zx";

	const astro = new Exchange(terra, owner, wallet, astroportFactoryAddress, astroportRouterAddress);
	
	const bLunaToLunaSwap = await bLunaToLuna(astro);
	const lunaToUstSwap = await lunaToUst();
}

const anchorLiquidationLoop = async () => {
	const bLunaAnchor = new Anchor(terra, owner, wallet, anchorAddressProvider.liquidationQueue(), anchorAddressProvider.bLunaToken(), anchorAddressProvider);
	
	while(true) {
		await bLunaAnchor.enterLiquidationQueue(1_000_000, 3);
		await bLunaAnchor.activateBids();
		await bLunaAnchor.claimLiquidations();
		await convertLiquidatedBlunaToUst();
		await sleep(60_000); // Sleep for 60 seconds
	}
}
// TODO: See if I can simplify the two functions into one function that sends 1 transaction that executes both swaps, I think it should be possible, but would need to build a custom smart contract

module.exports = { convertLiquidatedBlunaToUst, anchorLiquidationLoop };