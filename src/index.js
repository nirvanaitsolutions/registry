const Promise = require('bluebird');
const client = require('./helpers/client');

const username = process.env.STEEM_USERNAME;

/** Work to do before streaming the chain */
const init = () => {
  return new Promise((resolve, reject) => {
    client.database.call('get_following', [username, undefined, undefined, 100]).then(res => {
      // console.log('Following', res);
      resolve();
    });
  });
};

/** Work to do at each new irreversible block */
const work = (block, blockNum) => {
  return new Promise((resolve, reject) => {
    block.transactions.forEach((tx) => {
      tx.operations.forEach((op) => {
        switch (op[0]) {
          case 'account_update': {
            console.log(op[1].json_metadata);
            break;
          }
        }
      })
    });
    console.log(`Loaded block ${blockNum} (${block.timestamp})`);
    resolve();
  });
};

module.exports = {
  init,
  work,
};
