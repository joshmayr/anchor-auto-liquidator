const { LCDClient, Wallet, MnemonicKey, StdFee, MsgExecuteContract, MsgSend, Coin } = require('@terra-money/terra.js');
const {fabricateMarketRedeemStable, fabricateMarketDepositStableCoin, columbus5, AddressProviderFromJson, fabricateLiquidationQueueSubmitBid, fabricateCw20Send } = require('@anchor-protocol/anchor.js');
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

const bLUNATokenAddress = "terra1kc87mu460fwkqte29rquh4hc20m54fxwtsx7gp";
const astroportFactoryAddress = "terra1fnywlw4edny3vw44x04xd67uzkdqluymgreu7g";
const astroportRouterAddress = "terra16t7dpwwgx9n3lq6l6te3753lsjqwhxwpday9zx";


// Anchor smart contract addresses
const anchorAddressProvider = new AddressProviderFromJson(columbus5);

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

// Activate Bids
// TODO: Might be easier to create an async function for the below that takes bidIndex as a parameter and returns activateBidsMsg from the function
let bidIndex = 0;
const activateBidsMsg = {
  "activate_bids": {
	"bids_idx": [
	  bidIndex // TODO: Verify that the bidIndex in the message actually updates if I update bidIndex variable
	],
	"collateral_token": bLUNATokenAddress
  }
}

// Claim liquidations
const claimLiquidationsMsg = {
  "claim_liquidations": {
	"collateral_token": bLUNATokenAddress,
	 //"bids_idx": ["123","231"], // This is optional, for now we will leave blank and it should retrieve all
  }
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

// Perform native swap on astroport
const performNativeTrade = async (contractAddress, offer_denom, offer_amount) => {
	return [
		new MsgExecuteContract(owner.accAddress, contractAddress, {
			  "swap": {
				"max_spread": "0.005",
				"offer_asset": {
				  "info": {
					"native_token": {
					  "denom": offer_denom
					}
				  },
				  "amount": offer_amount
				},
				"belief_price": "62.694745553375171626"
			  }
			})
	]
}

// Perform native->cw20 swap on astroport
const performNativeCW20Trade = async (contractAddress, offer_denom, offer_amount) => {
	return [
		new MsgExecuteContract(owner.accAddress, contractAddress, {
			  "swap": {
				"max_spread": "0.005",
				"offer_asset": {
				  "info": {
					"native_token": {
					  "denom": offer_denom
					}
				  },
				  "amount": offer_amount
				},
				"belief_price": "62.694745553375171626"
			  }
			})
	]
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



const performCW20Trade = async (tokenContractAddress, base64Message, amount, pairContract) => {
	return [
		new MsgExecuteContract(owner.accAddress, tokenContractAddress, {
			"send": {
				"msg": base64Message,
				"amount": amount,
				"contract": pairContract
			}
		})
	]
}

const makeCW20TradeMsg = async (amount, pairContract, base64Msg) => {
	return fabricateCw20Send({
		"address": owner.accAddress,
		"amount": "0.001", // TODO: 
		"contract_address": anchorAddressProvider.bLunaToken(),
		"contract": pairContract,
		"msg": base64Msg
	})
}



// Need to get the belief price, and the amount of token that we want to trade from the wallet balance, then should be able to perform a swap with bLUNA

const getCoinBalance = async (denom) => {
	const balances = await terra.bank.balance(owner.accAddress);
	const balance = balances[0]["_coins"][denom]["amount"];
	return balance;
}
//getCoinBalance("uusd");

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

const getCW20Balance = async (tokenAddress) => {
	console.log(await getCW20BalanceQuery(tokenAddress));
}
//getCW20Balance(anchorAddressProvider.bLunaToken());

const getSwapAmountFromPercentHolding = async (percent) => { // TODO: Finish this function for when swapping coins that we don't want to swap full balance of
	return percent;
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

/*
In order to swap from bLUNA to LUNA there are a few steps:
1) Get the amount of bLUNA that we want to swap to LUNA, this should be 100% of our bLUNA balance (getCW20Balance)

2) Get the belief price for the bLUNA/LUNA trade, (queryLunaTrade)
3) Get the astroport pair contract for bBLUNA/LUNA (getPairInfo)
4) Create the swap message (base64EncodeMsg)
5) Execute the send message on the bLUNA contract to perform the swap (performCW20Trade)
*/
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

//bLunaToLunaSwap();


/*
1) Get the amount of LUNA that we want to swap to UST, for now we need to pay for transactions with LUNA, so aim to always keep 0.3 LUNA in our account
2) Get the belief price for the LUNA/UST trade
3) Get the astroport pair contract for LUNA/UST
4) Create the swap message
5) Execute the swap message on the pair contract
*/
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

//lunaToUstSwap();


const convertLiquidatedBlunaToUst = async () => {
	await bLunaToLunaSwap();
	await lunaToUstSwap();
}
convertLiquidatedBlunaToUst();
// TODO: Confirm that the above function works
// TODO: See if I can simplify the two functions into one function that sends 1 transaction that executes both swaps, I think it should be possible
// TODO: Clean up this file