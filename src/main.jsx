import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./styles.css";

// Block iOS Safari pinch / double-tap page zoom (88e0da0).
const block = (e) => e.preventDefault();
document.addEventListener("gesturestart", block, { passive: false });
document.addEventListener("gesturechange", block, { passive: false });
document.addEventListener("gestureend", block, { passive: false });
let lastTap = 0;
document.addEventListener("touchend", (e) => {
  const now = Date.now();
  if (now - lastTap <= 300) e.preventDefault();
  lastTap = now;
}, { passive: false });

createRoot(document.getElementById("root")).render(<App />);
