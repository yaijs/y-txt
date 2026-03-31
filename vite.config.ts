import { defineConfig } from 'vite';

const keystoneFlavor = process.env.YTXT_KEYSTONE_FLAVOR || 'dev';

function keystoneHostForFlavor(flavor: string): string {
  if (flavor === 'prod') return 'com.ytxt.keystone';
  if (flavor === 'beta') return 'com.ytxt.keystone.beta';
  return 'com.ytxt.keystone.dev';
}

function extensionNameForFlavor(flavor: string): string {
  if (flavor === 'prod') return 'Y/TXT';
  if (flavor === 'beta') return 'Y/TXT Beta';
  return 'Y/TXT Dev';
}

export default defineConfig({
  define: {
    __YTXT_KEYSTONE_HOST__: JSON.stringify(keystoneHostForFlavor(keystoneFlavor)),
    __YTXT_EXTENSION_NAME__: JSON.stringify(extensionNameForFlavor(keystoneFlavor)),
  },
  build: {
    rollupOptions: {
      input: {
        popup: 'popup.html',
        sidepanel: 'sidepanel.html',
        options: 'options.html',
        background: 'src/background/index.ts',
      },
      output: {
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
  },
});
