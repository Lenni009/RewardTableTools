const outputs = {
	rewardList: getOutput('rewardList'),
	chancesInputType: getOutput('chancesInputType'),
	chancesTable: getOutput('chancesTable'),
	EXML: getOutput('EXML'),
}

let file, ID, fileXmlDoc, snippetXmlDoc;		// make these variables available to the entire file

function getOutput(outputId) {
	const output = document.getElementById(outputId);
	return output;
}

function updateVar(element) {
	ID = element.value;
	searchReward(fileXmlDoc)
}

function readSingleFile(e) {
	file = e.files.item(0);

	if (!file) return;

	const reader = new FileReader();
	reader.onload = function (e) {
		const contents = e.target.result;
		if (!contents) return;
		fileXmlDoc = processEXML(contents);
		searchReward(fileXmlDoc);
		if (document.getElementById("rewardInput").value) searchRewardSection(document.getElementById("rewardInput"), 'chancesTable', 'EXML');
	};
	reader.readAsText(file);
}

function processEXML(contents) {
	const parser = new DOMParser();
	return parser.parseFromString(contents, "text/xml");
}

// entry point for reward ID search
function searchRewardSection(inputElement, outputId, EXMLOutputId) {
	const xmlDoc = fileXmlDoc
	if (!xmlDoc) return;
	const input = inputElement.value;
	const reward = xmlDoc.querySelector(`[value="GcGenericRewardTableEntry.xml"] > [name="Id"][value=${input} i], [value="GcRewardTableEntry.xml"] > [name="Id"][value=${input} i]`)?.parentNode;
	if (!reward) return;
	rewardChances(reward, outputId, 'Reward ID chances', xmlDoc);
	SerialiseXML(reward, EXMLOutputId);
}

function searchReward(xmlDoc) {
	if (!(file && ID)) return;

	const elements = Array.from(xmlDoc.querySelectorAll(`*:not([name="InventoryClass"])[value="${ID}" i]`));

	if (!elements.length) return;

	const results = new Set();		// can't have duplicate values

	for (const element of elements) {
		const reward = element.closest('[value="GcGenericRewardTableEntry.xml"], [value="GcRewardTableEntry.xml"]')?.querySelector('[name="Id"]');
		if (!reward) return;
		results.add(reward);
	}

	document.getElementById("rewardList").innerHTML = '';

	for (const reward of results) {
		const result = `<li>${reward.getAttribute("value")}</li>`;
		document.getElementById("rewardList").insertAdjacentHTML("beforeend", result);
	}
}

function rewardChances(EXMLSection, outputId, inputType, xmlDoc) {
	if (!xmlDoc) return;

	let output;
	if (EXMLSection.parentNode?.querySelector('[value="GcRewardTableEntry.xml"]') || EXMLSection.querySelector('[value="GcRewardTableEntry.xml"]')) {
		const rarities = Array.from(EXMLSection.querySelector('[name="Rarities"]').children);

		const table = new Array;
		for (const rarity of rarities) {
			const sizes = Array.from(rarity.querySelector('[name="Sizes"]').children);
			const rarityName = rarity.getAttribute("name");
			const rarityHeader = `<div class="rarity">${rarityName}</div>`;
			table.push(rarityHeader);

			for (const size of sizes) {
				const sizeName = size.getAttribute("name");

				const rewardData = getRewards(size);

				if (!checkDataIntegrity(rewardData, outputId)) return;
				if (rewardData.IDs.length == 0) continue;

				const sizeHeader = `<div class="size">${sizeName}</div>`
				const tablePart = buildTable(rewardData);
				table.push(sizeHeader)
				table.push(tablePart);
			}
		}
		output = table.join('');
	} else {
		const rewardData = getRewards(EXMLSection);
		if (!checkDataIntegrity(rewardData, outputId)) return;
		output = buildTable(rewardData);
	}

	document.getElementById(outputId).innerHTML = output;

	document.getElementById("chancesInputType").innerText = inputType;
}

function SerialiseXML(EXMLSection, EXMLOutputId) {
	const serializer = new XMLSerializer();
	const xmlStr = serializer.serializeToString(EXMLSection);
	document.getElementById(EXMLOutputId).innerText = xmlStr;
}

function searchSnippet(input, outputId) {
	const EXML = input.value;
	if (!EXML) return;
	snippetXmlDoc = processEXML(EXML);		// populate xmlDoc variable
	rewardChances(snippetXmlDoc, outputId, 'Chances from EXML snippet', snippetXmlDoc);
}

function reset() {
	const inputs = document.querySelectorAll('input[type="text"], textarea');
	for (const input of inputs) {
		input.value = '';
	}

	const outputs = document.querySelectorAll('#output [id]')
	for (const output of outputs) {
		output.innerHTML = '';
	}
}

