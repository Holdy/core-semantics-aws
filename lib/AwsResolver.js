'use strict';

let {semprop, registerResolver} = require('core-semantics');
let AWS;
let options;

let cached = {};

function prepareAWSSDK(options) {
    if (!AWS) {
        AWS = require('aws-sdk');

        var credentials = new AWS.SharedIniFileCredentials({ profile: options.profile });
        AWS.config.credentials = credentials;
    }
    return AWS;
}

function AwsResolver(options_profile_region) {
    options = options_profile_region;
    registerResolver(this);
}

AwsResolver.prototype.resolveAsync = async function (subject, relationship) {

    if (isEquivalent(relationship, semprop.tech.publicIpAddress)) {
        return getPublicIpAddressForAsync(subject);
    } else {
        throw new error(`Relationship ${relationship} not supported.`);
    }
};

async function getPublicIpAddressForAsync(instanceId) {

    let result = []; 
    if (!cached.ipAddressList) {
        cached.ipAddressList = await describeAddressesAsync();
    }

    cached.ipAddressList.forEach(address => {
        if (address.InstanceId === instanceId && address.PublicIp) {
            result.push(address.PublicIp);
        }
    });

    return result;
}

async function describeAddressesAsync() {
    let AWS = prepareAWSSDK(options);
    let client = new AWS.EC2({ region: options.region });

    let results = [];

    return new Promise((resolve, reject) => {
        runPagedQueryRecursive(client.describeAddresses.bind(client), {}, (err, data) => {
            if (err) {
                reject(err);
            } else if (data) {
                data.Addresses.forEach(item => {
                    results.push(item); 
                });
            } else {
                resolve(results);
            }
        });
    });

}

function isEquivalent(a, b) {
    return a === b;
}

function runPagedQueryRecursive(optionsCallbackFunction, options, resultCallback) {
    optionsCallbackFunction(options, (err, data) => {
        if (err) {
            return resultCallback(err, null);
        } else {
            resultCallback(null, data);
        }

        if (!data.NextToken) {
            return resultCallback(null, null);
        } else {
            options.NextToken = data.NextToken;
            runPagedQueryRecursive(optionsCallbackFunction, options, resultCallback);
        }
    });
}

module.exports = AwsResolver;