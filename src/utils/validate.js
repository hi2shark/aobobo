const validate = {
  isEmpty(val) {
    return val === '' || val === null || val === undefined;
  },
  isSet(val) {
    return val !== null && val !== undefined;
  },
  isArray(val) {
    return Array.isArray(val);
  },
  isObject(val) {
    return typeof val === 'object' && val !== null && !Array.isArray(val);
  },
  isNumber(val) {
    return typeof val === 'number' && !Number.isNaN(val);
  },
  isString(val) {
    return typeof val === 'string';
  },
};

export default validate;
