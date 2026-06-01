const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');

const defaultConfig = getDefaultConfig(__dirname);

const config = {
  resolver: {
    // We take all the default extensions and safely add our AI binary formats
    assetExts: [...defaultConfig.resolver.assetExts, 'tflite', 'task'],
  },
};

module.exports = mergeConfig(defaultConfig, config);