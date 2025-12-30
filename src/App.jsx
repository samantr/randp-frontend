import React from "react";
import { Routes, Route, Outlet } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import ProtectedRoute from "./components/ProtectedRoute";
import LoginPage from "./pages/login/LoginPage";
import AppShell from "./layout/AppShell";
import TransactionsListPage from "./components/transactions/TransactionsListPage";


import PersonsListPage from "./components/persons/PersonsListPage";
import ItemCategoriesListPage from "./components/itemCategories/ItemCategoriesListPage";
import ItemsListPage from "./components/items/ItemsListPage";
import ProjectsListPage from "./components/projects/ProjectsListPage";

function AppLayout() {
  return (
    <ProtectedRoute>
      <AppShell>
        <Outlet />
      </AppShell>
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <>
      <Toaster position="top-center" />
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route element={<AppLayout />}>
          <Route path="/" element={<div className="text-sm text-zinc-700">داشبورد (به زودی)</div>} />
          <Route path="/persons" element={<PersonsListPage />} />
          <Route path="/item-categories" element={<ItemCategoriesListPage />} />
          <Route path="/items" element={<ItemsListPage />} />
          <Route path="/projects" element={<ProjectsListPage />} />
          <Route path="/transactions" element={<TransactionsListPage />} />

        </Route>
      </Routes>
    </>
  );
}
