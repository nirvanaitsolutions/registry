const chalk = require('chalk');
const _ = require('lodash');
const express = require('express');
const Promise = require('bluebird');
const client = require('./helpers/client');
const redis = require('./helpers/redis');

const app = express();
const port = process.env.PORT || 4000;
const server = app.listen(port, () => console.log(chalk.blue(`Listening on ${port}`)));
const blocks = [];

redis.getAsync('block_height').then((blockHeight) => {
  const from = blockHeight ? parseInt(blockHeight) + 1 : 20000000;
  console.log(chalk.blue(`Last loaded block was ${blockHeight}`));

  const stream = client.blockchain.getBlockStream({ from });
  stream.on('data', (block) => {
    blocks.push(block);
  }).on('end', () => {
    console.log(chalk.yellow('Stream ended'));
  });

  nextBlock();
}).catch((err) => {
  console.error("Failed to get 'block_height' from Redis", err);
});

const nextBlock = () => {
  if (blocks[0]) {
    handleBlock(blocks[0]).then(() => {
      // redis.setAsync('block_height', blockNum).then(() => {
        blocks.shift();
        nextBlock();
      // });
    });
  } else {
    Promise.delay(100).then(() => {
      nextBlock();
    })
  }
};

const handleBlock = async (block) => {
  const blockNum = _.has(block, 'transactions[0].block_num')
    ? block.transactions[0].block_num : 0;
  console.log(chalk.blue(`Loaded block ${blockNum} (${block.timestamp})`));

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

  await Promise.delay(100);
  console.log(`Block ${blockNum} been handled`);
  return;
};
