// Importing this module registers every built-in entity definition.
import "./text.js";
import "./caption.js";
import "./equation.js";
import "./shapes.js";
import "./polygon.js";
import "./counter.js";
import "./strokes.js";

export { layoutTextLines, textBounds } from "./text.js";
export { captionWords } from "./caption.js";
export { equationBounds } from "./equation.js";
export { counterText } from "./counter.js";
