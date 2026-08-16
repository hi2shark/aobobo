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
  const axiosConfig = { ...config };
  if (!axiosConfig.method && axiosConfig.type) {
    axiosConfig.method = axiosConfig.type;
  }
  delete axiosConfig.type;
  return new Promise((resolve, reject) => {
    requestQueue.push({ config: axiosConfig, resolve, reject });
    processQueue();
  });
}

export default request;
