const { createEventAdapter } = require('@slack/events-api');
const { WebClient } = require('@slack/web-api');
const { MongoClient } = require('mongodb');

const token = process.env.OAUTH_TOKEN;
const slackSigningSecret = process.env.SLACK_SIGNING_SECRET;
const mongoPass = process.env.MONGOPASS;
const port = process.env.PORT || 3000;
const uri = `mongodb+srv://databaseuser:${mongoPass}@cluster0-bm9vw.mongodb.net/test?retryWrites=true&w=majority`;

const slackEvents = createEventAdapter(slackSigningSecret);
const web = new WebClient(token);
const dbClient = new MongoClient(uri, { useNewUrlParser: true });

dbClient.connect(err => {
	const collection = dbClient.db('test').collection('devices');
	// perform actions on the collection object
	dbClient.close();
});

slackEvents.on('message', async event => {
	console.log(`Received a message event: user ${event.user} in channel ${event.channel} says ${event.text}`);

	if (/@pointsrus leaderboard/i.exec(event.text)) {
		const result = await web.chat.postMessage({
			text: 'This should output a leaderboard',
			channel: event.channel,
		});

		console.log(`Successfully send message ${result.ts} in conversation ${event.channel}`);
	}
});

slackEvents.on('error', console.error);

slackEvents.start(port).then(() => {
	console.log(`server listening on port ${port}`);
});
