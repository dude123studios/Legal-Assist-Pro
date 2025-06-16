import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path'; // Node.js 'path' module for resolving file paths

// Export the Vite configuration
export default defineConfig({
  // Use the React plugin for Vite, which enables React Fast Refresh and JSX transformation
  plugins: [react()],

  // Build-specific configurations
  build: {
    // The output directory for the compiled and bundled files
    outDir: 'dist',
    // Clean the output directory before each build to ensure a fresh build
    emptyOutDir: true,
    // Generate sourcemaps for easier debugging in the browser's developer tools
    sourcemap: true,
    // Prevent Vite from inlining assets (like small images or fonts) into the JavaScript bundle.
    // This is often important for Chrome Extensions to ensure all assets are separate files
    // and can be referenced correctly by the manifest.json or other extension scripts.
    assetsInlineLimit: 0,

    // Rollup-specific options, as Vite uses Rollup internally for production builds
    rollupOptions: {
      // Define the entry points for your extension.
      // Each entry point will result in a separate JavaScript bundle.
      input: {
        // The main HTML file for the extension's popup UI.
        // This will be processed by Vite, and its associated JavaScript (src/main.tsx) will be bundled.
        popup: resolve(__dirname, 'index.html'),
        // The background service worker script.
        // This needs to be a separate, non-hashed file as referenced in manifest.json.
        background: resolve(__dirname, 'src/background.ts'),
        // The content script that interacts with web pages.
        // This also needs to be a separate, non-hashed file as referenced in manifest.json.
        contentScript: resolve(__dirname, 'src/contentScript.ts'),
      },
      // Define how the bundled output files are named and where they are placed within the 'outDir'.
      output: {
        // Custom naming function for JavaScript entry files (bundles created from 'input').
        entryFileNames: (chunkInfo) => {
          // If the chunk name is 'background' or 'contentScript', place it directly in the 'dist' root
          // with its original name (e.g., 'background.js', 'contentScript.js').
          if (chunkInfo.name === 'background' || chunkInfo.name === 'contentScript') {
            return '[name].js';
          }
          // For all other JavaScript entry chunks (e.g., the main bundle for the popup),
          // place them in an 'assets' subfolder and include a hash for cache busting.
          return 'assets/[name]-[hash].js';
        },
        // Custom naming function for other assets (like CSS, images, JSON files).
        assetFileNames: (assetInfo) => {
          // Place 'manifest.json' and 'icon.png' directly in the 'dist' root
          // as they are referenced there by Chrome.
          if (assetInfo.name === 'manifest.json' || assetInfo.name === 'icon.png') {
            return '[name].[ext]';
          }
          // For all other assets (e.g., CSS files, other images), place them in an 'assets' subfolder
          // and include a hash for cache busting.
          return 'assets/[name]-[hash].[ext]';
        },
        // Custom naming function for shared chunks (code that is used by multiple entry points).
        // These will also be placed in the 'assets' subfolder with a hash.
        chunkFileNames: 'assets/[name]-[hash].js',
      },
    },
  },
});