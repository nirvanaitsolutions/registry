const chalk = require('chalk');
const express = require('express');
const Promise = require('bluebird');
const client = require('./helpers/client');
const redis = require('./helpers/redis');

const app = express();
const port = process.env.PORT || 4000;
const server = app.listen(port, () => console.log(chalk.blue(`Listening on ${port}`)));
const blocks = [];

const start = () => {
  redis.getAsync('block_height').then((blockHeight) => {
    const from = blockHeight ? parseInt(blockHeight) + 1 : 20000000;
    console.log(chalk.blue(`Last loaded block was ${blockHeight}`));

    const stream = client.blockchain.getBlockStream({ from });
    stream.on('data', (block) => {
      blocks.push(block);
    }).on('end', () => {
      console.log(chalk.yellow('Stream ended'));
    });

    handleNextBlock();
  }).catch((err) => {
    console.error("Failed to get 'block_height' on Redis", err);
  });
};

const handleNextBlock = () => {
  if (blocks[0]) {
    handleBlock(blocks[0]).then((blockNum) => {
      redis.setAsync('block_height', blockNum).then(() => {
        console.log(`Block ${blockNum} been handled`);
        blocks.shift();
        handleNextBlock();
      });
    }).catch((err) => {
      console.error("Failed to set 'block_height' on Redis", err);
    });
  } else {
    Promise.delay(100).then(() => {
      handleNextBlock();
    });
  }
};

const handleBlock = async (block) => {
  const blockNum = Number.parseInt(block.block_id.slice(0, 8), 16);
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
  return blockNum;
};

start();
