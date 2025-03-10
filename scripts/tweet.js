const { TwitterApi } = require('twitter-api-v2');
const fs = require('fs');
const dotenv = require('dotenv');
const { exit } = require('process');

dotenv.config();

// Load Twitter API credentials from .env file
const client = new TwitterApi({
  appKey: process.env.TWITTER_API_KEY,
  appSecret: process.env.TWITTER_API_SECRET,
  accessToken: process.env.TWITTER_ACCESS_TOKEN,
  accessSecret: process.env.TWITTER_ACCESS_SECRET,
});

async function postTweet(tweetText) {
  try {
    const tweet = await client.v2.tweet({
      text: tweetText
    });
    console.log('Tweet posted:', tweet);
  } catch (error) {
    console.error('Error posting tweet:', error);
    exit(1)
  }
}
