const { LCDClient, Wallet, MnemonicKey, MsgExecuteContract } = require('@terra-money/terra.js');
const {columbus5, AddressProviderFromJson, fabricateCw20Send } = require('@anchor-protocol/anchor.js');
const {buildExecuteMsg, sendMsg} = require('./utils');

const secrets = require('./secrets.json');

const terra = new LCDClient({
	URL: 'https://lcd.terra.dev',
	chainID: 'columbus-5'
 });
const owner = new MnemonicKey({
	mnemonic:
		secrets.mnemonic,
  });
const wallet = new Wallet(terra, owner);

const astroportFactoryAddress = "terra1fnywlw4edny3vw44x04xd67uzkdqluymgreu7g";
const astroportRouterAddress = "terra16t7dpwwgx9n3lq6l6te3753lsjqwhxwpday9zx";

// Anchor smart contract addresses
const anchorAddressProvider = new AddressProviderFromJson(columbus5);

const makeCW20TradeMsg = async (amount, pairContract, actions) => {
	return fabricateCw20Send({
		"address": owner.accAddress,
		"amount": amount, // TODO: 
		"contract_address": anchorAddressProvider.bLunaToken(),
		"contract": pairContract,
		"msg": actions
	})
}

const getNativePairInfo = async(denom1, denom2) => {
	return await terra.wasm.contractQuery(
		astroportFactoryAddress,
		{
			"pair": {
				"asset_infos": [
				  {
					"native_token": {
					  "denom": denom1
					}
				  },
				  {
					"native_token": {
					  "denom": denom2
					}
				  }
				]
			}
		}
	);
}

const buildSwapMsg = async (max_spread, belief_price) => {
	return {
		"swap": {
			"max_spread": max_spread,
			"belief_price": belief_price
		}
	}
}

const getCoinBalance = async (denom) => {
	const balances = await terra.bank.balance(owner.accAddress);
	const balance = balances[0]["_coins"][denom]["amount"];
	return balance;
}

const getCW20BalanceQuery = async (tokenAddress) => {
	return await terra.wasm.contractQuery(
		tokenAddress,
		{
		"balance" : {
			"address": owner.accAddress
		}
	}
	);
}

const getPairInfo = async(address, denom) => {
	return await terra.wasm.contractQuery(
		astroportFactoryAddress,
		{
			"pair": {
				"asset_infos": [
				  {
					"token": {
					  "contract_addr": address
					}
				  },
				  {
					"native_token": {
					  "denom": denom
					}
				  }
				]
			}
		}
	);
}

const queryLunaTrade = async () => {
	return await terra.wasm.contractQuery(
		astroportRouterAddress,
		{
			"simulate_swap_operations" : {
			  "offer_amount": "1000000",
			  "operations": [
			  {
				  "astro_swap": {
					"offer_asset_info": {
					  "token": {
						"contract_addr": "terra1kc87mu460fwkqte29rquh4hc20m54fxwtsx7gp"
					  }
					},
					"ask_asset_info": {
					  "native_token": {
						"denom": "uluna"
					  }
					}
				  }
				}
			]
			}
		  }
	  );
}

const getBeliefPrice = async () => {
	const lunaReceived = await queryLunaTrade();
	return (1000000 / parseInt(lunaReceived.amount)).toString();
}

const queryNativeTrade = async (offerDenom, askDenom) => {
	return await terra.wasm.contractQuery(
		astroportRouterAddress,
		{
			"simulate_swap_operations" : {
			  "offer_amount": "1000000", // 1 LUNA
			  "operations": [
				  {
					  "native_swap": {
						  "offer_denom": offerDenom,
						  "ask_denom": askDenom
					  }
				  }
			]
			}
		  }
	  );
}

const getNativeBeliefPrice = async (offerDenom, askDenom) => {
	const amountReceived = await queryNativeTrade(offerDenom, askDenom);
	return (parseInt(amountReceived.amount) / 1_000_000).toString();
}

const cw20ToNativeSwap = async (cw20ContractAddress, nativeDenom, amount, maxSpread) => {
	const beliefPrice = await getBeliefPrice();
	const pairContractAddress = (await getPairInfo(cw20ContractAddress, nativeDenom)).contract_addr;
	const swapMsg = await buildSwapMsg(maxSpread, beliefPrice);
	const parsedAmount = amount / 1_000_000; // TODO: Anchor fabricator multiplies by 1_000_000 in the background, move away from using fabricators in the future
	const cw20TradeMsg = await(makeCW20TradeMsg(parsedAmount, pairContractAddress, swapMsg));
	const swapTx = await(sendMsg(terra, wallet, cw20TradeMsg));
	console.log(swapTx);
}

const getFixedAmountToSwapCw20 = async (cw20ContractAddress, amountToSave) => {
	const cw20Balance = (await getCW20BalanceQuery(cw20ContractAddress)).balance;
	return (parseInt(cw20Balance) - amountToSave).toString();
}

const getFixedAmountToSwap = async (coinDenom, amountToSave) => {
	const balance = await getCoinBalance(coinDenom);
	return (parseInt(balance) - amountToSave).toString();
}

const nativeToNativeSwap = async (coinToTrade, coinToReceive, amount, maxSpread) => {
	const beliefPrice = await getNativeBeliefPrice(coinToTrade, coinToReceive); // TODO: Build this function
	const pairContractAddress = (await getNativePairInfo(coinToTrade, coinToReceive)).contract_addr;
	
	const swapMsg = await buildExecuteMsg(owner.accAddress, pairContractAddress, {
			"swap": {
				"max_spread": maxSpread,
				"offer_asset": {
				  "info": {
					"native_token": {
					  "denom": coinToTrade
					}
				  },
				  "amount": amount
				},
				"belief_price": beliefPrice
			  }
		},
		{[coinToTrade]: amount})
		await sendMsg(terra, wallet, swapMsg);
}


const convertLiquidatedBlunaToUst = async () => {
	const cw20AmountToSwap = await getFixedAmountToSwapCw20(anchorAddressProvider.bLunaToken(), 0);
	await cw20ToNativeSwap(anchorAddressProvider.bLunaToken(), 'uluna', cw20AmountToSwap, "0.005");
	const amountToSwap = await getFixedAmountToSwap('uluna', 100_000); // We always want at least 0.1 LUNA in our account to cover transaction fees
	await nativeToNativeSwap('uluna', 'uusd', amountToSwap, "0.005");
}
// TODO: See if I can simplify the two functions into one function that sends 1 transaction that executes both swaps, I think it should be possible

module.exports = {nativeToNativeSwap, cw20ToNativeSwap, getFixedAmountToSwapCw20, getFixedAmountToSwap };