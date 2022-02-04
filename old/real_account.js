const { LCDClient, Wallet, MnemonicKey, StdFee, MsgExecuteContract, MsgSend, Coin } = require('@terra-money/terra.js');
const secrets = require('./secrets.json');

//const terra = new LCDClient({ URL: 'https://bombay-lcd.terra.dev', chainID:'bombay-12' });
const terra = new LCDClient({
	URL: 'https://lcd.terra.dev',
	chainID: 'columbus-5'
 });
const owner = new MnemonicKey({
	mnemonic:
		secrets.mnemonic,
  });
const wallet = new Wallet(terra, owner);

const walletAddress = async () => {
	console.log(owner.accAddress);
}
walletAddress();


// These are mainnet addresses, will need to create a new wallet and test on mainnet with a wallet that has a small amount of money
const astroportFactoryAddress = "terra1fnywlw4edny3vw44x04xd67uzkdqluymgreu7g";
const astroportRouterAddress = "terra16t7dpwwgx9n3lq6l6te3753lsjqwhxwpday9zx";
const bLUNATokenAddress = "terra1kc87mu460fwkqte29rquh4hc20m54fxwtsx7gp";

// Factory
// Get token pairs
// Query message:
// token: contract_address
// native_token: denom

// Router
// execute swap operations
// astro_swap:
// offer_asset_info: native_token/token
// ask_asset_info: native_token/token
// minimum receive
// astro_swap for bLUNA -> LUNA
// native swap for UST -> LUNA (I think)

// Query swap operations:
// simulate_swap_operations
// operations -> astro_swap -> offer_asset_info -> ask_asset_info, offer_amount

const getBalance = async (denom) => {
	const balances = await terra.bank.balance(owner.accAddress);
	const balance = balances[0]["_coins"][denom]["amount"];
	console.log(balance);
	return balance;
}
//const uusd_balance = getBalance("uusd");
// 20_000_000 uusd = 20 ust

// Swap bLUNA -> LUNA -> UST
const realQueryTrade = async(uusd_balance) => {
	return await terra.wasm.contractQuery(
		astroportRouterAddress,
		{
			"simulate_swap_operations" : {
			  "offer_amount": uusd_balance.toString(),
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
			  },
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
// Will return an error if the pool doesn't exist that we are trying to swap on 
// Do a query to simulate the response with what we have to offer
// Then do an execute query asking for 99% of what the simulation offer said we would receive

const queryLunaTrade = async(balance) => {
	return await terra.wasm.contractQuery(
		astroportRouterAddress,
		{
			"simulate_swap_operations" : {
			  "offer_amount": balance.toString(),
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

const getPairInfo = async(address, denom) => {
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

const performTrade = async (minimumReceived) => {
	return [
		new MsgExecuteContract(owner.accAddress, astroportRouterAddress, {
			"execute_swap_operations": {
				"operations": [
					{
						"native_swap":{
						  "offer_denom":"uluna",
						  "ask_denom":"uusd"
						}
					  }
				],
				"minimum_receive": minimumReceived.toString(),
				"to": owner.accAddress
			}
		})
	]
}

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

// TODO:
// 1) Create a new terra wallet
// 2) Send the new wallet $10 UST
// 3) Attempt to swap 9 UST for bLUNA
// Need to learn how it figures out how much money to remove from my wallet and what it sets the fees to...

async function main() {
	//await depositStable();
	//await submitBid();
	const uluna_balance = await getBalance("uluna");
	const uusd_balance = await getBalance("uusd");
	// await realQueryTrade(uusd_balance).then((result) => {
	// 	console.log(result);
	// });
	// await getPairInfo();
	// TODO: Need to simulate a trade to get the belief price
	await getNativePairInfo("uluna", "uusd").then((result) => {
		console.log(result.contract_addr);
		//performNativeTrade(result.contract_addr, "uusd", "10_000");
	});
	/*
	await queryLunaTrade(uluna_balance).then((result) => {
		console.log(result.amount);
		performTrade(result.amount).then((result2) => {
			console.log(result2);
		})
	});
	*/
}
	
main().catch(console.error);


// So it seems like we can't even believe the official docs for these contracts
// execute_swap_operations isn't what is called when using the frontend for astroport swaps
// it's just "swap".....
// So will need to perform things manually and then just reverse engineer the contract message from finder.terra.money it seems...
