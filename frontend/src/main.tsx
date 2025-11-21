


import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";

import { AuthProvider } from "./context/AuthContext";
import RequireAuth, { PublicOnly } from "./components/RequireAuth";

import HomeTilesPage from "./pages/HomeTilesPage";
import DocumentsList from "./pages/DocumentsList";
import DocumentPage from "./pages/DocumentPage";
import SearchResultsPage from "./pages/SearchResultsPage";
import DepartmentsListPage from "./pages/DepartmentsListPage";
import DepartmentPage from "./pages/DepartmentPage";
import CollectionsListPage from "./pages/CollectionsListPage";
import CollectionsPage from "./pages/CollectionsPage";
import LoginPage from "./pages/LoginPage";
import App from "./App";
import NewDocumentPage from "./pages/NewDocumentPage";
import { ThemeProvider } from "./context/ThemeContext";

const router = createBrowserRouter([
  {
    path: "/login",
    element: (
      <PublicOnly>
        <LoginPage />
      </PublicOnly>
    ),
  },
  {
    path: "/",
    element: (
      <RequireAuth>
        <App />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <HomeTilesPage /> },
      { path: "search", element: <SearchResultsPage /> },

      { path: "documents", element: <DocumentsList /> },
      { path: "documents/new", element: <NewDocumentPage /> },
      { path: "documents/:id", element: <DocumentPage /> },

      { path: "departments", element: <DepartmentsListPage /> },
      { path: "departments/:slug", element: <DepartmentPage /> },

      { path: "collections", element: <CollectionsListPage /> },
      { path: "collections/:slug", element: <CollectionsPage /> },
    ],
  },
]);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </ThemeProvider>
  </React.StrictMode>
);