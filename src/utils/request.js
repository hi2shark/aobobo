import axios from 'axios';

const requestQueue = [];
let concurrentCount = 0;
const MAX_CONCURRENT = 10;

function processQueue() {
  if (concurrentCount >= MAX_CONCURRENT || requestQueue.length === 0) return;
  const { config, resolve, reject } = requestQueue.shift();
  concurrentCount += 1;
  axios(config)
    .then((res) => {
      concurrentCount -= 1;
      resolve(res);
      processQueue();
    })
    .catch((err) => {
      concurrentCount -= 1;
      reject(err);
      processQueue();
    });
}

function request(config) {
  return new Promise((resolve, reject) => {
    requestQueue.push({ config, resolve, reject });
    processQueue();
  });
}

export default request;
