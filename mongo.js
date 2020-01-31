const { createEventAdapter } = require('@slack/events-api');
const { WebClient } = require('@slack/web-api');
const { MongoClient } = require('mongodb');
const { tablize } = require('batteries-not-included/dist/utils/index.js');

const token = process.env.OAUTH_TOKEN;
const slackSigningSecret = process.env.SLACK_SIGNING_SECRET;
const mongoPass = process.env.MONGOPASS;
const port = process.env.PORT || 3000;
const uri = `mongodb+srv://databaseuser:${mongoPass}@cluster0-bm9vw.mongodb.net/test?retryWrites=true&w=majority`;

console.log(uri)

const slackEvents = createEventAdapter(slackSigningSecret);
const web = new WebClient(token);
const dbClient = new MongoClient(uri, { useNewUrlParser: true });

dbClient.connect(err => {
	if (err) console.error(err);
	const collection = dbClient.db('test').collection('scores');

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
		try {
			console.log(`Received a message event: user ${event.user} in channel ${event.channel} says ${event.text}`);

			const { action, word } = getIsPlusOrMinus(event.text);
			if (action) {
				const value = action == 'add' ? 1 : -1;

				const doc = await collection.findOneAndUpdate(
					{ word },
					{ $inc: { count: value } },
					{ returnOriginal: false, upsert: true }
				);

				console.log(doc);

				const result = await web.chat.postMessage({
					text: `${doc.value.word} ${
						action == 'add' ? 'had a point added' : 'had a point removed'
					}. Score is now at: ${doc.value.count}`,
					channel: event.channel,
				});

				console.log(`Successfully send message ${result.ts} in conversation ${event.channel}`);
			}

			if (/@pointsrus leaderboard/i.exec(event.text)) {
				const topTenCollection = await collection
					.find({})
					.sort({ count: 1 })
					.limit(10)
					.toArray();
				const state = topTenCollection.map(doc => {
					return [doc.word, doc.count];
				});
				const tableString = tablize([['Item', 'Count'], ...state]);

				const result = await web.chat.postMessage({
					text: '```\n' + tableString + '```',
					channel: event.channel,
				});

				console.log(`Successfully send message ${result.ts} in conversation ${event.channel}`);
			}
		} catch (e) {
			console.error(e);
		}
	});

	slackEvents.on('error', console.error);

	slackEvents.start(port).then(() => {
		console.log(`server listening on port ${port}`);
	});
});
