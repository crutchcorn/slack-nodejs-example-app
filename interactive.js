const { createEventAdapter } = require('@slack/events-api');
const { WebClient } = require('@slack/web-api');
const { tablize } = require('batteries-not-included/utils');

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
		const actionString = action == 'add' ? 'had a point added' : 'had a point removed';
		const result = await web.chat.postMessage({
			text: `${word} ${actionString}. Score is now at: ${state[word]}`,
			channel: event.channel,
		});

		console.log(`Successfully send message ${result.ts} in conversation ${event.channel}`);
	}

	if (/@pointsrus leaderboard/i.exec(event.text)) {
		// Tablize just takes a 2D array, treats the first item as a header row, then makes an ASCII table
		const tableString = tablize([['Item', 'Count'], ...Object.entries(state)]);

		// Send that table in codeblocks to monospace the font and render properly
		const result = await web.chat.postMessage({
			text: '```\n' + tableString + '```',
			channel: event.channel,
		});

		console.log(`Successfully send message ${result.ts} in conversation ${event.channel}`);
	}
});

slackEvents.on('error', console.error);

slackEvents.start(port).then(() => {
	console.log(`server listening on port ${port}`);
});
