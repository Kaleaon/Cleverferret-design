// Centralized support runtime re-export from @ktheme/react/support
"use strict";
if (typeof module !== "undefined" && module.exports) {
  module.exports = require("@ktheme/react/support");
} else if (typeof window !== "undefined") {
  window.KthemeSupport = window.KthemeSupport || {
    version: "1.0.0",
    centralized: true,
  };
}
