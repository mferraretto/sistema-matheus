const isProd = (() => {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    return host && host !== 'localhost' && host !== '127.0.0.1';
  }
  if (typeof process !== 'undefined' && process.env.NODE_ENV) {
    return process.env.NODE_ENV === 'production';
  }
  return false;
})();

const logger = {
  log: (...args) => {
    if (!isProd) console.log(...args);
  },
  warn: (...args) => {
    if (!isProd) console.warn(...args);
  },
};

if (isProd) {
  console.log = () => {};
  console.warn = () => {};
}

export default logger;
