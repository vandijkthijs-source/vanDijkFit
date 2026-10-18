module.exports = function (api) {
  api.cache(true);

  return {
    presets: [
      [
        "babel-preset-expo",
        {
          web: {
            // Metro serves its web output as a classic script. Zustand's ESM
            // middleware uses import.meta, so transform it to Expo's registry.
            unstable_transformImportMeta: true,
          },
        },
      ],
    ],
  };
};
