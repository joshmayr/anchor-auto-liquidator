const { MsgExecuteContract } = require('@terra-money/terra.js');


async function buildExecuteMsg(senderAddress, contractAddress, actions) {
	return [
		new MsgExecuteContract(senderAddress, contractAddress, actions)
	]
}

async function sendMsg(client, wallet, msg) {
	const tx = await wallet.createAndSignTx({
		msgs: msg,
	})
	return await client.tx.broadcast(tx);
}

module.exports = { buildExecuteMsg, sendMsg }