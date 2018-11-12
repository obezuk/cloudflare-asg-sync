'use strict';

require('dotenv').config();

const AWS = require('aws-sdk');
const REQUEST = require('request-promise-native');
const lib = require('./lib.js');
const CF = require('./cf.js')(REQUEST, process.env.CLOUDFLARE_EMAIL, process.env.CLOUDFLARE_TOKEN);

module.exports.processAutoscalingEvent = async function(event, context) {
  await lib.processAutoscalingEvent(event, AWS, CF);
}