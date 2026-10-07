/**
 * Copyright 2018 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// If the loader is already loaded, just stop.
if (!self.define) {
  let registry = {};

  // Used for `eval` and `importScripts` where we can't get script URL by other means.
  // In both cases, it's safe to use a global var because those functions are synchronous.
  let nextDefineUri;

  const singleRequire = (uri, parentUri) => {
    uri = new URL(uri + ".js", parentUri).href;
    return registry[uri] || (
      
        new Promise(resolve => {
          if ("document" in self) {
            const script = document.createElement("script");
            script.src = uri;
            script.onload = resolve;
            document.head.appendChild(script);
          } else {
            nextDefineUri = uri;
            importScripts(uri);
            resolve();
          }
        })
      
      .then(() => {
        let promise = registry[uri];
        if (!promise) {
          throw new Error(`Module ${uri} didn’t register its module`);
        }
        return promise;
      })
    );
  };

  self.define = (depsNames, factory) => {
    const uri = nextDefineUri || ("document" in self ? document.currentScript.src : "") || location.href;
    if (registry[uri]) {
      // Module is already loading or loaded.
      return;
    }
    let exports = {};
    const require = depUri => singleRequire(depUri, uri);
    const specialDeps = {
      module: { uri },
      exports,
      require
    };
    registry[uri] = Promise.all(depsNames.map(
      depName => specialDeps[depName] || require(depName)
    )).then(deps => {
      factory(...deps);
      return exports;
    });
  };
}
define(['./workbox-afac4cd2'], (function (workbox) { 'use strict';

  self.skipWaiting();
  workbox.clientsClaim();
  /**
   * The precacheAndRoute() method efficiently caches and responds to
   * requests for URLs in the manifest.
   * See https://goo.gl/S9QRab
   */
  workbox.precacheAndRoute([{
    "url": "registerSW.js",
    "revision": "402b66900e731ca748771b6fc5e7a068"
  }, {
    "url": "pwa-maskable-512x512.png",
    "revision": "b87f2823667ffab2be20eb077edd434d"
  }, {
    "url": "pwa-512x512.png",
    "revision": "049b162b6e58aab189f5855b01a3e465"
  }, {
    "url": "pwa-192x192.png",
    "revision": "e9f561f57314ffa4ed5133b4583e77d8"
  }, {
    "url": "oppo-label-icon.svg",
    "revision": "d664926cf1ce473259883e43f7153152"
  }, {
    "url": "index.html",
    "revision": "c95ac2af1a6cda9bc1891cb2836d9ee9"
  }, {
    "url": "icon.svg",
    "revision": "d664926cf1ce473259883e43f7153152"
  }, {
    "url": "icon.png",
    "revision": "049b162b6e58aab189f5855b01a3e465"
  }, {
    "url": "icon.ico",
    "revision": "77dd51cec7d1f161f3d7c82eae1d53b4"
  }, {
    "url": "favicon.svg",
    "revision": "d664926cf1ce473259883e43f7153152"
  }, {
    "url": "favicon.png",
    "revision": "3b1ba140cacb43b4f3fd8cea3b5d55ae"
  }, {
    "url": "favicon.ico",
    "revision": "77dd51cec7d1f161f3d7c82eae1d53b4"
  }, {
    "url": "apple-touch-icon.png",
    "revision": "2b1d1725c43916bf174f993d62d8a8f9"
  }, {
    "url": "assets/index-DyHwx9hp.css",
    "revision": null
  }, {
    "url": "assets/index-CouIy6bS.js",
    "revision": null
  }, {
    "url": "assets/icon-D2RisZqq.png",
    "revision": null
  }, {
    "url": "apple-touch-icon.png",
    "revision": "2b1d1725c43916bf174f993d62d8a8f9"
  }, {
    "url": "favicon.ico",
    "revision": "77dd51cec7d1f161f3d7c82eae1d53b4"
  }, {
    "url": "favicon.png",
    "revision": "3b1ba140cacb43b4f3fd8cea3b5d55ae"
  }, {
    "url": "icon.png",
    "revision": "049b162b6e58aab189f5855b01a3e465"
  }, {
    "url": "icon.svg",
    "revision": "d664926cf1ce473259883e43f7153152"
  }, {
    "url": "pwa-192x192.png",
    "revision": "e9f561f57314ffa4ed5133b4583e77d8"
  }, {
    "url": "pwa-512x512.png",
    "revision": "049b162b6e58aab189f5855b01a3e465"
  }, {
    "url": "pwa-maskable-512x512.png",
    "revision": "b87f2823667ffab2be20eb077edd434d"
  }, {
    "url": "manifest.webmanifest",
    "revision": "6160193d16d5515aa2f14e780432b6de"
  }], {});
  workbox.cleanupOutdatedCaches();
  workbox.registerRoute(new workbox.NavigationRoute(workbox.createHandlerBoundToURL("index.html")));
  workbox.registerRoute(/^https:\/\/fonts\.googleapis\.com\/.*/i, new workbox.CacheFirst({
    "cacheName": "google-fonts-cache",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 10,
      maxAgeSeconds: 31536000
    }), new workbox.CacheableResponsePlugin({
      statuses: [0, 200]
    })]
  }), 'GET');
  workbox.registerRoute(/^https:\/\/fonts\.gstatic\.com\/.*/i, new workbox.CacheFirst({
    "cacheName": "gstatic-fonts-cache",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 10,
      maxAgeSeconds: 31536000
    }), new workbox.CacheableResponsePlugin({
      statuses: [0, 200]
    })]
  }), 'GET');

}));
