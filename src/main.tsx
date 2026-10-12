import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { isNativeApp } from './native/platform';
import { initializeNativeChrome } from './native/chrome';
import { installNativeBack } from './native/back';

async function start() {
  if (isNativeApp()) {
    await import('./native/fonts.css');
    await initializeNativeChrome();
    await installNativeBack();
  }
  createRoot(document.getElementById("root")!).render(<App />);
}
void start();
