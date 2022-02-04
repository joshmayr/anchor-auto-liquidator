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

const makeCW20TradeMsg = async (amount, pairContract, base64Msg) => {
	return fabricateCw20Send({
		"address": owner.accAddress,
		"amount": amount, // TODO: 
		"contract_address": anchorAddressProvider.bLunaToken(),
		"contract": pairContract,
		"msg": base64Msg
	})
}

// Get User Bids

// Will use this to check 2 things
// 1) Are there any bids that we need to activate?
// 2) Are there any filled liquidations that we can withdraw?
const queryUserBids = async () => {
	return await terra.wasm.contractQuery(
		"terra1e25zllgag7j9xsun3me4stnye2pcg66234je3u", // TODO: Set this as a variable, for anchorLiquidationQueueContractAddress
		{
		  "bids_by_user": {
			"collateral_token": "terra1...",
			"bidder": "terra1...", 
			"start_after": "123", 
			"limit": 8 
		  }
		}
	);
}

// Get Astroport Swap pair address
const getAstroPairInfo = async(address, denom) => {
	return await terra.wasm.contractQuery(
		astroportFactoryAddress,
		{
			"pair": {
				"asset_infos": [
				  {
					"token": {
					  "contract_address": address
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

// Get Astroport native swap pair address
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

const buildNativeSwapMsg = async (pairContractAddress, max_spread, belief_price, offer_denom, amount) => {
	return [
		new MsgExecuteContract(owner.accAddress, pairContractAddress, {
			"swap": {
				"max_spread": max_spread,
				"offer_asset": {
				  "info": {
					"native_token": {
					  "denom": offer_denom
					}
				  },
				  "amount": amount
				},
				"belief_price": belief_price
			  }
		},
		{[offer_denom]: amount}
	)
	]
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

const queryLunaUstTrade = async () => {
	return await terra.wasm.contractQuery(
		astroportRouterAddress,
		{
			"simulate_swap_operations" : {
			  "offer_amount": "1000000", // 1 LUNA
			  "operations": [
				  {
					  "native_swap": {
						  "offer_denom": "uluna",
						  "ask_denom": "uusd"
					  }
				  }
			]
			}
		  }
	  );
}

const getLunaUstBeliefPrice = async () => {
	const uustReceived = await queryLunaUstTrade();
	return (parseInt(uustReceived.amount) / 1000000).toString();
}

const bLunaToLunaSwap = async () => {
	const bLUNASwapAmount = (await getCW20BalanceQuery(anchorAddressProvider.bLunaToken())).balance; // #1
	const beliefPrice = await getBeliefPrice(); // #2
	const pairContractAddress = (await getPairInfo(anchorAddressProvider.bLunaToken(), "uluna")).contract_addr; // #3
	// TODO: For now the swap message is using a hardcoded amount, it looks like it want's bLUNA as the denomination, not ubLUNA. Will need to make an update to the balance from above, we CAN use decimals though so it's not that bad
	const base64SwapMessage = await buildSwapMsg('0.005', beliefPrice);  // #4
	
	const cw20TradeMsg = await(makeCW20TradeMsg(bLUNASwapAmount, pairContractAddress, base64SwapMessage));
	const executedTransaction = await(sendMsg(terra, wallet, cw20TradeMsg));
	// const executedTransaction = await(doCW20Trade(cw20TradeMsg));
	console.log(executedTransaction);
}

const lunaToUstSwap = async () => {
	const ulunaBalance = await getCoinBalance("uluna"); // #1
	const beliefPrice = await getLunaUstBeliefPrice(); // #2
	console.log(ulunaBalance);
	console.log(beliefPrice); // My belief price might be backwards...
	
	const pairContractAddress = (await getNativePairInfo('uluna', 'uusd')).contract_addr; // #3
	
	const swapMsg = await buildNativeSwapMsg(pairContractAddress, "0.005", beliefPrice, "uluna", "10000");
	const swapTransaction = await sendMsg(terra, wallet, swapMsg);
	// const swapTransaction = await doNativeTrade(swapMsg);
	console.log(swapTransaction);
}


const convertLiquidatedBlunaToUst = async () => {
	await bLunaToLunaSwap();
	await lunaToUstSwap();
}
convertLiquidatedBlunaToUst();
// TODO: Confirm that the above function works
// TODO: See if I can simplify the two functions into one function that sends 1 transaction that executes both swaps, I think it should be possible