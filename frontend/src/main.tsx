import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import App from "./App";
import HomeTilesPage from "./pages/HomeTilesPage.tsx";
import DocumentPage from "./pages/DocumentPage.tsx";
import DepartmentPage from "./pages/DepartmentPage.tsx";
import CollectionPage from "./pages/CollectionsPage.tsx";
import DocumentsList from "./pages/DocumentsList";
import DocumentRequirements from "./pages/DocumentRequirements";

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
        {index: true, element: <HomeTilesPage />},
        {path: "documents", element: <DocumentsList />},
        {path: "documents/:id", element: <DocumentPage />},
        {path: "documents/:id/requirements", element: <DocumentRequirements />},
        {path: "departments/:id", element: <DepartmentPage />},
        {path: "collections/:slug", element: <CollectionPage />},
      ],
  },
]);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);
