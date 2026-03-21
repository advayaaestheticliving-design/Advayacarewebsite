import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./styles/tailwind.css";
import App from "./App";
import { MemberSessionProvider } from "./context/MemberSessionContext";

const rootElement = document.getElementById("root");

if (!rootElement) {
  console.error("Root element with id 'root' not found in index.html");
} else {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      {/* Use Vite's base path so routing works under GitHub Pages project subpath */}
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <MemberSessionProvider>
          <App />
        </MemberSessionProvider>
      </BrowserRouter>
    </React.StrictMode>
  );
}
