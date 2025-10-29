import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import App from "./App";
import DocumentsList from "./pages/DocumentsList";
import DocumentRequirements from "./pages/DocumentRequirements";

const router = createBrowserRouter([
  { path: "/", element: <App /> },
  { path: "/documents", element: <DocumentsList /> },
  { path: "/documents/:id/requirements", element: <DocumentRequirements /> },
]);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);
