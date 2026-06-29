function idOf(document) {
  return document?._id == null ? undefined : String(document._id);
}

function mapToObject(value) {
  if (!value) {
    return {};
  }
  if (value instanceof Map) {
    return Object.fromEntries(value.entries());
  }
  return { ...value };
}

module.exports = {
  idOf,
  mapToObject,
};