function buildTable(data) {
	const outputs = new Array;
	for (let i = 0; i < data.IDs.length; i++) {
		const itemId = data.IDs[i];
		const chance = data.chances[i];
		const rewardType = data.rewards[i];
		const outString = (() => {
			if (itemId.toLowerCase() == ID.toLowerCase()) {
				return `<mark>${i + 1}.</mark><mark>${rewardType}</mark><mark>${itemId}</mark><mark>${chance}%</mark>`;
			} else {
				return `<div>${i + 1}.</div><div>${rewardType}</div><div>${itemId}</div><div>${chance}%</div>`;
			}
		})();
		outputs.push(outString);
	}
	const table = outputs.join('');
	return table;
}

function getRewards(EXMLSection) {
	const entries = Array.from(EXMLSection.querySelectorAll('[value="GcRewardTableItem.xml"]'));

	const IDs = [];
	const chances = [];
	const rewards = [];

	const selectors = ['ID', 'ProductList', 'Items', 'ProductIds', 'TechList', 'Currency', 'ProceduralProductCategory', 'Group', 'TechId', 'Event', 'Stat', 'CreatureID', 'ProductID', 'Reward'];

	for (const entry of entries) {
		let type, output;
		for (const selector of selectors) {
			if (!entry.querySelector(`[name="${selector}"]`)) continue;
			type = selector;
			break;
		}

		switch (type) {
			case 'ID':
			case 'TechId':
			case 'Event':
				output = entry.querySelector(`[name="${type}"]`).getAttribute("value");
				break;

			case 'Items':
			case 'ProductIds':
			case 'ProductList':
			case 'TechList':
				const amount = entry.querySelector(`[name="${type}"]`).childElementCount;
				output = `List (${amount} entries)`;
				break;

			case 'ProceduralProductCategory':
				output = `ProcProd: ${entry.querySelector(`[name="${type}"]`).getAttribute("value")}`;
				break;

			case 'Group':
				output = `ProcTech: ${entry.querySelector(`[name="${type}"]`).getAttribute("value")}`;
				break;

			case 'CreatureID':
				output = `CreatureEgg: ${entry.querySelector(`[name="${type}"]`).getAttribute("value")}`;
				break;

			case 'ProductID':
				output = `SeasonReward: ${entry.querySelector(`[name="${type}"]`).getAttribute("value")}`;
				break;

			case 'Currency':
				output = entry.querySelectorAll(`[name="${type}"]`)[1].getAttribute("value");
				break;

			case 'Stat':
				const modify = entry.querySelectorAll(`[name="${type}"]`)[1].getAttribute("value");
				output = `${modify} stat: ${entry.querySelector(`[name="${type}"]`).getAttribute("value")}`;
				break;

			case 'Reward':
				output = entry.querySelector(`[name="${type}"]`).getAttribute("value");
				break;

			default:
				output = "Error";
		}
		IDs.push(output);

		const chance = entry.querySelector('[name="PercentageChance"]');
		if (chance) {
			chances.push(chance.getAttribute("value"));
		} else {
			chances.push("Error");
		}

		const reward = entry.querySelector('[name="Reward"]');
		if (reward) {
			rewards.push(reward.getAttribute("value"));
		} else {
			rewards.push("Error");
		}
	}
	const data = constructData(EXMLSection, IDs, chances, rewards);
	return data;
}

function constructData(EXMLSection, IDs, chances, rewards) {
	const data = {
		"IDs": IDs,
		"chances": calculateChances(EXMLSection, chances),
		"rewards": rewards
	}
	return data;
}

function calculateChances(EXMLSection, PercentageChances) {
	const chances = PercentageChances.map(Number);
	if (EXMLSection.querySelector('[name="RewardChoice"]')?.getAttribute("value") == 'GiveAll') return chances;

	const calculatedChances = new Array;

	for (const chance of chances) {
		const calcChance = chance / (chances.reduce((a, b) => a + b, 0) / 100);
		calculatedChances.push(calcChance.toFixed(3));
	}
	return calculatedChances;
}

function checkDataIntegrity(data, outputId) {
	if (data.IDs.length === data.chances.length && data.IDs.length === data.rewards.length) {
		return true;
	} else {
		console.log("ERROR");
		document.getElementById(outputId).style.display = 'block';
		const button = `<button class="button" onclick="this.parentElement.style.display = ''; this.parentElement.innerHTML = '';">Restore Functionality</button>`
		document.getElementById(outputId).innerHTML = "[ERROR: Array length doesn't match] Something went wrong. Please send the Reward Id to Lenni#4423 on Discord. Click this button to regain page functionality." + button;
		return false;
	}
}