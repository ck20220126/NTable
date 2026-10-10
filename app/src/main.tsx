import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";
import "./overrides.css";

const mountRoot = document.getElementById("root");
if (!mountRoot) throw new Error("NTable demo requires a #root mount element");

createRoot(mountRoot).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

