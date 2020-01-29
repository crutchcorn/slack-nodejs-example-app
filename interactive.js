const { createEventAdapter } = require('@slack/events-api');
const { WebClient } = require('@slack/web-api');

const token = process.env.OAUTH_TOKEN;
const slackSigningSecret = process.env.SLACK_SIGNING_SECRET;

const slackEvents = createEventAdapter(slackSigningSecret);
const web = new WebClient(token);
const port = process.env.PORT || 3000;

/**
 * @type <Record<string, number>> A record of the word and score. Should start at 0
 * This should be replaced by a database for persistence. This is just a demo
 */
const state = {};

const getIsPlusOrMinus = str => {
	// Accept em-dash for cases like MacOS turning -- into an emdash
	const plusOrMinusRegex = /\@(\w+?)(\-{2}|\+{2}|\—{1})/;
	const [_, itemToScore, scoreStr] = plusOrMinusRegex.exec(str) || [];
	switch (scoreStr) {
		case '--':
		case '—':
			return { action: 'minus', word: itemToScore };
		case '++':
			return { action: 'add', word: itemToScore };
		default:
			return { action: '', word: undefined };
	}
};

slackEvents.on('message', async event => {
	console.log(`Received a message event: user ${event.user} in channel ${event.channel} says ${event.text}`);

	const { action, word } = getIsPlusOrMinus(event.text);
	if (action) {
		const currentState = state[word] || 0;
		state[word] = action == 'add' ? currentState + 1 : currentState - 1;
		const result = await web.chat.postMessage({
			text: `${word} ${action == 'add' ? 'had a point added' : 'had a point removed'}. Score is now at: ${
				state[word]
			}`,
			channel: event.channel,
		});

		console.log(`Successfully send message ${result.ts} in conversation ${event.channel}`);
	}

  if (/@pointsrus leaderboard/i.exec(event.text)) {
		const stateWords = Object.keys(state);
		const stateNumbers = Object.values(state);

    const itemStr = 'Item';
  	const countStr = 'Count';

		let longestWord = itemStr.length;
		let longestNumber = countStr.length;

		for (let word of stateWords) {
      // Add one for the ` ` after the entry
			longestWord = longestWord < word.length ? word.length : longestWord;
    }

		for (let number of stateNumbers) {
      const numStr = `${number}`;
			longestNumber = longestNumber < numStr.length ? numStr.length : longestNumber;
		}


    const getSpacing = (str, char, max) => {
      const addedLength = max - str.length;
      return char.repeat(addedLength);
    }

    const headerStr1 = `${itemStr}${getSpacing(itemStr, ' ', longestWord)}`;
    const headerStr2 = `${countStr}${getSpacing(countStr, ' ', longestNumber)}`;
    const headerStr = `${headerStr1} | ${headerStr2}`;
    // Plus three because of the two spaces plus the `|`
    const totalLength = headerStr.length;
    const seperatorStr = getSpacing('', '-', totalLength);
    const initialHeader = `${headerStr}\n${seperatorStr}\n`; 

    const tableString = stateWords.reduce((stateStr, word) => {
      const numberOfInstances = `${state[word]}`;
      const addedSpaceWord = getSpacing(word, ' ', longestWord);
      const addedSpaceNumber = getSpacing(numberOfInstances, ' ', longestNumber);
      return `${stateStr}${word}${addedSpaceWord} | ${addedSpaceNumber}${numberOfInstances}\n`;
    }, initialHeader);
    
    const result = await web.chat.postMessage({
		text: "```\n" + tableString + "```",
		channel: event.channel,
	});

  console.log(`Successfully send message ${result.ts} in conversation ${event.channel}`);
	}
});

slackEvents.on('error', console.error);

slackEvents.start(port).then(() => {
	console.log(`server listening on port ${port}`);
});
