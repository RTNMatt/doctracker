


import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";

import { AuthProvider } from "./context/AuthContext";
import RequireAuth, { PublicOnly } from "./components/RequireAuth";

import HomeTilesPage from "./pages/HomeTilesPage";
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
import NewCollectionPage from "./pages/NewCollectionPage";
import CreateContentPage from "./pages/CreateContentPage";
import UserProfilePage from "./pages/UserProfilePage";

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

      { path: "create", element: <CreateContentPage /> },
      { path: "documents/new", element: <NewDocumentPage /> },
      { path: "documents/:id", element: <DocumentPage /> },

      { path: "departments", element: <DepartmentsListPage /> },
      { path: "departments/:slug", element: <DepartmentPage /> },

      { path: "collections", element: <CollectionsListPage /> },
      { path: "collections/new", element: <NewCollectionPage /> },
      { path: "collections/:slug", element: <CollectionsPage /> },

      { path: "profile", element: <UserProfilePage /> },
      { path: "profiles/:userId", element: <UserProfilePage /> },
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