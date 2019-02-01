const express = require('express');
const Promise = require('bluebird');
const { init, work } = require('./src/index');
const client = require('./helpers/client');
const redis = require('./helpers/redis');

const app = express();
const port = process.env.PORT || 4000;
const server = app.listen(port, () => console.log(`Listening on ${port}`));

let lastIrreversibleBlockNum = 0;
const stream = setInterval(() => {
  client.database.getDynamicGlobalProperties().then(props => {
    lastIrreversibleBlockNum = parseInt(props.last_irreversible_block_num);
  });
}, 3000);

const start = () => {
  init().then(() => {
    redis.getAsync('block_height').then(blockHeight => {
      console.log(`Last loaded block was ${blockHeight}`);
      const nextBlockNum = blockHeight ? parseInt(blockHeight) + 1 : 1;
      handleBlock(nextBlockNum);
    }).catch((err) => {
      console.error("Failed to get 'block_height' on Redis", err);
    });
  });
};

const handleBlock = (blockNum) => {
  if (lastIrreversibleBlockNum >= blockNum) {
    client.database.getBlock(blockNum).then(block => {
      work(block, blockNum).then(() => {
        redis.setAsync('block_height', blockNum).then(() => {
          console.log(`New block height is ${blockNum} ${block.timestamp}`);
          handleBlock(blockNum + 1);
        }).catch((err) => {
          console.error("Failed to set 'block_height' on Redis", err);
          handleBlock(blockNum);
        });
      });
    }).catch(err => {
      console.error(`Request 'getBlock' failed at block num: ${blockNum}, retry`, err);
      handleBlock(blockNum);
    });
  } else {
    Promise.delay(100).then(() => {
      handleBlock(blockNum);
    });
  }
};

start();
