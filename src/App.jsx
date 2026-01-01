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
import UnitsListPage from "./components/units/UnitsListPage";
import DebtsMasterDetailPage from "./components/debts/DebtsMasterDetailPage";
import DebtAllocationsPage from "./components/debts/DebtAllocationsPage";
import TransactionAllocationsPage from "./components/transactions/TransactionAllocationsPage";
import DocumentsPage from "./components/documents/DocumentsPage";


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
          <Route path="/units" element={<UnitsListPage />} />
          <Route path="/item-categories" element={<ItemCategoriesListPage />} />
          <Route path="/items" element={<ItemsListPage />} />
          <Route path="/projects" element={<ProjectsListPage />} />
          <Route path="/debts" element={<DebtsMasterDetailPage />} />
          <Route path="/transactions" element={<TransactionsListPage />} />

          <Route path="/debts/:debtId/allocations" element={<DebtAllocationsPage />} />
          <Route path="/transactions/:transactionId/allocations" element={<TransactionAllocationsPage />} />
          <Route path="/debts/:debtId/documents" element={<DocumentsPage ownerType="debt" />} />
          <Route path="/transactions/:transactionId/documents" element={<DocumentsPage ownerType="transaction" />} />
        </Route>
      </Routes>
    </>
  );
}
