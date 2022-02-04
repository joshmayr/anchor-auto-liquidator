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

// Will return an error if the pool doesn't exist that we are trying to swap on 
// Do a query to simulate the response with what we have to offer
// Then do an execute query asking for 99% of what the simulation offer said we would receive

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
			  "swap": {
				"max_spread": "0.005",
				"offer_asset": {
				  "info": {
					"token": {
					  "contract_addr": bLUNATokenAddress
					}
				  },
				  "amount": offer_amount
				},
				"belief_price": "62.694745553375171626"
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
	await queryLunaTrade().then((result) => {
		console.log(result);
		const belief_price = 1000000 / parseInt(result.amount);
		console.log(belief_price);
	})
	/*
	await getPairInfo(bLUNATokenAddress, "uluna").then((result) => {
		console.log(result);
	});
	*/
	// TODO: Need to simulate a trade to get the belief price
	/*
	await getNativePairInfo("uluna", "uusd").then((result) => {
		console.log(result.contract_addr);
		performNativeTrade(result.contract_addr, "uusd", "10_000");
	});
	*/
}
	
main().catch(console.error);


// So it seems like we can't even believe the official docs for these contracts
// execute_swap_operations isn't what is called when using the frontend for astroport swaps
// it's just "swap".....
// So will need to perform things manually and then just reverse engineer the contract message from finder.terra.money it seems...
