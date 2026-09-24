/* Landing page: the Asia Conference globe and the footer year. */
import { initGlobe } from "./globe.js";
import { $ } from "./util.js";

const fy = $("foot-year");
if (fy) fy.textContent = String(new Date().getFullYear());

initGlobe();
