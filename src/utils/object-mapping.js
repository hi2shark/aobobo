const Mapping = {
  mapping(obj, path) {
    if (!obj || !path) return undefined;
    const keys = path.split('.');
    let result = obj;
    for (let i = 0; i < keys.length; i += 1) {
      if (result === null || result === undefined) return undefined;
      result = result[keys[i]];
    }
    return result;
  },

  each(maps, obj) {
    const result = {};
    Object.keys(maps).forEach((key) => {
      const path = maps[key];
      if (path === undefined) return;
      result[key] = this.mapping(obj, path);
    });
    return result;
  },
};

export default Mapping;
export { Mapping };
