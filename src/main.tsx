import { createRoot } from "react-dom/client";
import "../brand/tokens/tokens.css";
import "../styles.css";
import { App } from "./App";

createRoot(document.getElementById("root")!).render(<App />);
