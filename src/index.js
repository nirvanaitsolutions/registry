const _ = require('lodash');
const Promise = require('bluebird');
const dsteem = require('dsteem');
const client = require('./helpers/client');

const username = process.env.STEEM_USERNAME;
const privateKey = dsteem.PrivateKey.fromString(process.env.STEEM_WIF);
const following = [];

/** Work to do before streaming the chain */
const init = () => {
  return new Promise(async (resolve, reject) => {
    const step = 100;

    let follows = await client.call('follow_api', 'get_following', [username, '', 'blog', step]);
    let allFollows = follows;

    while (follows.length === step) {
      const startFrom = allFollows[allFollows.length - 1].following;
      follows = await client.call('follow_api', 'get_following', [username, startFrom, 'blog', step]);
      allFollows.push(...follows.slice(1));
    }
    const following = allFollows.map(follow => follow.following);
    console.log('Total following', following.length, following);

    resolve();
  });
};

/** Work to do at each new irreversible block */
const work = (block, blockNum) => {
  const promises = [];
  return new Promise((resolve, reject) => {
    block.transactions.forEach((tx) => {
      tx.operations.forEach((op) => {
        switch (op[0]) {
          case 'account_update': {
            let metadata = {};
            try {
              metadata = JSON.parse(op[1].json_metadata);
            } catch (err) {}
            if (
              !following.includes(op[1].account)
              && _.has(metadata, 'profile.type')
              && metadata.profile.type === 'app'
            ) {
              console.log('Follow account', op[1].account);
              promises.push(followAccount(op[1].account));
              following.push(op[1].account);
            } else if (following.includes(op[1].account)) {
              console.log('Unfollow account', op[1].account);
              promises.push(followAccount(op[1].account, []));
              following.splice(following.indexOf(op[1].account), 1);
            }
            break;
          }
        }
      })
    });
    Promise.each(promises, (promise) => {
      return promise;
    }).then(() => {
      console.log(`Work done on block ${blockNum}`, promises.length);
      resolve();
    });
  });
};

const followAccount = (following, what = ['blog']) => {
  const json = JSON.stringify(['follow', { follower: username, following, what }]);
  const data = {
    id: 'follow',
    json,
    required_auths: [],
    required_posting_auths: [username],
  };
  return client.broadcast.json(data, privateKey);
};

module.exports = {
  init,
  work,
};
