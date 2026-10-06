import React from 'react';
import { Routes, Route } from 'react-router-dom';
import DashboardLayout from './components/layout/DashboardLayout';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import RawMaterials from './pages/RawMaterials';
import StockTransactions from './pages/StockTransactions';
import Purchases from './pages/Purchases';
import Suppliers from './pages/Suppliers';
import Reports from './pages/Reports';
import Users from './pages/Users';
import Products from './pages/Products';
import Settings from './pages/Settings';
import SalesImport from './pages/SalesImport';
import Analytics from './pages/Analytics';
import ErrorBoundary from './components/ErrorBoundary';
import { SessionTimeoutProvider } from './context/SessionTimeoutContext';
import SessionTimeoutModal from './components/common/SessionTimeoutModal';

function App() {
  return (
    <ErrorBoundary>
      <SessionTimeoutProvider>
        <SessionTimeoutModal />
        <Routes>
        <Route path="/login" element={<Login />} />

      <Route
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/materials" element={<RawMaterials />} />
        <Route path="/products" element={<Products />} />
        <Route path="/analytics" element={<ProtectedRoute capability="viewReports"><Analytics /></ProtectedRoute>} />
        <Route path="/transactions" element={<StockTransactions />} />
        <Route path="/transactions/cash-grv"       element={<StockTransactions defaultVoucher="cash_grv" />} />
        <Route path="/transactions/credit-grv"     element={<StockTransactions defaultVoucher="credit_grv" />} />
        <Route path="/transactions/fresh-bazaar"   element={<StockTransactions defaultVoucher="fresh_bazaar" />} />
        <Route path="/transactions/pos-adjustment" element={<StockTransactions defaultVoucher="pos_adjustment" />} />
        <Route path="/transactions/disposal"       element={<StockTransactions defaultVoucher="disposal" />} />
        <Route path="/transactions/neg-adjustment" element={<StockTransactions defaultVoucher="neg_adjustment" />} />
        <Route path="/sales-import" element={<SalesImport />} />
        <Route
          path="/purchases"
          element={
            <ProtectedRoute capability="recordGoods">
              <Purchases />
            </ProtectedRoute>
          }
        />
        <Route
          path="/suppliers"
          element={
            <ProtectedRoute roles={['admin', 'manager']}>
              <Suppliers />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports"
          element={
            <ProtectedRoute capability="viewReports">
              <Reports />
            </ProtectedRoute>
          }
        />
        <Route path="/reports/summary"        element={<ProtectedRoute capability="viewReports"><Reports defaultTab="summary"        /></ProtectedRoute>} />
        <Route path="/reports/stock-balance"  element={<ProtectedRoute capability="viewReports"><Reports defaultTab="stock_balance"  /></ProtectedRoute>} />
        <Route path="/reports/inventory-count" element={<ProtectedRoute capability="viewReports"><Reports defaultTab="inventory_count" /></ProtectedRoute>} />
        <Route path="/reports/daily"          element={<ProtectedRoute capability="viewReports"><Reports defaultTab="daily"          /></ProtectedRoute>} />
        <Route path="/reports/cash-grv"       element={<ProtectedRoute capability="viewReports"><Reports defaultTab="cash_grv"       /></ProtectedRoute>} />
        <Route path="/reports/credit-grv"     element={<ProtectedRoute capability="viewReports"><Reports defaultTab="credit_grv"     /></ProtectedRoute>} />
        <Route path="/reports/fresh-bazaar"   element={<ProtectedRoute capability="viewReports"><Reports defaultTab="fresh_bazaar"   /></ProtectedRoute>} />
        <Route path="/reports/pos-adjustment" element={<ProtectedRoute capability="viewReports"><Reports defaultTab="pos_adjustment" /></ProtectedRoute>} />
        <Route path="/reports/disposal"       element={<ProtectedRoute capability="viewReports"><Reports defaultTab="disposal"       /></ProtectedRoute>} />
        <Route path="/reports/neg-adjustment" element={<ProtectedRoute capability="viewReports"><Reports defaultTab="neg_adjustment" /></ProtectedRoute>} />
        <Route path="/reports/stock-levels"   element={<ProtectedRoute capability="viewReports"><Reports defaultTab="stock"         /></ProtectedRoute>} />
        <Route path="/reports/purchases"      element={<ProtectedRoute capability="viewReports"><Reports defaultTab="purchases"      /></ProtectedRoute>} />
        <Route
          path="/users"
          element={
            <ProtectedRoute capability="manageAccounts">
              <Users />
            </ProtectedRoute>
          }
        />
        <Route path="/settings" element={<Settings />} />
        <Route path="/profile" element={<Settings />} />
      </Route>
    </Routes>
    </SessionTimeoutProvider>
    </ErrorBoundary>
  );
}

export default App;
