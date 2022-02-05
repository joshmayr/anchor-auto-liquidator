const { MsgExecuteContract } = require('@terra-money/terra.js');
const { fabricateCw20Send } = require('@anchor-protocol/anchor.js');

class Exchange {
	constructor(client, owner, wallet, factoryAddress, routerAddress) {
		this.client = client;
		this.owner = owner;
		this.wallet = wallet;
		this.factoryAddress = factoryAddress;
		this.routerAddress = routerAddress;
	}
	
	async getBeliefPrice(offerContractAddress, askNativeDenom) {
		const lunaReceived = await this.queryCW20Trade(offerContractAddress, askNativeDenom);
		return (1000000 / parseInt(lunaReceived.amount)).toString();
	}
	
	async getCoinBalance(denom) {
		const balances = await this.client.bank.balance(this.owner.accAddress);
		const balance = balances[0]["_coins"][denom]["amount"];
		return balance;
	}
	
	async getFixedAmountToSwapCw20(cw20ContractAddress, amountToSave) {
		const cw20Balance = (await this.queryCW20Balance(cw20ContractAddress)).balance;
		const amount = (parseInt(cw20Balance) - amountToSave)
		return (amount / 1_000_000).toString(); // TODO: Deprecate the fabricators and return the real balance here.
		// return (parseInt(cw20Balance) - amountToSave).toString();
	}
	
	async getNativeBeliefPrice(offerDenom, askDenom) {
		const amountReceived = await this.queryNativeTrade(offerDenom, askDenom);
		return (parseInt(amountReceived.amount) / 1_000_000).toString();
	}
	
	async getFixedAmountToSwap(coinDenom, amountToSave) {
		const balance = await this.getCoinBalance(coinDenom);
		return (parseInt(balance) - amountToSave).toString();
	}
	
	async queryCW20Balance(tokenAddress) {
		return await this.client.wasm.contractQuery(
			tokenAddress,
			{
			"balance" : {
				"address": this.owner.accAddress
			}
		}
		);
	}
	
	async queryCW20Trade(offerContractAddress, askNativeDenom) {
		return await this.client.wasm.contractQuery(
			this.routerAddress,
			{
				"simulate_swap_operations" : {
				  "offer_amount": "1000000",
				  "operations": [
				  {
					  "astro_swap": {
						"offer_asset_info": {
						  "token": {
							"contract_addr": offerContractAddress
						  }
						},
						"ask_asset_info": {
						  "native_token": {
							"denom": askNativeDenom
						  }
						}
					  }
					}
				]
				}
			  }
		  );
	}
	
	async queryNativePairAddress(denom1, denom2) {
		return await this.client.wasm.contractQuery(
			this.factoryAddress,
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
		
	async queryNativeTrade(offerDenom, askDenom) {
		return await this.client.wasm.contractQuery(
			this.routerAddress,
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
	
	async queryPairAddress(address, denom) {
		return await this.client.wasm.contractQuery(
			this.factoryAddress,
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
	
	cw20ToNativeSwapMsg(sender, amount, pairContract, maxSpread, beliefPrice, cw20ContractAddress) {
		const swapActions = this.swapMsg(maxSpread, beliefPrice);
		return fabricateCw20Send({
			"address": sender,
			"amount": amount,
			"contract_address": cw20ContractAddress,
			"contract": pairContract,
			"msg": swapActions
		});
	}
	
	nativeToNativeSwapMsg(sender, coinToTrade, amount, maxSpread, beliefPrice, pairContractAddress) {
		return [
			new MsgExecuteContract(sender, pairContractAddress, {
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
		]
	}
	
	swapMsg(max_spread, belief_price) {
		return {
			"swap": {
				"max_spread": max_spread,
				"belief_price": belief_price
			}
		}
	}
}

module.exports = {Exchange};